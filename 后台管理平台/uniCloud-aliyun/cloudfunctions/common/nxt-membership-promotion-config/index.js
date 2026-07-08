'use strict';

/**
 * 会员与推广运营配置：存 platform_settings.default.membership_promotion_config
 *
 * member_rights 按「会员类型 + 套餐周期」嵌套：personal|enterprise -> month|quarter|year
 * 赠送置顶 / 加急为「天数」额度（gift_top_days / gift_boost_days），与 uni-id-users 上
 * gift_top_used / gift_boost_used 对应，语义为已消耗天数额度（与历史 gift_*_count 字段兼容）。
 */

const DEFAULT_CONFIG = {
  member_plans: {
    personal: {
      month: { price: 68, enabled: true },
      quarter: { price: 188, enabled: true },
      year: { price: 598, enabled: true }
    },
    enterprise: {
      month: { price: 138, enabled: true },
      quarter: { price: 388, enabled: true },
      year: { price: 1298, enabled: true }
    }
  },
  member_rights: {
    personal: {
      month: {
        contact_purchase_quota: 50,
        gift_top_days: 2,
        gift_boost_days: 4,
        priority_display: true,
        full_data_access: true
      },
      quarter: {
        contact_purchase_quota: 50,
        gift_top_days: 8,
        gift_boost_days: 18,
        priority_display: true,
        full_data_access: true
      },
      year: {
        contact_purchase_quota: 50,
        gift_top_days: 30,
        gift_boost_days: 72,
        priority_display: true,
        full_data_access: true
      }
    },
    enterprise: {
      month: {
        contact_purchase_quota: 200,
        gift_top_days: 4,
        gift_boost_days: 10,
        priority_display: true,
        full_data_access: true,
        enterprise_badge: true
      },
      quarter: {
        contact_purchase_quota: 200,
        gift_top_days: 18,
        gift_boost_days: 42,
        priority_display: true,
        full_data_access: true,
        enterprise_badge: true
      },
      year: {
        contact_purchase_quota: 200,
        gift_top_days: 70,
        gift_boost_days: 150,
        priority_display: true,
        full_data_access: true,
        enterprise_badge: true
      }
    }
  },
  promotion_prices: {
    top: {
      free: { 1: 14, 3: 36, 7: 78 },
      personal: { 1: 12, 3: 32, 7: 70 },
      enterprise: { 1: 10, 3: 28, 7: 62 }
    },
    boost: {
      free: { 1: 9, 3: 25, 7: 56 },
      personal: { 1: 8, 3: 22, 7: 50 },
      enterprise: { 1: 7, 3: 20, 7: 45 }
    }
  },
  feature_switches: {
    personal_member_enabled: true,
    enterprise_member_enabled: true,
    promotion_top_enabled: true,
    promotion_boost_enabled: true,
    purchase_contact_member_only: true
  }
};

function isPlainObject(o) {
  return o && typeof o === 'object' && !Array.isArray(o);
}

function deepMerge(base, patch) {
  if (!isPlainObject(patch)) return JSON.parse(JSON.stringify(base));
  const out = JSON.parse(JSON.stringify(base));
  for (const k of Object.keys(patch)) {
    const pv = patch[k];
    const bv = out[k];
    if (isPlainObject(pv) && isPlainObject(bv)) {
      out[k] = deepMerge(bv, pv);
    } else {
      out[k] = pv;
    }
  }
  return out;
}

function isNestedMemberRightsTier(tierObj) {
  if (!isPlainObject(tierObj)) return false;
  return isPlainObject(tierObj.month) && isPlainObject(tierObj.quarter) && isPlainObject(tierObj.year);
}

function normalizePlanKey(planKey) {
  const pk = planKey != null ? String(planKey).trim() : '';
  if (pk === 'month' || pk === 'quarter' || pk === 'year') return pk;
  return 'month';
}

/**
 * 将历史「扁平」member_rights.personal / .enterprise 转为月季年三套（数值先复制到三档，便于后台再改）。
 */
