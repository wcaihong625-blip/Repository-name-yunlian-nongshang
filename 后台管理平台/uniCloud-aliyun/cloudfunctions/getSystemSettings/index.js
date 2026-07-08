'use strict';

// 获取系统配置云函数
// 调用方式：uniCloud.callFunction({ name: 'getSystemSettings', data: {} })
// 当前仅返回小程序「联系客服」等必要字段

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const collection = db.collection('platform_settings');

  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    const queryRes = await collection.doc('default').get();
    const docData = queryRes && queryRes.data;
    const doc = Array.isArray(docData)
      ? (docData.length ? docData[0] : null)
      : (docData && typeof docData === 'object' ? docData : null);

    if (!doc) {
      const defaultSettings = {
        customer_service_phone: '400-123-8888'
      };
      return res(200, '获取成功（使用默认配置）', defaultSettings);
    }

    const settings = {
      customer_service_phone: doc.customer_service_phone || '400-123-8888'
    };

    return res(200, '获取成功', settings);
  } catch (err) {
    console.error('getSystemSettings error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
