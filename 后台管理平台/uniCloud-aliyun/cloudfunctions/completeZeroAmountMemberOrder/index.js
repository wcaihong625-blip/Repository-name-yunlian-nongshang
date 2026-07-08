'use strict';

const { verifyToken } = require('nxt-auth');
const { applyMemberOrderPaidCore, safeString } = require('nxt-member-order-apply-paid');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '未登录');
    }
    const userId = tokenResult.userId;

    const orderId = safeString(event.order_id || event.id);
    if (!orderId) {
      return res(400, '缺少 order_id');
    }

    const orderRes = await db.collection('member_order').doc(orderId).get();
    const order = orderRes.data && orderRes.data[0] ? orderRes.data[0] : null;
    if (!order) {
      return res(404, '订单不存在');
    }
    if (safeString(order.user_id) !== userId) {
      return res(403, '无权操作该订单');
    }
    if (Number(order.pay_status) === 1 || Number(order.order_status) === 1) {
      return res(200, '订单已支付（幂等）', {
        idempotent: true,
        order_id: orderId,
        order_no: order.order_no,
        zero_pay: true,
        paid: true
      });
    }
    if (Number(order.pay_status) !== 0) {
      return res(400, '订单非待支付状态');
    }

    const pa = Number(order.pay_amount);
    if (pa !== 0) {
      return res(400, '仅支持实付金额为 0 的订单，请走微信支付');
    }

    const result = await applyMemberOrderPaidCore({
      db,
      orderId,
      preloadedOrder: order,
      payPayload: {
        pay_channel: 'zero_amount',
        transaction_id: `ZERO_${orderId.slice(-10)}_${Date.now()}`,
        pay_time: new Date(),
        pay_callback_time: new Date(),
        paid_amount: 0
      }
    });

    if (!result.ok) {
      return res(result.code || 500, result.message || '落账失败', result.data);
    }
    return res(200, result.message || '开通成功', result.data);
  } catch (err) {
    console.error('completeZeroAmountMemberOrder', err);
    return res(500, err.message || '服务器错误');
  }
};
