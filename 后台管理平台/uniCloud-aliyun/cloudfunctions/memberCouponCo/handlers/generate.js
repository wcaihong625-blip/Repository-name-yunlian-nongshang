'use strict';

const { requireAdmin } = require('nxt-auth');

function safeString(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

function parseTs(v) {
  if (v === undefined || v === null || v === '') return null;
  if (v instanceof Date) return v;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : new Date(t);
}

function normalizeList(value, allowed) {
  if (value == null || value === '') return ['all'];
  const raw = Array.isArray(value)
    ? value
    : String(value).split(',').map((x) => x.trim()).filter(Boolean);
  const list = raw.map((x) => String(x || '').trim()).filter((x) => x === 'all' || allowed.includes(x));
  if (!list.length || list.includes('all')) return ['all'];
  return Array.from(new Set(list));
}

const CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randomSuffix(len) {
  let s = '';
  for (let i = 0; i < len; i += 1) {
    s += CHARSET[Math.floor(Math.random() * CHARSET.length)];
  }
  return s;
}

module.exports = async (event, context) => {
  const db = uniCloud.database();
  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const admin = await requireAdmin(event, context);
    if (!admin.success) {
      return res(401, admin.error || '无权限');
    }

    const batch_name = safeString(event.batch_name);
    if (!batch_name) {
      return res(400, '请填写批次名称');
    }

    const count = Math.min(500, Math.max(1, parseInt(event.count, 10) || 0));
    if (!count) {
      return res(400, '生成数量无效（1~500）');
    }

    const coupon_type = safeString(event.coupon_type) || 'amount';
    if (!['amount', 'discount', 'free'].includes(coupon_type)) {
      return res(400, 'coupon_type 无效');
    }

    const scope = safeString(event.scope) || 'all';
    if (!['first_open', 'renewal', 'all'].includes(scope)) {
      return res(400, 'scope 无效');
    }
    const use_scene_raw = safeString(event.use_scene || event.usage_scope);
    const use_scene = use_scene_raw === 'first' ? 'first_open' : use_scene_raw === 'renew' ? 'renewal' : use_scene_raw || scope;
    if (!['first_open', 'renewal', 'all'].includes(use_scene)) {
      return res(400, 'use_scene 无效');
    }
    const apply_member_types = normalizeList(event.apply_member_types || event.member_type_scope, ['personal', 'enterprise']);
    const apply_plan_types = normalizeList(event.apply_plan_types || event.plan_type_scope, ['month', 'quarter', 'year']);

    const start_time = parseTs(event.start_time);
    const end_time = parseTs(event.end_time);
    if (!start_time || !end_time) {
      return res(400, '请填写有效的开始与结束时间');
    }
    if (start_time.getTime() > end_time.getTime()) {
      return res(400, '开始时间不能晚于结束时间');
    }

    let discount_value = 0;
    if (coupon_type === 'free') {
      discount_value = 0;
    } else {
      discount_value = Number(event.discount_value);
      if (Number.isNaN(discount_value)) {
        return res(400, '请填写抵扣值/折扣值');
      }
      if (coupon_type === 'amount' && discount_value <= 0) {
        return res(400, '固定金额抵扣须大于 0');
      }
      if (coupon_type === 'discount' && (discount_value <= 0 || discount_value > 1)) {
        if (discount_value > 1 && discount_value <= 100) {
          discount_value = discount_value / 100;
        }
        if (discount_value <= 0 || discount_value > 1) {
          return res(400, '折扣须为 0~1 之间（如 0.9 表示九折）');
        }
      }
    }

    const max_use_count = event.max_use_count != null ? parseInt(event.max_use_count, 10) : 1;
    const max_use_per_user = event.max_use_per_user != null ? parseInt(event.max_use_per_user, 10) : 1;
    if (max_use_count < 1 || max_use_per_user < 1) {
      return res(400, '使用次数须至少为 1');
    }

    const prefix = safeString(event.prefix).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const batch_id = `B${Date.now()}${randomSuffix(4)}`;
    const col = db.collection('member_coupon_code');
    const now = new Date();
    const user = admin.user || {};
    const created_by_uid = safeString(user._id) || safeString(admin.userId);
    const created_by_name = safeString(user.nickname || user.username || user.mobile || 'admin');

    const codes = [];
    const suffixLen = 12;
    let attempts = 0;
    const maxAttempts = count * 80;

    while (codes.length < count && attempts < maxAttempts) {
      attempts += 1;
      const body = `${prefix}${randomSuffix(suffixLen)}`;
      const code = body.length > 32 ? body.slice(0, 32) : body;
      const dup = await col.where({ code }).limit(1).get();
      if (dup.data && dup.data.length) continue;
      codes.push(code);
    }

    if (codes.length < count) {
      return res(500, `唯一码生成失败，仅生成 ${codes.length}/${count}，请缩小批量或更换前缀重试`);
    }

    const docs = codes.map((code) => ({
      batch_id,
      batch_name,
      code,
      coupon_type,
      discount_value,
      discount_amount: coupon_type === 'amount' ? discount_value : 0,
      discount_rate: coupon_type === 'discount' ? discount_value : 0,
      scope,
      use_scene,
      usage_scope: use_scene,
      member_type_scope: apply_member_types.includes('all') ? 'all' : apply_member_types.join(','),
      plan_type_scope: apply_plan_types.includes('all') ? 'all' : apply_plan_types.join(','),
      apply_member_types,
      apply_plan_types,
      status: 'enabled',
      start_time,
      end_time,
      max_use_count,
      used_count: 0,
      max_use_per_user,
      remark: safeString(event.remark),
      created_at: now,
      created_by_uid,
      created_by_name
    }));

    await col.add(docs);

    return res(200, '生成成功', {
      batch_id,
      batch_name,
      count: docs.length,
      codes
    });
  } catch (err) {
    console.error('generateMemberCouponCodes', err);
    return res(500, err.message || '服务器错误');
  }
};

