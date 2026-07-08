'use strict';

const { verifyToken } = require('nxt-auth');
const { computeNextYwSalesCode } = require('nxt-sales-staff');

exports.main = async (event, context) => {
  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  try {
    const db = uniCloud.database();
    const sales_code = await computeNextYwSalesCode(db);
    return { code: 200, message: 'ok', data: { sales_code } };
  } catch (e) {
    if (e && e.code === 'YW_OVERFLOW') {
      return { code: 400, message: e.message };
    }
    console.error('[getNextSalesStaffCode]', e);
    return { code: 500, message: e.message || '生成业务员编号失败' };
  }
};
