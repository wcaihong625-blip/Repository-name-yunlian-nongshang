'use strict';

const { verifyToken } = require('nxt-auth');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

const ALLOWED_TYPES = new Set(['normal', 'exception', 'followup']);

const TYPE_LABEL = {
  normal: '普通备注',
  exception: '异常备注',
  followup: '跟进备注'
};

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
  const remark_type = safeString(event.remark_type);
  let remark_content = safeString(event.remark_content);

  if (!orderId) {
    return { code: 400, message: '缺少 order_id' };
  }
  if (!ALLOWED_TYPES.has(remark_type)) {
    return { code: 400, message: 'remark_type 须为 normal / exception / followup' };
  }
  if (!remark_content) {
    return { code: 400, message: '备注内容不能为空' };
  }
  if (remark_content.length > 2000) {
    return { code: 400, message: '备注内容过长（最多 2000 字）' };
  }

  const operator_uid = safeString(tokenResult.userId);
  const operator_name = await resolveOperatorName(db, tokenResult);

  try {
    const orderRes = await db.collection('member_order').doc(orderId).get();
    const order = docFromGet(orderRes);
    if (!order) {
      return { code: 404, message: '订单不存在' };
    }

    const order_no = safeString(order.order_no);
    const customer_id = safeString(order.customer_id);
    const now = Date.now();

    const mainDoc = {
      order_id: orderId,
      order_no,
      customer_id,
      remark_type,
      remark_content,
      operator_uid,
      operator_name,
      created_at: now
    };

    const addMain = await db.collection('member_order_remark').add(mainDoc);
    const mainId = addMain.id || addMain._id;

    const logContent = `[处理日志] ${operator_name || operator_uid} 新增了${TYPE_LABEL[remark_type] || remark_type}`;
    const logDoc = {
      order_id: orderId,
      order_no,
      customer_id,
      remark_type: 'system',
      remark_content: logContent,
      operator_uid,
      operator_name,
      created_at: now + 1
    };
    await db.collection('member_order_remark').add(logDoc);

    return {
      code: 200,
      message: 'ok',
      data: {
        remark_id: mainId,
        remark: { ...mainDoc, _id: mainId }
      }
    };
  } catch (e) {
    console.error('[addMemberOrderRemark]', e);
    return { code: 500, message: e.message || '保存失败' };
  }
};

