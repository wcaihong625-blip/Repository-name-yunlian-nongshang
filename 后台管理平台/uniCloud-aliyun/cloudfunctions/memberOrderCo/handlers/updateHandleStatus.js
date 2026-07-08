'use strict';

const { verifyToken } = require('nxt-auth');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

const ALLOWED_STATUS = new Set(['pending', 'processing', 'done', 'closed']);

const STATUS_LABEL = {
  pending: '待处理',
  processing: '跟进中',
  done: '已处理',
  closed: '已关闭'
};

function normalizeHandleStatus(raw) {
  const s = safeString(raw);
  if (!s) return 'pending';
  return s;
}

function docFromGet(res) {
  const d = res && res.data;
  if (d == null) return null;
  if (Array.isArray(d)) return d.length ? d[0] : null;
  if (typeof d === 'object') return d;
  return null;
}

async function resolveOperatorName(db, tokenResult) {
  const uid = tokenResult.userId;
  let name = '';
  if (tokenResult.user && tokenResult.user.username) {
    name = safeString(tokenResult.user.username);
  }
  if (name) return name;
  try {
    const userRes = await db.collection('uni-id-users').doc(uid).get();
    const u = docFromGet(userRes);
    if (u) {
      name = safeString(u.nickname || u.username || u.mobile);
    }
  } catch (_e) {}
  return name || uid;
}

module.exports = async (event, context) => {
  const db = uniCloud.database();

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  const orderId = safeString(event.order_id || event.id);
  const handle_status = safeString(event.handle_status);
  let handle_result = safeString(event.handle_result);
  let followup_uid = safeString(event.followup_uid);
  let followup_name = safeString(event.followup_name);

  if (!orderId) {
    return { code: 400, message: '缺少 order_id' };
  }
  if (!ALLOWED_STATUS.has(handle_status)) {
    return { code: 400, message: 'handle_status 须为 pending / processing / done / closed' };
  }
  if (handle_result.length > 2000) {
    return { code: 400, message: '处理结论过长（最多 2000 字）' };
  }

  const opUid = safeString(tokenResult.userId);
  const opName = await resolveOperatorName(db, tokenResult);

  if (!followup_uid) followup_uid = opUid;
  if (!followup_name) followup_name = opName;

  const now = Date.now();

  try {
    const orderRes = await db.collection('member_order').doc(orderId).get();
    const order = docFromGet(orderRes);
    if (!order) {
      return { code: 404, message: '订单不存在' };
    }

    const order_no = safeString(order.order_no);
    const customer_id = safeString(order.customer_id);

    const prevStatus = normalizeHandleStatus(order.handle_status);
    const prevLabel = STATUS_LABEL[prevStatus] || prevStatus || '（空）';
    const nextLabel = STATUS_LABEL[handle_status] || handle_status;

    await db
      .collection('member_order')
      .doc(orderId)
      .update({
        handle_status,
        handle_result,
        followup_uid,
        followup_name,
        handled_at: now,
        updated_at: now
      });

    const logContent = [
      '[处理日志] 人工处理状态已更新',
      `处理状态更新为：${nextLabel}（自：${prevLabel}）`,
      `处理结论：${handle_result ? handle_result : '（无）'}`,
      `跟进人：${followup_name || followup_uid}`,
      `操作人：${opName || opUid}`
    ].join('\n');

    await db.collection('member_order_remark').add({
      order_id: orderId,
      order_no,
      customer_id,
      remark_type: 'system',
      remark_content: logContent,
      operator_uid: opUid,
      operator_name: opName,
      created_at: now
    });

    return {
      code: 200,
      message: 'ok',
      data: {
        order_id: orderId,
        handle_status,
        handle_result,
        followup_uid,
        followup_name,
        handled_at: now
      }
    };
  } catch (e) {
    console.error('[updateMemberOrderHandleStatus]', e);
    return { code: 500, message: e.message || '更新失败' };
  }
};

