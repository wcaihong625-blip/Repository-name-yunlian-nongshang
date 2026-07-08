/**
 * 统一读取微信小程序配置。
 *
 * 读取优先级：
 * 1. 云函数环境变量（推荐临时覆盖）
 *    - WX_APP_ID / WX_APP_SECRET
 *    - 兼容旧名称：WECHAT_APPID / WECHAT_SECRET
 * 2. uni-config-center 配置文件
 *    - uniCloud-aliyun/cloudfunctions/common/uni-config-center/wechat-login/config.json
 *    - 兼容旧目录：wechat/config.json
 */

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

function readFromConfigCenter() {
  const possiblePaths = [
    './uni-config-center/index.js',
    '../common/uni-config-center/index.js',
    '../../common/uni-config-center/index.js'
  ];
  const pluginIds = ['wechat-login', 'wechat'];
  const env = getCurrentEnv();

  for (const configPath of possiblePaths) {
    for (const pluginId of pluginIds) {
      try {
        const createConfig = require(configPath);
        const configCenter = createConfig({ pluginId });
        const rawConfig =
          typeof configCenter.rawConfig === 'function'
            ? configCenter.rawConfig()
            : null;
        const envConfig =
          (rawConfig && (rawConfig[env] || rawConfig.production || rawConfig.development)) ||
          (typeof configCenter.config === 'function' ? configCenter.config() : null) ||
          {};

        const appid =
          envConfig?.weixin?.appId ||
          envConfig?.weixin?.appid ||
          envConfig?.appid ||
          envConfig?.appId;
        const secret =
          envConfig?.weixin?.appSecret ||
          envConfig?.weixin?.secret ||
          envConfig?.secret ||
          envConfig?.appSecret ||
          envConfig?.appsecret;

        if (appid && secret) {
          console.log('[getWechatConfig] 已从配置文件读取', {
            env,
            pluginId,
            configPath,
            hasAppid: true,
            hasSecret: true
          });
          return { appid, secret };
        }
      } catch (error) {
        // 当前路径不存在就继续尝试下一个，不中断流程
      }
    }
  }

  return null;
}

/**
 * 与 JWT 同源：直接读正式 wechat-login/config.json（与 common/authHelper 一致）
 */
function readFromFormalWechatLoginJson() {
  const env = getCurrentEnv();
  try {
    const raw = require('./uni-config-center/wechat-login/config.json');
    const envConfig =
      (raw && (raw[env] || raw.production || raw.development)) || {};

    const appid =
      envConfig?.weixin?.appId ||
      envConfig?.weixin?.appid ||
      envConfig?.appid ||
      envConfig?.appId;
    const secret =
      envConfig?.weixin?.appSecret ||
      envConfig?.weixin?.secret ||
      envConfig?.secret ||
      envConfig?.appSecret ||
      envConfig?.appsecret;

    if (appid && secret) {
      console.log('[getWechatConfig] 已从正式 wechat-login/config.json 读取', {
        env,
        hasAppid: true,
        hasSecret: true
      });
      return { appid, secret, source: 'wechatLogin/common/uni-config-center/wechat-login/config.json' };
    }
  } catch (error) {
    // 继续走 uni-config-center 扫描
  }
  return null;
}

module.exports = function getWechatConfig() {
  const appid =
    process.env.WX_APP_ID ||
    process.env.WX_APPID ||
    process.env.WECHAT_APPID;
  const secret =
    process.env.WX_APP_SECRET ||
    process.env.WX_APPSECRET ||
    process.env.WECHAT_SECRET;

  if (appid && secret) {
    console.log('[getWechatConfig] 已从环境变量读取', {
      hasAppid: true,
      hasSecret: true
    });
    return { appid, secret, source: 'env' };
  }

  const formal = readFromFormalWechatLoginJson();
  if (formal) {
    return formal;
  }

  const config = readFromConfigCenter();
  if (config) {
    return { ...config, source: config.source || 'uni-config-center' };
  }

  throw new Error(
    '微信小程序配置缺失：请在当前云函数目录下创建 common/uni-config-center/wechat-login/config.json（与仓库 cloudfunctions/common 下同名文件内容一致），并填写 weixin.appId、weixin.appSecret；或在云函数环境变量中配置 WX_APP_ID / WX_APP_SECRET（兼容 WECHAT_APPID / WECHAT_SECRET）。'
  );
};
