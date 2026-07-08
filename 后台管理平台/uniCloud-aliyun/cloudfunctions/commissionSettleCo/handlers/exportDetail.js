'use strict';

const { verifyToken } = require('nxt-auth');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/**
 * 结算月份导出为「YYYY年MM月」，避免 Excel/WPS 将 2026-04 识别为日期
 */
function formatSettleMonthForCsv(raw) {
  const s = safeString(raw);
  if (!s) return '';
  if (/^\d{4}年\d{2}月$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
  if (m) {
    const y = m[1];
    const mo = parseInt(m[2], 10);
    if (mo >= 1 && mo <= 12) {
      const mm = mo < 10 ? `0${mo}` : String(mo);
      return `${y}年${mm}月`;
    }
  }
  return `月份：${s}`;
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

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
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
  return x;
}

function customerDisplayName(p) {
  if (!p) return '';
  return safeString(p.company_name || p.contact_name || p.nickname || p.mobile);
}

/**
 * 仅导出指定结算单 order_ids 内的订单，不混入其它结算单/月份
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

    const settleMonthRaw = safeString(settle.settle_month);
    const settleMonthExport = formatSettleMonthForCsv(settleMonthRaw);
    const orderIds = Array.isArray(settle.order_ids)
      ? settle.order_ids.map((x) => safeString(x)).filter(Boolean)
      : [];
    const idSet = new Set(orderIds);

    const headers = [
      'settle_sheet_id',
      'settle_month',
      'sales_id',
      'sales_name',
      '_id',
      'order_no',
      'customer_id',
      'customer_name',
      'mobile',
      'order_type_text',
      'pay_time',
      'pay_amount',
      'commission_type_text',
      'commission_amount',
      'commission_status_text',
      'commission_settlement_id',
      'commission_settlement_month',
      'commission_settle_time'
    ];

    const headers_zh = [
      '结算单ID',
      '结算月份',
      '业务员ID',
      '业务员姓名',
      '订单ID',
      '订单号',
      '客户ID',
      '客户姓名',
      '手机号',
      '订单类型',
      '支付时间',
      '支付金额',
      '提成类型',
      '提成金额',
      '提成状态',
      '订单关联结算单ID',
      '订单关联结算月份',
      '提成结算时间'
    ];

    if (orderIds.length === 0) {
      return {
        code: 200,
        message: 'ok',
        data: {
          headers,
          headers_zh,
          list: [],
          settle_month: settleMonthExport,
          settle_id: settleId,
          sales_name: safeString(settle.sales_name)
        }
      };
    }

    const byId = new Map();
    for (const batch of chunkArray(orderIds, BATCH)) {
      const r = await db.collection('member_order').where({ _id: _.in(batch) }).get();
      const rows = r.data || [];
      for (const o of rows) {
        const oid = safeString(o._id);
        if (!idSet.has(oid)) continue;
        byId.set(oid, o);
      }
    }

    const orders = orderIds.map((id) => byId.get(id)).filter(Boolean);

    const custIds = [...new Set(orders.map((o) => safeString(o.customer_id)).filter(Boolean))];
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
      for (const c of cr.data || []) {
        custMap[safeString(c._id)] = c;
      }
    }

    const list = orders.map((item) => {
      const cid = safeString(item.customer_id);
      const prof = custMap[cid];
      const mobileOut =
        prof && prof.mobile != null && safeString(prof.mobile)
          ? safeString(prof.mobile)
          : safeString(item.mobile);
      return {
        settle_sheet_id: settleId,
        settle_month: settleMonthExport,
        sales_id: safeString(item.sales_id),
        sales_name: safeString(item.sales_name),
        _id: safeString(item._id),
        order_no: safeString(item.order_no),
        customer_id: cid,
        customer_name: customerDisplayName(prof),
        mobile: mobileOut,
        order_type_text: orderTypeText(item.order_type),
        pay_time: formatDateTime(item.pay_time),
        pay_amount: safeNumber(item.pay_amount).toFixed(2),
        commission_type_text: commissionTypeText(item.commission_type),
        commission_amount: safeNumber(item.commission_amount).toFixed(2),
        commission_status_text: commissionStatusText(item.commission_status),
        commission_settlement_id: safeString(item.commission_settlement_id || settleId),
        commission_settlement_month: formatSettleMonthForCsv(item.commission_settlement_month),
        commission_settle_time: formatDateTime(item.commission_settle_time)
      };
    });

    return {
      code: 200,
      message: '导出成功',
      data: {
        headers,
        headers_zh,
        list,
        settle_month: settleMonthExport,
        settle_id: settleId,
        sales_name: safeString(settle.sales_name),
        order_count_expected: orderIds.length,
        order_count_exported: list.length
      }
    };
  } catch (e) {
    console.error('exportCommissionSettleDetail error:', e);
    return { code: 500, message: e.message || '导出失败' };
  }
};

