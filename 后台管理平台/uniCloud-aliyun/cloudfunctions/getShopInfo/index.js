// 获取店铺信息云函数
// 调用方式：uniCloud.callFunction({ name: 'getShopInfo', data: { user_id?, shop_id? } })

'use strict';

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const shopCollection = db.collection('shop_list');

  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    const { user_id, shop_id } = event;

    // 参数验证：至少需要 user_id 或 shop_id 之一
    if (!user_id && !shop_id) {
      return res(400, '参数错误：user_id 或 shop_id 至少需要提供一个');
    }

    let shopRes;

    if (shop_id) {
      // 通过店铺ID查询
      shopRes = await shopCollection.doc(shop_id).get();
    } else {
      // 通过用户ID查询（获取该用户最新的店铺信息）
      shopRes = await shopCollection
        .where({
          user_id: user_id
        })
        .orderBy('created_date', 'desc')
        .limit(1)
        .get();
    }

    if (!shopRes.data || shopRes.data.length === 0) {
      return res(404, '未找到店铺信息', null);
    }

    const shop = shopRes.data[0];

    return res(200, '获取成功', shop);
  } catch (err) {
    console.error('getShopInfo error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};



