'use strict';

const { verifyToken } = require('nxt-auth');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

module.exports = async (event, context) => {
  const db = uniCloud.database();

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  const orderId = safeString(event.order_id || event.id);
  if (!orderId) {
    return { code: 400, message: '缺少 order_id' };
  }

  try {
    const remarkRes = await db
      .collection('member_order_remark')
      .where({ order_id: orderId })
      .limit(500)
      .get();
    const remarkRows = (remarkRes.data || []).slice();
    remarkRows.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });

    const remarks = [];
    const action_logs = [];
    let latest_exception_remark = null;
    for (const r of remarkRows) {
      const row = {
        _id: safeString(r._id),
        remark_type: safeString(r.remark_type),
        remark_content: safeString(r.remark_content),
        operator_uid: safeString(r.operator_uid),
        operator_name: safeString(r.operator_name),
        created_at: r.created_at
      };
      if (r.remark_type === 'system') {
        action_logs.push(row);
      } else {
        remarks.push(row);
        if (r.remark_type === 'exception' && !latest_exception_remark) {
          latest_exception_remark = row;
        }
      }
    }

    return {
      code: 200,
      message: 'ok',
      data: { remarks, action_logs, latest_exception_remark }
    };
  } catch (e) {
    console.error('[getMemberOrderRemarks]', e);
    return { code: 500, message: e.message || '查询失败' };
  }
};

