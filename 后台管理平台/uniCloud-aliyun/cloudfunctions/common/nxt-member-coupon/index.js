'use strict';

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function safeNumber(value) {
  const n = Number(value);
  return value === undefined || value === null || Number.isNaN(n) ? 0 : n;
}

function docFromGet(res) {
  const d = res && res.data;
  if (d == null) return null;
  if (Array.isArray(d)) return d.length ? d[0] : null;
  if (typeof d === 'object') return d;
  return null;
}

function normalizeCode(code) {
  return safeString(code).toUpperCase().replace(/\s+/g, '');
}

function roundMoney(n) {
  return Math.round(safeNumber(n) * 100) / 100;
}

function normalizeCouponType(coupon) {
  const t = safeString(coupon && coupon.coupon_type).toLowerCase();
  if (['amount', 'fixed', 'fixed_amount', 'cash'].includes(t)) return 'amount';
  if (['discount', 'rate', 'percent'].includes(t)) return 'discount';
  if (['free', 'zero', 'zero_amount'].includes(t)) return 'free';
  return t || 'amount';
}

function normalizeScene(v) {
  const s = safeString(v).toLowerCase();
  if (['first', 'first_open', 'new', 'open'].includes(s)) return 'first_open';
  if (['renew', 'renewal'].includes(s)) return 'renewal';
  return s;
}

function normalizeMemberType(v) {
  const s = safeString(v).toLowerCase();
  if (s === 'enterprise') return 'enterprise';
  if (s === 'personal') return 'personal';
  return '';
}

function normalizePlanType(v) {
  const s = safeString(v).toLowerCase();
  if (['month', 'quarter', 'year'].includes(s)) return s;
  return '';
}

function normalizeScopeList(value, allowed) {
  if (value == null || value === '') return ['all'];
  const raw = Array.isArray(value)
    ? value
    : String(value)
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean);
  const list = raw.map((x) => safeString(x).toLowerCase()).filter((x) => x === 'all' || allowed.includes(x));
  if (!list.length || list.includes('all')) return ['all'];
  return Array.from(new Set(list));
}

