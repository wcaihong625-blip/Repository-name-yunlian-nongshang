'use strict';

/**
 * 预览周期档位升级。规则：目标套餐标价；新到期=原到期+完整目标天数；不作个人剩余抵扣；不从今日重算。
 * 云函数名 previewUpgradePlanPeriod（24 字符）符合阿里云 ≤30 字符限制。
 */
const { verifyToken } = require('nxt-auth');
const { loadMembershipPromotionConfig } = require('nxt-membership-promotion-config');
const { buildPlanPeriodUpgradeQuoteForUser } = require('nxt-member-upgrade-enterprise');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '登录状态无效');
    }
    const userId = tokenResult.userId;

    const userRes = await db.collection('uni-id-users').doc(userId).get();
    if (!userRes.data || userRes.data.length === 0) {
      return res(404, '用户不存在');
    }
    const userInfo = userRes.data[0];

    const targetPlanKey = event.target_plan_key != null ? String(event.target_plan_key).trim() : '';
    const mpcfg = await loadMembershipPromotionConfig(db);
    const quote = await buildPlanPeriodUpgradeQuoteForUser(db, userInfo, mpcfg, targetPlanKey);
    if (!quote.ok) {
      return res(400, quote.message || '无法预览周期升级');
    }

    return res(200, 'ok', quote);
  } catch (err) {
    console.error('previewUpgradePlanPeriod error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
