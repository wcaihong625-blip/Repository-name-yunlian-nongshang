'use strict';

const { verifyToken } = require('nxt-auth');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const shopCollection = db.collection('shop_list');
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

    const {
      shopName,
      category,
      region,
      address,
      contactName,
      phone,
      image,
      plan
    } = event;

    if (!shopName || !category || !region || !address || !contactName || !phone || !image) {
      return res(400, '参数错误：必填字段不能为空');
    }

    if (shopName.trim().length < 2) {
      return res(400, '店铺名称长度至少需要2个字符');
    }

    const phoneReg = /^1[3-9]\d{9}$/;
    if (!phoneReg.test(phone)) {
      return res(400, '手机号格式错误');
    }

    const userRes = await usersCollection.doc(user_id).get();
    if (!userRes.data || userRes.data.length === 0) {
      return res(400, '用户不存在');
    }

    const user = userRes.data[0];

    const existingShop = await shopCollection.where({
      user_id: user_id
    }).get();

    if (existingShop.data && existingShop.data.length > 0) {
      const activeShop = existingShop.data.find(shop =>
        shop.status === '已通过' || shop.status === '待审核'
      );
      if (activeShop) {
        return res(400, '您已经申请过店铺，请勿重复申请');
      }
    }

    const shopNameExist = await shopCollection.where({
      shopName: shopName.trim(),
      status: { $in: ['已通过', '待审核'] }
    }).count();

    if (shopNameExist.total > 0) {
      return res(400, '店铺名称已被使用，请更换其他名称');
    }

    const shopData = {
      shopName: shopName.trim(),
      category: category.trim(),
      region: region.trim(),
      address: address.trim(),
      contactName: contactName.trim(),
      phone: phone.trim(),
      image: image,
      plan: plan || 'vip',
      user_id: user_id,
      owner: user.nickname || user.username || '未知用户',
      status: '待审核',
      created_date: new Date(),
      updated_date: new Date(),
      approved_date: null,
      rejected_reason: null
    };

    const insertRes = await shopCollection.add(shopData);

    if (insertRes.id) {
      return res(200, '开店申请提交成功，请等待审核', {
        id: insertRes.id,
        ...shopData
      });
    } else {
      return res(500, '提交失败，请重试');
    }
  } catch (err) {
    console.error('openShop error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
