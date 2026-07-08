'use strict';

const { verifyToken } = require('nxt-auth');

exports.main = async (event, context) => {
  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success) {
    return { code: 401, message: tokenResult.error || '未登录，请先登录', data: null };
  }
  const user_id = tokenResult.userId;

  const { avatar, nickname, username, bio, location, industry } = event;

  if (!avatar && !nickname && !username && !bio && !location && !industry) {
    return { code: 400, message: '至少需要提供一个要更新的字段', data: null };
  }

  try {
    const db = uniCloud.database();
    const usersCollection = db.collection('uni-id-users');

    const userCheck = await usersCollection.doc(user_id).get();
    if (!userCheck.data || userCheck.data.length === 0) {
      return { code: 404, message: '用户不存在', data: null };
    }

    const updateData = { update_time: Date.now() };

    if (avatar !== undefined) updateData.avatar = avatar;
    if (avatar !== undefined) updateData.avatar_file = avatar;
    if (nickname !== undefined) updateData.nickname = nickname;
    if (username !== undefined) updateData.username = username;
    if (bio !== undefined) updateData.bio = bio;
    if (location !== undefined) updateData.location = location;
    if (industry !== undefined) updateData.industry = industry;

    const result = await usersCollection.doc(user_id).update(updateData);

    if (result.updated === 0) {
      console.warn('更新失败，updated为0:', result);
    }

    const userResult = await usersCollection.doc(user_id).get();
    const userData = userResult.data && userResult.data.length > 0 ? userResult.data[0] : null;

    if (!userData) {
      return { code: 500, message: '更新后无法获取用户信息', data: null };
    }

    return {
      code: 200,
      message: '更新成功',
      data: { user_id, ...updateData, userInfo: userData }
    };
  } catch (error) {
    console.error('更新用户信息失败:', error);

    let errorMessage = '更新失败';
    if (error && error.message) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    }

    if (errorMessage.includes('permission') || errorMessage.includes('权限')) {
      errorMessage = '没有更新权限，请检查数据库权限配置';
    } else if (errorMessage.includes('not found') || errorMessage.includes('不存在')) {
      errorMessage = '数据库集合不存在，请检查数据库配置';
    }

    return { code: 500, message: errorMessage, data: null };
  }
};
