'use strict';

const { requireAdmin } = require('nxt-auth');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/** 业务以 status 为准；仅当历史文档缺 status 时回退 apply_status（迁移后应不再出现） */
function getApplyStatus(applyData = {}) {
  if (applyData.status !== undefined && applyData.status !== null) {
    return Number(applyData.status);
  }
  if (applyData.apply_status !== undefined && applyData.apply_status !== null) {
    return Number(applyData.apply_status);
  }
  return -1;
}

function extractDoc(res) {
  if (!res || !res.data) return null;
  if (Array.isArray(res.data)) {
    return res.data.length ? res.data[0] : null;
  }
  if (typeof res.data === 'object' && res.data._id) {
    return res.data;
  }
  return null;
}

function resp(code, message, data = null) {
  return { code, message, data };
}

exports.main = async (event, context) => {
  const db = uniCloud.database();

  console.log('[auditCustomerTransferApply] event 原始内容:', JSON.stringify(event));

  const adminResult = await requireAdmin(event, context);
  if (!adminResult.success || !adminResult.userId) {
    return resp(403, adminResult.error || '无后台审批权限');
  }
  const uid = adminResult.userId;

  // 入参兼容：优先 apply_id，再 id（避免与框架注入的 id 冲突）
  const applyId = safeString(event.apply_id || event.id);
  const action = safeString(event.action || event.audit_action);
  const auditReason = safeString(event.audit_reason || event.reject_reason || event.audit_remark);

  console.log('[auditCustomerTransferApply] 解析后参数 → applyId:', applyId, '| action:', action);

  if (!applyId) return resp(400, 'id 必填');
  if (action !== 'approve' && action !== 'reject') {
    return resp(400, 'action 必须为 approve 或 reject');
  }
  if (action === 'reject' && !auditReason) {
    return resp(400, 'audit_reason 必填');
  }

  try {
    // 1. 获取审批人信息
    const auditUser = adminResult.user || {};
    const auditUserName = auditUser.nickname || auditUser.username || '';
    if (!auditUser || !auditUser._id) {
      return resp(404, '用户不存在');
    }

    const nowDate = new Date();

    // 公共校验：申请单存在且必须待审批
    const applyRes = await db.collection('customer_transfer_apply').doc(applyId).get();
    console.log('[auditCustomerTransferApply] doc查询结果 data类型:', typeof applyRes.data, '| 是否数组:', Array.isArray(applyRes.data), '| 内容:', JSON.stringify(applyRes.data));
    const applyData = extractDoc(applyRes);
    if (!applyData) return resp(404, '该申请不存在（applyId=' + applyId + '）');
    if (getApplyStatus(applyData) !== 0) {
      return resp(400, '该申请已审批，不可重复操作');
    }

    if (action === 'reject') {
      console.log('[auditCustomerTransferApply] 执行拒绝 → 审批前 status:', applyData.status, '| apply_status:', applyData.apply_status, '→ 写入 status=2, apply_status=2');
      await db.collection('customer_transfer_apply').doc(applyId).update({
        status: 2,
        apply_status: 2,
        audit_reason: auditReason,
        audit_by: uid,
        audit_by_name: auditUserName,
        audit_time: nowDate,
        updated_at: nowDate
      });
      console.log('[auditCustomerTransferApply] 拒绝完成 → 已写入 status=2, apply_status=2（与 status 同步）');

      return resp(200, '审批已拒绝', {
        id: applyId,
        status: 2
      });
    }

    // 通过：必须事务，一次性更新申请单 + customer_profile.current_sales_*
    // 业务规则：严禁修改 first_sales_id；严禁回写历史 member_order
    const transaction = await db.startTransaction();
    try {
      // A. 再次读取申请单，确认仍为待审批
      const applyRes2 = await transaction.collection('customer_transfer_apply').doc(applyId).get();
      const apply2 = extractDoc(applyRes2);
      if (!apply2) {
        await transaction.rollback();
        return resp(404, '该申请不存在');
      }
      if (getApplyStatus(apply2) !== 0) {
        await transaction.rollback();
        return resp(400, '该申请已审批，请刷新后重试');
      }

      // B. 再次读取客户，确认客户仍存在
      const customerId = safeString(apply2.customer_id);
      const customerRes2 = await transaction.collection('customer_profile').doc(customerId).get();
      const customer2 = extractDoc(customerRes2);
      if (!customer2) {
        await transaction.rollback();
        return resp(404, '关联客户不存在');
      }

      // C. 防并发：客户当前归属必须与申请单 from_sales_id 一致，否则不覆盖
      const customerCurrentSalesId = safeString(customer2.current_sales_id);
      const applyFromSalesId = safeString(apply2.from_sales_id);
      if (customerCurrentSalesId !== applyFromSalesId) {
        await transaction.rollback();
        return resp(400, '客户当前归属已变化，请刷新后重试');
      }

      const toSalesId = safeString(apply2.to_sales_id);
      const toSalesRes = await transaction.collection('sales_staff').doc(toSalesId).get();
      const toSales = extractDoc(toSalesRes);
      if (!toSales) {
        await transaction.rollback();
        return resp(404, '目标业务员不存在');
      }
      if (Number(toSales.status) !== 1) {
        await transaction.rollback();
        return resp(400, '目标业务员已停用，无法审批通过');
      }

      // D. 事务中更新申请单为已通过
      console.log('[auditCustomerTransferApply] 执行通过 → 审批前 status:', apply2.status, '| apply_status:', apply2.apply_status, '→ 写入 status=1, apply_status=1');
      await transaction.collection('customer_transfer_apply').doc(applyId).update({
        status: 1,
        apply_status: 1,
        audit_by: uid,
        audit_by_name: auditUserName,
        audit_time: nowDate,
        updated_at: nowDate
      });

      // E. 事务中更新客户表：只更新 current_sales_id/current_sales_name
      await transaction.collection('customer_profile').doc(customerId).update({
        current_sales_id: toSalesId,
        current_sales_name: safeString(apply2.to_sales_name || toSales.sales_name)
      });

      await transaction.commit();
      console.log('[auditCustomerTransferApply] 通过完成 → 事务已提交，已写入 status=1, apply_status=1（与 status 同步）');
      return resp(200, '审批已通过', {
        id: applyId,
        status: 1,
        customer_id: customerId,
        current_sales_id: toSalesId,
        current_sales_name: safeString(apply2.to_sales_name || toSales.sales_name)
      });
    } catch (txErr) {
      try {
        await transaction.rollback();
      } catch (rollbackErr) {
        console.error('auditCustomerTransferApply rollback error:', rollbackErr);
      }
      throw txErr;
    }

  } catch (e) {
    console.error('auditCustomerTransferApply error:', e);
    return resp(500, e.message || '服务繁忙，请稍后再试');
  }
};
