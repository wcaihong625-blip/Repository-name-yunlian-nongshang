'use strict';

const { verifyToken, getWechatConfig } = require('nxt-auth');

const res = (code, message, data) => {
  return { code, message, data: data || null };
};

let accessTokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
  const now = Date.now();
  if (accessTokenCache.token && accessTokenCache.expiresAt > now) {
    return accessTokenCache.token;
  }

  const { appid, secret } = getWechatConfig();

  const response = await uniCloud.httpclient.request('https://api.weixin.qq.com/cgi-bin/token', {
    method: 'GET',
    data: { grant_type: 'client_credential', appid, secret },
    dataType: 'json'
  });

  if (response.status !== 200 || !response.data || response.data.errcode) {
    throw new Error(response.data?.errmsg || '获取 access_token 失败');
  }

  const { access_token, expires_in } = response.data;
  accessTokenCache = { token: access_token, expiresAt: now + (expires_in - 300) * 1000 };
  return access_token;
}

async function getPhoneNumber(phoneCode) {
  const accessToken = await getAccessToken();

  const response = await uniCloud.httpclient.request(`https://api.weixin.qq.com/wxa/business/getuserphonenumber?access_token=${accessToken}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    data: { code: phoneCode },
    dataType: 'json'
  });

  if (response.status !== 200 || !response.data || response.data.errcode) {
    throw new Error(response.data?.errmsg || '获取手机号失败');
  }

  return response.data.phone_info?.phoneNumber || response.data.phone_info?.purePhoneNumber;
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const usersCollection = db.collection('uni-id-users');

  const { phoneCode } = event;

  try {
    if (!phoneCode) {
      return res(400, '参数错误：phoneCode 为必填项');
    }

    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '登录状态无效');
    }
    const userId = tokenResult.userId;

    const phoneNumber = await getPhoneNumber(phoneCode);

    if (!phoneNumber) {
      return res(400, '获取手机号失败');
    }

    const existingUser = await usersCollection
      .where({ mobile: phoneNumber, _id: db.command.neq(userId) })
      .limit(1)
      .get();

    if (existingUser.data && existingUser.data.length > 0) {
      return res(400, '该手机号已被其他账号绑定');
    }

    await usersCollection.doc(userId).update({ mobile: phoneNumber });

    return res(200, '绑定成功', { phoneNumber });

  } catch (err) {
    console.error('[bindPhoneNumber] 错误:', err);
    return res(500, err.message || '服务器内部错误');
  }
};
