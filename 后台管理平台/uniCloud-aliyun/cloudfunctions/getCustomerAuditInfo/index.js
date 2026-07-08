'use strict';

const { verifyToken } = require('nxt-auth');
const { batchSalesCodeByStaffId } = require('nxt-sales-staff');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function safeNumber(value) {
  return value === undefined || value === null || isNaN(value) ? 0 : Number(value);
}

function docFromGet(res) {
  const d = res && res.data;
  if (d == null) return null;
  if (Array.isArray(d)) return d.length ? d[0] : null;
  if (typeof d === 'object') return d;
  return null;
}

/** 订单排序：pay_time 优先，否则 created_at */
function orderSortTs(o) {
  const p = o.pay_time;
  if (p !== undefined && p !== null && p !== '') {
    const t = new Date(p).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const c = o.created_at;
  if (c !== undefined && c !== null && c !== '') {
    const t = new Date(c).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return 0;
}

/** 转移申请排序：apply_time 优先，否则 created_at */
function transferSortTs(row) {
  const a = row.apply_time;
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

/** 与 auditCustomerTransferApply 一致：status 优先，缺省再认 apply_status */
function getFinalApplyStatus(doc) {
  if (doc.status !== undefined && doc.status !== null && doc.status !== '') {
    return Number(doc.status);
  }
  if (doc.apply_status !== undefined && doc.apply_status !== null && doc.apply_status !== '') {
    return Number(doc.apply_status);
  }
  return -1;
}

function applyStatusText(s) {
  const n = Number(s);
  if (n === 0) return '待审批';
  if (n === 1) return '已通过';
  if (n === 2) return '已拒绝';
  return '—';
}

function orderTypeText(t) {
  const n = Number(t);
  if (n === 1) return '首开';
  if (n === 2) return '续费';
  return safeString(t) || '—';
}

function commissionStatusText(s) {
  const n = Number(s);
  if (n === 0) return '未结算';
  if (n === 1) return '已结算';
  return safeString(s) || '—';
}

function memberStatusText(st) {
  const n = Number(st);
  if (n === 0) return '未开通';
  if (n === 1) return '已开通';
  if (n === 2) return '已过期';
  return '—';
}

function customerDisplayName(p) {
  if (!p) return '';
  return safeString(p.company_name || p.contact_name || p.nickname || p.mobile);
}

/**
 * 客户核对信息聚合（只读）：customer_profile + 最近已支付订单 + 最近转移申请
 */
exports.main = async (event, context) => {
  const db = uniCloud.database();

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  const customerId = safeString(event.customer_id);
  if (!customerId) {
    return { code: 400, message: '缺少 customer_id' };
  }

  try {
    const profRes = await db.collection('customer_profile').doc(customerId).get();
    const prof = docFromGet(profRes);
    if (!prof) {
      return { code: 404, message: '客户不存在' };
    }

    const customer_name = customerDisplayName(prof);

    const codeMap = await batchSalesCodeByStaffId(db, [
      safeString(prof.first_sales_id),
      safeString(prof.current_sales_id)
    ]);

    const customer = {
      _id: safeString(prof._id),
      customer_name,
      mobile: safeString(prof.mobile),
      first_sales_id: safeString(prof.first_sales_id),
      first_sales_name: safeString(prof.first_sales_name),
      first_sales_code: safeString(codeMap[safeString(prof.first_sales_id)]),
      current_sales_id: safeString(prof.current_sales_id),
      current_sales_name: safeString(prof.current_sales_name),
      current_sales_code: safeString(codeMap[safeString(prof.current_sales_id)]),
      source_channel_id: safeString(prof.source_channel_id),
      source_channel_name: safeString(prof.source_channel_name),
      transfer_count: prof.transfer_count != null ? Number(prof.transfer_count) : 0,
      company_name: safeString(prof.company_name),
      contact_name: safeString(prof.contact_name),
      nickname: safeString(prof.nickname)
    };

    const orderRes = await db
      .collection('member_order')
      .where({ customer_id: customerId, order_status: 1 })
      .limit(200)
      .get();

    const orderRows = (orderRes.data || []).slice();
    orderRows.sort((a, b) => orderSortTs(b) - orderSortTs(a));
    const topOrders = orderRows.slice(0, 5);

    const nowTs = Date.now();
    const mst = prof.member_status != null ? Number(prof.member_status) : 0;
    let expTs = null;
    if (prof.member_expire_time != null && prof.member_expire_time !== '') {
      const t = new Date(prof.member_expire_time).getTime();
      if (!Number.isNaN(t)) expTs = t;
    }
    let display_status = '未开通';
    let is_effective = false;
    if (mst === 0) {
      display_status = '未开通';
    } else if (mst === 2) {
      display_status = '已过期';
    } else if (mst === 1) {
      if (expTs != null && expTs > nowTs) {
        display_status = '有效会员';
        is_effective = true;
      } else {
        display_status = '已过期';
      }
    }
    const latestSuccess = orderRows[0] || null;
    const latestRenewal =
      orderRows.filter((o) => Number(o.order_type) === 2).sort((a, b) => orderSortTs(b) - orderSortTs(a))[0] ||
      null;

    const membership = {
      member_status: mst,
      member_status_text: memberStatusText(mst),
      display_status,
      member_expire_time: prof.member_expire_time,
      member_last_renew_time: prof.member_last_renew_time,
      is_effective,
      last_success_order: latestSuccess
        ? {
            order_no: safeString(latestSuccess.order_no),
            order_type: latestSuccess.order_type,
            order_type_text: orderTypeText(latestSuccess.order_type),
            pay_time: latestSuccess.pay_time,
            pay_amount: safeNumber(latestSuccess.pay_amount)
          }
        : null,
      last_renewal_order: latestRenewal
        ? {
            order_no: safeString(latestRenewal.order_no),
            pay_time: latestRenewal.pay_time,
            pay_amount: safeNumber(latestRenewal.pay_amount),
            expire_time_before: latestRenewal.expire_time_before,
            expire_time_after: latestRenewal.expire_time_after
          }
        : null
    };

    const recent_orders = topOrders.map((o) => ({
      _id: safeString(o._id),
      order_no: safeString(o.order_no),
      customer_id: safeString(o.customer_id),
      customer_name,
      mobile: safeString(o.mobile) || customer.mobile,
      order_type: o.order_type,
      order_type_text: orderTypeText(o.order_type),
      pay_time: o.pay_time,
      pay_amount: safeNumber(o.pay_amount),
      commission_amount: safeNumber(o.commission_amount),
      commission_status: o.commission_status,
      commission_status_text: commissionStatusText(o.commission_status),
      commission_settlement_id: safeString(o.commission_settlement_id),
      commission_settlement_month: safeString(o.commission_settlement_month)
    }));

    const applyRes = await db
      .collection('customer_transfer_apply')
      .where({ customer_id: customerId })
      .limit(30)
      .get();

    const applyRows = (applyRes.data || []).slice();
    applyRows.sort((a, b) => transferSortTs(b) - transferSortTs(a));
    const topApplies = applyRows.slice(0, 5);

    const recent_transfer_records = topApplies.map((r) => {
      const final_apply_status = getFinalApplyStatus(r);
      const apply_time =
        r.apply_time != null && r.apply_time !== '' ? r.apply_time : r.created_at;
      return {
        _id: safeString(r._id),
        customer_id: safeString(r.customer_id),
        from_sales_id: safeString(r.from_sales_id),
        from_sales_name: safeString(r.from_sales_name),
        to_sales_id: safeString(r.to_sales_id),
        to_sales_name: safeString(r.to_sales_name),
        apply_time,
        final_apply_status,
        status: final_apply_status,
        apply_status: final_apply_status,
        apply_status_text: applyStatusText(final_apply_status),
        audit_time: r.audit_time,
        reject_reason: safeString(r.audit_reason || r.reject_reason),
        created_at: r.created_at
      };
    });

    return {
      code: 200,
      message: 'ok',
      data: {
        customer,
        recent_orders,
        recent_transfer_records,
        membership
      }
    };
  } catch (e) {
    console.error('[getCustomerAuditInfo]', e);
    return { code: 500, message: e.message || '查询失败' };
  }
};
