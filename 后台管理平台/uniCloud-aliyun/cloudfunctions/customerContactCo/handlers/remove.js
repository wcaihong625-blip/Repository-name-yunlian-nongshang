// 删除/隐藏联系人云函数
// 调用方式：uniCloud.callFunction({ name: 'deleteContact', data: { token, contactId } })
// 注意：手动添加的联系人会真正删除，平台联系人只是标记为隐藏（软删除）

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
    const { contactId } = event;

    if (!contactId) {
      return res(400, '参数错误：contactId不能为空');
    }

    // 查询联系人
    const contactRes = await contactsCollection.doc(contactId).get();
    
    if (!contactRes.data || contactRes.data.length === 0) {
      return res(404, '联系人不存在');
    }

    const contact = contactRes.data[0];

    // 验证是否为该用户添加的联系人
    if (contact.user_id !== userId) {
      return res(403, '无权删除此联系人');
    }

    // 软删除：标记为隐藏
    await contactsCollection.doc(contactId).update({
      is_hidden: true,
      updated_date: new Date()
    });

    console.log(`用户 ${userId} 删除了联系人 ${contactId}`);

    return res(200, '删除成功', null);
  } catch (err) {
    console.error('deleteContact error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};

















