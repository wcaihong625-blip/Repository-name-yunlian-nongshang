'use strict';
/**
 * 支付成功统一落账入口（会员订单）。供管理端/内部验签回调调用；微信小程序支付成功由 memberWxpayNotify 等走同一套 nxt-member-order-apply-paid。
 * 鉴权：后台管理员，或请求体 internal_secret 与 uni-config-center/nxt-server/config.json 中 pay_callback.internal_secret 一致。
 */
const { getConfig, requireAdmin } = require('nxt-auth');
const { applyMemberOrderPaidCore, safeString, findPaidUniPayOrder } = require('nxt-member-order-apply-paid');

function canUseInternalSecret(event) {
  const cfg = getConfig() || {};
  const secret = cfg.pay_callback && safeString(cfg.pay_callback.internal_secret);
  if (!secret) return false;
  return safeString(event.internal_secret) === secret;
}

exports.main = async (event, context) => {
  const db = uniCloud.database();

  try {
    if (!canUseInternalSecret(event)) {
      const admin = await requireAdmin(event, context);
      if (!admin.success) {
        return { code: 403, message: admin.error || '无权限', data: null };
      }
    }

    let orderId = safeString(event.order_id || event.id || event.member_order_id);
    const outTradeNo = safeString(event.out_trade_no || event.order_no);
    const transactionId = safeString(event.transaction_id);

    if (!orderId) {
      const paidPayOrder = await findPaidUniPayOrder(db, {
        out_trade_no: outTradeNo,
        transaction_id: transactionId
      });
      orderId = safeString(
        paidPayOrder &&
          ((paidPayOrder.custom && paidPayOrder.custom.member_order_id) || paidPayOrder.member_order_id || paidPayOrder.biz_order_id)
      );
      if (!orderId) {
        return { code: 404, message: '未找到可补单的已支付订单', data: null };
      }
    }

    console.log('[applyMemberOrderPaidResult] start repair', {
      out_trade_no: outTradeNo,
      transaction_id: transactionId,
      member_order_id: orderId
    });
    const result = await applyMemberOrderPaidCore({
      db,
      orderId,
      payPayload: {
        transaction_id: transactionId || event.transaction_id,
        out_trade_no: outTradeNo || event.out_trade_no,
        pay_order_no: event.pay_order_no,
        pay_channel: event.pay_channel,
        pay_time: event.pay_time,
        pay_callback_time: event.pay_callback_time,
        paid_amount: event.paid_amount
      }
    });

    if (!result.ok) {
      return { code: result.code, message: result.message, data: result.data };
    }
    return { code: 200, message: result.message, data: result.data };
  } catch (err) {
    console.error('applyMemberOrderPaidResult error:', err);
    return { code: 500, message: err.message || '服务器错误', data: null };
  }
};
