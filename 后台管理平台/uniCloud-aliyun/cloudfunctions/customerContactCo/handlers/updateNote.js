// 更新联系人备注/信息云函数
// 调用方式：uniCloud.callFunction({ name: 'updateContactNote', data: { token, contactId, platformUserId?, name?, phone?, note? } })
// 注意：可以更新手动添加的联系人和平台联系人的覆盖数据（不影响原始用户数据）

'use strict';

const { verifyToken } = require('nxt-auth');

/**
 * 统一响应格式
 */
function createResponse(code, message, data = null) {
  return {
    code,
    message,
    data
  };
}

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
    const { contactId, platformUserId, name, phone, note } = event;

    // 如果提供了 platformUserId，说明是更新平台联系人的覆盖数据
    // 严格验证 platformUserId 是否为有效的非空字符串
    if (platformUserId && typeof platformUserId === 'string' && platformUserId.trim()) {
      // 查找是否已存在覆盖记录
      const existingOverride = await contactsCollection
        .where({
          user_id: userId,
          platform_user_id: platformUserId,
          is_hidden: false
        })
        .get();

      const now = new Date();
      let overrideId;
      let overrideData;

      const existingOverrideData = existingOverride.data && existingOverride.data.length > 0 ? existingOverride.data[0] : null;
      
      if (existingOverrideData) {
        // 更新现有覆盖记录，保留原有字段值
        overrideId = existingOverrideData._id;
        overrideData = {
          // 保留原有字段值，只更新用户提供的字段
          name: existingOverrideData.name || '',
          phone: existingOverrideData.phone || '',
          company: existingOverrideData.company || '',
          note: existingOverrideData.note || '',
          avatar: existingOverrideData.avatar || '',
          updated_date: now
        };
      } else {
        // 创建新的覆盖记录
        overrideData = {
          user_id: userId,
          platform_user_id: platformUserId,
          name: '',
          phone: '',
          company: '',
          note: '',
          avatar: '',
          is_hidden: false,
          created_date: now,
          updated_date: now
        };
      }

      // 更新用户提供的字段（包括空字符串，表示用户明确设置为空）
      if (name !== undefined && name !== null) {
        if (!name.trim()) {
          return res(400, '姓名不能为空');
        }
        overrideData.name = name.trim();
      }
      if (phone !== undefined && phone !== null) {
        if (!phone.trim()) {
          // 允许设置为空字符串（用户明确清空电话）
          overrideData.phone = '';
        } else {
          // 手机号格式验证
          const phoneReg = /^1[3-9]\d{9}$/;
          if (!phoneReg.test(phone.trim())) {
            return res(400, '手机号格式错误');
          }
          overrideData.phone = phone.trim();
        }
      }
      if (note !== undefined && note !== null) {
        // 允许设置为空字符串
        overrideData.note = note.trim();
      }
      
      // 如果 name 和 phone 都未提供，至少需要更新 note
      if (name === undefined && phone === undefined && note === undefined) {
        return res(400, '至少需要提供一个更新字段');
      }

      if (overrideId) {
        // 更新现有记录
        await contactsCollection.doc(overrideId).update(overrideData);
        overrideData._id = overrideId;
      } else {
        // 创建新记录
        const insertRes = await contactsCollection.add(overrideData);
        overrideData._id = insertRes.id;
      }

      console.log(`用户 ${userId} 更新了平台联系人 ${platformUserId} 的覆盖数据`);

      // 获取原始用户信息（用于返回完整数据）
      const usersCollection = db.collection('uni-id-users');
      const userRes = await usersCollection.doc(platformUserId).get();
      const originalUser = userRes.data && userRes.data.length > 0 ? userRes.data[0] : null;

      // 返回更新后的数据，覆盖数据优先，如果覆盖数据为空则使用原始数据
      return res(200, '更新成功', {
        id: overrideData._id,
        userId: platformUserId,
        name: overrideData.name !== undefined && overrideData.name !== null && overrideData.name !== '' 
          ? overrideData.name 
          : (originalUser ? (originalUser.nickname || originalUser.username || '用户') : ''),
        phone: overrideData.phone !== undefined && overrideData.phone !== null && overrideData.phone !== ''
          ? overrideData.phone
          : (originalUser ? (originalUser.mobile || '') : ''),
        company: overrideData.company !== undefined && overrideData.company !== null && overrideData.company !== ''
          ? overrideData.company
          : (originalUser ? (originalUser.companyName || '') : ''),
        note: overrideData.note !== undefined && overrideData.note !== null ? overrideData.note : '',
        avatar: overrideData.avatar !== undefined && overrideData.avatar !== null && overrideData.avatar !== ''
          ? overrideData.avatar
          : (originalUser ? (originalUser.avatar || '') : ''),
        source: 'platform',
        sourceType: 'follow',
        sourceInfo: '已关注',
        hasOverride: true,
        addTime: null
      });
    }

    // 以下是更新手动添加的联系人的逻辑
    // 如果既没有有效的 platformUserId，也没有 contactId，返回错误
    if (!contactId || (typeof contactId !== 'string' && typeof contactId !== 'object')) {
      return res(400, '参数错误：必须提供 platformUserId（平台联系人）或 contactId（手动联系人）');
    }

    // 查询联系人
    const contactRes = await contactsCollection.doc(contactId).get();
    
    if (!contactRes.data || contactRes.data.length === 0) {
      return res(404, '联系人不存在');
    }

    const contact = contactRes.data[0];

    // 验证是否为该用户添加的联系人
    if (contact.user_id !== userId) {
      return res(403, '无权修改此联系人');
    }

    // 如果是平台联系人的覆盖数据，不应该通过 contactId 更新（应该使用 platformUserId）
    if (contact.platform_user_id) {
      return res(400, '请使用 platformUserId 参数更新平台联系人');
    }

    // 构建更新数据
    const updateData = {
      updated_date: new Date()
    };

    if (name !== undefined && name !== null) {
      if (!name.trim()) {
        return res(400, '姓名不能为空');
      }
      updateData.name = name.trim();
    }

    if (phone !== undefined && phone !== null) {
      if (!phone.trim()) {
        return res(400, '电话号码不能为空');
      }
      // 手机号格式验证
      const phoneReg = /^1[3-9]\d{9}$/;
      if (!phoneReg.test(phone.trim())) {
        return res(400, '手机号格式错误');
      }
      
      // 检查新手机号是否与其他联系人重复
      const duplicateRes = await contactsCollection
        .where({
          user_id: userId,
          phone: phone.trim(),
          is_hidden: false,
          _id: db.command.neq(contactId)
        })
        .count();
      
      if (duplicateRes.total > 0) {
        return res(400, '该手机号已被其他联系人使用');
      }
      
      updateData.phone = phone.trim();
    }

    if (note !== undefined && note !== null) {
      updateData.note = note.trim();
    }

    // 更新数据库
    await contactsCollection.doc(contactId).update(updateData);

    console.log(`用户 ${userId} 更新了联系人 ${contactId}`);

    // 获取更新后的数据
    const updatedRes = await contactsCollection.doc(contactId).get();
    const updatedContact = updatedRes.data[0];

    return res(200, '更新成功', {
      id: updatedContact._id,
      name: updatedContact.name,
      phone: updatedContact.phone,
      company: updatedContact.company || '',
      note: updatedContact.note || '',
      avatar: updatedContact.avatar || '',
      source: 'manual',
      sourceType: 'manual',
      sourceInfo: '手动添加',
      addTime: updatedContact.created_date
    });
  } catch (err) {
    console.error('updateContactNote error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};


