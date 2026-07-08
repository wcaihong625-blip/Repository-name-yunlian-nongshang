/**
 * 与云端 sanitize 后结构一致：member_rights[tier][month|quarter|year]
 * 兼容历史扁平 member_rights[tier]（单套数值用于各周期展示兜底）
 */

function isPlainObject(o) {
    return o && typeof o === 'object' && !Array.isArray(o);
}

function normalizePlanKey(planKey) {
    const pk = planKey != null ? String(planKey).trim() : '';
    if (pk === 'month' || pk === 'quarter' || pk === 'year') return pk;
    return 'month';
}

function isNestedTier(tierObj) {
    return isPlainObject(tierObj) && isPlainObject(tierObj.month) && isPlainObject(tierObj.quarter) && isPlainObject(tierObj.year);
}

function normalizeRightsRow(defRow, patchRow) {
    const d = isPlainObject(defRow) ? defRow : {};
    const r = isPlainObject(patchRow) ? patchRow : {};
    const giftTop =
        Number(r.gift_top_days != null ? r.gift_top_days : r.gift_top_count != null ? r.gift_top_count : d.gift_top_days != null ? d.gift_top_days : d.gift_top_count) || 0;
    const giftBoost =
        Number(r.gift_boost_days != null ? r.gift_boost_days : r.gift_boost_count != null ? r.gift_boost_count : d.gift_boost_days != null ? d.gift_boost_days : d.gift_boost_count) || 0;
    return {
        contact_purchase_quota: Number(r.contact_purchase_quota != null ? r.contact_purchase_quota : d.contact_purchase_quota) || 0,
        gift_top_days: giftTop,
        gift_boost_days: giftBoost,
        gift_top_count: giftTop,
        gift_boost_count: giftBoost,
        priority_display: r.priority_display != null ? !!r.priority_display : !!d.priority_display,
        full_data_access: r.full_data_access != null ? !!r.full_data_access : !!d.full_data_access,
        enterprise_badge: r.enterprise_badge != null ? !!r.enterprise_badge : !!d.enterprise_badge
    };
}

/**
 * @param {object} cfg membership_promotion_config
 * @param {'personal'|'enterprise'} tier
 * @param {'month'|'quarter'|'year'} planKey
 * @param {object} defaultCfg 与 membershipPromotionDefaults 同结构
 */
export function mergeRightsForTierPlan(cfg, tier, planKey, defaultCfg) {
    const pk = normalizePlanKey(planKey);
    const defTier = (defaultCfg && defaultCfg.member_rights && defaultCfg.member_rights[tier]) || {};
    const cfgTier = (cfg && cfg.member_rights && cfg.member_rights[tier]) || {};

    let defRow;
    let cfgRow;
    if (isNestedTier(defTier)) {
        defRow = defTier[pk] || defTier.month || {};
    } else {
        defRow = defTier;
    }

    if (isNestedTier(cfgTier)) {
        cfgRow = cfgTier[pk] || cfgTier.month || {};
    } else {
        cfgRow = cfgTier;
    }

    return normalizeRightsRow(defRow, cfgRow);
}