function sanitizeMemberRightsTier(tierObj, tier, defaultTierNested) {
  const base = defaultTierNested && isPlainObject(defaultTierNested) ? defaultTierNested : DEFAULT_CONFIG.member_rights[tier] || {};
  if (!isPlainObject(tierObj)) {
    return JSON.parse(JSON.stringify(base));
  }
  if (isNestedMemberRightsTier(tierObj)) {
    const out = {};
    for (const pk of ['month', 'quarter', 'year']) {
      out[pk] = normalizeRightsRow(base[pk] || {}, isPlainObject(tierObj[pk]) ? tierObj[pk] : {});
    }
    return out;
  }

  const legacy = tierObj;
  const rowFrom = (defPlan) => {
    const d = defPlan || {};
    const gt =
      Number(legacy.gift_top_days != null ? legacy.gift_top_days : legacy.gift_top_count != null ? legacy.gift_top_count : d.gift_top_days != null ? d.gift_top_days : d.gift_top_count) || 0;
    const gb =
      Number(legacy.gift_boost_days != null ? legacy.gift_boost_days : legacy.gift_boost_count != null ? legacy.gift_boost_count : d.gift_boost_days != null ? d.gift_boost_days : d.gift_boost_count) || 0;
    return normalizeRightsRow(d, {
      contact_purchase_quota: legacy.contact_purchase_quota,
      gift_top_days: gt,
      gift_boost_days: gb,
      priority_display: legacy.priority_display,
      full_data_access: legacy.full_data_access,
      enterprise_badge: legacy.enterprise_badge
    });
  };
  return {
    month: rowFrom(base.month),
    quarter: rowFrom(base.quarter),
    year: rowFrom(base.year)
  };
}

function sanitizeMembershipConfig(cfg) {
  const c = cfg && typeof cfg === 'object' ? cfg : {};
  const mr = c.member_rights && typeof c.member_rights === 'object' ? c.member_rights : {};
  const defMr = DEFAULT_CONFIG.member_rights || {};
  c.member_rights = {
    personal: sanitizeMemberRightsTier(mr.personal, 'personal', defMr.personal),
    enterprise: sanitizeMemberRightsTier(mr.enterprise, 'enterprise', defMr.enterprise)
  };
  return c;
}

async function loadMembershipPromotionConfig(db) {
  const col = db.collection('platform_settings');
  const r = await col.doc('default').get();
  const raw = r.data && r.data[0] && r.data[0].membership_promotion_config;
  const merged = deepMerge(DEFAULT_CONFIG, raw || {});
  return sanitizeMembershipConfig(merged);
}

function inferPlanKeyFromDays(memberDays) {
  const d = Number(memberDays) || 365;
  if (d <= 35) return 'month';
  if (d <= 100) return 'quarter';
  return 'year';
}

function planDays(planKey) {
  if (planKey === 'month') return 30;
  if (planKey === 'quarter') return 90;
  return 365;
}

/**
 * 解析会员套餐：tier personal|enterprise, planKey month|quarter|year
 */
function resolveMemberPlan(cfg, tier, planKey) {
  const t = tier === 'enterprise' ? 'enterprise' : 'personal';
  const pk = ['month', 'quarter', 'year'].includes(planKey) ? planKey : 'year';
  const sw = cfg.feature_switches || {};
  if (t === 'personal' && sw.personal_member_enabled === false) {
    return { ok: false, message: '当前已关闭个人会员开通' };
  }
  if (t === 'enterprise' && sw.enterprise_member_enabled === false) {
    return { ok: false, message: '当前已关闭企业会员开通' };
  }
  const plans = (cfg.member_plans && cfg.member_plans[t]) || {};
  const cell = plans[pk];
  if (!cell || cell.enabled === false) {
    return { ok: false, message: '该会员套餐未开放' };
  }
  const price = Number(cell.price);
  if (!(price >= 0) || Number.isNaN(price)) {
    return { ok: false, message: '会员价格配置无效' };
  }
  return { ok: true, price, days: planDays(pk), planKey: pk, tier: t };
}

