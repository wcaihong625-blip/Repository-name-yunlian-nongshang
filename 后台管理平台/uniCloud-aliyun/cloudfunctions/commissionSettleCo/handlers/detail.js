'use strict';

const { verifyToken } = require('nxt-auth');
const { batchSalesCodeByStaffId } = require('nxt-sales-staff');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function safeNumber(value) {
  return value === undefined || value === null || isNaN(value) ? 0 : Number(value);
}

function formatDateTime(v) {
  if (v === undefined || v === null || v === '') return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function docFromGet(res) {
  const d = res && res.data;
  if (d == null) return null;
  if (Array.isArray(d)) return d.length ? d[0] : null;
  if (typeof d === 'object') return d;
  return null;
}

/** where().get() 的 data 在少数环境下可能是单对象 */
function dataArrayFromQuery(res) {
  const d = res && res.data;
  if (d == null) return [];
  if (Array.isArray(d)) return d;
  if (typeof d === 'object') return [d];
  return [];
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

function settleStatusText(status) {
  const s = Number(status);
  if (s === 0) return '待结算';
  if (s === 1) return '已结算';
  if (s === 2) return '部分结算';
  return '';
}

function orderTypeText(t) {
  const n = Number(t);
  if (n === 1) return '首开';
  if (n === 2) return '续费';
  return safeString(t);
}

function commissionStatusText(s) {
  const n = Number(s);
  if (n === 0) return '未结算';
  if (n === 1) return '已结算';
  return safeString(s);
}

function commissionTypeText(ct) {
  const x = safeString(ct);
  if (x === 'first_open') return '首开提成';
  if (x === 'renewal') return '续费提成';
  return x || '-';
}

function customerDisplayName(p) {
  if (!p) return '';
  return safeString(p.company_name || p.contact_name || p.nickname || p.mobile);
}

/**
 * 结算单详情 + 本单 order_ids 对应订单（核对闭环，只读）
 */
module.exports = async (event, context) => {
  const db = uniCloud.database();
  const _ = db.command;

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  const settleId = safeString(event.settle_id);
  if (!settleId) {
    return { code: 400, message: '缺少 settle_id' };
  }

  const BATCH = 80;

  try {
    const settleRes = await db.collection('sales_commission_settle').doc(settleId).get();
    const settle = docFromGet(settleRes);
    if (!settle) {
      return { code: 404, message: '结算单不存在' };
    }

    const settleMonth = safeString(settle.settle_month);
    const orderIds = Array.isArray(settle.order_ids)
      ? settle.order_ids.map((x) => safeString(x)).filter(Boolean)
      : [];
    const idSet = new Set(orderIds);

    const settleSalesId = safeString(settle.sales_id);
    const settleCodeMapEarly = await batchSalesCodeByStaffId(db, [settleSalesId]);

    const settleSummary = {
      _id: safeString(settle._id),
      settle_month: settleMonth,
      sales_id: settleSalesId,
      sales_name: safeString(settle.sales_name),
      sales_code: safeString(settleCodeMapEarly[settleSalesId]),
      order_count: safeNumber(settle.order_count),
      order_ids_length: orderIds.length,
      commission_total: safeNumber(settle.commission_total),
      commission_paid: safeNumber(settle.commission_paid),
      commission_unpaid: safeNumber(settle.commission_unpaid),
      settle_status: settle.settle_status,
      settle_status_text: settleStatusText(settle.settle_status),
      settled_at: settle.settled_at,
      settled_at_text: formatDateTime(settle.settled_at),
      created_at_text: formatDateTime(settle.created_at),
      remark: safeString(settle.remark)
    };

    if (orderIds.length === 0) {
      return {
        code: 200,
        message: 'ok',
        data: {
          settle: settleSummary,
          orders: []
        }
      };
    }

    const byId = new Map();
    for (const batch of chunkArray(orderIds, BATCH)) {
      const r = await db.collection('member_order').where({ _id: _.in(batch) }).get();
      const rows = dataArrayFromQuery(r);
      for (const o of rows) {
        const oid = safeString(o._id);
        if (!idSet.has(oid)) continue;
        byId.set(oid, o);
      }
    }

    const ordersRaw = orderIds.map((id) => byId.get(id)).filter(Boolean);

    const orderSalesIds = ordersRaw.map((o) => safeString(o.sales_id)).filter(Boolean);
    const orderCodeMap = await batchSalesCodeByStaffId(db, [settleSalesId, ...orderSalesIds]);

    const custIds = [...new Set(ordersRaw.map((o) => safeString(o.customer_id)).filter(Boolean))];
    const custMap = {};
    for (const cb of chunkArray(custIds, 50)) {
      const cr = await db
        .collection('customer_profile')
        .where({ _id: _.in(cb) })
        .field({
          company_name: true,
          contact_name: true,
          nickname: true,
          mobile: true
        })
        .get();
      for (const c of dataArrayFromQuery(cr)) {
        custMap[safeString(c._id)] = c;
      }
    }

    const orders = ordersRaw.map((item) => {
      const cid = safeString(item.customer_id);
      const prof = custMap[cid];
      const mobileOut =
        prof && prof.mobile != null && safeString(prof.mobile)
          ? safeString(prof.mobile)
          : safeString(item.mobile);
      return {
        _id: safeString(item._id),
        order_no: safeString(item.order_no),
        customer_id: cid,
        customer_name: customerDisplayName(prof),
        mobile: mobileOut,
        order_type: item.order_type,
        order_type_text: orderTypeText(item.order_type),
        pay_time: item.pay_time,
        pay_time_text: formatDateTime(item.pay_time),
        pay_amount: safeNumber(item.pay_amount),
        commission_amount: safeNumber(item.commission_amount),
        commission_type: safeString(item.commission_type),
        commission_type_text: commissionTypeText(item.commission_type),
        commission_status: item.commission_status,
        commission_status_text: commissionStatusText(item.commission_status),
        commission_settlement_id: safeString(item.commission_settlement_id),
        commission_settlement_month: safeString(item.commission_settlement_month),
        sales_id: safeString(item.sales_id),
        sales_name: safeString(item.sales_name),
        sales_staff_code: safeString(orderCodeMap[safeString(item.sales_id)]),
        first_sales_id: safeString(item.first_sales_id),
        first_sales_name: safeString(item.first_sales_name)
      };
    });

    return {
      code: 200,
      message: 'ok',
      data: {
        settle: settleSummary,
        orders,
        orders_loaded: orders.length,
        orders_expected: orderIds.length
      }
    };
  } catch (e) {
    console.error('getCommissionSettleDetail error:', e);
    return { code: 500, message: e.message || '查询失败' };
  }
};

