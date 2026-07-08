/**
 * 与云端 nxt-membership-promotion-config 默认结构保持一致，仅作接口失败时的兜底展示。
 * member_rights 按会员类型 + 套餐周期嵌套；赠送为「天数」额度。
 */
export const membershipPromotionDefaults = {
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
