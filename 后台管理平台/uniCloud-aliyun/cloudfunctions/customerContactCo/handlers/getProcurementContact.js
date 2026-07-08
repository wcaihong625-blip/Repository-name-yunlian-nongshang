'use strict';

const { verifyToken, createResponse } = require('nxt-auth');

function firstDocFromGet(getRes) {
  const data = getRes && getRes.data;
  if (Array.isArray(data)) return data[0] || null;
  if (data && typeof data === 'object') return data;
  return null;
}

module.exports = async (event, context) => {
  const db = uniCloud.database();
  const usersCollection = db.collection('uni-id-users');
  const res = createResponse;

  try {
    const authResult = await verifyToken(event, context);
    if (!authResult.success) {
      return res(401, authResult.error || '请先登录');
    }

    const currentUserId = authResult.userId;
    const { targetUserId } = event;
    if (!targetUserId || !String(targetUserId).trim()) {
      return res(400, '参数错误：targetUserId不能为空');
    }

    const requesterRes = await usersCollection.doc(currentUserId).get();
    const requester = firstDocFromGet(requesterRes);
    if (!requester) {
      return res(404, '当前用户不存在');
    }

    const now = Date.now();
    const vipExpireTime = requester.vip_expire_time ? new Date(requester.vip_expire_time).getTime() : 0;
    const isVip = !!requester.is_vip && vipExpireTime > now;
    if (!isVip) {
      return {
        success: false,
        code: 403,
        message: '只有会员用户才能联系采购商',
        needVip: true,
        vipRestricted: true,
        data: null
      };
    }

    const targetRes = await usersCollection.doc(String(targetUserId).trim()).get();
    const targetUser = firstDocFromGet(targetRes);
    if (!targetUser) {
      return res(404, '采购商不存在');
    }

    if (!targetUser.mobile) {
      return res(404, '该采购商未设置电话');
    }

    return res(200, '获取成功', {
      user_id: targetUser._id || '',
      nickname: targetUser.nickname || targetUser.username || '用户',
      username: targetUser.username || '',
      mobile: targetUser.mobile || ''
    });
  } catch (err) {
    console.error('customerContactCo.getProcurementContact error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
