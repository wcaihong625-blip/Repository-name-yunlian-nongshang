'use strict';

const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

function getCurrentEnv() {
  let env = process.env.UNI_PLATFORM_ENV || process.env.NODE_ENV;
  if (process.env.UNI_CLOUD_PROVIDER) {
    env = 'production';
    if (
      process.env.UNI_CLOUD_HBUILDERX_DEBUG === 'true' ||
      process.env.NODE_ENV === 'development'
    ) {
      env = 'development';
    }
  }
  return env || 'production';
}

function readNxtServerConfigByFile() {
  const configPath = path.join(__dirname, '..', 'uni-config-center', 'nxt-server', 'config.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`[nxt-auth] 读取配置失败: ${err.message}`);
  }
}

function getConfig() {
  try {
    const createConfig = require('uni-config-center');
    const configCenter = createConfig({ pluginId: 'nxt-server' });
    const cfg = typeof configCenter.config === 'function' ? configCenter.config() : null;
    if (cfg && Object.keys(cfg).length > 0) return cfg;
  } catch (_e) {
    // uni-config-center 不可用，降级到本地文件读取
  }
  return readNxtServerConfigByFile();
}

function getJwtSecret() {
  const cfg = getConfig();
  const secret =
    (cfg && cfg.jwt && cfg.jwt.secret && String(cfg.jwt.secret).trim()) ||
    (process.env.JWT_SECRET && String(process.env.JWT_SECRET).trim()) ||
    '';
  if (!secret) {
    throw new Error(
      '[nxt-auth] 未配置 JWT secret，请在 common/uni-config-center/nxt-server/config.json 中配置 jwt.secret'
    );
  }
  return secret;
}

function getJwtExpiresIn() {
  const cfg = getConfig();
  return (
    (cfg && cfg.jwt && cfg.jwt.expiresIn) ||
    process.env.JWT_EXPIRES_IN ||
    '7d'
  );
}

function getTokenFromEvent(event) {
  if (!event) return '';
  let token =
    event.uniIdToken ||
    event.uni_id_token ||
    event.token ||
    event.authorization ||
    (event.headers && (event.headers.authorization || event.headers.Authorization || event.headers['uni-id-token'])) ||
    (event.clientInfo && event.clientInfo.uniIdToken) ||
    '';
  if (typeof token === 'string') {
    token = token.replace(/^Bearer\s+/i, '').trim();
  }
  return token;
}

function normalizeDecoded(decoded = {}) {
  return {
    userId: decoded.uid || decoded.userId || decoded._id || '',
    username: decoded.username || '',
    role: decoded.role || decoded.roles || '',
    mobile: decoded.mobile || ''
  };
}

async function verifyToken(event, context) {
  const token = getTokenFromEvent(event);
  if (!token) {
    return { success: false, userId: null, error: '未登录，请先登录', decoded: null, user: null };
  }

  if (context) {
    try {
      const uniID = require('uni-id-common');
      const uniIDIns = uniID.createInstance({ context });
      const res = await uniIDIns.checkToken(token);
      if (res.errCode === 0) {
        const userId = res.uid || res.user_id;
        return {
          success: true,
          userId,
          error: null,
          decoded: res,
          user: { userId, username: '', role: '', mobile: '' }
        };
      }
    } catch (_e) {
      // uni-id-common 不可用或校验失败，降级到本地 JWT
    }
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret());
    const normalized = normalizeDecoded(decoded);
    if (!normalized.userId) {
      return { success: false, userId: null, error: '登录状态无效', decoded, user: null };
    }
    return {
      success: true,
      userId: normalized.userId,
      error: null,
      decoded,
      user: normalized
    };
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return { success: false, userId: null, error: '登录状态已过期，请重新登录', decoded: null, user: null };
    }
    if (err.name === 'JsonWebTokenError') {
      return { success: false, userId: null, error: '登录状态无效', decoded: null, user: null };
    }
    return { success: false, userId: null, error: '验证登录状态时发生错误', decoded: null, user: null };
  }
}

