'use strict';

const { requireAdmin } = require('nxt-auth');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function getCustomerName(customerProfile = {}) {
  return safeString(
    customerProfile.company_name ||
    customerProfile.contact_name ||
    customerProfile.nickname ||
    customerProfile.mobile
  );
}

function resp(code, message, data = null) {
  return { code, message, data };
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const _ = db.command;

  const adminResult = await requireAdmin(event, context);
  if (!adminResult.success || !adminResult.userId) {
    return resp(403, adminResult.error || '无后台管理权限');
  }
  const uid = adminResult.userId;

  const customerId = safeString(event.customer_id);
  const toSalesId = safeString(event.to_sales_id || event.new_sales_id);
  const applyReason = safeString(event.apply_reason);

  if (!customerId) {
    return resp(400, 'customer_id 必填');
  }
  if (!toSalesId) {
    return resp(400, 'to_sales_id 必填');
  }
  if (!applyReason) {
    return resp(400, 'apply_reason 必填');
  }

  try {
    // 1. 获取申请人信息
    const applyUser = adminResult.user || {};
    const applyUserName = applyUser.nickname || applyUser.username || '';

    // 2. 查询客户信息
    const customerRes = await db.collection('customer_profile').doc(customerId).get();
    const customerProfile = customerRes.data && customerRes.data.length ? customerRes.data[0] : null;

    if (!customerProfile) {
      return resp(404, '客户不存在');
    }

    const customerName = getCustomerName(customerProfile);
    const currentSalesId = safeString(customerProfile.current_sales_id);
    if (!currentSalesId) {
      return resp(400, '客户当前未分配业务员，无法发起转移');
    }

    const currentSalesRes = await db.collection('sales_staff').doc(currentSalesId).get();
    const currentSales = currentSalesRes.data && currentSalesRes.data.length ? currentSalesRes.data[0] : null;
    if (!currentSales) {
      return resp(400, '客户当前归属业务员不存在，无法发起转移');
    }
    const currentSalesName = safeString(customerProfile.current_sales_name || currentSales.sales_name);

    if (currentSalesId === toSalesId) {
      return resp(400, '目标业务员不能与当前业务员相同');
    }

    // 3. 查询新业务员姓名
    let toSalesName = '';
    const toSalesRes = await db.collection('sales_staff').doc(toSalesId).get();
    if (toSalesRes.data && toSalesRes.data.length) {
      const staff = toSalesRes.data[0];
      const status = Number(staff.status);
      if (status !== 1) {
        return resp(400, '目标业务员已停用，无法发起转移');
      }
      toSalesName = safeString(staff.sales_name);
    } else {
      return resp(404, '目标业务员不存在');
    }

    // 4. 校验是否已有待审批的申请（仅以 status=0 为准；历史脏数据请执行云函数 fixCustomerTransferApplyStatus）
    console.log('[createCustomerTransferApply] 查询重复申请 → customer_id:', customerId, '| 使用字段: status==0（唯一判定待审批）');
    const pendingRes = await db
      .collection('customer_transfer_apply')
      .where({
        customer_id: customerId,
        status: 0
      })
      .field({
        _id: true,
        customer_id: true,
        status: true,
        apply_status: true,
        created_at: true
      })
      .limit(5)
      .get();
    const pendingList = pendingRes.data && pendingRes.data.length ? pendingRes.data : [];
    if (pendingList.length > 0) {
      console.log(
        '[createCustomerTransferApply] 命中待审批记录数:',
        pendingList.length,
        '| 详情:',
        JSON.stringify(pendingList.map((r) => ({ _id: r._id, status: r.status, apply_status: r.apply_status })))
      );
      return resp(400, '该客户已有待审批的转移申请，请勿重复提交');
    }
    console.log('[createCustomerTransferApply] 无 status=0 的待审批记录，允许创建');

    const nowDate = new Date();

    // 5. 创建申请记录
    const applyData = {
      customer_id: customerId,
      customer_name: customerName,
      user_id: safeString(customerProfile.user_id),
      mobile: safeString(customerProfile.mobile),
      from_sales_id: currentSalesId,
      from_sales_name: currentSalesName,
      to_sales_id: toSalesId,
      to_sales_name: toSalesName,
      apply_reason: applyReason,
      status: 0,
      apply_status: 0,
      apply_by: uid,
      apply_by_name: applyUserName,
      created_at: nowDate,
      updated_at: nowDate
    };

    const addRes = await db.collection('customer_transfer_apply').add(applyData);
    const applyId = addRes.id || addRes.insertedId;

    return {
      code: 200,
      message: '申请提交成功',
      data: {
        id: applyId,
        customer_id: customerId,
        from_sales_id: currentSalesId,
        to_sales_id: toSalesId,
        status: 0
      }
    };

  } catch (e) {
    console.error('createCustomerTransferApply error:', e);
    return resp(500, e.message || '服务繁忙，请稍后再试');
  }
};
