'use strict';

const { prepareCouponRedeemContext, redeemCouponInTransaction } = require('nxt-member-coupon');
const { loadMembershipPromotionConfig, rightsForTierAndPlan } = require('nxt-membership-promotion-config');

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

/**
 * 是否视为「已支付落账完成」（含历史仅有 order_status=1 的数据）
 */
function isOrderPaidDoc(o) {
  if (!o) return false;
  const ps = o.pay_status;
  if (ps === 1 || ps === '1') return true;
  if (ps === undefined || ps === null || ps === '') {
    return Number(o.order_status) === 1;
  }
  return false;
}

function parsePayTime(input) {
  if (input === undefined || input === null || input === '') {
    return new Date();
  }
  if (input instanceof Date) return input;
  const t = new Date(input).getTime();
  if (Number.isNaN(t)) return new Date();
  return new Date(t);
}

async function findPaidUniPayOrder(db, payload = {}) {
  const orderId = safeString(payload.orderId || payload.member_order_id || payload.biz_order_id);
  const outTradeNo = safeString(payload.out_trade_no || payload.order_no);
  const transactionId = safeString(payload.transaction_id);
  const cmd = db.command;
  const uniPayCollection = db.collection('uni-pay-orders');

  const orList = [];
  if (orderId) {
    orList.push({ 'custom.member_order_id': orderId });
    orList.push({ member_order_id: orderId });
    orList.push({ biz_order_id: orderId });
  }
  if (outTradeNo) {
    orList.push({ out_trade_no: outTradeNo });
    orList.push({ order_no: outTradeNo });
  }
  if (transactionId) {
    orList.push({ transaction_id: transactionId });
  }
  if (!orList.length) return null;

  const q = await uniPayCollection
    .where(
      cmd.and([
        { status: 1 },
        cmd.or(orList)
      ])
    )
    .orderBy('pay_date', 'desc')
    .limit(1)
    .get();
  return (q.data && q.data[0]) || null;
}

function parseRemarkMeta(remark) {
  const out = {};
  try {
    if (remark && typeof remark === 'string' && remark.trim().startsWith('{')) {
      const j = JSON.parse(remark);
      out.member_tier = j.member_tier;
      out.plan_key = j.plan_key;
      out.biz_type = j.biz_type;
      out.from_plan_type = j.from_plan_type || j.from_plan_key || '';
      out.to_plan_type = j.to_plan_type || j.to_plan_key || '';
      out.from_member_type = j.from_member_type || j.from_member_tier || '';
      out.to_member_type = j.to_member_type || j.to_member_tier || '';
      out.order_scene = j.order_scene || '';
    }
  } catch (_e) {
    /* ignore */
  }
  return out;
}

function normalizeMemberType(v, fallback) {
  const s = String(v || '').trim();
  if (s === 'enterprise' || s === 'personal') return s;
  return fallback || 'personal';
}

function normalizePlanType(v, fallback) {
  const s = String(v || '').trim();
  if (s === 'month' || s === 'quarter' || s === 'year') return s;
  return fallback || 'month';
}

/**
 * 支付成功统一落账（幂等）。供 applyMemberOrderPaidResult 云函数与未来微信回调云函数共用。
 * 会员订单更新、用户 VIP、客户档案、优惠码核销在同一事务内提交，避免「已支付但未核销」或反向不一致。
 */
