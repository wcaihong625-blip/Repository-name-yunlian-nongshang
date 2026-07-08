'use strict';
const db = uniCloud.database();

exports.main = async (event, context) => {
  // 固定读一条配置：ymt_config/latest
  const doc = await db.collection('ymt_config').doc('latest').get();
  const data = doc.data && doc.data[0];

  if (!data || !data.pointer_url) {
    return { success: false, message: 'pointer_url not set yet' };
  }

  // 直接把 pointer_url 返回给小程序（或者直接代理返回 pointer 内容也行）
  return {
    success: true,
    pointer_url: data.pointer_url,
    updated_at: data.updated_at || ''
  };
};
