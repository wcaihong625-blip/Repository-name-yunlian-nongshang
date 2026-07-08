'use strict';

const { verifyToken } = require('nxt-auth');
const fs = require('fs');
const path = require('path');

function normalizePayParams(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.errCode === 'number' && raw.errCode !== 0) return null;
  if (raw.payParams && typeof raw.payParams === 'object') return raw.payParams;
  if (raw.payment && typeof raw.payment === 'object') return raw.payment;
  if (raw.orderInfo && typeof raw.orderInfo === 'object') return raw.orderInfo;
  if (raw.order && typeof raw.order === 'object') return raw.order;
  if (raw.data && typeof raw.data === 'object') {
    if (raw.data.payParams) return raw.data.payParams;
    if (raw.data.payment) return raw.data.payment;
    if (raw.data.orderInfo) return raw.data.orderInfo;
    if (raw.data.order && typeof raw.data.order === 'object') return raw.data.order;
  }
  return null;
}

function toCent(amountYuan) {
  const n = Number(amountYuan);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function resolveSpaceIdFromConfig(config) {
  const envSpaceId = process.env.UNI_CLOUD_SPACE_ID || '';
  if (envSpaceId) return envSpaceId;
  const notifyUrl = config && config.notifyUrl;
  if (notifyUrl && typeof notifyUrl === 'object') {
    const firstKey = Object.keys(notifyUrl)[0] || '';
    if (firstKey) return firstKey;
  }
  return '';
}

function loadUniPayConfig() {
  const pluginRoot = path.join(__dirname, '..', 'common', 'uni-config-center', 'uni-pay');
  try {
    const createConfig = require('uni-config-center');
    const configCenter = createConfig({ pluginId: 'uni-pay' });
    const cfg = typeof configCenter.config === 'function' ? configCenter.config() : null;
    if (cfg && typeof cfg === 'object' && Object.keys(cfg).length > 0) {
      return { config: cfg, source: 'uni-config-center' };
    }
  } catch (_e) {
    /* ignore */
  }
  const configPath = path.join(__dirname, '..', 'common', 'uni-config-center', 'uni-pay', 'config.js');
  if (fs.existsSync(configPath)) {
    try {
      delete require.cache[require.resolve(configPath)];
      const cfg = require(configPath);
      if (cfg && typeof cfg === 'object') {
        return { config: cfg, source: 'local-file' };
      }
    } catch (err) {
      return { config: null, source: 'local-file', error: err.message };
    }
  }
  return { config: null, source: 'none' };
}

async function getUserWxOpenid(db, userId) {
  if (!userId) return '';
  const userRes = await db.collection('uni-id-users').doc(userId).get();
  const user = userRes && userRes.data && userRes.data[0] ? userRes.data[0] : null;
  if (!user) return '';
  const wxOpenid = user.wx_openid || user.wxOpenid || '';
  return typeof wxOpenid === 'string' ? wxOpenid.trim() : '';
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const col = db.collection('promotion_order');
  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const auth = await verifyToken(event, context);
    if (!auth.success) return res(401, auth.error || '登录状态无效');

    const orderId = String(event.promotion_order_id || event.order_id || '').trim();
    if (!orderId) {
      return res(400, '缺少 promotion_order_id');
    }

    const docRes = await col.doc(orderId).get();
    const order = docRes.data && docRes.data[0];
    if (!order) {
      return res(404, '推广订单不存在');
    }
    console.log('[createPromotionWxPayParams] order_loaded', {
      promotion_order_id: orderId,
      order_no: String(order.order_no || '').trim(),
      pay_status: Number(order.pay_status || 0),
      status: order.status || '',
      promotion_type: order.promotion_type === 'boost' ? 'boost' : 'top',
      duration_days: order.duration_days,
      price: Number(order.price != null ? order.price : 0)
    });
    if (String(order.user_id) !== String(auth.userId)) {
      return res(403, '无权操作该订单');
    }
    if (Number(order.pay_status) === 1 || order.status === 'active') {
      return res(400, '该订单已支付或已生效');
    }
    if (order.status === 'cancelled' || order.status === 'expired') {
      return res(400, '订单已关闭，请重新下单');
    }

    const amountYuan = Number(order.price != null ? order.price : 0);
    if (!Number.isFinite(amountYuan) || amountYuan <= 0) {
      return res(400, '当前订单无需微信支付（0 元请直接开通）');
    }

    const cfgResult = loadUniPayConfig();
    const uniPayConfig = cfgResult.config || {};
    const hasWxpay = !!(uniPayConfig && typeof uniPayConfig.wxpay === 'object');
    const hasWxpayMp = !!(hasWxpay && uniPayConfig.wxpay && typeof uniPayConfig.wxpay.mp === 'object');
    if (!hasWxpay || !hasWxpayMp) {
      return res(500, 'uni-pay 配置缺少 wxpay / wxpay.mp');
    }

    const orderNo = String(order.order_no || '').trim();
    if (!orderNo) {
      return res(500, '订单缺少 order_no');
    }

    const totalFee = toCent(amountYuan);
    if (totalFee <= 0) {
      return res(400, '订单金额异常');
    }

    const platform = (context && context.PLATFORM) || 'mp-weixin';
    const cloudSpaceId = resolveSpaceIdFromConfig(uniPayConfig);
    const wxOpenid = await getUserWxOpenid(db, auth.userId);
    if (!wxOpenid) {
      return res(400, '当前账号缺少微信openid，请先重新登录微信后再支付');
    }

    const payOrder = await uniCloud.importObject('uni-pay-co').createOrder({
      provider: 'wxpay',
      openid: wxOpenid,
      order_no: orderNo,
      out_trade_no: orderNo,
      total_fee: totalFee,
      type: 'promotion_wx',
      title: '云链农商信息推广',
      description: '采购/供应信息推广服务',
      user_id: auth.userId,
      clientInfo: {
        platform,
        clientIP: '',
        userAgent: ''
      },
      cloudInfo: {
        spaceId: cloudSpaceId
      },
      custom: {
        biz_type: 'promotion_wx',
        promotion_order_id: orderId
      }
    });

    const payParams = normalizePayParams(payOrder);
    if (payOrder && typeof payOrder === 'object' && Number(payOrder.errCode || 0) !== 0) {
      return res(500, payOrder.errMsg || 'uni-pay 下单失败', { errCode: payOrder.errCode });
    }
    if (!payParams) {
      return res(500, 'uni-pay 下单成功但未返回支付参数');
    }

    await col.doc(orderId).update({
      uni_pay_order: payOrder && typeof payOrder === 'object' ? payOrder : null,
      updated_at: new Date()
    });

    console.log('[createPromotionWxPayParams] uni_pay_order_saved', {
      promotion_order_id: orderId,
      order_no: orderNo,
      pay_status: Number(order.pay_status || 0),
      is_active: order.status === 'active'
    });

    return res(200, '支付参数生成成功', {
      order_id: orderId,
      order_no: orderNo,
      pay_amount: amountYuan,
      pay_params: payParams
    });
  } catch (err) {
    console.error('createPromotionWxPayParams error:', err);
    if (String((err && err.message) || '').includes('uni-pay-co')) {
      return res(500, '未检测到 uni-pay-co，请先部署官方 uni-pay');
    }
    return res(500, err.message || '服务器错误');
  }
};
