// 批量更新状态为已发布云函数
// 将所有"审核中"和"审核失败"状态更新为"已发布"
// 调用方式：uniCloud.callFunction({ name: 'updateStatusToPublished', data: { type: 'supply' | 'purchase' } })

'use strict';

exports.main = async (event, context) => {
  const db = uniCloud.database();
  
  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    const { type } = event; // 'supply' 或 'purchase'
    
    if (!type || (type !== 'supply' && type !== 'purchase')) {
      return res(400, '参数错误：type必须是supply或purchase');
    }

    const collection = type === 'supply' 
      ? db.collection('supply_list')
      : db.collection('purchase_list');

    // 查找所有状态为"审核中"或"审核失败"的记录
    const queryRes = await collection.where({
      status: db.command.in(['审核中', '审核失败'])
    }).get();

    if (queryRes.data.length === 0) {
      return res(200, '没有需要更新的记录', {
        updatedCount: 0
      });
    }

    // 批量更新状态为"已发布"
    const ids = queryRes.data.map(item => item._id);
    const updateRes = await collection.where({
      _id: db.command.in(ids)
    }).update({
      status: '已发布',
      updated_date: new Date()
    });

    return res(200, '更新成功', {
      updatedCount: updateRes.updated || ids.length
    });
  } catch (err) {
    console.error('updateStatusToPublished error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};



