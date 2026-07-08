/**
 * 会员中心展示用：套餐价、立省、赠送权益等值、推广单买价。
 * 数据统一来自 getMembershipPromotionConfig 返回结构（与 membershipPromotionDefaults 兜底合并），
 * 不参与支付/发券/下单，仅供页面展示。
 */

import { membershipPromotionDefaults } from './membershipPromotionDefaults.js';
import { mergeRightsForTierPlan } from './memberConfigRights.js';

const BUNDLE_SLOTS = [7, 3, 1];

function warnMemberPricing(msg) {
    if (typeof console !== 'undefined' && console.warn) {
        console.warn('[memberPricing]', msg);
    }
}

/** 已废弃整表推广价指纹（与旧 membershipPromotionDefaults 一致） */
const LEGACY_PROMOTION_TABLE = {
    top: {
        free: { 1: 6, 3: 15, 7: 30 },
        personal: { 1: 5, 3: 12, 7: 25 },
        enterprise: { 1: 4, 3: 10, 7: 20 }
    },
    boost: {
        free: { 1: 3, 3: 8, 7: 18 },
        personal: { 1: 2, 3: 6, 7: 15 },
        enterprise: { 1: 1, 3: 4, 7: 10 }
    }
};

function promotionRowMatchesLegacy(row, expected) {
    if (!row || typeof row !== 'object' || !expected) return false;
    return ['1', '3', '7'].every((k) => Number(row[k]) === Number(expected[k]));
}

function isLegacyPromotionPricesTable(pp) {
    if (!pp || !pp.top || !pp.boost) return false;
    const kinds = ['free', 'personal', 'enterprise'];
    for (const pt of ['top', 'boost']) {
        for (const k of kinds) {
            if (!promotionRowMatchesLegacy(pp[pt][k], LEGACY_PROMOTION_TABLE[pt][k])) return false;
        }
    }
    return true;
}

function mergePromotionPriceTiers(baseTiers, patchTiers) {
    const kinds = ['free', 'personal', 'enterprise'];
    const dayKeys = ['1', '3', '7'];
    const out = {};
    kinds.forEach((mk) => {
        const b = (baseTiers && baseTiers[mk]) || {};
        const p = (patchTiers && patchTiers[mk]) || {};
        out[mk] = { ...b };
        dayKeys.forEach((dk) => {
            const n = Number(p[dk]);
            if (Number.isFinite(n) && n >= 0) out[mk][dk] = n;
        });
    });
    return out;
}

/**
 * 小程序展示用配置：在「定版 defaults」上合并云端 patch；若仍为整套废弃价则替换为定版 promotion_prices。
 * 与支付云函数各自读库无关，仅避免前端读到历史库里的旧表。
 */
export function resolveMembershipConfigForDisplay(cfg) {
    const raw = cfg && typeof cfg === 'object' ? cfg : membershipPromotionDefaults;
    let merged;
    try {
        merged = JSON.parse(JSON.stringify(raw));
    } catch (_e) {
        merged = { ...membershipPromotionDefaults };
    }
    const def = membershipPromotionDefaults;
    const pp = merged.promotion_prices;
    if (pp && isLegacyPromotionPricesTable(pp)) {
        warnMemberPricing(
            '检测到已废弃的 promotion_prices 整表（旧非会员 6/15/30 等），展示已切换为定版；请在后台「会员运营配置」保存后写入数据库。'
        );
        merged.promotion_prices = JSON.parse(JSON.stringify(def.promotion_prices));
        return merged;
    }
    merged.promotion_prices = {
        top: mergePromotionPriceTiers(def.promotion_prices.top, (pp && pp.top) || {}),
        boost: mergePromotionPriceTiers(def.promotion_prices.boost, (pp && pp.boost) || {})
    };
    return merged;
}

/** @param {any} cfg — 展示/计算统一走 resolve，避免云端旧 promotion_prices 覆盖定版 */
export function normalizeMembershipCfg(cfg) {
    return resolveMembershipConfigForDisplay(cfg && typeof cfg === 'object' ? cfg : membershipPromotionDefaults);
}

/**
 * 规范化会员类型、套餐周期 key
 * @param {'personal'|'enterprise'} tier
 * @param {string} planKey
 */
