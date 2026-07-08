'use strict';

const { verifyToken } = require('nxt-auth');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function isEmptyField(value) {
  return safeString(value) === '';
}

function docFromGet(res) {
  const d = res && res.data;
  if (d == null) return null;
  if (Array.isArray(d)) return d.length ? d[0] : null;
  if (typeof d === 'object') return d;
  return null;
}

/**
 * 与 getCustomerAuditInfo.customerDisplayName 一致：档案无单独 customer_name 字段
 */
function profileDisplayName(prof) {
  if (!prof) return '';
  return safeString(prof.company_name || prof.contact_name || prof.nickname || prof.mobile);
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

const ALLOWED_FIELDS = new Set(['customer_name', 'mobile']);

exports.main = async (event, context) => {
  const db = uniCloud.database();

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  const orderId = safeString(event.order_id || event.id);
  let fields = event.repair_fields;
  if (!Array.isArray(fields) || fields.length === 0) {
    return { code: 400, message: '请传入 repair_fields 数组，允许 customer_name、mobile' };
  }

  fields = [...new Set(fields.map((x) => safeString(x)).filter(Boolean))];
  for (const f of fields) {
    if (!ALLOWED_FIELDS.has(f)) {
      return { code: 400, message: `不允许的修复字段：${f}` };
    }
  }

  const opUid = safeString(tokenResult.userId);
  const opName = await resolveOperatorName(db, tokenResult);

  try {
    const orderRes = await db.collection('member_order').doc(orderId).get();
    const order = docFromGet(orderRes);
    if (!order) {
      return { code: 404, message: '订单不存在' };
    }

    const customerId = safeString(order.customer_id);
    if (!customerId) {
      return { code: 400, message: '订单缺少 customer_id，无法从客户档案回填' };
    }

    const profRes = await db.collection('customer_profile').doc(customerId).get();
    const prof = docFromGet(profRes);
    if (!prof) {
      return { code: 400, message: '客户档案不存在，无法回填' };
    }

    const srcName = profileDisplayName(prof);
    const srcMobile = safeString(prof.mobile);

    const update = {};
    const reasons = [];
    const done = [];

    if (fields.includes('customer_name')) {
      if (!isEmptyField(order.customer_name)) {
        reasons.push('订单客户姓名已有值，不允许覆盖');
      } else if (!srcName) {
        reasons.push('客户档案无可用姓名（企业名/联系人/昵称/手机号均为空）');
      } else {
        update.customer_name = srcName;
        done.push('customer_name');
      }
    }

    if (fields.includes('mobile')) {
      if (!isEmptyField(order.mobile)) {
        reasons.push('订单手机号已有值，不允许覆盖');
      } else if (!srcMobile) {
        reasons.push('客户档案无手机号');
      } else {
        update.mobile = srcMobile;
        done.push('mobile');
      }
    }

    if (Object.keys(update).length === 0) {
      const msg = reasons.length ? reasons.join('；') : '没有可执行的回填项';
      return { code: 400, message: msg };
    }

    const now = Date.now();
    update.updated_at = now;

    await db.collection('member_order').doc(orderId).update(update);

    const parts = [];
    if (done.includes('customer_name')) parts.push('客户姓名');
    if (done.includes('mobile')) parts.push('手机号');
    const logContent = `[修复] 已从客户档案回填${parts.join('、')}（来源：customer_profile._id=${customerId}）操作人：${
      opName || opUid
    }`;

    await db.collection('member_order_remark').add({
      order_id: orderId,
      order_no: safeString(order.order_no),
      customer_id: customerId,
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
        updated_fields: done,
        partial_errors: reasons.length ? reasons : undefined
      }
    };
  } catch (e) {
    console.error('[repairMemberOrderCustomerInfo]', e);
    return { code: 500, message: e.message || '修复失败' };
  }
};
