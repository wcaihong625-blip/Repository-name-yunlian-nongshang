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

function formatTs(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(
    d.getHours()
  ).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

async function loadLatestExceptionRemarkMap(db, orderIds) {
  const map = {};
  if (!orderIds.length) return map;
  const _ = db.command;
  const batch = 80;
  for (let i = 0; i < orderIds.length; i += batch) {
    const slice = orderIds.slice(i, i + batch);
    const res = await db
      .collection('member_order_remark')
      .where({
        order_id: _.in(slice),
        remark_type: 'exception'
      })
      .limit(2000)
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
  if (order_type === 1 || order_type === 2) parts.push({ order_type });
  if (commission_status === 0 || commission_status === 1) parts.push({ commission_status });
  if (sales_id) parts.push({ sales_id });
  if (channel_id) parts.push({ channel_id });

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
  const MAX_ROWS = 12000;
  const BATCH = 500;

  try {
    const all = [];
    let skip = 0;
    for (;;) {
      const res = await db
        .collection('member_order')
        .where(where)
        .orderBy('created_at', 'desc')
        .skip(skip)
        .limit(BATCH)
        .get();
      const chunk = res.data || [];
      all.push(...chunk);
      if (chunk.length < BATCH) break;
      skip += BATCH;
      if (all.length >= MAX_ROWS) break;
    }

    const ids = all.map((r) => safeString(r._id)).filter(Boolean);
    const remarkMap = await loadLatestExceptionRemarkMap(db, ids);

    const list = all.map((o) => {
      const hid = safeString(o._id);
      const exCode = pickPrimaryException(o);
      return {
        order_id: hid,
        order_no: safeString(o.order_no),
        customer_id: safeString(o.customer_id),
        customer_name: safeString(o.customer_name),
        mobile: safeString(o.mobile),
        order_type_text: Number(o.order_type) === 1 ? '首开' : Number(o.order_type) === 2 ? '续费' : '其他',
        pay_time: formatTs(o.pay_time),
        pay_amount: safeNumber(o.pay_amount),
        commission_amount: safeNumber(o.commission_amount),
        commission_status_text: Number(o.commission_status) === 1 ? '已结算' : '未结算',
        commission_settlement_id: safeString(o.commission_settlement_id),
        commission_settlement_month: safeString(o.commission_settlement_month),
        exception_type_text: labelForException(exCode),
        handle_status_text: handleStatusText(o.handle_status),
        followup_name: safeString(o.followup_name),
        handled_at: formatTs(o.handled_at),
        handle_result: safeString(o.handle_result),
        latest_exception_remark: remarkMap[hid] || ''
      };
    });

    const headers = [
      'order_id',
      'order_no',
      'customer_id',
      'customer_name',
      'mobile',
      'order_type_text',
      'pay_time',
      'pay_amount',
      'commission_amount',
      'commission_status_text',
      'commission_settlement_id',
      'commission_settlement_month',
      'exception_type_text',
      'handle_status_text',
      'followup_name',
      'handled_at',
      'handle_result',
      'latest_exception_remark'
    ];

    const headers_zh = [
      '订单ID',
      '订单号',
      '客户ID',
      '客户姓名',
      '手机号',
      '订单类型',
      '支付时间',
      '支付金额',
      '提成金额',
      '提成状态',
      '结算单ID',
      '结算月份',
      '异常类型',
      '处理状态',
      '跟进人',
      '最近处理时间',
      '处理结论',
      '最新异常备注'
    ];

    return {
      code: 200,
      message: 'ok',
      data: {
        headers,
        headers_zh,
        list,
        truncated: all.length >= MAX_ROWS
      }
    };
  } catch (e) {
    console.error('[exportOrderExceptionData]', e);
    return { code: 500, message: e.message || '导出失败' };
  }
};
