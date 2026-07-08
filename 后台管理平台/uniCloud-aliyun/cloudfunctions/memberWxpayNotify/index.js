'use strict';

const { applyMemberOrderPaidCore } = require('nxt-member-order-apply-paid');

function safeString(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

function toYuanFromCent(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Number((n / 100).toFixed(2));
}

exports.main = async (event) => {
  const db = uniCloud.database();
  const memberOrderCollection = db.collection('member_order');

  try {
    const payloadData = event.data && typeof event.data === 'object' ? event.data : {};
    const custom = payloadData.custom && typeof payloadData.custom === 'object' ? payloadData.custom : {};
    const bizType = safeString(custom.biz_type || event.biz_type);
    const memberOrderId = safeString(custom.member_order_id || event.member_order_id);
    const outTradeNo = safeString(
      event.out_trade_no ||
      event.order_no ||
      payloadData.out_trade_no ||
      (event.orderInfo && event.orderInfo.out_trade_no) ||
      (event.data && event.data.out_trade_no)
    );

    console.log('[memberWxpayNotify] callback received', {
      out_trade_no: outTradeNo,
      member_order_id: memberOrderId,
      biz_type: bizType,
      has_data: !!event.data
    });

    if (bizType && bizType !== 'member_order_pay') {
      console.log('[memberWxpayNotify] skip non-member biz_type', {
        out_trade_no: outTradeNo,
        member_order_id: memberOrderId,
        biz_type: bizType
      });
      return { code: 200, message: 'skip non member_order_pay', data: null };
    }

    if (!memberOrderId && !outTradeNo) {
      return { code: 400, message: '缺少 member_order_id/out_trade_no', data: null };
    }

    let order = null;
    if (memberOrderId) {
      const byId = await memberOrderCollection.doc(memberOrderId).get();
      order = byId.data && byId.data[0];
    }
    if (!order && outTradeNo) {
      const query = await memberOrderCollection.where({
        out_trade_no: outTradeNo
      }).limit(1).get();
      order = query.data && query.data[0];
    }
    if (!order) {
      console.error('[memberWxpayNotify] business order not found', {
        out_trade_no: outTradeNo,
        member_order_id: memberOrderId,
        biz_type: bizType
      });
      return { code: 404, message: '业务订单不存在', data: null };
    }

    const paidAmountYuan =
      event.paid_amount != null
        ? Number(event.paid_amount)
        : toYuanFromCent(
            event.total_fee ||
            (event.orderInfo && event.orderInfo.total_fee) ||
            (event.data && event.data.total_fee)
          );

    const result = await applyMemberOrderPaidCore({
      db,
      orderId: order._id,
      payPayload: {
        transaction_id: safeString(event.transaction_id || payloadData.transaction_id),
        out_trade_no: outTradeNo,
        pay_order_no: safeString(event.pay_order_no || outTradeNo),
        pay_channel: 'wxpay',
        pay_time: event.pay_time || new Date(),
        pay_callback_time: new Date(),
        paid_amount: paidAmountYuan
      }
    });

    if (!result.ok) {
      console.error('[memberWxpayNotify] apply paid failed', {
        out_trade_no: outTradeNo,
        member_order_id: order._id,
        biz_type: bizType,
        code: result.code,
        message: result.message
      });
      return { code: result.code || 500, message: result.message || '落账失败', data: result.data || null };
    }
    console.log('[memberWxpayNotify] apply paid success', {
      out_trade_no: outTradeNo,
      member_order_id: order._id,
      biz_type: bizType,
      user_order_success: true
    });
    return { code: 200, message: 'ok', data: result.data || null };
  } catch (err) {
    console.error('memberWxpayNotify error:', err);
    return { code: 500, message: err.message || '服务器错误', data: null };
  }
};
