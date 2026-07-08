'use strict';

const { resolveMemberPlan, planDays } = require('nxt-membership-promotion-config');
const { roundMoney } = require('nxt-member-coupon');

function parseOrderRemarkJson(rmk) {
  if (!rmk || typeof rmk !== 'string') return null;
  const s = rmk.trim();
  if (!s.startsWith('{')) return null;
  try {
    return JSON.parse(s);
  } catch (_e) {
    return null;
  }
}

function shouldSkipOrderForEnterprisePlanInfer(o, j) {
  const ot = Number(o.order_type);
  if (ot === 3) return true;
  if (j && j.biz_type === 'upgrade_enterprise') return true;
  return false;
}

/**
 * 从已支付会员订单备注中推断最近一次「个人会员」购买周期（月/季/年），用于升级时与企业同周期对齐。
 * 跳过个人→企业升级单（order_type=3 或备注 upgrade_enterprise）；保留周期升级单（同 tier）。
 */
function inferPersonalPlanKeyFromPaidOrders(orders) {
  const list = Array.isArray(orders) ? orders : [];
  for (const o of list) {
    const j = parseOrderRemarkJson(o.remark);
    if (!j) continue;
    if (shouldSkipOrderForEnterprisePlanInfer(o, j)) continue;
    const pk = j.plan_key != null ? String(j.plan_key).trim() : '';
    if (j.member_tier === 'personal' && ['month', 'quarter', 'year'].includes(pk)) {
      return pk;
    }
  }
  return '';
}

/** 续费入口：取最近一次个人/企业会员单的周期（跳过个人→企业升级单） */
function inferLastPlanKeyFromPaidOrders(orders) {
  const list = Array.isArray(orders) ? orders : [];
  for (const o of list) {
    const j = parseOrderRemarkJson(o.remark);
    if (!j) continue;
    if (shouldSkipOrderForEnterprisePlanInfer(o, j)) continue;
    const pk = j.plan_key != null ? String(j.plan_key).trim() : '';
    if (
      (j.member_tier === 'personal' || j.member_tier === 'enterprise') &&
      ['month', 'quarter', 'year'].includes(pk)
    ) {
      return pk;
    }
  }
  return '';
}

/**
 * 当前会员周期（月/季/年）：与 member_type 一致的最近已支付单备注 plan_key。
 * 跳过个人→企业升级单（order_type=3）。
 */
function inferPlanKeyFromPaidOrdersForTier(orders, memberTier) {
  const tier = memberTier === 'enterprise' ? 'enterprise' : 'personal';
  const list = Array.isArray(orders) ? orders : [];
  for (const o of list) {
    const j = parseOrderRemarkJson(o.remark);
    if (!j) continue;
    if (shouldSkipOrderForEnterprisePlanInfer(o, j)) continue;
    const pk = j.plan_key != null ? String(j.plan_key).trim() : '';
    if (j.member_tier === tier && ['month', 'quarter', 'year'].includes(pk)) {
      return pk;
    }
  }
  return '';
}

function planRank(planKey) {
  const pk = planKey != null ? String(planKey).trim() : '';
  if (pk === 'month') return 1;
  if (pk === 'quarter') return 2;
  if (pk === 'year') return 3;
  return 0;
}

function planLabelZh(planKey) {
  const pk = planKey != null ? String(planKey).trim() : '';
  if (pk === 'month') return '月卡';
  if (pk === 'quarter') return '季卡';
  if (pk === 'year') return '年卡';
  return '会员';
}

function formatVipExpireTextFromTs(ts) {
  const t = Number(ts);
  if (!Number.isFinite(t) || t <= 0) return '';
  const dateObj = new Date(t);
  if (Number.isNaN(dateObj.getTime())) return '';
  return `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')} ${String(
    dateObj.getHours()
  ).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}:${String(dateObj.getSeconds()).padStart(2, '0')}`;
}

function userVipExpireTs(user) {
  const raw = user && user.vip_expire_time;
  if (raw instanceof Date) return raw.getTime();
  if (raw != null && raw !== '') {
    const t = new Date(raw).getTime();
    return Number.isNaN(t) ? 0 : t;
  }
  return 0;
}

/**
 * 企业类型升级（个人→企业）计价：非「周期顺延」。
 * 剩余价值 = 个人同档套餐标价 × min(1, 剩余毫秒/该档周期毫秒)；应付 = max(0, 企业同档标价 − 剩余价值)。
 * 支付落账后：到期日不变，仅 member_type 与权益变更。
 */
function computeUpgradeQuote(mpcfg, planKey, vipExpireTs, nowTs) {
  const pk = ['month', 'quarter', 'year'].includes(planKey) ? planKey : 'year';
  const personal = resolveMemberPlan(mpcfg, 'personal', pk);
  const enterprise = resolveMemberPlan(mpcfg, 'enterprise', pk);
  if (!personal.ok) {
    return { ok: false, message: personal.message || '个人套餐无效' };
  }
  if (!enterprise.ok) {
    return { ok: false, message: enterprise.message || '企业套餐无效' };
  }

  const periodMs = planDays(pk) * 86400000;
  const remainingMs = Math.max(0, Number(vipExpireTs) - Number(nowTs));
  const ratio = periodMs > 0 ? Math.min(1, remainingMs / periodMs) : 0;
  const remaining_value = roundMoney(personal.price * ratio);
  const enterprise_price = roundMoney(enterprise.price);
  const upgrade_pay = roundMoney(Math.max(0, enterprise_price - remaining_value));
  const discount_amount = roundMoney(Math.max(0, enterprise_price - upgrade_pay));

  return {
    ok: true,
    plan_key: pk,
    period_days: planDays(pk),
    remaining_ms: remainingMs,
    remaining_days_ceil: Math.max(0, Math.ceil(remainingMs / 86400000)),
    personal_price: personal.price,
    enterprise_price,
    remaining_ratio: ratio,
    remaining_value,
    upgrade_pay,
    discount_amount
  };
}

