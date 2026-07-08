'use strict';

const { verifyToken, createResponse } = require('nxt-auth');

module.exports = async (event, context) => {
  const db = uniCloud.database();
  const dbCmd = db.command;

  const usersCollection = db.collection('uni-id-users');
  const codesCollection = db.collection('vip_redeem_codes');
  const recordsCollection = db.collection('vip_records');

  try {
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return createResponse(401, tokenResult.error || '未登录，请先登录');
    }

    const userId = tokenResult.userId;
    let { code } = event;

    if (!code || typeof code !== 'string') {
      return createResponse(400, '请输入优惠码');
    }

    code = code.trim().toUpperCase();

    if (!code) {
      return createResponse(400, '请输入优惠码');
    }

    // 查优惠码
    const codeRes = await codesCollection.where({
      code
    }).limit(1).get();

    if (!codeRes.data || codeRes.data.length === 0) {
      return createResponse(404, '优惠码不存在');
    }

    const redeemCode = codeRes.data[0];

    // 状态校验
    if (redeemCode.status === 'used') {
      return createResponse(400, '优惠码已使用');
    }

    if (redeemCode.status === 'disabled') {
      return createResponse(400, '优惠码已作废');
    }

    if (redeemCode.status === 'expired') {
      return createResponse(400, '优惠码已过期');
    }

    const now = Date.now();

    if (redeemCode.expire_at) {
      const expireAt = new Date(redeemCode.expire_at).getTime();
      if (!Number.isNaN(expireAt) && expireAt < now) {
        // 过期时顺手更新状态
        await codesCollection.doc(redeemCode._id).update({
          status: 'expired'
        });
        return createResponse(400, '优惠码已过期');
      }
    }

    if (redeemCode.type !== 'days') {
      return createResponse(400, '当前优惠码类型暂不支持');
    }

    const addDays = Number(redeemCode.value || 0);
    if (!addDays || addDays <= 0) {
      return createResponse(400, '优惠码配置无效');
    }

    // 查用户
    const userRes = await usersCollection.doc(userId).get();
    if (!userRes.data || userRes.data.length === 0) {
      return createResponse(404, '用户不存在');
    }

    const user = userRes.data[0];

    const nowDate = new Date();
    const currentExpireTime = user.vip_expire_time ? new Date(user.vip_expire_time).getTime() : 0;

    let baseTime = nowDate.getTime();
    if (currentExpireTime && currentExpireTime > baseTime) {
      baseTime = currentExpireTime;
    }

    const afterExpireTime = baseTime + addDays * 24 * 60 * 60 * 1000;

    // 更新用户会员状态
    await usersCollection.doc(userId).update({
      is_vip: true,
      vip_level: 'vip',
      vip_source: 'redeem_code',
      vip_expire_time: new Date(afterExpireTime)
    });

    // 记录会员变更记录
    await recordsCollection.add({
      user_id: userId,
      days: addDays,
      source_type: 'redeem_code',
      source_id: redeemCode._id,
      before_expire_time: currentExpireTime ? new Date(currentExpireTime) : null,
      after_expire_time: new Date(afterExpireTime),
      remark: redeemCode.remark || '',
      created_at: new Date()
    });

    // 更新优惠码状态
    await codesCollection.doc(redeemCode._id).update({
      status: 'used',
      used_by: userId,
      used_at: new Date()
    });

    return createResponse(200, '兑换成功', {
      added_days: addDays,
      vip_expire_time: afterExpireTime,
      vip_expire_time_text: formatDate(afterExpireTime)
    });
  } catch (err) {
    console.error('redeemVipCode error:', err);
    return createResponse(500, '服务器内部错误', {
      error: err.message || 'unknown error'
    });
  }
};

function formatDate(timestamp) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const minute = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hour}:${minute}`;
}
