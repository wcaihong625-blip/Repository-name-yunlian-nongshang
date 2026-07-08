'use strict';

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function dataArrayFromQuery(res) {
  const d = res && res.data;
  if (d == null) return [];
  if (Array.isArray(d)) return d;
  if (typeof d === 'object') return [d];
  return [];
}

function getMonthBoundaries(monthStr) {
  const match = monthStr.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;

  const startDate = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00+08:00`);
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear += 1;
  }
  const endDate = new Date(new Date(`${nextYear}-${String(nextMonth).padStart(2, '0')}-01T00:00:00+08:00`).getTime() - 1);
  return { start: startDate, end: endDate };
}

/**
 * 待确认结算单（settle_status=0）已占用的订单，避免预览/生成与「已生成未确认」重复统计
 */
async function loadLockedOrderIdsForMonth(db, settleMonth) {
  const locked = new Set();
  const batch = 200;
  let skip = 0;
  for (;;) {
    const res = await db.collection('sales_commission_settle')
      .where({ settle_month: settleMonth, settle_status: 0 })
      .field({ order_ids: true })
      .skip(skip)
      .limit(batch)
      .get();
    const rows = dataArrayFromQuery(res);
    for (const row of rows) {
      for (const id of row.order_ids || []) {
        if (id) locked.add(String(id));
      }
    }
    if (rows.length < batch) break;
    skip += batch;
  }
  return locked;
}

/**
 * @param {string|null|undefined|{sales_ids_in?: string[]}} salesFilter 单个 sales_id 字符串，或 { sales_ids_in } 多业务员
 */
function buildBaseOrderWhere(_, settleMonth, bounds, salesFilter) {
  const parts = [
    { order_status: 1 },
    { commission_amount: _.gt(0) },
    { commission_status: 0 },
    { sales_id: _.and(_.neq(''), _.neq(null)) },
    _.or([
      { pay_time: _.gte(bounds.start).and(_.lte(bounds.end)) },
      { pay_time: _.gte(bounds.start.getTime()).and(_.lte(bounds.end.getTime())) }
    ])
  ];
  if (salesFilter && typeof salesFilter === 'object' && !Array.isArray(salesFilter)) {
    const ids = (salesFilter.sales_ids_in || [])
      .map((x) => safeString(x))
      .filter(Boolean);
    if (ids.length > 0) {
      parts.push({ sales_id: _.in(ids) });
    }
  } else {
    const sid = safeString(salesFilter);
    if (sid) {
      parts.push({ sales_id: sid });
    }
  }
  return _.and(parts);
}

/**
 * 分页拉取当月符合条件的未结算订单，并排除待确认结算单占用的订单
 */
async function fetchEligibleOrders(db, _, settleMonth, bounds, salesFilter) {
  const lockedIds = await loadLockedOrderIdsForMonth(db, settleMonth);
  const orderQuery = buildBaseOrderWhere(_, settleMonth, bounds, salesFilter);

  const pageSize = 500;
  let skip = 0;
  const orders = [];
  for (;;) {
    const res = await db.collection('member_order')
      .where(orderQuery)
      .orderBy('pay_time', 'asc')
      .skip(skip)
      .limit(pageSize)
      .get();
    const chunk = dataArrayFromQuery(res);
    for (const o of chunk) {
      if (!lockedIds.has(String(o._id))) {
        orders.push(o);
      }
    }
    if (chunk.length < pageSize) break;
    skip += pageSize;
  }
  return { orders, lockedOrderCount: lockedIds.size };
}

module.exports = {
  safeString,
  getMonthBoundaries,
  loadLockedOrderIdsForMonth,
  buildBaseOrderWhere,
  fetchEligibleOrders
};