export function normalizeTier(tier) {
    return tier === 'enterprise' ? 'enterprise' : 'personal';
}

export function normalizePlanKey(planKey) {
    const pk = planKey != null ? String(planKey).trim() : '';
    if (pk === 'month' || pk === 'quarter' || pk === 'year') return pk;
    return 'month';
}

function hasPromotionSlotPrices(row) {
    if (!row || typeof row !== 'object') return false;
    return ['1', '3', '7'].every((k) => {
        const v = row[k];
        return v != null && Number.isFinite(Number(v)) && Number(v) >= 0;
    });
}

/**
 * 兼容后台配置中可能出现的字符串金额（如 "188"、"188元"）。
 * 无法解析时返回 NaN。
 */
function parsePriceNumber(v) {
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    if (typeof v === 'string') {
        const s = v.trim().replace(/,/g, '');
        if (!s) return NaN;
        const m = s.match(/-?\d+(?:\.\d+)?/);
        if (!m) return NaN;
        const n = Number(m[0]);
        return Number.isFinite(n) ? n : NaN;
    }
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
}

/**
 * 将总天数按 7→3→1 天拆分后，用单价表累计金额（键须为 '1'|'3'|'7'）。
 */
export function quotePromotionDaysAtPublicUnitYuan(unitRow, totalDays) {
    let n = Math.max(0, Math.floor(Number(totalDays) || 0));
    let sum = 0;
    for (const slot of BUNDLE_SLOTS) {
        const key = String(slot);
        const u = Number(unitRow && unitRow[key]);
        if (!Number.isFinite(u) || u < 0) continue;
        const count = Math.floor(n / slot);
        sum += count * u;
        n -= count * slot;
    }
    if (n > 0) {
        const u1 = Number(unitRow && unitRow['1']);
        if (Number.isFinite(u1) && u1 >= 0) sum += n * u1;
    }
    return Number.isFinite(sum) ? sum : NaN;
}

/**
 * 置顶+加急赠送，按「非会员」单买价折算等值（元）。无法计算时返回 null。
 * @param {any} cfg
 * @param {'personal'|'enterprise'} tier
 * @param {'month'|'quarter'|'year'} planKey
 * @returns {number|null}
 */
export function equivalentGiftValueYuan(cfg, tier, planKey) {
    const c = normalizeMembershipCfg(cfg);
    const t = normalizeTier(tier);
    const pk = normalizePlanKey(planKey);
    const r = mergeRightsForTierPlan(c, t, pk, membershipPromotionDefaults);
    const gt = r.gift_top_days != null ? r.gift_top_days : r.gift_top_count || 0;
    const gb = r.gift_boost_days != null ? r.gift_boost_days : r.gift_boost_count || 0;
    const pp = c.promotion_prices || membershipPromotionDefaults.promotion_prices;
    const topFree = (pp.top && pp.top.free) || {};
    const boostFree = (pp.boost && pp.boost.free) || {};
    if (!hasPromotionSlotPrices(topFree)) {
        warnMemberPricing('promotion_prices.top.free 缺少完整 1/3/7 天单价，无法折算置顶赠送等值');
        return null;
    }
    if (!hasPromotionSlotPrices(boostFree)) {
        warnMemberPricing('promotion_prices.boost.free 缺少完整 1/3/7 天单价，无法折算加急赠送等值');
        return null;
    }
    const topY = quotePromotionDaysAtPublicUnitYuan(topFree, gt);
    const boostY = quotePromotionDaysAtPublicUnitYuan(boostFree, gb);
    const total = topY + boostY;
    if (!Number.isFinite(total)) return null;
    return Math.round(total);
}

/**
 * 季卡/年卡相对月卡连买立省（元）。月卡为 0；配置不全或结果非正为 0。
 * 个人：季 = 月价×3−季价；年 = 月价×12−年价。企业同理。
 */
