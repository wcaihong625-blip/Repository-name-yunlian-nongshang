'use strict';

const { verifyToken } = require('nxt-auth');
const {
  safeString,
  getMonthBoundaries,
  fetchEligibleOrders
} = require('nxt-commission-month');
const { batchSalesCodeByStaffId } = require('nxt-sales-staff');

module.exports = async (event, context) => {
  const db = uniCloud.database();
  const _ = db.command;

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  const settleMonth = safeString(event.settle_month);
  if (!settleMonth) return { code: 400, message: '缺少参数 settle_month' };

  const bounds = getMonthBoundaries(settleMonth);
  if (!bounds) return { code: 400, message: 'settle_month 格式错误，应为 YYYY-MM' };

  let salesFilter = safeString(event.sales_id) || null;
  const salesNameForPreview = safeString(event.sales_name);

  try {
    if (!salesFilter && salesNameForPreview) {
      const staffRes = await db
        .collection('sales_staff')
        .where({ sales_name: new RegExp(salesNameForPreview, 'i') })
        .field({ _id: true, sales_name: true })
        .limit(50)
        .get();
      const staffRows = staffRes.data || [];
      const ids = staffRows.map((r) => safeString(r._id)).filter(Boolean);
      if (ids.length === 0) {
        const existingSettleRes = await db.collection('sales_commission_settle').where({ settle_month: settleMonth }).get();
        const rows = existingSettleRes.data || [];
        const pendingCount = rows.filter((r) => Number(r.settle_status) === 0).length;
        const settledCount = rows.filter((r) => Number(r.settle_status) === 1).length;
        return {
          code: 200,
          message: 'ok',
          data: {
            settle_month: settleMonth,
            total_eligible_orders: 0,
            total_eligible_commission: 0,
            locked_pending_order_slots: 0,
            sales_list: [],
            existing_settle_bills: { pending: pendingCount, settled: settledCount },
            preview_sales_filter_note: '未匹配到业务员姓名'
          }
        };
      }
      salesFilter = ids.length === 1 ? ids[0] : { sales_ids_in: ids };
    }

    const { orders, lockedOrderCount } = await fetchEligibleOrders(db, _, settleMonth, bounds, salesFilter);

    const salesMap = {};
    let totalCommission = 0;

    for (const order of orders) {
      const sId = safeString(order.sales_id);
      if (!sId) continue;
      const commAmount = Number(order.commission_amount) || 0;
      totalCommission += commAmount;

      if (!salesMap[sId]) {
        salesMap[sId] = {
          sales_id: sId,
          sales_name: safeString(order.sales_name),
          order_count: 0,
          commission_total: 0
        };
      }
      salesMap[sId].order_count += 1;
      salesMap[sId].commission_total += commAmount;
    }

    let sales_list = Object.values(salesMap).map((row) => ({
      ...row,
      commission_total: Number(row.commission_total.toFixed(2))
    }));

    sales_list.sort((a, b) => b.commission_total - a.commission_total);

    const codeMap = await batchSalesCodeByStaffId(
      db,
      sales_list.map((r) => r.sales_id)
    );
    sales_list = sales_list.map((r) => ({
      ...r,
      sales_code: safeString(codeMap[safeString(r.sales_id)])
    }));

    const existingSettleRes = await db.collection('sales_commission_settle').where({ settle_month: settleMonth }).get();
    const pendingCount = (existingSettleRes.data || []).filter((r) => Number(r.settle_status) === 0).length;
    const settledCount = (existingSettleRes.data || []).filter((r) => Number(r.settle_status) === 1).length;

    return {
      code: 200,
      message: 'ok',
      data: {
        settle_month: settleMonth,
        total_eligible_orders: orders.length,
        total_eligible_commission: Number(totalCommission.toFixed(2)),
        locked_pending_order_slots: lockedOrderCount,
        sales_list,
        existing_settle_bills: {
          pending: pendingCount,
          settled: settledCount
        }
      }
    };
  } catch (e) {
    console.error('previewCommissionMonthSettle error:', e);
    return { code: 500, message: e.message || '查询失败' };
  }
};

