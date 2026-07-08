'use strict';

const { requireAdmin } = require('nxt-auth');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function uniqIds(list) {
  const set = new Set();
  (list || []).forEach((item) => {
    const id = safeString(item);
    if (id) set.add(id);
  });
  return Array.from(set);
}

function toTimestamp(value) {
  if (value === undefined || value === null || value === '') return 0;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? 0 : value.getTime();
  const ts = new Date(value).getTime();
  return Number.isNaN(ts) ? 0 : ts;
}

function formatDateTime(value) {
  const ts = toTimestamp(value);
  if (!ts) return '';
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function isOrderPaid(order) {
  if (!order) return false;
  if (Number(order.pay_status) === 1) return true;
  return Number(order.order_status) === 1;
}

function isMockPaidOrder(order) {
  if (!order) return false;
  if (order.pay_mock_flag === true) return true;
  const payChannel = safeString(order.pay_channel).toLowerCase();
  if (payChannel === 'mock_admin') return true;
  const tx = safeString(order.transaction_id).toUpperCase();
  if (tx.startsWith('MOCK_')) return true;
  const outTradeNo = safeString(order.out_trade_no).toUpperCase();
  if (outTradeNo.startsWith('MOCK_')) return true;
  return false;
}

function isRealPaidOrder(order) {
  return isOrderPaid(order) && !isMockPaidOrder(order);
}

async function pickLatestPaidOrder(col, where) {
  const res = await col
    .where(where)
    .field({
      _id: true,
      pay_status: true,
      order_status: true,
      expire_time_after: true,
      pay_time: true,
      updated_at: true,
      created_at: true,
      member_type: true,
      plan_type: true
    })
    .orderBy('expire_time_after', 'desc')
    .orderBy('pay_time', 'desc')
    .orderBy('updated_at', 'desc')
    .orderBy('created_at', 'desc')
    .limit(1)
    .get();
  return (res.data && res.data[0]) || null;
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const cmd = db.command;
  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const auth = await requireAdmin(event, context);
    if (!auth.success) {
      return res(401, auth.error || '仅管理员可操作');
    }

    const orderIds = uniqIds(
      Array.isArray(event.order_ids)
        ? event.order_ids
        : [event.order_id, event.id]
    );
    if (!orderIds.length) {
      return res(400, '缺少 order_ids');
    }

    const orderCol = db.collection('member_order');
    const orderRes = await orderCol.where({ _id: cmd.in(orderIds) }).get();
    const rows = orderRes.data || [];
    if (!rows.length) {
      return res(404, '未找到可删除订单');
    }

    const realPaidOrders = rows.filter(isRealPaidOrder);
    if (realPaidOrders.length) {
      const blockedOrderNos = uniqIds(
        realPaidOrders.map((item) => safeString(item.order_no) || safeString(item._id))
      ).slice(0, 10);
      return res(400, '不允许删除已真实支付的订单', {
        blocked_count: realPaidOrders.length,
        blocked_orders: blockedOrderNos
      });
    }

    const userIds = uniqIds(rows.map((r) => r.user_id));
    const customerIds = uniqIds(rows.map((r) => r.customer_id));
    const hitOrderIds = uniqIds(rows.map((r) => r._id));
    const remarkRes = await db
      .collection('member_order_remark')
      .where({ order_id: cmd.in(hitOrderIds) })
      .field({ _id: true })
      .get();
    const remarkIds = uniqIds((remarkRes.data || []).map((r) => r._id));

    const tx = await db.startTransaction();
    try {
      for (const orderId of hitOrderIds) {
        await tx.collection('member_order').doc(orderId).remove();
      }
      for (const remarkId of remarkIds) {
        await tx.collection('member_order_remark').doc(remarkId).remove();
      }
      await tx.commit();
    } catch (e) {
      try {
        await tx.rollback();
      } catch (_rb) {}
      throw e;
    }

    const usersCol = db.collection('uni-id-users');
    const customerCol = db.collection('customer_profile');
    let syncedUsers = 0;
    let syncedCustomers = 0;
    const nowTs = Date.now();
    const paidWhere = cmd.or([{ pay_status: 1 }, { order_status: 1 }]);

    for (const userId of userIds) {
      const latest = await pickLatestPaidOrder(orderCol, cmd.and([{ user_id: userId }, paidWhere]));
      const expireTs = latest ? toTimestamp(latest.expire_time_after) : 0;
      const active = !!(latest && isOrderPaid(latest) && expireTs > nowTs);
      if (active) {
        await usersCol.doc(userId).update({
          is_vip: true,
          vip_expire_time: expireTs,
          vip_expire_time_text: formatDateTime(expireTs),
          member_type: latest.member_type === 'enterprise' ? 'enterprise' : 'personal',
          member_plan_key: safeString(latest.plan_type) || 'month',
          updated_at: new Date()
        });
      } else {
        await usersCol.doc(userId).update({
          is_vip: false,
          vip_expire_time: null,
          vip_expire_time_text: '',
          member_type: 'free',
          member_plan_key: '',
          updated_at: new Date()
        });
      }
      syncedUsers += 1;
    }

    for (const customerId of customerIds) {
      const latest = await pickLatestPaidOrder(orderCol, cmd.and([{ customer_id: customerId }, paidWhere]));
      const expireTs = latest ? toTimestamp(latest.expire_time_after) : 0;
      let memberStatus = 0;
      if (latest && isOrderPaid(latest)) {
        memberStatus = expireTs > nowTs ? 1 : 2;
      }
      const updateDoc = {
        member_status: memberStatus,
        member_expire_time: expireTs ? new Date(expireTs) : null,
        member_type: memberStatus === 0 ? 'free' : (latest.member_type === 'enterprise' ? 'enterprise' : 'personal'),
        member_plan_key: memberStatus === 0 ? '' : (safeString(latest.plan_type) || 'month'),
        updated_at: new Date()
      };
      await customerCol.doc(customerId).update(updateDoc);
      syncedCustomers += 1;
    }

    return res(200, '删除成功并已同步会员状态', {
      deleted_order_count: hitOrderIds.length,
      deleted_remark_count: remarkIds.length,
      synced_user_count: syncedUsers,
      synced_customer_count: syncedCustomers
    });
  } catch (err) {
    console.error('deleteMemberOrdersAndSync error:', err);
    return res(500, err.message || '服务器错误');
  }
};
