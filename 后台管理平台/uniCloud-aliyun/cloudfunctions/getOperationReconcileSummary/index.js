'use strict';

/**
 * 运营对账总览聚合（只读）
 *
 * 统计口径说明（摘要区，按所选月份 YYYY-MM，+8 月界与 nxt-commission-month 一致）：
 * - new_customer_count：customer_profile.created_at 落在该月；若带 sales_id 则另加 first_sales_id == sales_id
 * - member_order_count / 首开 / 续费：member_order.order_status==1 且 pay_time 落在该月；可选 sales_id 过滤 sales_id
 * - unsettled_order_count / settled_order_count：同上时间窗 + commission_status
 * - settle_bill_count / commission_amount_total：sales_commission_settle.settle_month == month；可选 sales_id
 *
 * 异常区：全库数据质量扫描（与所选月无关），避免与摘要重复解释成本；订单类异常为全量未结/已结异常笔数。
 */

const { verifyToken } = require('nxt-auth');
const { safeString, getMonthBoundaries } = require('nxt-commission-month');

function dataArrayFromQuery(res) {
  const d = res && res.data;
  if (d == null) return [];
  if (Array.isArray(d)) return d;
  if (typeof d === 'object') return [d];
  return [];
}

/** 与 getCustomerAuditInfo / audit 侧一致 */
function getFinalApplyStatus(doc) {
  if (doc.status !== undefined && doc.status !== null && doc.status !== '') {
    return Number(doc.status);
  }
  if (doc.apply_status !== undefined && doc.apply_status !== null && doc.apply_status !== '') {
    return Number(doc.apply_status);
  }
  return -1;
}