async function fetchPaidMemberOrders(db, userId, limit) {
  const lim = limit != null ? Number(limit) : 40;
  const r = await db
    .collection('member_order')
    .where({ user_id: userId, pay_status: 1 })
    .orderBy('pay_time', 'desc')
    .limit(Number.isFinite(lim) && lim > 0 ? lim : 40)
    .get();
  return r.data || [];
}

/**
 * 为当前登录用户计算升级企业会员报价（不落库）。
 */
/**
 * 周期档位升级预览（同档 personal/enterprise：月→季、月→年、季→年）。
 * 支付金额 = 目标套餐当前标价（不按个人剩余价值抵扣）。
 * 新到期 = 当前 vip 到期时刻 + 目标档完整天数（季 90、年 365、月 30）；剩余未到期时长保留在时间轴内，不从「今日」重算周期。
 */
async function buildPlanPeriodUpgradeQuoteForUser(db, userDoc, mpcfg, targetPlanKey, nowTs) {
  const now = nowTs != null ? nowTs : Date.now();
  const expTs = userVipExpireTs(userDoc);
  const tier = userDoc.member_type === 'enterprise' ? 'enterprise' : userDoc.member_type === 'personal' ? 'personal' : '';

  if (tier !== 'personal' && tier !== 'enterprise') {
    return { ok: false, message: '仅个人或企业会员可办理周期升级' };
  }
  if (!(userDoc.is_vip === true && expTs > now)) {
    return { ok: false, message: '当前非有效会员，无法周期升级' };
  }

  const tgt = targetPlanKey != null ? String(targetPlanKey).trim() : '';
  if (!['quarter', 'year'].includes(tgt)) {
    return { ok: false, message: '目标周期仅支持季卡或年卡' };
  }

  const userId = userDoc._id;
  const orders = await fetchPaidMemberOrders(db, userId, 40);
  const currentPlan = inferPlanKeyFromPaidOrdersForTier(orders, tier);
  if (!currentPlan) {
    return { ok: false, message: '无法识别当前套餐周期，请联系客服或先完成续费' };
  }

  const r0 = planRank(currentPlan);
  const r1 = planRank(tgt);
  if (!(r1 > r0)) {
    return { ok: false, message: '仅支持升级至更长周期（月→季/年，季→年）' };
  }

  const resolved = resolveMemberPlan(mpcfg, tier, tgt);
  if (!resolved.ok) {
    return { ok: false, message: resolved.message || '目标套餐无效' };
  }

  const addMs = planDays(tgt) * 86400000;
  const newExpireTs = expTs + addMs;

  return {
    ok: true,
    member_tier: tier,
    current_plan_key: currentPlan,
    target_plan_key: tgt,
    target_plan_label: planLabelZh(tgt),
    current_plan_label: planLabelZh(currentPlan),
    member_tier_label: tier === 'enterprise' ? '企业' : '个人',
    pay_amount: roundMoney(resolved.price),
    target_price: roundMoney(resolved.price),
    target_days: resolved.days,
    vip_expire_time_text: userDoc.vip_expire_time_text || formatVipExpireTextFromTs(expTs),
    new_expire_time_text: formatVipExpireTextFromTs(newExpireTs)
  };
}

/** 个人→企业类型升级预览（不落库）。与 computeUpgradeQuote 一致：应付为折算价，非周期顺延、不延长到期。 */
async function buildUpgradeQuoteForUser(db, userDoc, mpcfg, nowTs) {
  const now = nowTs != null ? nowTs : Date.now();
  const expTs = userVipExpireTs(userDoc);
  const mt = userDoc.member_type || 'free';

  if (mt !== 'personal') {
    return { ok: false, message: '仅个人会员可升级为企业会员' };
  }
  if (!(userDoc.is_vip === true && expTs > now)) {
    return { ok: false, message: '当前非有效个人会员，无法升级' };
  }

  const userId = userDoc._id;
  const orders = await fetchPaidMemberOrders(db, userId, 40);
  let planKey = inferPersonalPlanKeyFromPaidOrders(orders);
  if (!planKey) {
    planKey = 'year';
  }

  const q = computeUpgradeQuote(mpcfg, planKey, expTs, now);
  if (!q.ok) {
    return q;
  }

  return {
    ok: true,
    ...q,
    plan_key_inferred: planKey,
    vip_expire_time: expTs,
    vip_expire_time_text: userDoc.vip_expire_time_text || ''
  };
}

module.exports = {
  parseOrderRemarkJson,
  inferPersonalPlanKeyFromPaidOrders,
  inferLastPlanKeyFromPaidOrders,
  inferPlanKeyFromPaidOrdersForTier,
  planRank,
  planLabelZh,
  formatVipExpireTextFromTs,
  computeUpgradeQuote,
  fetchPaidMemberOrders,
  userVipExpireTs,
  buildPlanPeriodUpgradeQuoteForUser,
  buildUpgradeQuoteForUser
};