async function applyMemberOrderPaidCore(opts) {
  const db = opts.db;
  const orderId = safeString(opts.orderId);
  const payPayload = opts.payPayload || {};

  if (!orderId) {
    return { ok: false, code: 400, message: '缺少 order_id', data: null };
  }

  const memberOrderCollection = db.collection('member_order');
  const customerProfileCollection = db.collection('customer_profile');
  const usersCollection = db.collection('uni-id-users');
  const uniPayOrdersCollection = db.collection('uni-pay-orders');

  let finalOrderId = orderId;
  let order = opts.preloadedOrder || null;
  if (!order) {
    const orderRes = await memberOrderCollection.doc(finalOrderId).get();
    order = docFromGet(orderRes);
  }
  if (!order) {
    const paidPayOrder = await findPaidUniPayOrder(db, {
      orderId: finalOrderId,
      out_trade_no: payPayload.out_trade_no,
      transaction_id: payPayload.transaction_id
    });
    const paidCustomOrderId = safeString(paidPayOrder && paidPayOrder.custom && paidPayOrder.custom.member_order_id);
    if (paidCustomOrderId) {
      finalOrderId = paidCustomOrderId;
      const orderRes = await memberOrderCollection.doc(finalOrderId).get();
      order = docFromGet(orderRes);
    }
  }
  if (!order) {
    return { ok: false, code: 404, message: '订单不存在', data: null };
  }

  if (Number(order.pay_status) === 2 || Number(order.order_status) === 2) {
    return { ok: false, code: 400, message: '订单已取消，无法落账', data: null };
  }

  if (isOrderPaidDoc(order)) {
    return {
      ok: true,
      code: 200,
      message: '订单已支付（幂等）',
      data: {
        idempotent: true,
        order_id: finalOrderId,
        pay_status: order.pay_status != null ? Number(order.pay_status) : 1,
        order_status: Number(order.order_status)
      }
    };
  }

  const userId = safeString(order.user_id);
  if (!userId) {
    return { ok: false, code: 400, message: '订单缺少 user_id', data: null };
  }

  let userInfo = opts.preloadedUser || null;
  if (!userInfo) {
    const userRes = await usersCollection.doc(userId).get();
    userInfo = docFromGet(userRes);
  }
  if (!userInfo) {
    return { ok: false, code: 404, message: '用户不存在', data: null };
  }

  const pay_time = parsePayTime(payPayload.pay_time);
  const pay_callback_time = payPayload.pay_callback_time != null && payPayload.pay_callback_time !== ''
    ? parsePayTime(payPayload.pay_callback_time)
    : new Date();

  const transaction_id = safeString(payPayload.transaction_id) || `MOCK_TX_${finalOrderId.slice(-8)}_${Date.now()}`;
  const out_trade_no = safeString(payPayload.out_trade_no) || safeString(order.out_trade_no) || safeString(order.order_no);
  const pay_order_no = safeString(payPayload.pay_order_no) || safeString(order.pay_order_no) || safeString(order.order_no);
  const pay_channel = safeString(payPayload.pay_channel) || safeString(order.pay_channel) || 'unknown';

  const pay_amount = safeNumber(order.pay_amount);
  const member_days = order.member_days != null ? Number(order.member_days) : 365;
  const orderTypeNum = Number(order.order_type);
  const isFirstOpen = orderTypeNum === 1;
  const isUpgradeEnterprise = orderTypeNum === 3;

  const remarkMeta = parseRemarkMeta(order.remark);
  const remarkBizUpgrade = remarkMeta.biz_type === 'upgrade_enterprise';
  const remarkBizPeriod = remarkMeta.biz_type === 'upgrade_period';
  const treatAsUpgradeKeepExpire = isUpgradeEnterprise || remarkBizUpgrade;
  const treatAsPeriodUpgrade = orderTypeNum === 4 || remarkBizPeriod;
  const order_scene =
    safeString(order.order_scene) ||
    safeString(remarkMeta.order_scene) ||
    (treatAsUpgradeKeepExpire ? 'upgrade_member_type' : treatAsPeriodUpgrade ? 'upgrade_plan' : isFirstOpen ? 'new' : 'renew');

  const final_sales_id = safeString(order.sales_id);
  let commission_rate = 0;
  let commission_amount = 0;
  const commission_type = isFirstOpen ? 'first_open' : 'renewal';

  if (final_sales_id) {
    const staffRes = await db.collection('sales_staff').doc(final_sales_id).get();
    const staff = docFromGet(staffRes);
    if (staff) {
      commission_rate = isFirstOpen
        ? safeNumber(staff.base_commission_rate_first)
        : safeNumber(staff.base_commission_rate_renew);
      if (pay_amount > 0) {
        commission_amount = Number((pay_amount * commission_rate).toFixed(2));
      }
    }
  }

  const nowTs = pay_time.getTime();
  const vipRaw = userInfo.vip_expire_time;
  const expire_time_before_ts = vipRaw
    ? (vipRaw instanceof Date ? vipRaw.getTime() : new Date(vipRaw).getTime())
    : nowTs;
  let expire_time_after_ts;
  if (treatAsUpgradeKeepExpire) {
    /** order_type=3 / upgrade_enterprise：企业类型升级，vip 到期戳不变，仅 member_type→enterprise */
    expire_time_after_ts = expire_time_before_ts;
  } else if (treatAsPeriodUpgrade) {
    /** order_type=4 / upgrade_period：周期档位升级，新到期=原到期+目标整段天数（非从支付日起算，非补差价换周期） */
    expire_time_after_ts = expire_time_before_ts + member_days * 24 * 60 * 60 * 1000;
  } else {
    expire_time_after_ts = Math.max(nowTs, expire_time_before_ts);
    expire_time_after_ts += member_days * 24 * 60 * 60 * 1000;
  }

  const expire_time_before = new Date(expire_time_before_ts);
  const expire_time_after = new Date(expire_time_after_ts);
  const vip_expire_time = expire_time_after_ts;

  const dateObj = new Date(vip_expire_time);
  const vip_expire_time_text = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;

  const customerId = safeString(order.customer_id);

  const finalMemberType = treatAsUpgradeKeepExpire
    ? 'enterprise'
    : normalizeMemberType(
        order.to_member_type || order.member_type || remarkMeta.to_member_type || remarkMeta.member_tier,
        userInfo.member_type === 'enterprise' ? 'enterprise' : 'personal'
      );
  const finalPlanType = normalizePlanType(
    order.to_plan_type ||
      order.plan_type ||
      remarkMeta.to_plan_type ||
      remarkMeta.plan_key ||
      userInfo.member_plan_key,
    'month'
  );
  const fromMemberType = normalizeMemberType(
    order.from_member_type || remarkMeta.from_member_type || userInfo.member_type,
    userInfo.member_type === 'enterprise' ? 'enterprise' : 'personal'
  );
  const fromPlanType = normalizePlanType(
    order.from_plan_type || remarkMeta.from_plan_type || userInfo.member_plan_key || finalPlanType,
    finalPlanType
  );

  let rights = null;
  try {
    const cfg = await loadMembershipPromotionConfig(db);
    rights = rightsForTierAndPlan(cfg, finalMemberType, finalPlanType);
  } catch (_e) {
    rights = null;
  }
  const gift_top_days = Number(order.gift_top_days != null ? order.gift_top_days : rights && rights.gift_top_days) || 0;
  const gift_boost_days = Number(order.gift_boost_days != null ? order.gift_boost_days : rights && rights.gift_boost_days) || 0;

  const paidAmountOverride = payPayload.paid_amount;
  const updateDoc = {
    pay_status: 1,
    order_status: 1,
    pay_time,
    pay_channel,
    transaction_id,
    out_trade_no,
    pay_order_no,
    pay_callback_time,
    expire_time_before,
    expire_time_after,
    commission_type,
    commission_rate,
    commission_amount,
    commission_status: order.commission_status != null ? order.commission_status : 0,
    order_scene,
    member_type: finalMemberType,
    plan_type: finalPlanType,
    member_days,
    gift_top_days,
    gift_boost_days,
    from_member_type: fromMemberType,
    to_member_type: finalMemberType,
    from_plan_type: fromPlanType,
    to_plan_type: finalPlanType,
    updated_at: new Date()
  };
  if (paidAmountOverride != null && !isNaN(Number(paidAmountOverride))) {
    updateDoc.pay_amount = Number(paidAmountOverride);
  }

  const userUpdate = {
    is_vip: true,
    vip_expire_time,
    vip_expire_time_text,
    member_type: finalMemberType,
    member_plan_key: finalPlanType,
    gift_top_used: 0,
    gift_boost_used: 0
  };

  let customerUpdate = null;
  let profile = opts.preloadedCustomerProfile || null;
  if (customerId) {
    if (!profile) {
      const profRes = await customerProfileCollection.doc(customerId).get();
      profile = docFromGet(profRes);
    }
    if (profile) {
      if (isFirstOpen) {
        customerUpdate = {
          member_expire_time: expire_time_after,
          member_status: 1,
          member_type: finalMemberType,
          member_plan_key: finalPlanType,
          gift_top_days: gift_top_days,
          gift_boost_days: gift_boost_days,
          member_first_open_time: profile.member_first_open_time || pay_time,
          member_last_renew_time: pay_time,
          updated_at: new Date()
        };
      } else {
        customerUpdate = {
          member_expire_time: expire_time_after,
          member_status: 1,
          member_type: finalMemberType,
          member_plan_key: finalPlanType,
          gift_top_days: gift_top_days,
          gift_boost_days: gift_boost_days,
          member_last_renew_time: pay_time,
          updated_at: new Date()
        };
      }
    }
  }

  const preparedCouponRedeem = opts.preparedCouponRedeem || await prepareCouponRedeemContext(db, finalOrderId, order, updateDoc);
  if (!preparedCouponRedeem.ok) {
    return {
      ok: false,
      code: 400,
      message: preparedCouponRedeem.message || '优惠码核销校验失败',
      data: null
    };
  }

  const transaction = await db.startTransaction();
  try {
    await transaction.collection('member_order').doc(finalOrderId).update(updateDoc);
    await transaction.collection('uni-id-users').doc(userId).update(userUpdate);
    if (customerId && customerUpdate) {
      await transaction.collection('customer_profile').doc(customerId).update(customerUpdate);
    }

    const redeemRes = await redeemCouponInTransaction(transaction, db, finalOrderId, order, updateDoc, preparedCouponRedeem);
    if (!redeemRes.ok) {
      throw new Error(redeemRes.message || '优惠码核销失败');
    }

    await transaction.commit();
  } catch (err) {
    try {
      await transaction.rollback();
    } catch (_rb) {
      /* ignore */
    }
    console.error('[applyMemberOrderPaidCore] transaction failed', err);
    return {
      ok: false,
      code: 500,
      message: err.message || '支付落账失败',
      data: null
    };
  }

  const extraOr = [];
  if (out_trade_no) {
    extraOr.push({ out_trade_no });
    extraOr.push({ order_no: out_trade_no });
  }
  if (transaction_id) {
    extraOr.push({ transaction_id });
  }
  if (extraOr.length) {
    try {
      const cmd = db.command;
      const extraRowsRes = await uniPayOrdersCollection
        .where(cmd.or(extraOr))
        .limit(50)
        .get();
      const extraRows = extraRowsRes.data || [];
      for (const row of extraRows) {
        if (!row || !row._id) continue;
        await uniPayOrdersCollection.doc(row._id).update({
          biz_type: 'member_order',
          biz_order_id: finalOrderId,
          member_order_id: finalOrderId,
          user_order_success: true,
          updated_at: new Date()
        });
      }
    } catch (e) {
      console.error('[applyMemberOrderPaidCore] update user_order_success failed', {
        out_trade_no,
        transaction_id,
        member_order_id: finalOrderId,
        message: e && e.message
      });
    }
  }

  return {
    ok: true,
    code: 200,
    message: '支付落账成功',
    data: {
      idempotent: false,
      order_id: finalOrderId,
      commission_amount,
      vip_expire_time_text,
      order_type: order.order_type,
      order_scene,
      member_type: finalMemberType,
      plan_type: finalPlanType,
      gift_top_days,
      gift_boost_days,
      pay_status: 1,
      transaction_id,
      out_trade_no,
      pay_order_no
    }
  };
}

module.exports = {
  safeString,
  isOrderPaidDoc,
  applyMemberOrderPaidCore,
  findPaidUniPayOrder
};
