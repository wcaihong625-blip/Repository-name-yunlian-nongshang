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

    const cond = [];
    if (safeString(event.batch_name)) {
      cond.push({ batch_name: new RegExp(safeString(event.batch_name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') });
    }
    if (safeString(event.code)) {
      cond.push({ code: safeString(event.code).toUpperCase() });
    }
    if (safeString(event.batch_id)) {
      cond.push({ batch_id: safeString(event.batch_id) });
    }
    if (safeString(event.coupon_type)) {
      cond.push({ coupon_type: safeString(event.coupon_type) });
    }
    if (safeString(event.scope)) {
      cond.push({ scope: safeString(event.scope) });
    }
    if (safeString(event.status)) {
      cond.push({ status: safeString(event.status) });
    }

    const st = event.start_time_range;
    const et = event.end_time_range;
    if (st && et) {
      const a = new Date(st).getTime();
      const b = new Date(et).getTime();
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        cond.push({ start_time: cmd.lte(new Date(b)) });
        cond.push({ end_time: cmd.gte(new Date(a)) });
      }
    }

    const where = cond.length ? cmd.and(cond) : {};

    const col = db.collection('member_coupon_code');
    let total = 0;
    try {
      const totalRes = await col.where(where).count();
      total = totalRes.total || 0;
    } catch (e) {
      // count 在大表/弱索引场景容易超时，降级不阻断列表查询
      total = 0;
    }

    const listRes = await col
      .where(where)
      .field({
        _id: true,
        code: true,
        batch_id: true,
        batch_name: true,
        coupon_type: true,
        discount_value: true,
        discount_amount: true,
        discount_rate: true,
        scope: true,
        use_scene: true,
        usage_scope: true,
        member_type_scope: true,
        plan_type_scope: true,
        apply_member_types: true,
        apply_plan_types: true,
        status: true,
        used_count: true,
        max_use_count: true,
        max_use_per_user: true,
        start_time: true,
        end_time: true,
        created_at: true,
        remark: true
      })
      .orderBy('created_at', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const list = (listRes.data || []).map((row) => ({
      _id: row._id,
      code: row.code,
      batch_id: row.batch_id,
      batch_name: row.batch_name,
      coupon_type: row.coupon_type,
      discount_value: row.discount_value,
      discount_amount: row.discount_amount,
      discount_rate: row.discount_rate,
      scope: row.scope,
      use_scene: row.use_scene || row.usage_scope || row.scope || 'all',
      member_type_scope: row.member_type_scope || 'all',
      plan_type_scope: row.plan_type_scope || 'all',
      apply_member_types: row.apply_member_types || [],
      apply_plan_types: row.apply_plan_types || [],
      status: row.status,
      used_count: row.used_count,
      max_use_count: row.max_use_count,
      max_use_per_user: row.max_use_per_user,
      start_time: row.start_time,
      end_time: row.end_time,
      created_at: row.created_at,
      remark: row.remark
    }));

    return res(200, 'ok', { list, total, page, pageSize });
  } catch (err) {
    console.error('getMemberCouponCodeList', err);
    return res(500, err.message || '服务器错误');
  }
};

