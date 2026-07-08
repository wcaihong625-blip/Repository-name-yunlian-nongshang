'use strict';

const { verifyToken } = require('nxt-auth');
const { validateMemberCouponForOrder, roundMoney } = require('nxt-member-coupon');
const {
  loadMembershipPromotionConfig,
  resolveMemberPlan,
  inferPlanKeyFromDays
} = require('nxt-membership-promotion-config');

function safeString(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

module.exports = async (event, context) => {
  const db = uniCloud.database();
  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '未登录');
    }
    const userId = tokenResult.userId;

    const code = safeString(event.code);
    const coupon_id = safeString(event.coupon_id);
    if (!code && !coupon_id) {
      return res(400, '请输入优惠码');
    }

    let orderTypeContext = safeString(event.order_type_context);
    if (!orderTypeContext) {
      const ot = event.order_type;
      if (ot === 1 || ot === '1') orderTypeContext = 'first_open';
      else if (ot === 2 || ot === '2') orderTypeContext = 'renewal';
    }
    if (!orderTypeContext) {
      const cmd = db.command;
      const mCol = db.collection('member_order');
      const userRes = await db.collection('uni-id-users').doc(userId).get();
      const u = userRes.data && userRes.data[0] ? userRes.data[0] : {};
      const mobile = safeString(u.mobile);
      const historyCond = [{ user_id: userId }];
      if (mobile) historyCond.push({ mobile });
      const historyOrderQuery = await mCol
        .where(cmd.and([cmd.or(historyCond), { order_status: 1 }]))
        .orderBy('pay_time', 'asc')
        .limit(1)
        .get();
      orderTypeContext = historyOrderQuery.data && historyOrderQuery.data.length ? 'renewal' : 'first_open';
    }
    if (!['first_open', 'renewal'].includes(orderTypeContext)) {
      return res(400, 'order_type_context 须为 first_open 或 renewal');
    }

    let original_amount = roundMoney(event.original_amount != null ? Number(event.original_amount) : 888);
    try {
      const mpcfg = await loadMembershipPromotionConfig(db);
      const tier = event.member_tier === 'enterprise' ? 'enterprise' : 'personal';
      const planKey =
        event.plan_key && ['month', 'quarter', 'year'].includes(String(event.plan_key))
          ? String(event.plan_key)
          : inferPlanKeyFromDays(event.member_days);
      const rplan = resolveMemberPlan(mpcfg, tier, planKey);
      if (rplan.ok) {
        original_amount = roundMoney(rplan.price);
      }
    } catch (_e) {
      /* 配置读取失败时保留入参原价 */
    }
    if (original_amount <= 0) {
      return res(400, '原价无效');
    }

    const v = await validateMemberCouponForOrder(db, {
      userId,
      orderTypeContext,
      originalAmount: original_amount,
      couponCode: code,
      couponId: coupon_id,
      memberType: event.member_tier,
      planType: event.plan_key
    });

    if (!v.ok) {
      return res(v.code || 400, v.message, { valid: false });
    }

    return res(200, '可用', v.data);
  } catch (err) {
    console.error('validateMemberCouponCode', err);
    return res(500, err.message || '服务器错误');
  }
};