function isAdminRole(role) {
  if (!role) return false;
  if (Array.isArray(role)) {
    return role.some((r) => r === 'admin' || (r && typeof r === 'object' && r.role_id === 'admin'));
  }
  if (typeof role === 'string') return role === 'admin' || role.includes('admin');
  return false;
}

async function requireAdmin(event, context) {
  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success) return tokenResult;

  const db = uniCloud.database();
  const userRes = await db.collection('uni-id-users').doc(tokenResult.userId).get();
  const user = userRes && userRes.data && userRes.data.length ? userRes.data[0] : null;
  if (!user) {
    return { success: false, userId: tokenResult.userId, error: '用户不存在' };
  }
  if (!isAdminRole(user.role)) {
    return { success: false, userId: tokenResult.userId, error: '无后台审批权限' };
  }
  return {
    success: true,
    userId: tokenResult.userId,
    error: null,
    user
  };
}

async function getCurrentUserId(event, context) {
  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success) return null;
  return tokenResult.userId;
}

async function getCurrentUser(event, context) {
  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success) return null;
  const user = tokenResult.user || {};
  return {
    uid: user.userId || tokenResult.userId,
    userId: user.userId || tokenResult.userId,
    username: user.username || '',
    role: user.role || '',
    mobile: user.mobile || '',
    decoded: tokenResult.decoded
  };
}

function signToken(payload, expiresIn) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: expiresIn || getJwtExpiresIn() });
}

function createResponse(code, message, data = null) {
  return { code, message, data };
}

function pickFirstNonEmpty(...values) {
  for (const value of values) {
    if (value === undefined || value === null) continue;
    const normalized = String(value).trim();
    if (normalized) return normalized;
  }
  return '';
}

function isPlainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function getEnvConfig(rawConfig, env) {
  if (!isPlainObject(rawConfig)) return {};
  if (isPlainObject(rawConfig[env])) return rawConfig[env];
  return rawConfig;
}

function extractWechatFields(rawConfig, env) {
  const envConfig = getEnvConfig(rawConfig, env);
  const mpWeixinConfig = envConfig['mp-weixin']?.oauth?.weixin || envConfig.mpWeixin?.oauth?.weixin || {};
  const oauthWeixinConfig = envConfig.oauth?.weixin || {};
  const weixinConfig = envConfig.weixin || {};

  const appid = pickFirstNonEmpty(
    weixinConfig.appId,
    weixinConfig.appid,
    envConfig.appId,
    envConfig.appid,
    mpWeixinConfig.appId,
    mpWeixinConfig.appid,
    oauthWeixinConfig.appId,
    oauthWeixinConfig.appid
  );

  const secret = pickFirstNonEmpty(
    weixinConfig.appSecret,
    weixinConfig.appsecret,
    weixinConfig.secret,
    envConfig.appSecret,
    envConfig.appsecret,
    envConfig.secret,
    mpWeixinConfig.appSecret,
    mpWeixinConfig.appsecret,
    mpWeixinConfig.secret,
    oauthWeixinConfig.appSecret,
    oauthWeixinConfig.appsecret,
    oauthWeixinConfig.secret
  );

  return {
    appid,
    secret,
    envConfig,
    topLevelKeys: isPlainObject(envConfig) ? Object.keys(envConfig) : []
  };
}