function parseDate(input) {
  if (input === undefined || input === null || input === '') return null;
  if (input instanceof Date) return input;
  const t = new Date(input).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

/**
 * 计算优惠：返回 { discount_amount, pay_amount }
 */
function computeCouponPricing(coupon, originalAmount) {
  const orig = roundMoney(originalAmount);
  const type = normalizeCouponType(coupon);
  const amountValue = safeNumber(
    coupon.discount_amount != null ? coupon.discount_amount : coupon.amount != null ? coupon.amount : coupon.discount_value
  );
  const rateValue = safeNumber(
    coupon.discount_rate != null ? coupon.discount_rate : coupon.rate != null ? coupon.rate : coupon.discount_value
  );

  if (type === 'free') {
    return { discount_amount: orig, pay_amount: 0 };
  }
  if (type === 'amount') {
    const disc = Math.min(orig, roundMoney(amountValue));
    const pay = Math.max(0, roundMoney(orig - disc));
    return { discount_amount: roundMoney(orig - pay), pay_amount: pay };
  }
  if (type === 'discount') {
    let rate = rateValue;
    if (rate > 1 && rate <= 100) rate = rate / 100;
    if (rate <= 0 || rate > 1) {
      return { discount_amount: 0, pay_amount: orig };
    }
    const pay = roundMoney(orig * rate);
    return { discount_amount: roundMoney(orig - pay), pay_amount: pay };
  }
  return { discount_amount: 0, pay_amount: orig };
}

function scopeMatches(couponScope, orderTypeContext) {
  const s = safeString(couponScope) || 'all';
  const ctx = normalizeScene(orderTypeContext);
  if (s === 'all') return true;
  if (ctx === 'first_open') return s === 'first_open';
  if (ctx === 'renewal') return s === 'renewal';
  return false;
}

function useSceneMatches(coupon, orderTypeContext) {
  const useScene = safeString(coupon.use_scene || coupon.usage_scope);
  if (!useScene) return scopeMatches(coupon.scope, orderTypeContext);
  const s = normalizeScene(useScene);
  if (s === 'all') return true;
  return s === normalizeScene(orderTypeContext);
}

function memberTypeMatches(coupon, memberType) {
  const mt = normalizeMemberType(memberType);
  if (!mt) return true;
  const scope = coupon.apply_member_types != null ? coupon.apply_member_types : coupon.member_type_scope;
  const list = normalizeScopeList(scope, ['personal', 'enterprise']);
  return list.includes('all') || list.includes(mt);
}

function planTypeMatches(coupon, planType) {
  const pt = normalizePlanType(planType);
  if (!pt) return true;
  const scope = coupon.apply_plan_types != null ? coupon.apply_plan_types : coupon.plan_type_scope;
  const list = normalizeScopeList(scope, ['month', 'quarter', 'year']);
  return list.includes('all') || list.includes(pt);
}

async function loadCouponDoc(db, couponId, couponCode) {
  const col = db.collection('member_coupon_code');
  if (couponId) {
    const r = await col.doc(safeString(couponId)).get();
    const d = docFromGet(r);
    if (d) return d;
  }
  const code = normalizeCode(couponCode);
  if (!code) return null;
  const r2 = await col.where({ code }).limit(1).get();
  return r2.data && r2.data[0] ? r2.data[0] : null;
}

async function countUserUses(db, codeId, userId) {
  if (!codeId || !userId) return 0;
  const r = await db
    .collection('member_coupon_use_log')
    .where({ code_id: codeId, user_id: userId, status: 'used' })
    .count();
  return r.total || 0;
}

/**
 * 校验优惠码是否可用于当前用户与订单场景（不核销）
 * orderTypeContext: 'first_open' | 'renewal'
 */
async function validateMemberCouponForOrder(db, params) {
  const userId = safeString(params.userId);
  const orderTypeContext = normalizeScene(params.orderTypeContext || params.scene);
  const memberType = normalizeMemberType(params.memberType || params.member_tier);
  const planType = normalizePlanType(params.planType || params.plan_key);
  const originalAmount = roundMoney(params.originalAmount);
  const couponId = safeString(params.couponId);
  const couponCode = normalizeCode(params.couponCode);

  if (!couponId && !couponCode) {
    return { ok: false, code: 400, message: '请提供优惠码' };
  }
  if (!userId) {
    return { ok: false, code: 401, message: '用户未登录' };
  }
  if (originalAmount <= 0) {
    return { ok: false, code: 400, message: '原价无效' };
  }

  const coupon = await loadCouponDoc(db, couponId, couponCode);
  if (!coupon) {
    return { ok: false, code: 404, message: '优惠码不存在' };
  }
  if (coupon.status !== 'enabled') {
    return { ok: false, code: 400, message: '优惠码已停用' };
  }

  const now = Date.now();
  const st = parseDate(coupon.start_time);
  const et = parseDate(coupon.end_time);
  if (st && now < st.getTime()) {
    return { ok: false, code: 400, message: '优惠码尚未生效' };
  }
  if (et && now > et.getTime()) {
    return { ok: false, code: 400, message: '优惠码已过期' };
  }

  if (!useSceneMatches(coupon, orderTypeContext)) {
    return { ok: false, code: 400, message: '优惠码不适用于当前订单类型' };
  }
  if (!memberTypeMatches(coupon, memberType)) {
    return { ok: false, code: 400, message: '优惠码不适用于当前会员类型' };
  }
  if (!planTypeMatches(coupon, planType)) {
    return { ok: false, code: 400, message: '优惠码不适用于当前套餐周期' };
  }

  const maxUse = coupon.max_use_count != null ? Number(coupon.max_use_count) : 1;
  const used = Number(coupon.used_count || 0);
  if (used >= maxUse) {
    return { ok: false, code: 400, message: '优惠码可用次数已用尽' };
  }

  const maxPerUser = coupon.max_use_per_user != null ? Number(coupon.max_use_per_user) : 1;
  const uUses = await countUserUses(db, coupon._id, userId);
  if (uUses >= maxPerUser) {
    return { ok: false, code: 400, message: '您已使用过该优惠码' };
  }

  const { discount_amount, pay_amount } = computeCouponPricing(coupon, originalAmount);

  return {
    ok: true,
    code: 200,
    message: 'ok',
    data: {
      valid: true,
      coupon: {
        _id: coupon._id,
        code: coupon.code,
        batch_id: coupon.batch_id,
        batch_name: coupon.batch_name,
        coupon_type: normalizeCouponType(coupon),
        discount_value: coupon.discount_value,
        discount_amount: coupon.discount_amount,
        discount_rate: coupon.discount_rate,
        scope: coupon.scope || 'all',
        use_scene: coupon.use_scene || coupon.usage_scope || coupon.scope || 'all',
        member_type_scope: coupon.member_type_scope || 'all',
        plan_type_scope: coupon.plan_type_scope || 'all',
        apply_member_types: normalizeScopeList(coupon.apply_member_types != null ? coupon.apply_member_types : coupon.member_type_scope, ['personal', 'enterprise']),
        apply_plan_types: normalizeScopeList(coupon.apply_plan_types != null ? coupon.apply_plan_types : coupon.plan_type_scope, ['month', 'quarter', 'year'])
      },
      original_amount: originalAmount,
      discount_amount,
      pay_amount,
      is_zero_order: pay_amount === 0
    }
  };
}

async function prepareCouponRedeemContext(db, orderId, orderBeforeUpdate, updateDoc) {
  const oid = safeString(orderId);
  const codeId = safeString(orderBeforeUpdate.coupon_id || orderBeforeUpdate.coupon_code_id);
  const codeStr = normalizeCode(orderBeforeUpdate.coupon_code);
  if (!codeId && !codeStr) {
    return { ok: true, skip: true };
  }

  const logColl = db.collection('member_coupon_use_log');
  const dedupeKey = `${oid}_${codeId || codeStr}`;
  const exist = await logColl.where({ order_id: oid, status: 'used' }).limit(1).get();
  if (exist.data && exist.data.length) {
    return { ok: true, skip: true, existed: exist.data[0] };
  }
  const dedupeExist = await logColl.where({ dedupe_key: dedupeKey }).limit(1).get();
  if (dedupeExist.data && dedupeExist.data.length) {
    return { ok: true, skip: true, existed: dedupeExist.data[0] };
  }

  let coupon = null;
  if (codeId) {
    coupon = await loadCouponDoc(db, codeId, '');
  }
  if (!coupon && codeStr) {
    coupon = await loadCouponDoc(db, '', codeStr);
  }
  if (!coupon) {
    return { ok: false, message: '订单关联的优惠码不存在' };
  }

  const maxUse = coupon.max_use_count != null ? Number(coupon.max_use_count) : 1;
  const maxPerUser = coupon.max_use_per_user != null ? Number(coupon.max_use_per_user) : 1;
  const userId = safeString(orderBeforeUpdate.user_id);

  const usedNow = Number(coupon.used_count || 0);
  if (usedNow >= maxUse) {
    return { ok: false, message: '优惠码可用次数已用尽' };
  }

  const userUseCount = await countUserUses(db, coupon._id, userId);
  if (userUseCount >= maxPerUser) {
    return { ok: false, message: '该用户已使用过此优惠码' };
  }

  const payAfter =
    updateDoc.pay_amount != null && !Number.isNaN(Number(updateDoc.pay_amount))
      ? roundMoney(updateDoc.pay_amount)
      : roundMoney(orderBeforeUpdate.pay_amount);
  const payBefore = roundMoney(orderBeforeUpdate.original_amount);
  let discAmt =
    updateDoc.discount_amount != null && !Number.isNaN(Number(updateDoc.discount_amount))
      ? roundMoney(updateDoc.discount_amount)
      : roundMoney(orderBeforeUpdate.discount_amount);
  if (!discAmt && payBefore >= payAfter) {
    discAmt = roundMoney(payBefore - payAfter);
  }

  return {
    ok: true,
    skip: false,
    coupon,
    maxUse,
    dedupeKey,
    logDoc: {
      dedupe_key: dedupeKey,
      code_id: coupon._id,
      code: coupon.code,
      batch_id: coupon.batch_id || '',
      batch_name: coupon.batch_name || '',
      order_id: oid,
      order_no: orderBeforeUpdate.order_no || '',
      user_id: userId,
      customer_id: orderBeforeUpdate.customer_id || '',
      mobile: orderBeforeUpdate.mobile || '',
      used_at: new Date(),
      status: 'used',
      pay_amount_before: payBefore,
      discount_amount: discAmt,
      pay_amount_after: payAfter,
      member_type: orderBeforeUpdate.to_member_type || orderBeforeUpdate.member_type || '',
      plan_type: orderBeforeUpdate.to_plan_type || orderBeforeUpdate.plan_type || '',
      order_scene: orderBeforeUpdate.order_scene || '',
      order_type: orderBeforeUpdate.order_type || '',
      created_at: new Date()
    }
  };
}

/**
 * 支付成功事务内核销（事务内只写；查询由 prepareCouponRedeemContext 在事务外完成）
 */
async function redeemCouponInTransaction(transaction, db, orderId, orderBeforeUpdate, updateDoc, preparedContext) {
  const prepared = preparedContext;
  if (!prepared) {
    return { ok: false, message: '缺少事务前优惠码核销上下文' };
  }
  if (!prepared.ok || prepared.skip) {
    return prepared;
  }

  const cmd = db.command;
  await transaction.collection('member_coupon_code').doc(prepared.coupon._id).update({
    used_count: cmd.inc(1)
  });
  await transaction.collection('member_coupon_use_log').add(prepared.logDoc);

  return { ok: true };
}

module.exports = {
  normalizeCode,
  computeCouponPricing,
  validateMemberCouponForOrder,
  prepareCouponRedeemContext,
  redeemCouponInTransaction,
  safeString,
  roundMoney,
  normalizeScopeList
};
