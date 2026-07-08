'use strict';
/**
 * 小程序端：查询当前登录用户的会员订单列表（按创建时间倒序，分页）
 */
const { verifyToken } = require('nxt-auth');

module.exports = async (event, context) => {
  const res = (code, message, data) => ({ code, message, data: data || null });
  const db = uniCloud.database();
  const cmd = db.command;
  const memberOrderCollection = db.collection('member_order');

  try {
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '登录状态无效');
    }
    const userId = tokenResult.userId;

    const page = Math.max(1, parseInt(event.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(event.pageSize, 10) || 10));
    const skip = (page - 1) * pageSize;

    const where = {
      user_id: userId,
      deleted: cmd.neq(true)
    };

    const [countRes, listRes] = await Promise.all([
      memberOrderCollection.where(where).count(),
      memberOrderCollection
        .where(where)
        .orderBy('created_at', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
    ]);

    const total = (countRes && countRes.total) || 0;
    const list = (listRes && listRes.data) || [];
    const hasMore = skip + list.length < total;

    return res(200, 'ok', {
      list,
      page,
      pageSize,
      total,
      hasMore
    });
  } catch (err) {
    console.error('getMyMemberOrders error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};

