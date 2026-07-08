'use strict';

const { verifyToken } = require('nxt-auth');
const { safeString, getMonthBoundaries } = require('nxt-commission-month');
const {
  buildExceptionWhere,
  buildHandleWhere,
  pickPrimaryException,
  labelForException
} = require('nxt-order-exception');

function safeNumber(value) {
  return value === undefined || value === null || isNaN(value) ? 0 : Number(value);
}

function normalizeHandleStatus(raw) {
  const s = safeString(raw);
  if (!s || s === 'pending') return 'pending';
  return s;
}

function handleStatusText(raw) {
  const s = normalizeHandleStatus(raw);
  const m = { pending: '待处理', processing: '跟进中', done: '已处理', closed: '已关闭' };
  return m[s] || s || '待处理';
}

async function loadLatestExceptionRemarkMap(db, orderIds) {
  const map = {};
  if (!orderIds.length) return map;
  const _ = db.command;
  const batch = 40;
  for (let i = 0; i < orderIds.length; i += batch) {
    const slice = orderIds.slice(i, i + batch);
    const res = await db
      .collection('member_order_remark')
      .where({
        order_id: _.in(slice),
        remark_type: 'exception'
      })
      .limit(800)
      .get();
    const rows = res.data || [];
    const best = {};
    for (const r of rows) {
      const oid = safeString(r.order_id);
      if (!oid) continue;
      const t = r.created_at ? new Date(r.created_at).getTime() : 0;
      if (!best[oid] || t > best[oid].t) {
        best[oid] = { t, text: safeString(r.remark_content) };
      }
    }
    for (const oid of Object.keys(best)) {
      if (map[oid] === undefined) map[oid] = best[oid].text;
    }
  }
  return map;
}

/** 每条订单最新一条 system / followup（用于列表摘要兜底） */
async function loadLatestSystemFollowupMap(db, orderIds) {
  const map = {};
  if (!orderIds.length) return map;
  const _ = db.command;
  const batch = 40;
  for (let i = 0; i < orderIds.length; i += batch) {
    const slice = orderIds.slice(i, i + batch);
    const res = await db
      .collection('member_order_remark')
      .where({
        order_id: _.in(slice),
        remark_type: _.in(['system', 'followup'])
      })
      .limit(800)
      .get();
    const rows = res.data || [];
    const best = {};
    for (const r of rows) {
      const oid = safeString(r.order_id);
      if (!oid) continue;
      const t = r.created_at ? new Date(r.created_at).getTime() : 0;
      if (!best[oid] || t > best[oid].t) {
        best[oid] = { t, text: safeString(r.remark_content) };
      }
    }
    for (const oid of Object.keys(best)) {
      map[oid] = best[oid].text;
    }
  }
  return map;
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const _ = db.command;

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  const page = Math.max(1, parseInt(event.page, 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(event.pageSize, 10) || 20));

  const exception_type = safeString(event.exception_type);
  const handle_status = safeString(event.handle_status);
  const order_type =
    event.order_type !== undefined && event.order_type !== null && event.order_type !== ''
      ? Number(event.order_type)
      : null;
  const commission_status =
    event.commission_status !== undefined && event.commission_status !== null && event.commission_status !== ''
      ? Number(event.commission_status)
      : null;
  const sales_id = safeString(event.sales_id);
  const channel_id = safeString(event.channel_id);
  const month = safeString(event.month);

  const parts = [buildExceptionWhere(_, exception_type)];

  const hw = buildHandleWhere(_, handle_status);
  if (hw) parts.push(hw);

  if (order_type === 1 || order_type === 2) {
    parts.push({ order_type });
  }

  if (commission_status === 0 || commission_status === 1) {
    parts.push({ commission_status });
  }

  if (sales_id) {
    parts.push({ sales_id });
  }

  if (channel_id) {
    parts.push({ channel_id });
  }

  if (month) {
    const bounds = getMonthBoundaries(month);
    if (!bounds) {
      return { code: 400, message: '月份格式须为 YYYY-MM' };
    }
    parts.push(
      _.or([
        { pay_time: _.gte(bounds.start).and(_.lte(bounds.end)) },
        { pay_time: _.gte(bounds.start.getTime()).and(_.lte(bounds.end.getTime())) }
      ])
    );
  }

  const where = _.and(parts);

  try {
    let total = 0;
    try {
      const countRes = await db.collection('member_order').where(where).count();
      total = countRes.total || 0;
    } catch (e) {
      // 计数超时时降级，优先返回当前页数据
      total = 0;
    }

    const skip = (page - 1) * pageSize;
    const listRes = await db
      .collection('member_order')
      .where(where)
      .field({
        _id: true,
        order_no: true,
        customer_id: true,
        customer_name: true,
        mobile: true,
        order_type: true,
        pay_time: true,
        pay_amount: true,
        commission_amount: true,
        commission_status: true,
        commission_settlement_id: true,
        commission_settlement_month: true,
        handle_status: true,
        handle_result: true,
        followup_uid: true,
        followup_name: true,
        handled_at: true,
        commission_rate: true,
        sales_id: true,
        sales_name: true,
        channel_id: true,
        invite_code: true
      })
      .orderBy('created_at', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    const rows = listRes.data || [];
    const ids = rows.map((r) => safeString(r._id)).filter(Boolean);
    const [remarkMap, sysFollowMap] = await Promise.all([
      loadLatestExceptionRemarkMap(db, ids),
      loadLatestSystemFollowupMap(db, ids)
    ]);

    const list = rows.map((o) => {
      const exCode = pickPrimaryException(o);
      const hid = safeString(o._id);
      const hr = safeString(o.handle_result);
      const sf = sysFollowMap[hid] || '';
      const latest_remark_summary = sf;
      const latest_handle_summary = hr || sf || '';

      return {
        _id: hid,
        order_no: safeString(o.order_no),
        customer_id: safeString(o.customer_id),
        customer_name: safeString(o.customer_name),
        mobile: safeString(o.mobile),
        order_type: o.order_type,
        order_type_text: Number(o.order_type) === 1 ? '首开' : Number(o.order_type) === 2 ? '续费' : '其他',
        pay_time: o.pay_time,
        pay_amount: safeNumber(o.pay_amount),
        commission_amount: safeNumber(o.commission_amount),
        commission_status: o.commission_status,
        commission_status_text: Number(o.commission_status) === 1 ? '已结算' : '未结算',
        commission_settlement_id: safeString(o.commission_settlement_id),
        commission_settlement_month: safeString(o.commission_settlement_month),
        exception_type: exCode,
        exception_type_text: labelForException(exCode),
        handle_status: normalizeHandleStatus(o.handle_status),
        handle_status_text: handleStatusText(o.handle_status),
        handle_result: hr,
        followup_uid: safeString(o.followup_uid),
        followup_name: safeString(o.followup_name),
        handled_at: o.handled_at,
        latest_exception_remark: remarkMap[hid] || '',
        latest_remark_summary,
        latest_handle_summary
      };
    });

    return {
      code: 200,
      message: 'ok',
      data: {
        list,
        total,
        page,
        pageSize
      }
    };
  } catch (e) {
    console.error('[getOrderExceptionList]', e);
    return { code: 500, message: e.message || '查询失败' };
  }
};