export function packageVsMonthlySaveYuan(cfg, tier, planKey) {
    const pk = normalizePlanKey(planKey);
    if (pk === 'month') return 0;
    const c = normalizeMembershipCfg(cfg);
    const t = normalizeTier(tier);
    const plans = (c.member_plans && c.member_plans[t]) || {};
    const monthCell = plans.month;
    const planCell = plans[pk];
    if (!monthCell || monthCell.enabled === false || !planCell || planCell.enabled === false) {
        warnMemberPricing(`member_plans.${t}.${pk} 或 month 未启用，无法计算立省`);
        return 0;
    }
    const mp = parsePriceNumber(monthCell.price);
    const p = parsePriceNumber(planCell.price);
    if (!Number.isFinite(mp) || mp <= 0 || !Number.isFinite(p)) {
        warnMemberPricing(`member_plans.${t} 月/季年 价格无效，无法计算立省`);
        return 0;
    }
    const mult = pk === 'quarter' ? 3 : 12;
    const save = Math.round(mp * mult - p);
    return save > 0 ? save : 0;
}

export function packageSaveShortCardLine(cfg, tier, planKey) {
    const save = packageVsMonthlySaveYuan(cfg, tier, planKey);
    if (!save) return '';
    return `省${save}元`;
}

export function packageVsMonthlySaveLine(cfg, tier, planKey) {
    const save = packageVsMonthlySaveYuan(cfg, tier, planKey);
    if (!save) return '';
    const pk = normalizePlanKey(planKey);
    const periodText = pk === 'quarter' ? '3个月' : '12个月';
    return `比月卡连买${periodText}省${save}元`;
}

/**
 * @returns {{ price: number|null, enabled: boolean, ok: boolean }}
 */
export function getPlanPrice(cfg, tier, planKey) {
    const c = normalizeMembershipCfg(cfg);
    const t = normalizeTier(tier);
    const pk = normalizePlanKey(planKey);
    const cell = (c.member_plans && c.member_plans[t] && c.member_plans[t][pk]) || null;
    if (!cell || cell.enabled === false) {
        return { price: null, enabled: !!(cell && cell.enabled === false), ok: false };
    }
    const price = parsePriceNumber(cell.price);
    if (!Number.isFinite(price) || price < 0) {
        warnMemberPricing(`member_plans.${t}.${pk}.price 无效`);
        return { price: null, enabled: true, ok: false };
    }
    return { price, enabled: true, ok: true };
}

/**
 * @returns {{ giftTop: number, giftBoost: number }}
 */
export function getGiftDays(cfg, tier, planKey) {
    const c = normalizeMembershipCfg(cfg);
    const t = normalizeTier(tier);
    const pk = normalizePlanKey(planKey);
    const r = mergeRightsForTierPlan(c, t, pk, membershipPromotionDefaults);
    const giftTop = Number(r.gift_top_days != null ? r.gift_top_days : r.gift_top_count) || 0;
    const giftBoost = Number(r.gift_boost_days != null ? r.gift_boost_days : r.gift_boost_count) || 0;
    return { giftTop, giftBoost };
}

/**
 * @param {'top'|'boost'} promoType
 * @param {'free'|'personal'|'enterprise'} memberKind
 * @returns {Record<string, number>|null}
 */
export function getPromotionPriceRow(cfg, promoType, memberKind) {
    const c = normalizeMembershipCfg(cfg);
    const pt = promoType === 'boost' ? 'boost' : 'top';
    const mk = memberKind === 'enterprise' || memberKind === 'personal' ? memberKind : 'free';
    const row = c.promotion_prices && c.promotion_prices[pt] && c.promotion_prices[pt][mk];
    if (!row || typeof row !== 'object') {
        warnMemberPricing(`promotion_prices.${pt}.${mk} 缺失`);
        return null;
    }
    return row;
}

/**
 * 单格展示用字符串（无手写兜底数字）
 * @param {'top'|'boost'} promoType
 * @param {'free'|'personal'|'enterprise'} memberKind
 * @param {'1'|'3'|'7'} dayKey
 */
export function formatPromotionPriceCell(cfg, promoType, memberKind, dayKey) {
    const row = getPromotionPriceRow(cfg, promoType, memberKind);
    if (!row) return '—';
    const k = String(dayKey);
    const v = row[k];
    const n = v != null ? Number(v) : NaN;
    if (!Number.isFinite(n) || n < 0) {
        warnMemberPricing(`promotion_prices 缺少 ${promoType}.${memberKind}.${k}`);
        return '—';
    }
    return String(n);
}

