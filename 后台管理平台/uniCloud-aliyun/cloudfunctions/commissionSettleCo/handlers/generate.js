'use strict';

const { verifyToken } = require('nxt-auth');
const {
  safeString,
  getMonthBoundaries,
  fetchEligibleOrders
} = require('nxt-commission-month');

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

  const salesIdFilter = safeString(event.sales_id) || null;

  try {
    const { orders, lockedOrderCount } = await fetchEligibleOrders(db, _, settleMonth, bounds, salesIdFilter);

    if (orders.length === 0) {
      return {
        code: 200,
        message: '该月份无未结算订单（或已全部纳入待确认结算单）',
        data: {
          settle_month: settleMonth,
          created_count: 0,
          settle_ids: [],
          locked_order_count: lockedOrderCount
        }
      };
    }

    const salesMap = {};
    for (const order of orders) {
      const sId = safeString(order.sales_id);
      if (!sId) continue;
      if (!salesMap[sId]) {
        salesMap[sId] = {
          sales_id: sId,
          sales_name: safeString(order.sales_name),
          order_count: 0,
          first_open_count: 0,
          renewal_count: 0,
          first_open_amount: 0,
          renewal_amount: 0,
          first_open_commission: 0,
          renewal_commission: 0,
          commission_total: 0,
          order_ids: []
        };
      }

      const mapItem = salesMap[sId];
      const isFirst = (order.order_type === 1 || order.commission_type === 'first_open');
      const isRenewal = (order.order_type === 2 || order.commission_type === 'renewal');

      mapItem.order_count += 1;
      mapItem.order_ids.push(order._id);
      const payAmount = Number(order.pay_amount) || 0;
      const commAmount = Number(order.commission_amount) || 0;

      mapItem.commission_total += commAmount;

      if (isFirst) {
        mapItem.first_open_count += 1;
        mapItem.first_open_amount += payAmount;
        mapItem.first_open_commission += commAmount;
      } else if (isRenewal) {
        mapItem.renewal_count += 1;
        mapItem.renewal_amount += payAmount;
        mapItem.renewal_commission += commAmount;
      } else {
        mapItem.renewal_count += 1;
        mapItem.renewal_amount += payAmount;
        mapItem.renewal_commission += commAmount;
      }
    }

    const targetSalesIds = Object.keys(salesMap);
    const existingSettleRes = await db.collection('sales_commission_settle').where({
      settle_month: settleMonth,
      sales_id: _.in(targetSalesIds)
    }).get();
    const existingSales = (existingSettleRes.data || []).map((item) => safeString(item.sales_id));

    const nowDate = new Date();
    const creates = [];
    for (const sId of targetSalesIds) {
      if (existingSales.includes(sId)) {
        continue;
      }
      const data = salesMap[sId];
      creates.push({
        sales_id: data.sales_id,
        sales_name: data.sales_name,
        settle_month: settleMonth,
        order_count: data.order_count,
        first_open_count: data.first_open_count,
        renewal_count: data.renewal_count,
        first_open_amount: Number(data.first_open_amount.toFixed(2)),
        renewal_amount: Number(data.renewal_amount.toFixed(2)),
        first_open_commission: Number(data.first_open_commission.toFixed(2)),
        renewal_commission: Number(data.renewal_commission.toFixed(2)),
        commission_total: Number(data.commission_total.toFixed(2)),
        commission_paid: 0,
        commission_unpaid: Number(data.commission_total.toFixed(2)),
        settle_status: 0,
        order_ids: data.order_ids,
        remark: '',
        created_at: nowDate,
        updated_at: nowDate
      });
    }

    if (creates.length === 0) {
      return {
        code: 200,
        message: '该月份有待结订单，但对应业务员均已存在结算单（待确认或已结算），未生成新单',
        data: {
          settle_month: settleMonth,
          created_count: 0,
          settle_ids: [],
          locked_order_count: lockedOrderCount
        }
      };
    }

    const addRes = await db.collection('sales_commission_settle').add(creates);
    let settleIds = [];
    if (Array.isArray(addRes.ids) && addRes.ids.length) {
      settleIds = addRes.ids;
    } else if (addRes.insertedIds && typeof addRes.insertedIds === 'object') {
      settleIds = Object.values(addRes.insertedIds);
    } else if (addRes.id) {
      settleIds = [addRes.id];
    }

    return {
      code: 200,
      message: '生成结算单成功',
      data: {
        settle_month: settleMonth,
        created_count: creates.length,
        settle_ids: settleIds,
        locked_order_count: lockedOrderCount
      }
    };
  } catch (e) {
    console.error('generateCommissionSettle error:', e);
    return { code: 500, message: e.message || '服务繁忙，请稍后再试' };
  }
};

