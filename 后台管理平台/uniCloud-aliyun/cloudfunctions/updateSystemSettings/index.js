'use strict';

// 更新系统配置云函数（管理员）
// 当前仅支持 customer_service_phone

const { requireAdmin } = require('nxt-auth');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const collection = db.collection('platform_settings');

  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    const adminResult = await requireAdmin(event, context);
    if (!adminResult.success) {
      return res(403, adminResult.error || '无权访问，需要管理员权限');
    }

    const { settings } = event;

    if (!settings || typeof settings !== 'object') {
      return res(400, '参数错误：settings 必须是一个对象');
    }

    const updateData = {
      update_time: Date.now()
    };

    const allowedFields = ['customer_service_phone'];

    allowedFields.forEach((field) => {
      if (settings[field] !== undefined) {
        updateData[field] = settings[field];
      }
    });

    if (Object.keys(updateData).length === 1) {
      return res(400, '参数错误：至少需要提供一个有效的配置项');
    }

    if (updateData.customer_service_phone !== undefined) {
      if (typeof updateData.customer_service_phone !== 'string' || !updateData.customer_service_phone.trim()) {
        return res(400, '参数错误：客服电话必须是非空字符串');
      }
      const phonePattern = /^[\d\-\+\(\)\s]+$/;
      if (!phonePattern.test(updateData.customer_service_phone.trim())) {
        return res(400, '参数错误：客服电话格式不正确');
      }
      updateData.customer_service_phone = updateData.customer_service_phone.trim();
    }

    const existingRes = await collection.doc('default').get();

    let result;
    if (!existingRes.data || existingRes.data.length === 0) {
      const newData = {
        _id: 'default',
        ...updateData,
        create_time: Date.now()
      };
      result = await collection.add(newData);
      console.log('updateSystemSettings 创建成功:', result.id);
    } else {
      result = await collection.doc('default').update(updateData);
      console.log('updateSystemSettings 更新成功，影响记录数:', result.updated);
    }

    const updatedRes = await collection.doc('default').get();
    const updatedDoc = updatedRes.data[0];

    const updatedSettings = {
      customer_service_phone: updatedDoc.customer_service_phone || '400-123-8888',
      update_time: updatedDoc.update_time
    };

    return res(200, '更新成功', updatedSettings);
  } catch (err) {
    console.error('updateSystemSettings error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
