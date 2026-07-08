// 手动添加联系人云函数
// 调用方式：uniCloud.callFunction({ name: 'addManualContact', data: { token, name, phone, company?, note? } })

'use strict';

const { verifyToken, createResponse } = require('nxt-auth');

module.exports = async (event, context) => {
  const db = uniCloud.database();
  const contactsCollection = db.collection('customer_contacts');

  const res = createResponse;

  try {
    // 验证token并获取当前用户ID
    const authResult = await verifyToken(event, context);
    if (!authResult.success) {
      return res(401, authResult.error);
    }

    const userId = authResult.userId;
    const { name, phone, company, note } = event;

    const usersCollection = db.collection('uni-id-users');

    const userRes = await usersCollection.doc(userId).get();
    if (!userRes.data || userRes.data.length === 0) {
      return createResponse(404, '用户不存在');
    }

    const userInfo = userRes.data[0];
    const currentTimestamp = Date.now();
    const vipExpireTime = userInfo.vip_expire_time ? new Date(userInfo.vip_expire_time).getTime() : 0;
    const isVip = !!userInfo.is_vip && vipExpireTime > currentTimestamp;

    if (!isVip) {
      return {
        success: false,
        code: 403,
        message: '该功能仅会员可用，请开通会员后继续操作',
        needVip: true,
        vipRestricted: true,
        data: null
      };
    }

    // 参数验证
    if (!name || !name.trim()) {
      return res(400, '参数错误：name不能为空');
    }

    if (!phone || !phone.trim()) {
      return res(400, '参数错误：phone不能为空');
    }

    // 手机号格式验证
    const phoneReg = /^1[3-9]\d{9}$/;
    if (!phoneReg.test(phone.trim())) {
      return res(400, '手机号格式错误');
    }

    // 检查是否已存在（同一用户下，相同手机号）
    const existingContact = await contactsCollection
      .where({
        user_id: userId,
        phone: phone.trim(),
        is_hidden: false
      })
      .count();

    if (existingContact.total > 0) {
      return res(400, '该联系人已存在');
    }

    const currentDate = new Date();
    const contactData = {
      user_id: userId,
      name: name.trim(),
      phone: phone.trim(),
      company: company ? company.trim() : '',
      note: note ? note.trim() : '',
      avatar: '',
      is_hidden: false,
      created_date: currentDate,
      updated_date: currentDate
    };

    // 插入数据库
    const insertRes = await contactsCollection.add(contactData);

    if (insertRes.id) {
      console.log(`用户 ${userId} 添加了手动联系人: ${name} (${phone})`);
      
      return res(200, '添加成功', {
        id: insertRes.id,
        ...contactData
      });
    } else {
      return res(500, '添加失败，请重试');
    }
  } catch (err) {
    console.error('addManualContact error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};

















