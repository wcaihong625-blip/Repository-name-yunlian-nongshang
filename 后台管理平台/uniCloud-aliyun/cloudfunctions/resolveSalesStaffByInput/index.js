'use strict';

const { verifyToken } = require('nxt-auth');
const { resolveStaffByInput } = require('nxt-sales-staff');

exports.main = async (event, context) => {
  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  const db = uniCloud.database();
  const raw = event.sales_input || event.sales_code;
  const r = await resolveStaffByInput(db, raw);
  if (!r.ok) {
    return { code: r.code, message: r.message };
  }
  return { code: 200, message: 'ok', data: r.data };
};
