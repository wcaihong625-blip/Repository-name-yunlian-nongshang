'use strict';

/**
 * 预览企业类型升级（个人→企业）应付金额。规则与落账一致：折算后应付、到期不变、仅类型与权益变更。
 * 云函数名须 ≤30 字符（阿里云限制），故使用 previewEntMemberUpgrade。
 */
const { verifyToken } = require('nxt-auth');
const { loadMembershipPromotionConfig } = require('nxt-membership-promotion-config');
const { buildUpgradeQuoteForUser } = require('nxt-member-upgrade-enterprise');

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

    const mpcfg = await loadMembershipPromotionConfig(db);
    const quote = await buildUpgradeQuoteForUser(db, userInfo, mpcfg);
    if (!quote.ok) {
      return res(400, quote.message || '无法计算升级金额');
    }

    return res(200, 'ok', quote);
  } catch (err) {
    console.error('previewEntMemberUpgrade error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
