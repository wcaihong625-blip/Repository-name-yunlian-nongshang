'use strict';

const { getConfig } = require('nxt-auth');

function safeString(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

function toYuanFromCent(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Number((n / 100).toFixed(2));
}

function internalSecretFromConfig() {
  const cfg = getConfig() || {};
  const secret = cfg.pay_callback && safeString(cfg.pay_callback.internal_secret);
  return secret || '';
}

exports.main = async (event) => {
  const db = uniCloud.database();

  try {
    const outTradeNo = safeString(
      event.out_trade_no ||
        event.order_no ||
        (event.orderInfo && event.orderInfo.out_trade_no) ||
        (event.data && event.data.out_trade_no)
    );

    if (!outTradeNo) {
      return { code: 400, message: '缺少 out_trade_no', data: null };
    }

    console.log('[promotionWxpayNotify] incoming', { out_trade_no: outTradeNo });

    const query = await db
      .collection('promotion_order')
      .where({
        order_no: outTradeNo
      })
      .limit(1)
      .get();
    const order = query.data && query.data[0];
    if (!order) {
      return { code: 404, message: '业务订单不存在', data: null };
    }
    console.log('[promotionWxpayNotify] order_found', {
      promotion_order_id: order._id,
      order_no: outTradeNo,
      pay_status: Number(order.pay_status || 0),
      status: order.status || '',
      promotion_type: order.promotion_type === 'boost' ? 'boost' : 'top',
      duration_days: order.duration_days,
      content_id: safeString(order.content_id),
      content_type: safeString(order.content_type)
    });

    const paidAmountYuan =
      event.paid_amount != null
        ? Number(event.paid_amount)
        : toYuanFromCent(
            event.total_fee ||
              (event.orderInfo && event.orderInfo.total_fee) ||
              (event.data && event.data.total_fee)
          );

    const secret = internalSecretFromConfig();
    if (!secret) {
      console.error('[promotionWxpayNotify] 缺少 pay_callback.internal_secret，无法安全落账');
      return { code: 500, message: '服务端未配置支付回调密钥', data: null };
    }

    const promotionOrderCo = uniCloud.importObject('promotionOrderCo');
    const result = await promotionOrderCo.markPaidAndActivate({
      internal_secret: secret,
      order_id: order._id,
      pay_channel: 'wxpay',
      transaction_id: safeString(event.transaction_id || (event.data && event.data.transaction_id)),
      paid_amount:
        paidAmountYuan != null && Number.isFinite(paidAmountYuan) ? paidAmountYuan : Number(order.price || 0),
      pay_time: event.pay_time || new Date()
    });

    if (!result || result.code !== 200) {
      return {
        code: (result && result.code) || 500,
        message: (result && result.message) || '推广订单落账失败',
        data: (result && result.data) || null
      };
    }
    return { code: 200, message: 'ok', data: result.data || null };
  } catch (err) {
    console.error('promotionWxpayNotify error:', err);
    return { code: 500, message: err.message || '服务器错误', data: null };
  }
};
