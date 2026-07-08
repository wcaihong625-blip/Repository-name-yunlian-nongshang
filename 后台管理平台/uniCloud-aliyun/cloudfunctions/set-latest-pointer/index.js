'use strict';
const db = uniCloud.database();

exports.main = async (event, context) => {
  // 兼容：HTTP 请求时参数可能在 event.body（字符串）里
  let body = event;

  if (event && typeof event.body === 'string') {
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      body = {};
    }
  }

  const pointer_url = body && (body.pointer_url || body.pointerUrl);

  if (!pointer_url) {
    return {
      success: false,
      message: 'missing pointer_url',
      debug: {
        hasEventBody: !!(event && event.body),
        eventBodyType: typeof (event && event.body),
        eventKeys: event ? Object.keys(event) : [],
        bodyKeys: body ? Object.keys(body) : []
      }
    };
  }

  await db.collection('ymt_config').doc('latest').set({
    pointer_url,
    updated_at: new Date().toISOString()
  });

  return { success: true, pointer_url };
};