/**
 * 套餐详情 / 权益概览用结构化数据（金额均来自配置 + 公式）
 */
export function buildMemberPlanDisplayData(cfg, tier, planKey) {
    const c = normalizeMembershipCfg(cfg);
    const t = normalizeTier(tier);
    const pk = normalizePlanKey(planKey);
    const planLabel = pk === 'quarter' ? '季卡' : pk === 'year' ? '年卡' : '月卡';
    const pr = getPlanPrice(c, t, pk);
    const save = packageVsMonthlySaveYuan(c, t, pk);
    const eq = equivalentGiftValueYuan(c, t, pk);
    const { giftTop, giftBoost } = getGiftDays(c, t, pk);
    const r = mergeRightsForTierPlan(c, t, pk, membershipPromotionDefaults);

    return {
        tier: t,
        planKey: pk,
        planLabel,
        price: pr.price,
        priceDisplay: pr.ok && pr.price != null ? String(pr.price) : '—',
        giftTop,
        giftBoost,
        equivalentYuan: eq,
        equivalentDisplay: eq != null && Number.isFinite(eq) ? String(eq) : '—',
        saveYuan: save > 0 ? save : 0,
        saveDisplay: save > 0 ? String(save) : '',
        showSave: save > 0,
        saveLongLine: packageVsMonthlySaveLine(c, t, pk),
        contactQuota: r.contact_purchase_quota != null ? r.contact_purchase_quota : null
    };
}

/**
 * 套餐卡片下方说明行（不含立省金额、不含权益等值数字，避免与强调块重复）
 */
export function memberPlanSecondaryLines(cfg, tier, planKey) {
    const c = normalizeMembershipCfg(cfg);
    const t = normalizeTier(tier);
    const pk = normalizePlanKey(planKey);
    const r = mergeRightsForTierPlan(c, t, pk, membershipPromotionDefaults);
    const gt = r.gift_top_days != null ? r.gift_top_days : r.gift_top_count || 0;
    const gb = r.gift_boost_days != null ? r.gift_boost_days : r.gift_boost_count || 0;
    const cq = r.contact_purchase_quota != null ? r.contact_purchase_quota : '—';
    const lines = [
        `联系采购方 ${cq} 次/月`,
        r.priority_display ? '信息优先展示' : '信息展示按平台规则',
        r.full_data_access ? '可查看浏览量、收藏量、被联系等数据' : '基础数据可见（以平台规则为准）',
        `本套餐赠送置顶 ${gt} 天、加急曝光 ${gb} 天`,
        '推广单买价格见下方价目表（与配置同步）'
    ];
    if (t === 'enterprise' && r.enterprise_badge) {
        lines.splice(1, 0, '企业认证标识展示');
    }
    return lines;
}

/** 与需求文档命名对齐的别名 */
export const calcPlanSaveAmount = packageVsMonthlySaveYuan;
export const calcGiftValueEquivalentYuan = equivalentGiftValueYuan;

/**
 * @param {'free'|'personal'|'enterprise'} memberKind
 */
export function getPromotionPrices(cfg, memberKind) {
    return {
        top: getPromotionPriceRow(cfg, 'top', memberKind),
        boost: getPromotionPriceRow(cfg, 'boost', memberKind)
    };
}

/** @deprecated 请用 buildMemberPlanDisplayData + memberPlanSecondaryLines */
export function memberPackageMarketingLines(cfg, tier, planKey) {
    const d = buildMemberPlanDisplayData(cfg, tier, planKey);
    const suf = d.planKey === 'quarter' ? '季' : d.planKey === 'year' ? '年' : '月';
    const lines = [];
    if (d.priceDisplay !== '—') lines.push(`${d.priceDisplay}元/${suf}`);
    if (d.saveLongLine) lines.push(d.saveLongLine);
    lines.push(`送置顶${d.giftTop}天 + 加急${d.giftBoost}天`);
    if (d.equivalentDisplay !== '—') lines.push(`权益价值${d.equivalentDisplay}元`);
    return lines;
}
