// 微信一键登录云函数
// 加入了一体化登录流程：接收并保存 avatarUrl、nickName
'use strict';

const crypto = require('crypto');
const { signToken, getWechatConfig } = require('nxt-auth');

const res = (code, message, data) => {
  return { code, message, data: data || null };
};

let accessTokenCache = {
  token: null,
  expiresAt: 0
};

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
  accessTokenCache = {
    token: access_token,
    expiresAt: now + (expires_in - 300) * 1000
  };
  return access_token;
}

async function code2Session(code) {
  const { appid, secret, source } = getWechatConfig();

  console.log(`[wechatLogin] 当前读取到的配置来源: ${source || '本地'}`);
  console.log(`[wechatLogin] 当前使用的 appId: ${appid}`);
  const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${appid}&secret=${secret}&js_code=${code}&grant_type=authorization_code`;

  const response = await uniCloud.httpclient.request(url, {
    method: 'GET',
    dataType: 'json'
  });

  console.log(`[wechatLogin] jscode2session 返回结果:`, response.data);

  if (response.status !== 200 || !response.data || response.data.errcode) {
    console.error(`[wechatLogin] jscode2session 出错: errcode=${response.data?.errcode}, errmsg=${response.data?.errmsg}`);
    throw new Error(response.data?.errmsg || 'jscode2session 失败');
  }

  return response.data;
}

function decryptPhoneNumber(encryptedData, iv, sessionKey) {
  try {
    const sessionKeyBuffer = Buffer.from(sessionKey, 'base64');
    const encryptedDataBuffer = Buffer.from(encryptedData, 'base64');
    const ivBuffer = Buffer.from(iv, 'base64');

    const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKeyBuffer, ivBuffer);
    let decrypted = decipher.update(encryptedDataBuffer, 'binary', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted).phoneNumber;
  } catch (err) {
    throw new Error('解密手机号失败');
  }
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

  const { loginCode, phoneCode, encryptedData, iv, avatarUrl, nickName } = event;

  try {
    if (!loginCode) {
      return res(400, '参数错误：loginCode 为必填项');
    }

    const sessionData = await code2Session(loginCode);
    const { openid, session_key, unionid } = sessionData;

    if (!openid) {
      return res(400, '获取微信用户信息失败');
    }

    let user = null;
    let isNewUser = false;

    let userRes = await usersCollection.where({ wx_openid: openid }).limit(1).get();

    if (userRes.data && userRes.data.length > 0) {
      user = userRes.data[0];
    } else if (unionid) {
      userRes = await usersCollection.where({ wx_unionid: unionid }).limit(1).get();
      if (userRes.data && userRes.data.length > 0) {
        user = userRes.data[0];
        await usersCollection.doc(user._id).update({ wx_openid: openid });
        user.wx_openid = openid;
      }
    }

    const now = Date.now();

    if (!user) {
      const addData = {
        username: nickName || ('wx_' + openid.slice(-8)),
        mobile: '',
        password: '',
        wx_openid: openid,
        wx_unionid: unionid || '',
        nickname: nickName || '',
        avatar: avatarUrl || '',
        status: 0,
        created_date: now,
        last_login_date: now
      };
      if (avatarUrl) {
        addData.avatar_file = { url: avatarUrl };
      }

      const addRes = await usersCollection.add(addData);
      const userId = addRes.id || (addRes.insertedId && addRes.insertedId.toString());
      const newUserRes = await usersCollection.doc(userId).get();
      user = newUserRes.data[0];
      isNewUser = true;
    }

    let phoneNumber = user.mobile || '';
    if (phoneCode) {
      try {
        phoneNumber = await getPhoneNumber(phoneCode);
      } catch (err) {
        console.warn('[wechatLogin] 获取手机号失败:', err.message);
      }
    } else if (encryptedData && iv && session_key) {
      try {
        phoneNumber = decryptPhoneNumber(encryptedData, iv, session_key);
      } catch (err) {
        console.warn('[wechatLogin] 解密手机号失败:', err.message);
      }
    }

    const updateData = { last_login_date: now };

    if (phoneNumber && phoneNumber !== user.mobile) {
      updateData.mobile = phoneNumber;
    }

    if (avatarUrl && avatarUrl !== user.avatar) {
      updateData.avatar = avatarUrl;
      updateData.avatar_file = { url: avatarUrl };
    }

    if (nickName && nickName !== user.nickname) {
      updateData.nickname = nickName;
      if (!user.username || user.username.startsWith('wx_')) {
        updateData.username = nickName;
      }
    }

    if (!user.nickname && !updateData.nickname) {
      updateData.nickname = '微信用户';
    }

    if (Object.keys(updateData).length > 1) {
      await usersCollection.doc(user._id).update(updateData);
      const updatedUserRes = await usersCollection.doc(user._id).get();
      user = updatedUserRes.data[0];
    } else {
      await usersCollection.doc(user._id).update({ last_login_date: now });
    }

    const token = signToken({ uid: user._id });

    return res(200, isNewUser ? '注册并登录成功' : '登录成功', {
      token,
      uid: user._id,
      userInfo: {
        nickName: user.nickname || '',
        avatarUrl: user.avatar || '',
        phone: user.mobile || '',
        role: user.role || []
      }
    });

  } catch (err) {
    console.error('[wechatLogin] 错误:', err);
    return res(500, err.message || '服务器内部错误');
  }
};
