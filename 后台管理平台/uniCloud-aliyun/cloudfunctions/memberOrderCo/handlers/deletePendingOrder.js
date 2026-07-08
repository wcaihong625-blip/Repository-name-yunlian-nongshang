'use strict';

const { verifyToken } = require('nxt-auth');

module.exports = async (event, context) => {
  const res = (code, message, data) => ({ code, message, data: data || null });
  const db = uniCloud.database();
  const cmd = db.command;
  const collection = db.collection('member_order');

  try {
    const auth = await verifyToken(event, context);
    if (!auth.success) {
      return res(401, auth.error || '登录状态无效');
    }

    const orderId = String(event.order_id || '').trim();
    if (!orderId) {
      return res(400, '缺少 order_id');
    }

    const docRes = await collection.doc(orderId).get();
    const order = docRes && docRes.data && docRes.data[0];
    if (!order) {
      return res(404, '订单不存在');
    }
    if (String(order.user_id || '') !== String(auth.userId)) {
      return res(403, '无权删除该订单');
    }

    const payStatus = Number(order.pay_status || 0);
    const orderStatus = Number(order.order_status || 0);
    if (payStatus === 1 || orderStatus === 1) {
      return res(400, '已支付订单不允许删除');
    }
    if (payStatus === 2 || orderStatus === 2) {
      return res(400, '仅支持删除待支付订单');
    }

    const orderNos = Array.from(
      new Set(
        [order.order_no, order.out_trade_no, order.pay_order_no]
          .map((x) => String(x || '').trim())
          .filter(Boolean)
      )
    );
    const uniPayOr = [{ 'custom.member_order_id': orderId }];
    if (orderNos.length) {
      uniPayOr.push({ order_no: cmd.in(orderNos) });
      uniPayOr.push({ out_trade_no: cmd.in(orderNos) });
    }

    const now = new Date();
    await collection.doc(orderId).update({
      deleted: true,
      pay_status: 2,
      order_status: 2,
      deleted_at: now,
      deleted_by: String(auth.userId),
      deleted_reason: 'user_delete_pending_order',
      updated_at: now
    });

    // 阿里云兼容：不删 uni-pay 主表，改为标记关闭/失效，避免继续支付
    await db.collection('uni-pay-orders').where(cmd.or(uniPayOr)).update({
      status: -1,
      pay_status: 2,
      order_status: 2,
      closed_at: now,
      close_reason: 'member_order_deleted',
      deleted: true
    });

    // 备注表做软删除标记（不存在时 update 不影响主流程）
    await db.collection('member_order_remark').where({ order_id: orderId }).update({
      deleted: true,
      deleted_at: now,
      deleted_by: String(auth.userId)
    });

    return res(200, '删除成功', {
      order_id: orderId
    });
  } catch (err) {
    console.error('deletePendingOrder error:', err);
    return res(500, err.message || '服务器内部错误');
  }
};