function auditTs(row) {
  const a = row.audit_time;
  if (a !== undefined && a !== null && a !== '') {
    const t = new Date(a).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const c = row.created_at;
  if (c !== undefined && c !== null && c !== '') {
    const t = new Date(c).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

function emptyIdCond(field, _) {
  return _.or([
    { [field]: _.exists(false) },
    { [field]: null },
    { [field]: '' }
  ]);
}

async function countWhere(db, coll, whereObj) {
  const r = await db.collection(coll).where(whereObj).count();
  return r.total || 0;
}

async function loadAllApplies(db, fields) {
  const out = [];
  const batch = 500;
  let skip = 0;
  for (;;) {
    const res = await db
      .collection('customer_transfer_apply')
      .field(fields)
      .skip(skip)
      .limit(batch)
      .get();
    const rows = dataArrayFromQuery(res);
    out.push(...rows);
    if (rows.length < batch) break;
    skip += batch;
    if (skip > 200000) break;
  }
  return out;
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const _ = db.command;

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  let month = safeString(event.month);
  if (!month) {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    month = `${y}-${String(m).padStart(2, '0')}`;
  }

  const bounds = getMonthBoundaries(month);
  if (!bounds) {
    return { code: 400, message: 'month 格式错误，应为 YYYY-MM' };
  }

  const salesId = safeString(event.sales_id);
  const payWindow = _.and([
    { order_status: 1 },
    _.or([
      { pay_time: _.gte(bounds.start).and(_.lte(bounds.end)) },
      { pay_time: _.gte(bounds.start.getTime()).and(_.lte(bounds.end.getTime())) }
    ])
  ]);

  const orderBase = salesId ? _.and([payWindow, { sales_id: salesId }]) : payWindow;

  try {
    const tsStart = bounds.start.getTime();
    const tsEnd = bounds.end.getTime();
    const custCreatedWindow = _.and([
      _.or([
        { created_at: _.gte(bounds.start).and(_.lte(bounds.end)) },
        { created_at: _.gte(tsStart).and(_.lte(tsEnd)) }
      ])
    ]);
    const newCustomerWhere = salesId
      ? _.and([custCreatedWindow, { first_sales_id: salesId }])
      : custCreatedWindow;

    const [
      new_customer_count,
      member_order_count,
      first_open_count,
      renewal_count,
      unsettled_order_count,
      settled_order_count
    ] = await Promise.all([
      countWhere(db, 'customer_profile', newCustomerWhere),
      countWhere(db, 'member_order', orderBase),
      countWhere(db, 'member_order', _.and([orderBase, { order_type: 1 }])),
      countWhere(db, 'member_order', _.and([orderBase, { order_type: 2 }])),
      countWhere(db, 'member_order', _.and([orderBase, { commission_status: 0 }])),
      countWhere(db, 'member_order', _.and([orderBase, { commission_status: 1 }]))
    ]);

    const settleWhere = salesId
      ? _.and([{ settle_month: month }, { sales_id: salesId }])
      : { settle_month: month };

    const settleCountRes = await db.collection('sales_commission_settle').where(settleWhere).count();
    const settle_bill_count = settleCountRes.total || 0;
    let commission_amount_total = 0;
    const settleBatch = 500;
    let settleSkip = 0;
    for (;;) {
      const settleRes = await db
        .collection('sales_commission_settle')
        .where(settleWhere)
        .field({ commission_total: true })
        .skip(settleSkip)
        .limit(settleBatch)
        .get();
      const settleRows = dataArrayFromQuery(settleRes);
      if (settleRows.length === 0) break;
      for (const r of settleRows) {
        commission_amount_total += Number(r.commission_total) || 0;
      }
      if (settleRows.length < settleBatch) break;
      settleSkip += settleBatch;
      if (settleSkip > 200000) break;
    }
    commission_amount_total = Number(commission_amount_total.toFixed(2));

    const customerQuick = salesId
      ? _.or([{ first_sales_id: salesId }, { current_sales_id: salesId }])
      : {};

    const [customer_total, order_total] = await Promise.all([
      salesId ? countWhere(db, 'customer_profile', customerQuick) : countWhere(db, 'customer_profile', {}),
      countWhere(db, 'member_order', orderBase)
    ]);

    const [
      customer_missing_first_sales,
      customer_missing_current_sales,
      customer_missing_source_channel,
      order_commission_unsettled,
      order_settled_missing_settle_id,
      order_settled_missing_settle_month,
      order_missing_customer_id,
      order_missing_customer_name,
      order_missing_sales_info,
      order_invalid_order_type
    ] = await Promise.all([
      countWhere(db, 'customer_profile', emptyIdCond('first_sales_id', _)),
      countWhere(db, 'customer_profile', emptyIdCond('current_sales_id', _)),
      countWhere(db, 'customer_profile', emptyIdCond('source_channel_id', _)),
      countWhere(
        db,
        'member_order',
        _.and([{ commission_amount: _.gt(0) }, { commission_status: 0 }])
      ),
      countWhere(
        db,
        'member_order',
        _.and([{ commission_status: 1 }, emptyIdCond('commission_settlement_id', _)])
      ),
      countWhere(
        db,
        'member_order',
        _.and([{ commission_status: 1 }, emptyIdCond('commission_settlement_month', _)])
      ),
      countWhere(
        db,
        'member_order',
        _.and([{ order_status: 1 }, emptyIdCond('customer_id', _)])
      ),
      countWhere(
        db,
        'member_order',
        _.and([
          { order_status: 1 },
          _.and([{ customer_id: _.and(_.neq(''), _.neq(null)) }, emptyIdCond('customer_name', _)])
        ])
      ),
      countWhere(
        db,
        'member_order',
        _.and([
          { order_status: 1 },
          _.or([
            emptyIdCond('sales_id', _),
            emptyIdCond('sales_name', _)
          ])
        ])
      ),
      countWhere(
        db,
        'member_order',
        _.and([
          { order_status: 1 },
          _.or([
            { order_type: _.exists(false) },
            { order_type: null },
            _.and([{ order_type: _.neq(1) }, { order_type: _.neq(2) }])
          ])
        ])
      )
    ]);

    const applies = await loadAllApplies(db, {
      customer_id: true,
      status: true,
      apply_status: true,
      to_sales_id: true,
      audit_time: true,
      created_at: true
    });

    const transfer_pending_total = applies.filter((r) => getFinalApplyStatus(r) === 0).length;

    const pendingByCustomer = {};
    const approvedLatest = {};
    for (const row of applies) {
      const cid = safeString(row.customer_id);
      if (!cid) continue;
      const st = getFinalApplyStatus(row);
      if (st === 0) {
        pendingByCustomer[cid] = (pendingByCustomer[cid] || 0) + 1;
      }
      if (st === 1) {
        const prev = approvedLatest[cid];
        if (!prev || auditTs(row) >= auditTs(prev)) {
          approvedLatest[cid] = row;
        }
      }
    }

    let transfer_multi_pending = 0;
    for (const c of Object.keys(pendingByCustomer)) {
      if (pendingByCustomer[c] > 1) transfer_multi_pending += 1;
    }

    const chunk = 80;

    let transfer_status_inconsistent = 0;
    const pendingIds = new Set(Object.keys(pendingByCustomer));
    const profPendingCheck = await db
      .collection('customer_profile')
      .where({ transfer_status: 1 })
      .field({ _id: true })
      .limit(5000)
      .get();
    for (const p of dataArrayFromQuery(profPendingCheck)) {
      const id = safeString(p._id);
      if (!pendingIds.has(id)) transfer_status_inconsistent += 1;
    }
    const pendingList = Array.from(pendingIds);
    for (let j = 0; j < pendingList.length; j += chunk) {
      const slice = pendingList.slice(j, j + chunk);
      const pr = await db
        .collection('customer_profile')
        .where({ _id: _.in(slice) })
        .field({ _id: true, transfer_status: true })
        .get();
      for (const row of dataArrayFromQuery(pr)) {
        const ts =
          row.transfer_status !== undefined && row.transfer_status !== null ? Number(row.transfer_status) : 0;
        if (ts !== 1) transfer_status_inconsistent += 1;
      }
    }

    /** 最近一次「已通过」申请的 to_sales_id 与当前 current_sales_id 不一致（两字段语义相同，共用一个计数） */
    let approved_to_current_mismatch = 0;
    const approvedCustomerIds = Object.keys(approvedLatest);
    for (let i = 0; i < approvedCustomerIds.length; i += chunk) {
      const slice = approvedCustomerIds.slice(i, i + chunk);
      const pres = await db
        .collection('customer_profile')
        .where({ _id: _.in(slice) })
        .field({ current_sales_id: true })
        .get();
      const pmap = {};
      for (const x of dataArrayFromQuery(pres)) {
        pmap[safeString(x._id)] = safeString(x.current_sales_id);
      }
      for (const cid of slice) {
        const app = approvedLatest[cid];
        const toId = safeString(app && app.to_sales_id);
        const cur = pmap[cid] || '';
        if (toId && cur && toId !== cur) approved_to_current_mismatch += 1;
      }
    }

    let customer_transfer_count_mismatch = 0;
    let skipCust = 0;
    const custBatch = 150;
    for (;;) {
      const cr = await db
        .collection('customer_profile')
        .where({ transfer_count: _.gt(0) })
        .field({ _id: true, transfer_count: true })
        .skip(skipCust)
        .limit(custBatch)
        .get();
      const crows = dataArrayFromQuery(cr);
      if (crows.length === 0) break;
      const ids = crows.map((c) => safeString(c._id)).filter(Boolean);
      const ar = await db
        .collection('customer_transfer_apply')
        .where({ customer_id: _.in(ids) })
        .field({ customer_id: true, status: true, apply_status: true })
        .get();
      const approveCount = {};
      for (const row of dataArrayFromQuery(ar)) {
        if (getFinalApplyStatus(row) === 1) {
          const k = safeString(row.customer_id);
          approveCount[k] = (approveCount[k] || 0) + 1;
        }
      }
      for (const c of crows) {
        const id = safeString(c._id);
        const tc = Number(c.transfer_count) || 0;
        const ac = approveCount[id] || 0;
        if (tc > 0 && ac === 0) customer_transfer_count_mismatch += 1;
        else if (tc > 0 && ac !== tc) customer_transfer_count_mismatch += 1;
      }
      if (crows.length < custBatch) break;
      skipCust += custBatch;
      if (skipCust > 50000) break;
    }

    return {
      code: 200,
      message: 'ok',
      data: {
        summary: {
          month,
          new_customer_count,
          member_order_count,
          first_open_count,
          renewal_count,
          unsettled_order_count,
          settled_order_count,
          settle_bill_count,
          commission_amount_total
        },
        exceptions: {
          customer_missing_first_sales,
          customer_missing_current_sales,
          customer_missing_source_channel,
          customer_transfer_count_mismatch,
          customer_current_sales_mismatch: approved_to_current_mismatch,
          order_commission_unsettled,
          order_settled_missing_settle_id,
          order_settled_missing_settle_month,
          order_missing_customer_id,
          order_missing_customer_name,
          order_missing_sales_info,
          order_invalid_order_type,
          transfer_multi_pending,
          transfer_status_inconsistent,
          transfer_approved_not_synced: approved_to_current_mismatch
        },
        quick_links: {
          customer_total,
          order_total,
          settle_total: settle_bill_count,
          transfer_pending_total
        },
        _meta: {
          note:
            '摘要按所选月 pay_time（已支付订单）与客户 created_at；异常为全库扫描。transfer_status_inconsistent 在客户量极大时仅抽样 transfer_status=1 客户与全部待审客户，详见代码上限。'
        }
      }
    };
  } catch (e) {
    console.error('getOperationReconcileSummary error:', e);
    return { code: 500, message: e.message || '查询失败' };
  }
};
