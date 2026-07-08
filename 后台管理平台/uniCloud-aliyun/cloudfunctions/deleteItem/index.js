'use strict';

const { verifyToken } = require('nxt-auth');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const usersCollection = db.collection('uni-id-users');

  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '未登录，请先登录');
    }
    const user_id = tokenResult.userId;

    const { id, type } = event;

    if (!id || !type) {
      return res(400, '参数错误：id、type 为必填项');
    }

    if (type !== 'supply' && type !== 'purchase') {
      return res(400, '参数错误：type 必须是 supply 或 purchase');
    }

    const collection = type === 'supply'
      ? db.collection('supply_list')
      : db.collection('purchase_list');

    const itemRes = await collection.doc(id).get();

    if (!itemRes.data || itemRes.data.length === 0) {
      return res(404, '记录不存在');
    }

    const item = itemRes.data[0];

    if (item.user_id !== user_id) {
      return res(403, '无权删除此记录');
    }

    const deleteRes = await collection.doc(id).remove();

    if (deleteRes.deleted > 0) {
      const updateField = type === 'supply' ? 'supply_count' : 'procurement_count';
      await usersCollection.doc(user_id).update({
        [updateField]: db.command.inc(-1)
      }).catch(err => {
        console.error('更新用户统计失败:', err);
      });

      return res(200, '删除成功');
    } else {
      return res(500, '删除失败，请重试');
    }
  } catch (err) {
    console.error('deleteItem error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
