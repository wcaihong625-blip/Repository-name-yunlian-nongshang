'use strict';

/**
 * uni-pay 支付成功回调（type=promotion_wx）
 * 推广订单微信支付落账并激活。
 */
module.exports = async (obj) => {
  try {
    const data = (obj && obj.data) || {};
    console.log('[uni-pay notify][promotion_wx] trigger', {
      out_trade_no: data.out_trade_no || data.order_no || '',
      promotion_order_id: data.custom && data.custom.promotion_order_id
    });
    const res = await uniCloud.callFunction({
      name: 'promotionWxpayNotify',
      data: {
        out_trade_no: data.out_trade_no || data.order_no || '',
        pay_order_no: data.out_trade_no || data.order_no || '',
        transaction_id: data.transaction_id || '',
        total_fee: data.total_fee,
        pay_time: data.pay_time || new Date(),
        data
      }
    });
    const body = res && res.result;
    return !!(body && body.code === 200);
  } catch (err) {
    console.error('[uni-pay notify][promotion_wx] error:', err);
    return false;
  }
};
