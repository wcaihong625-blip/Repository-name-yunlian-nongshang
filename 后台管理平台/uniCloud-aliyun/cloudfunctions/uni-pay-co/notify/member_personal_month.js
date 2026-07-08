'use strict';

/**
 * uni-pay 支付成功回调（type=member_personal_month）
 * 只处理个人会员月卡业务落账，最终调用统一的会员落账云函数。
 */
module.exports = async (obj) => {
  try {
    const data = (obj && obj.data) || {};
    const res = await uniCloud.callFunction({
      name: 'memberWxpayNotify',
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
    console.error('[uni-pay notify][member_personal_month] error:', err);
    return false;
  }
};
