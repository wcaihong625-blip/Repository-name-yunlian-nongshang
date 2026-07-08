'use strict';

const { verifyToken } = require('nxt-auth');
const { batchSalesCodeByStaffId, safeString } = require('nxt-sales-staff');

module.exports = async (event, context) => {
  const db = uniCloud.database();
  const _ = db.command;

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  // settle_month 可选：不传或空则查全部月份（结算记录列表）；与月结预览（必须指定月）分离
  const settleMonth = safeString(event.settle_month);
  const salesId = safeString(event.sales_id);
  const salesName = safeString(event.sales_name);
  const settleId = safeString(event.settle_id);
  const settleStatus = event.settle_status !== undefined ? parseInt(event.settle_status, 10) : null;
  const page = parseInt(event.page, 10) || 1;
  const pageSize = parseInt(event.pageSize, 10) || 20;

  try {
    const query = {};
    if (settleId) query._id = settleId;
    if (settleMonth) query.settle_month = settleMonth;
    if (salesId) query.sales_id = salesId;
    if (salesName) query.sales_name = new RegExp(salesName, 'i');
    if (!isNaN(settleStatus) && settleStatus !== null) query.settle_status = settleStatus;

    const countRes = await db.collection('sales_commission_settle').where(query).count();
    const total = countRes.total || 0;

    const listRes = await db.collection('sales_commission_settle')
      .where(query)
      .orderBy('created_at', 'desc')
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .get();

    const rawList = listRes.data || [];
    const codeMap = await batchSalesCodeByStaffId(
      db,
      rawList.map((r) => r.sales_id)
    );
    const list = rawList.map((r) => ({
      ...r,
      sales_code: safeString(codeMap[safeString(r.sales_id)])
    }));

    return {
      code: 200,
      message: '获取成功',
      data: {
        list,
        total,
        page,
        pageSize
      }
    };
  } catch (e) {
    console.error('getCommissionSettleList error:', e);
    return { code: 500, message: e.message || '查询失败' };
  }
};

