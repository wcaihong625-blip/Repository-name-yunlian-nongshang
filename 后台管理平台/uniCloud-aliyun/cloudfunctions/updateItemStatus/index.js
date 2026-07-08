// 更新供应/采购状态云函数
// 调用方式：uniCloud.callFunction({ name: 'updateItemStatus', data: { token, id, type, status } })
// type: 'supply' 或 'purchase'
// status: '已发布' 或 '已下架'

'use strict';

const { verifyToken } = require('nxt-auth');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  
  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    // 验证 token 并获取 user_id
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '未登录，请先登录');
    }
    const user_id = tokenResult.userId;

    const { id, type, status } = event;

    // 参数验证
    if (!id || !type || !status) {
      return res(400, '参数错误：id、type、status 为必填项');
    }

    if (type !== 'supply' && type !== 'purchase') {
      return res(400, '参数错误：type 必须是 supply 或 purchase');
    }

    if (status !== '已发布' && status !== '已下架') {
      return res(400, '参数错误：status 必须是 已发布 或 已下架');
    }

    // 选择对应的集合
    const collection = type === 'supply' 
      ? db.collection('supply_list')
      : db.collection('purchase_list');

    // 先查询记录，验证所有权
    const itemRes = await collection.doc(id).get();
    
    if (!itemRes.data || itemRes.data.length === 0) {
      return res(404, '记录不存在');
    }

    const item = itemRes.data[0];

    // 验证是否为该用户发布的
    if (item.user_id !== user_id) {
      return res(403, '无权修改此记录');
    }

    // 更新状态
    const updateData = {
      status: status,
      updated_date: new Date()
    };

    // 如果状态变为"已发布"，更新发布时间
    if (status === '已发布' && !item.publish_date) {
      updateData.publish_date = new Date();
    }

    const updateRes = await collection.doc(id).update(updateData);

    if (updateRes.updated > 0) {
      return res(200, '更新成功', {
        id: id,
        status: status
      });
    } else {
      return res(500, '更新失败，请重试');
    }
  } catch (err) {
    console.error('updateItemStatus error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};

















