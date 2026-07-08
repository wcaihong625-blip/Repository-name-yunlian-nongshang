// 获取客户联系人列表云函数
// 调用方式：uniCloud.callFunction({ name: 'getCustomerContacts', data: { token } })
// 返回：平台联系人（关注的用户）+ 手动添加的联系人

'use strict';

const { verifyToken, createResponse } = require('nxt-auth');

module.exports = async (event, context) => {
  const db = uniCloud.database();
  const followsCollection = db.collection('user_follows');
  const usersCollection = db.collection('uni-id-users');
  const contactsCollection = db.collection('customer_contacts');

  const res = createResponse;

  try {
    // 验证token并获取当前用户ID
    const authResult = await verifyToken(event, context);
    if (!authResult.success) {
      return res(401, authResult.error);
    }

    const userId = authResult.userId;

    const userRes = await usersCollection.doc(userId).get();
    if (!userRes.data || userRes.data.length === 0) {
      return createResponse(404, '用户不存在');
    }

    const userInfo = userRes.data[0];
    const now = Date.now();
    const vipExpireTime = userInfo.vip_expire_time ? new Date(userInfo.vip_expire_time).getTime() : 0;
    const isVip = !!userInfo.is_vip && vipExpireTime > now;

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

    // 并行获取两类联系人
    // 1. 平台联系人：从关注列表中获取
    const followsRes = await followsCollection
      .where({
        follower_id: userId
      })
      .orderBy('created_date', 'desc')
      .get();

    const followingIds = followsRes.data.map(item => item.following_id);
    
    // 2. 手动添加的联系人和平台联系人的覆盖数据
    const allContactsRes = await contactsCollection
      .where({
        user_id: userId,
        is_hidden: false
      })
      .orderBy('created_date', 'desc')
      .get();

    // 分离手动联系人和平台联系人覆盖数据
    const manualContacts = [];
    const platformOverrides = {}; // platform_user_id -> override data
    
    allContactsRes.data.forEach(item => {
      if (item.platform_user_id) {
        // 这是平台联系人的覆盖数据
        platformOverrides[item.platform_user_id] = item;
      } else {
        // 这是手动添加的联系人
        manualContacts.push(item);
      }
    });

    // 批量获取平台用户的详细信息
    let platformContacts = [];
    if (followingIds.length > 0) {
      const usersRes = await usersCollection
        .where({
          _id: db.command.in(followingIds)
        })
        .get();

      // 创建用户ID到用户信息的映射
      const userMap = {};
      usersRes.data.forEach(user => {
        userMap[user._id] = {
          id: user._id,
          userId: user._id, // 用于跳转到用户主页
          name: user.nickname || user.username || '用户',
          phone: user.mobile || '',
          avatar: user.avatar || '',
          company: user.companyName || '',
          source: 'platform',
          sourceType: 'follow', // 来源类型：关注
          sourceInfo: '已关注',
          note: '', // 备注由前端本地存储管理
          addTime: null // 关注时间从 follows 表获取
        };
      });

      // 按照关注顺序排列，并添加关注时间和覆盖数据
      platformContacts = followingIds.map(id => {
        const contact = userMap[id];
        if (contact) {
          const followRecord = followsRes.data.find(f => f.following_id === id);
          if (followRecord) {
            contact.addTime = followRecord.created_date;
          }
          
          // 如果有覆盖数据，应用覆盖（覆盖数据优先于原始数据）
          if (platformOverrides[id]) {
            const override = platformOverrides[id];
            contact.id = override._id; // 使用覆盖记录的ID，用于后续更新
            
            // 使用明确的空值检查：只有 undefined 和 null 才回退到原始数据
            // 空字符串被视为有效值（用户明确设置为空）
            contact.name = (override.name !== undefined && override.name !== null) 
              ? override.name 
              : contact.name;
            contact.phone = (override.phone !== undefined && override.phone !== null) 
              ? override.phone 
              : contact.phone;
            contact.company = (override.company !== undefined && override.company !== null) 
              ? override.company 
              : contact.company;
            contact.note = (override.note !== undefined && override.note !== null) 
              ? override.note 
              : contact.note;
            // 保留原始头像，除非覆盖数据中有（包括空字符串）
            if (override.avatar !== undefined && override.avatar !== null) {
              contact.avatar = override.avatar;
            }
            contact.hasOverride = true; // 标记有覆盖数据
          } else {
            // 没有覆盖数据，使用原始用户数据
            contact.id = id; // 使用用户ID作为标识
            contact.hasOverride = false;
          }
        }
        return contact;
      }).filter(Boolean);
    }

    // 格式化手动添加的联系人
    const formattedManualContacts = manualContacts.map(item => ({
      id: item._id,
      userId: null, // 手动添加的联系人没有用户ID
      name: item.name || '',
      phone: item.phone || '',
      avatar: item.avatar || '',
      company: item.company || '',
      source: 'manual',
      sourceType: 'manual',
      sourceInfo: '手动添加',
      note: item.note || '',
      addTime: item.created_date,
      hasOverride: false
    }));

    // 合并联系人，按手机号去重（如果平台联系人和手动联系人手机号相同，优先保留平台联系人）
    const allContacts = [...platformContacts, ...formattedManualContacts];
    const uniqueContacts = [];
    const phoneMap = new Map();
    
    allContacts.forEach((contact) => {
      if (!contact.phone) {
        // 没有手机号的联系人，直接添加（平台用户可能没有手机号）
        uniqueContacts.push(contact);
      } else if (!phoneMap.has(contact.phone)) {
        phoneMap.set(contact.phone, true);
        uniqueContacts.push(contact);
      } else {
        // 如果手机号重复，且当前是手动添加的，跳过（优先保留平台联系人）
        if (contact.source === 'platform') {
          // 如果平台联系人重复，替换之前的手动联系人
          const index = uniqueContacts.findIndex(c => c.phone === contact.phone);
          if (index !== -1 && uniqueContacts[index].source === 'manual') {
            uniqueContacts[index] = contact;
          }
        }
      }
    });

    console.log(`用户 ${userId} 获取联系人: 平台 ${platformContacts.length} 个, 手动 ${formattedManualContacts.length} 个, 去重后 ${uniqueContacts.length} 个`);

    return res(200, '获取成功', uniqueContacts);
  } catch (err) {
    console.error('getCustomerContacts error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};