function getWechatConfig() {
  const env = getCurrentEnv();

  const logWechatConfig = (stage, payload = {}) => {
    console.log('[nxt-auth][getWechatConfig]', stage, {
      env,
      ...payload
    });
  };

  const envAppid = process.env.WX_APP_ID || process.env.WX_APPID || process.env.WECHAT_APPID;
  const envSecret = process.env.WX_APP_SECRET || process.env.WX_APPSECRET || process.env.WECHAT_SECRET;
  if (envAppid && envSecret) {
    logWechatConfig('read_from_env', {
      hasAppId: true,
      hasAppSecret: true
    });
    return { appid: envAppid, secret: envSecret, source: 'env', env };
  }

  try {
    const uniConfigCenter = require('uni-config-center');
    const pluginIds = ['wechat-login', 'wechatLogin', 'uni-id', 'wechat'];

    for (const pluginId of pluginIds) {
      try {
        const configInst = uniConfigCenter({ pluginId });
        const baseConfig = typeof configInst.config === 'function' ? configInst.config() : null;
        const { appid, secret, topLevelKeys } = extractWechatFields(baseConfig, env);

        logWechatConfig('scan_config_center', {
          pluginId,
          topLevelKeys,
          hasAppId: !!appid,
          hasAppSecret: !!secret
        });

        if (appid && secret) {
          logWechatConfig('resolved_from_config_center', {
            pluginId,
            topLevelKeys,
            hasAppId: true,
            hasAppSecret: true
          });
          return { appid, secret, source: `config-center:${pluginId}`, env };
        }
      } catch (error) {
        logWechatConfig('scan_config_center_failed', {
          pluginId,
          error: error.message
        });
        // 当前 pluginId 不存在，继续尝试
      }
    }
  } catch (_e) {
    // uni-config-center 不可用
  }

  const configCandidates = [
    {
      pluginId: 'wechat-login',
      configPath: path.join(__dirname, '..', 'uni-config-center', 'wechat-login', 'config.json')
    },
    {
      pluginId: 'wechat-login',
      configPath: path.join(__dirname, '..', 'node_modules', 'uni-config-center', 'wechat-login', 'config.json')
    },
    {
      pluginId: 'wechat-login',
      configPath: path.join(__dirname, 'uni-config-center', 'wechat-login', 'config.json')
    },
    {
      pluginId: 'uni-id',
      configPath: path.join(__dirname, '..', 'uni-config-center', 'uni-id', 'config.json')
    },
    {
      pluginId: 'uni-id',
      configPath: path.join(__dirname, '..', 'node_modules', 'uni-config-center', 'uni-id', 'config.json')
    },
    {
      pluginId: 'uni-id',
      configPath: path.join(__dirname, 'uni-config-center', 'uni-id', 'config.json')
    }
  ];
  const visitedConfigPaths = new Set();

  for (const candidate of configCandidates) {
    if (visitedConfigPaths.has(candidate.configPath)) continue;
    visitedConfigPaths.add(candidate.configPath);

    logWechatConfig('scan_config_file', {
      pluginId: candidate.pluginId,
      configPath: candidate.configPath,
      exists: fs.existsSync(candidate.configPath)
    });

    if (!fs.existsSync(candidate.configPath)) continue;

    try {
      const raw = JSON.parse(fs.readFileSync(candidate.configPath, 'utf8'));
      const { appid, secret, topLevelKeys } = extractWechatFields(raw, env);
      logWechatConfig('parsed_config_file', {
        pluginId: candidate.pluginId,
        configPath: candidate.configPath,
        rawTopLevelKeys: raw && typeof raw === 'object' ? Object.keys(raw) : [],
        topLevelKeys,
        hasAppId: !!appid,
        hasAppSecret: !!secret
      });
      if (appid && secret) {
        logWechatConfig('resolved_from_config_file', {
          pluginId: candidate.pluginId,
          configPath: candidate.configPath,
          hasAppId: true,
          hasAppSecret: true
        });
        return {
          appid,
          secret,
          source: `file:${candidate.pluginId}:${candidate.configPath}`,
          env
        };
      }
    } catch (error) {
      logWechatConfig('parse_config_file_failed', {
        pluginId: candidate.pluginId,
        configPath: candidate.configPath,
        error: error.message
      });
    }
  }

  logWechatConfig('resolve_failed', {
    checkedPaths: Array.from(visitedConfigPaths)
  });
  throw new Error('[nxt-auth] 微信小程序配置缺失，请检查后端 common/uni-config-center 正式配置');
}

module.exports = {
  getConfig,
  getJwtSecret,
  getJwtExpiresIn,
  getTokenFromEvent,
  verifyToken,
  requireAdmin,
  getCurrentUserId,
  getCurrentUser,
  signToken,
  createResponse,
  getWechatConfig
};
