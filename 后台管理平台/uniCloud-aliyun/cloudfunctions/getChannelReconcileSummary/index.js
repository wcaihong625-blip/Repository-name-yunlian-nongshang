'use strict';

/**
 * 渠道 / 邀请码核对：按月、已支付订单，聚合摘要与分组列表（只读，不做纠偏）
 */

const { verifyToken } = require('nxt-auth');
const { safeString, getMonthBoundaries } = require('nxt-commission-month');

function safeNumber(value) {
  return value === undefined || value === null || isNaN(value) ? 0 : Number(value);
}

function payTs(o) {
  const p = o.pay_time;
  if (p === undefined || p === null || p === '') return 0;
  const t = new Date(p).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function isEmptyChannel(o) {
  const c = o.channel_id;
  return c === undefined || c === null || String(c).trim() === '';
}

function isEmptyInvite(o) {
  const c = o.invite_code;
  return c === undefined || c === null || String(c).trim() === '';
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const _ = db.command;

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  let month = safeString(event.month);
  if (!month) {
    const now = new Date();
    month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const bounds = getMonthBoundaries(month);
  if (!bounds) {
    return { code: 400, message: '月份格式须为 YYYY-MM' };
  }

  const salesId = safeString(event.sales_id);
  const channelIdFilter = safeString(event.channel_id);
  const inviteFilter = safeString(event.invite_code);

  const parts = [
    { order_status: 1 },
    _.or([
      { pay_time: _.gte(bounds.start).and(_.lte(bounds.end)) },
      { pay_time: _.gte(bounds.start.getTime()).and(_.lte(bounds.end.getTime())) }
    ])
  ];
  if (salesId) {
    parts.push({ sales_id: salesId });
  }
  if (channelIdFilter) {
    parts.push({ channel_id: channelIdFilter });
  }
  if (inviteFilter) {
    parts.push({ invite_code: inviteFilter });
  }

  const where = _.and(parts);

  const orders = [];
  const batch = 500;
  const maxScan = 20000;
  let skip = 0;
  try {
    for (;;) {
      const res = await db
        .collection('member_order')
        .where(where)
        .field({
          order_type: true,
          customer_id: true,
          channel_id: true,
          channel_name: true,
          invite_code: true,
          commission_amount: true,
          pay_time: true
        })
        .skip(skip)
        .limit(batch)
        .get();
      const rows = res.data || [];
      orders.push(...rows);
      if (rows.length < batch) break;
      skip += batch;
      if (skip >= maxScan) break;
    }
  } catch (e) {
    console.error('[getChannelReconcileSummary] load orders', e);
    return { code: 500, message: e.message || '查询订单失败' };
  }

  let first_open_count = 0;
  let renewal_count = 0;
  let empty_channel_count = 0;
  let empty_invite_count = 0;
  const firstOpenByCustomer = new Map();

  const groupMap = new Map();

  for (const o of orders) {
    const ot = Number(o.order_type);
    if (ot === 1) {
      first_open_count += 1;
      const cid = safeString(o.customer_id);
      if (cid) {
        firstOpenByCustomer.set(cid, (firstOpenByCustomer.get(cid) || 0) + 1);
      }
    } else if (ot === 2) {
      renewal_count += 1;
    }

    if (isEmptyChannel(o)) empty_channel_count += 1;
    if (isEmptyInvite(o)) empty_invite_count += 1;

    const chId = isEmptyChannel(o) ? '' : safeString(o.channel_id);
    const chName = safeString(o.channel_name) || '—';
    const inv = isEmptyInvite(o) ? '' : safeString(o.invite_code);
    const gkey = `${chId}\n${chName}\n${inv}`;

    let g = groupMap.get(gkey);
    if (!g) {
      g = {
        channel_id: chId,
        channel_name: chName,
        invite_code: inv,
        first_open: 0,
        renewal: 0,
        order_total: 0,
        commission_total: 0,
        last_pay_time: 0
      };
      groupMap.set(gkey, g);
    }
    g.order_total += 1;
    g.commission_total += safeNumber(o.commission_amount);
    const ts = payTs(o);
    if (ts > g.last_pay_time) g.last_pay_time = ts;

    if (ot === 1) g.first_open += 1;
    else if (ot === 2) g.renewal += 1;
  }

  let multi_first_open_customer_count = 0;
  for (const n of firstOpenByCustomer.values()) {
    if (n > 1) multi_first_open_customer_count += 1;
  }

  const groups = Array.from(groupMap.values());
  groups.sort((a, b) => b.order_total - a.order_total);

  return {
    code: 200,
    message: 'ok',
    data: {
      month,
      summary: {
        order_total: orders.length,
        first_open_count,
        renewal_count,
        empty_channel_count,
        empty_invite_count,
        /** 同月同一客户出现多笔「首开」订单的客户数，用于人工发现重复首开风险 */
        multi_first_open_customer_count
      },
      groups
      ,
      truncated: orders.length >= maxScan
    }
  };
};