function normalizeRightsRow(defRow, patchRow) {
  const d = defRow && typeof defRow === 'object' ? defRow : {};
  const r = patchRow && typeof patchRow === 'object' ? patchRow : {};
  const giftTop =
    Number(r.gift_top_days != null ? r.gift_top_days : r.gift_top_count != null ? r.gift_top_count : d.gift_top_days != null ? d.gift_top_days : d.gift_top_count) || 0;
  const giftBoost =
    Number(r.gift_boost_days != null ? r.gift_boost_days : r.gift_boost_count != null ? r.gift_boost_count : d.gift_boost_days != null ? d.gift_boost_days : d.gift_boost_count) || 0;
  return {
    contact_purchase_quota:
      Number(r.contact_purchase_quota != null ? r.contact_purchase_quota : d.contact_purchase_quota) || 0,
    gift_top_days: giftTop,
    gift_boost_days: giftBoost,
    /** @deprecated 与 gift_top_days 同值，兼容旧云函数字段名 */
    gift_top_count: giftTop,
    /** @deprecated 与 gift_boost_days 同值 */
    gift_boost_count: giftBoost,
    priority_display: r.priority_display != null ? !!r.priority_display : !!d.priority_display,
    full_data_access: r.full_data_access != null ? !!r.full_data_access : !!d.full_data_access,
    enterprise_badge: r.enterprise_badge != null ? !!r.enterprise_badge : !!d.enterprise_badge
  };
}

/**
 * 某会员类型 + 套餐周期下的权益（已清洗嵌套结构）。
 */
function rightsForTierAndPlan(cfg, tier, planKey) {
  if (tier !== 'personal' && tier !== 'enterprise') return null;
  const pk = normalizePlanKey(planKey);
  const sanitized = sanitizeMembershipConfig(cfg || {});
  const tierBlock = sanitized.member_rights && sanitized.member_rights[tier];
  const row = tierBlock && tierBlock[pk];
  const defTier = DEFAULT_CONFIG.member_rights[tier] || {};
  const defRow = defTier[pk] || defTier.month || {};
  return normalizeRightsRow(defRow, row || {});
}

/**
 * 兼容旧调用：无法区分周期时按「月卡」档权益（新配置下与最小周期一致）。
 */
function rightsForTier(cfg, tier) {
  return rightsForTierAndPlan(cfg, tier, 'month');
}

function resolveUserMemberKind(user, nowTs) {
  const now = nowTs != null ? nowTs : Date.now();
  let expTs = 0;
  const raw = user.vip_expire_time;
  if (raw instanceof Date) expTs = raw.getTime();
  else if (raw != null && raw !== '') {
    const t = new Date(raw).getTime();
    expTs = Number.isNaN(t) ? 0 : t;
  }
  const isVip = user.is_vip === true && expTs > now;
  if (!isVip) return 'free';
  const mt = user.member_type;
  if (mt === 'enterprise') return 'enterprise';
  if (mt === 'personal') return 'personal';
  return 'personal';
}

/**
 * promotionType: top | boost
 * durationDays: 1 | 3 | 7
 * memberKind: free | personal | enterprise
 */
function resolvePromotionPrice(cfg, promotionType, durationDays, memberKind) {
  const pt = promotionType === 'boost' ? 'boost' : 'top';
  const sw = cfg.feature_switches || {};
  if (pt === 'top' && sw.promotion_top_enabled === false) {
    return { ok: false, message: '置顶推广已关闭' };
  }
  if (pt === 'boost' && sw.promotion_boost_enabled === false) {
    return { ok: false, message: '加急曝光已关闭' };
  }
  const dk = String(durationDays);
  if (!['1', '3', '7'].includes(dk)) {
    return { ok: false, message: '推广时长无效' };
  }
  const mk = memberKind === 'enterprise' || memberKind === 'personal' ? memberKind : 'free';
  const table = cfg.promotion_prices && cfg.promotion_prices[pt];
  if (!table || !table[mk]) {
    return { ok: false, message: '推广价格未配置' };
  }
  const row = table[mk];
  const price = Number(row[dk]);
  if (Number.isNaN(price) || price < 0) {
    return { ok: false, message: '推广价格无效' };
  }
  return { ok: true, price, origin_price: price };
}

module.exports = {
  DEFAULT_CONFIG,
  deepMerge,
  loadMembershipPromotionConfig,
  inferPlanKeyFromDays,
  planDays,
  resolveMemberPlan,
  rightsForTier,
  rightsForTierAndPlan,
  sanitizeMembershipConfig,
  resolveUserMemberKind,
  resolvePromotionPrice
};
