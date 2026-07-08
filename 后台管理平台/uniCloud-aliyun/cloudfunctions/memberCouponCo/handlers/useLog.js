'use strict';

const { requireAdmin } = require('nxt-auth');

function safeString(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

module.exports = async (event, context) => {
  const db = uniCloud.database();
  const cmd = db.command;
  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const admin = await requireAdmin(event, context);
    if (!admin.success) {
      return res(401, admin.error || '无权限');
    }

    const page = Math.max(1, parseInt(event.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(event.pageSize, 10) || 20));

    const cond = [{ status: 'used' }];
    if (safeString(event.code)) {
      cond.push({ code: safeString(event.code).toUpperCase() });
    }
    if (safeString(event.batch_id)) {
      cond.push({ batch_id: safeString(event.batch_id) });
    }
    if (safeString(event.batch_name)) {
      cond.push({
        batch_name: new RegExp(safeString(event.batch_name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      });
    }
    if (safeString(event.mobile)) {
      cond.push({ mobile: safeString(event.mobile) });
    }
    if (safeString(event.order_no)) {
      cond.push({ order_no: safeString(event.order_no) });
    }

    const dr = event.used_at_range;
    if (dr && Array.isArray(dr) && dr.length === 2 && dr[0] && dr[1]) {
      const t0 = new Date(dr[0]).getTime();
      const t1 = new Date(dr[1]).getTime();
      if (!Number.isNaN(t0) && !Number.isNaN(t1)) {
        const lo = new Date(Math.min(t0, t1));
        const hi = new Date(Math.max(t0, t1));
        cond.push({ used_at: cmd.and(cmd.gte(lo), cmd.lte(hi)) });
      }
    }

    const where = cmd.and(cond);
    const col = db.collection('member_coupon_use_log');
    let total = 0;
    try {
      const totalRes = await col.where(where).count();
      total = totalRes.total || 0;
    } catch (e) {
      // count 超时降级，优先保证页面可打开
      total = 0;
    }

    const listRes = await col
      .where(where)
      .field({
        _id: true,
        code: true,
        order_no: true,
        user_id: true,
        mobile: true,
        used_at: true,
        pay_amount_before: true,
        discount_amount: true,
        pay_amount_after: true,
        member_type: true,
        plan_type: true,
        order_scene: true,
        order_type: true,
        status: true,
        batch_name: true
      })
      .orderBy('used_at', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    return res(200, 'ok', {
      list: listRes.data || [],
      total,
      page,
      pageSize
    });
  } catch (err) {
    console.error('getMemberCouponUseLog', err);
    return res(500, err.message || '服务器错误');
  }
};

