'use strict';

const { requireAdmin } = require('nxt-auth');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const authCollection = db.collection('realname_auth');
  const usersCollection = db.collection('uni-id-users');

  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    const adminResult = await requireAdmin(event, context);
    if (!adminResult.success) {
      return res(403, adminResult.error || '无后台审批权限');
    }

    const {
      page = 1,
      pageSize = 10,
      status = '',
      search = '',
      user_id = ''
    } = event;

    const whereCondition = {};

    if (status) {
      whereCondition.status = status;
    }

    if (user_id) {
      whereCondition.user_id = user_id;
    }

    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      whereCondition.$or = [
        { realName: searchRegex },
        { idCard: searchRegex }
      ];
    }

    let query = authCollection;
    if (Object.keys(whereCondition).length > 0) {
      query = query.where(whereCondition);
    }

    const countRes = await query.count();
    const total = countRes.total || 0;

    const skip = (page - 1) * pageSize;
    const listRes = await query
      .orderBy('created_date', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    const userIds = [];
    if (listRes.data && listRes.data.length > 0) {
      listRes.data.forEach(item => {
        if (item.user_id && !userIds.includes(item.user_id)) {
          userIds.push(item.user_id);
        }
      });
    }

    const userInfoMap = {};
    if (userIds.length > 0) {
      const usersRes = await usersCollection.where({
        _id: db.command.in(userIds)
      }).field({
        _id: true,
        nickname: true,
        username: true,
        mobile: true
      }).get();

      if (usersRes.data) {
        usersRes.data.forEach(user => {
          userInfoMap[user._id] = {
            nickname: user.nickname || user.username || '未知用户',
            mobile: user.mobile || ''
          };
        });
      }
    }

    const list = (listRes.data || []).map(item => {
      const userInfo = userInfoMap[item.user_id] || {
        nickname: '未知用户',
        mobile: ''
      };

      const maskIdCard = (idCard) => {
        if (!idCard || idCard.length < 8) {
          return idCard;
        }
        return idCard.substring(0, 4) + '********' + idCard.substring(idCard.length - 4);
      };

      return {
        _id: item._id,
        user_id: item.user_id,
        user_nickname: userInfo.nickname,
        user_mobile: userInfo.mobile,
        realName: item.realName || '',
        idCard: maskIdCard(item.idCard || ''),
        idCardFull: item.idCard || '',
        idCardFront: item.idCardFront || '',
        idCardBack: item.idCardBack || '',
        status: item.status || 'unverified',
        rejectReason: item.rejectReason || '',
        auditor_id: item.auditor_id || '',
        auditor_name: item.auditor_name || '',
        audit_date: item.audit_date || null,
        created_date: item.created_date || null,
        updated_date: item.updated_date || null,
        verified_date: item.verified_date || null
      };
    });

    return res(200, '获取成功', {
      list: list,
      total: total,
      page: page,
      pageSize: pageSize,
      hasMore: skip + list.length < total
    });
  } catch (err) {
    console.error('getRealnameAuthList error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
