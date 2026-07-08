'use strict';

const { requireAdmin } = require('nxt-auth');

function safeString(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

module.exports = async (event, context) => {
  const db = uniCloud.database();
  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const admin = await requireAdmin(event, context);
    if (!admin.success) {
      return res(401, admin.error || '无权限');
    }

    const _id = safeString(event._id || event.code_id);
    const status = safeString(event.status);
    if (!_id) {
      return res(400, '缺少优惠码记录 _id');
    }
    if (!['enabled', 'disabled'].includes(status)) {
      return res(400, 'status 须为 enabled 或 disabled');
    }

    await db.collection('member_coupon_code').doc(_id).update({ status });

    return res(200, '已更新', { _id, status });
  } catch (err) {
    console.error('setMemberCouponCodeStatus', err);
    return res(500, err.message || '服务器错误');
  }
};

