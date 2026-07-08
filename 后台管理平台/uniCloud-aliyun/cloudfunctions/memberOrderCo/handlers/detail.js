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

function normalizeHandleStatus(raw) {
  const s = safeString(raw);
  if (!s) return 'pending';
  return s;
}

function handleStatusText(raw) {
  const s = normalizeHandleStatus(raw);
  const m = { pending: '待处理', processing: '跟进中', done: '已处理', closed: '已关闭' };
  return m[s] || s;
}

function payStatusText(order) {
  if (!order) return '—';
  const ps = order.pay_status;
  if (ps === 1 || ps === '1') return '已支付';
  if (ps === 2 || ps === '2') return '已取消';
  if (ps === 3 || ps === '3') return '支付失败';
  if (ps === 0 || ps === '0') return '待支付';
  const os = Number(order.order_status);
  if (os === 1) return '已支付';
  if (os === 2) return '已取消';
  return '待支付';
}

function memberStatusText(st) {
  const n = Number(st);
  if (n === 0) return '未开通';
  if (n === 1) return '已开通';
  if (n === 2) return '已过期';
  return '—';
}

function buildMembershipSummary(profile, paidOrdersDesc) {
  const nowTs = Date.now();
  const mst = profile && profile.member_status != null ? Number(profile.member_status) : 0;
  let expTs = null;
  if (profile && profile.member_expire_time != null && profile.member_expire_time !== '') {
    const t = new Date(profile.member_expire_time).getTime();
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

  const latestSuccess = paidOrdersDesc[0] || null;
  const latestRenewal =
    paidOrdersDesc.filter((o) => Number(o.order_type) === 2).sort((a, b) => orderSortTs(b) - orderSortTs(a))[0] ||
    null;

  return {
    member_status: mst,
    member_status_text: memberStatusText(mst),
    display_status,
    member_expire_time: profile ? profile.member_expire_time : null,
    member_last_renew_time: profile ? profile.member_last_renew_time : null,
    is_effective,
    last_success_order: latestSuccess
      ? {
          _id: safeString(latestSuccess._id),
          order_no: safeString(latestSuccess.order_no),
          order_type: latestSuccess.order_type,
          order_type_text: orderTypeText(latestSuccess.order_type),
          pay_time: latestSuccess.pay_time,
          pay_amount: safeNumber(latestSuccess.pay_amount)
        }
      : null,
    last_renewal_order: latestRenewal
      ? {
          _id: safeString(latestRenewal._id),
          order_no: safeString(latestRenewal.order_no),
          pay_time: latestRenewal.pay_time,
          pay_amount: safeNumber(latestRenewal.pay_amount),
          expire_time_before: latestRenewal.expire_time_before,
          expire_time_after: latestRenewal.expire_time_after
        }
      : null
  };
}

module.exports = async (event, context) => {
  const db = uniCloud.database();

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  const orderId = safeString(event.order_id || event.id);
  if (!orderId) {
    return { code: 400, message: '缺少 order_id' };
  }

  try {
    const orderRes = await db.collection('member_order').doc(orderId).get();
    const order = docFromGet(orderRes);
    if (!order) {
      return { code: 404, message: '订单不存在' };
    }

    const customerId = safeString(order.customer_id);
    let profile = null;
    let membership_summary = null;
    let customer_current_sales_id = '';
    let customer_current_sales_name = '';

    if (customerId) {
      const profRes = await db.collection('customer_profile').doc(customerId).get();
      profile = docFromGet(profRes);
      if (profile) {
        customer_current_sales_id = safeString(profile.current_sales_id);
        customer_current_sales_name = safeString(profile.current_sales_name);
      }

      const paidRes = await db
        .collection('member_order')
        .where({ customer_id: customerId, order_status: 1 })
        .limit(200)
        .get();
      const paidRows = (paidRes.data || []).slice();
      paidRows.sort((a, b) => orderSortTs(b) - orderSortTs(a));
      membership_summary = buildMembershipSummary(profile, paidRows);
    }

    const remarkRes = await db
      .collection('member_order_remark')
      .where({ order_id: orderId })
      .limit(200)
      .get();
    const remarkRows = (remarkRes.data || []).slice();
    remarkRows.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

    const remarks = [];
    const action_logs = [];
    let latest_exception_remark = null;
    for (const r of remarkRows) {
      const row = {
        _id: safeString(r._id),
        remark_type: safeString(r.remark_type),
        remark_content: safeString(r.remark_content),
        operator_uid: safeString(r.operator_uid),
        operator_name: safeString(r.operator_name),
        created_at: r.created_at
      };
      if (r.remark_type === 'system') {
        action_logs.push(row);
      } else {
        remarks.push(row);
        if (r.remark_type === 'exception' && !latest_exception_remark) {
          latest_exception_remark = row;
        }
      }
    }

    const os = Number(order.order_status);
    const staffCodeMap = await batchSalesCodeByStaffId(db, [
      safeString(order.sales_id),
      safeString(order.first_sales_id),
      customer_current_sales_id
    ]);

    const order_out = {
      _id: safeString(order._id),
      order_no: safeString(order.order_no),
      user_id: safeString(order.user_id),
      customer_id: customerId,
      customer_name: safeString(order.customer_name),
      mobile: safeString(order.mobile),
      order_type: order.order_type,
      order_type_text: orderTypeText(order.order_type),
      order_status: order.order_status,
      order_status_text: os === 1 ? '已支付' : os === 0 ? '待支付' : os === 2 ? '已取消' : '其他',
      pay_status: order.pay_status != null && order.pay_status !== '' ? Number(order.pay_status) : null,
      pay_status_text: payStatusText(order),
      transaction_id: safeString(order.transaction_id),
      out_trade_no: safeString(order.out_trade_no),
      pay_order_no: safeString(order.pay_order_no),
      pay_callback_time: order.pay_callback_time,
      pay_mock_flag: order.pay_mock_flag === true,
      pay_amount: safeNumber(order.pay_amount),
      original_amount: safeNumber(order.original_amount),
      discount_amount: safeNumber(order.discount_amount),
      member_days: order.member_days != null ? Number(order.member_days) : null,
      pay_time: order.pay_time,
      expire_time_before: order.expire_time_before,
      expire_time_after: order.expire_time_after,
      sales_id: safeString(order.sales_id),
      sales_name: safeString(order.sales_name),
      sales_code: safeString(staffCodeMap[safeString(order.sales_id)]),
      first_sales_id: safeString(order.first_sales_id),
      first_sales_name: safeString(order.first_sales_name),
      first_sales_code: safeString(staffCodeMap[safeString(order.first_sales_id)]),
      channel_id: safeString(order.channel_id),
      channel_name: safeString(order.channel_name),
      invite_code: safeString(order.invite_code),
      commission_type: safeString(order.commission_type),
      commission_rate: order.commission_rate != null ? Number(order.commission_rate) : null,
      commission_amount: safeNumber(order.commission_amount),
      commission_status: order.commission_status,
      commission_status_text: commissionStatusText(order.commission_status),
      commission_settle_time: order.commission_settle_time,
      commission_settlement_id: safeString(order.commission_settlement_id),
      commission_settlement_month: safeString(order.commission_settlement_month),
      pay_channel: safeString(order.pay_channel),
      /* pay_mock_flag：仅历史展示/清理识别，不参与正式支付分支（见 member_order.schema pay_mock_flag 说明） */
      pay_channel_display: order.pay_mock_flag
        ? `${safeString(order.pay_channel) || '—'}（历史测试落账·仅展示）`
        : safeString(order.pay_channel),
      source_type: safeString(order.source_type),
      remark: safeString(order.remark),
      created_at: order.created_at,
      updated_at: order.updated_at,
      handle_status: normalizeHandleStatus(order.handle_status),
      handle_status_text: handleStatusText(order.handle_status),
      handle_result: safeString(order.handle_result),
      followup_uid: safeString(order.followup_uid),
      followup_name: safeString(order.followup_name),
      handled_at: order.handled_at
    };

    const customer_current_sales_code = safeString(staffCodeMap[customer_current_sales_id]);

    return {
      code: 200,
      message: 'ok',
      data: {
        order: order_out,
        customer_current_sales_id,
        customer_current_sales_name,
        customer_current_sales_code,
        membership_summary,
        remarks,
        action_logs,
        latest_exception_remark
      }
    };
  } catch (e) {
    console.error('[getMemberOrderDetail]', e);
    return { code: 500, message: e.message || '查询失败' };
  }
};

