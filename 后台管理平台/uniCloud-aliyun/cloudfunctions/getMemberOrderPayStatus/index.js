'use strict';

const { verifyToken } = require('nxt-auth');
const { applyMemberOrderPaidCore } = require('nxt-member-order-apply-paid');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const auth = await verifyToken(event, context);
    if (!auth.success) return res(401, auth.error || '登录状态无效');

    const orderId = String(event.order_id || '').trim();
    if (!orderId) return res(400, '缺少 order_id');

    const docRes = await db.collection('member_order').doc(orderId).get();
    let order = docRes.data && docRes.data[0];
    if (!order) return res(404, '订单不存在');
    if (String(order.user_id || '') !== auth.userId) return res(403, '无权查看该订单');

    const paidByBusiness = Number(order.pay_status) === 1 || Number(order.order_status) === 1;
    let syncedByRepair = false;

    if (!paidByBusiness) {
      const cmd = db.command;
      const orderNos = Array.from(
        new Set(
          [order.order_no, order.out_trade_no, order.pay_order_no]
            .map((v) => String(v || '').trim())
            .filter(Boolean)
        )
      );
      const orList = [{ 'custom.member_order_id': orderId }, { member_order_id: orderId }, { biz_order_id: orderId }];
      if (orderNos.length) {
        orList.push({ out_trade_no: cmd.in(orderNos) });
        orList.push({ order_no: cmd.in(orderNos) });
      }
      const payOrderRes = await db
        .collection('uni-pay-orders')
        .where(
          cmd.and([
            { status: 1 },
            cmd.or(orList)
          ])
        )
        .orderBy('pay_date', 'desc')
        .limit(1)
        .get();
      const paidPayOrder = payOrderRes.data && payOrderRes.data[0];
      if (paidPayOrder) {
        console.log('[getMemberOrderPayStatus] paid order found, start repair', {
          out_trade_no: paidPayOrder.out_trade_no,
          member_order_id: orderId,
          biz_type: paidPayOrder.custom && paidPayOrder.custom.biz_type
        });
        const repairResult = await applyMemberOrderPaidCore({
          db,
          orderId,
          payPayload: {
            out_trade_no: paidPayOrder.out_trade_no,
            transaction_id: paidPayOrder.transaction_id,
            pay_order_no: paidPayOrder.out_trade_no,
            pay_channel: paidPayOrder.provider || 'wxpay',
            pay_time: paidPayOrder.pay_date || new Date(),
            pay_callback_time: paidPayOrder.notify_date || new Date(),
            paid_amount:
              paidPayOrder.total_fee != null && !isNaN(Number(paidPayOrder.total_fee))
                ? Number((Number(paidPayOrder.total_fee) / 100).toFixed(2))
                : undefined
          }
        });
        if (repairResult.ok) {
          syncedByRepair = true;
          const afterRepair = await db.collection('member_order').doc(orderId).get();
          order = afterRepair.data && afterRepair.data[0];
        } else {
          console.error('[getMemberOrderPayStatus] repair failed', {
            out_trade_no: paidPayOrder.out_trade_no,
            member_order_id: orderId,
            code: repairResult.code,
            message: repairResult.message
          });
        }
      }
    }

    const paid = Number(order.pay_status) === 1 || Number(order.order_status) === 1;
    return res(200, 'ok', {
      order_id: order._id,
      order_no: order.order_no,
      pay_status: Number(order.pay_status || 0),
      order_status: Number(order.order_status || 0),
      is_paid: paid,
      repaired: syncedByRepair
    });
  } catch (err) {
    console.error('getMemberOrderPayStatus error:', err);
    return res(500, err.message || '服务器错误');
  }
};
