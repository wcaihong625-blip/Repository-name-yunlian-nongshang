'use strict';

const { requireAdmin } = require('nxt-auth');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const authCollection = db.collection('realname_auth');
  const usersCollection = db.collection('uni-id-users');

  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    const adminResult = await requireAdmin(event, context);
    if (!adminResult.success) {
      return res(403, adminResult.error || '无后台审批权限');
    }
    const auditor_id = adminResult.userId;
    const auditor_name = (adminResult.user && (adminResult.user.nickname || adminResult.user.username)) || '管理员';

    const {
      id,
      action,
      rejectReason = ''
    } = event;

    if (!id || !action) {
      return res(400, '参数错误：id、action不能为空');
    }

    if (action !== 'approve' && action !== 'reject') {
      return res(400, '参数错误：action只能是approve或reject');
    }

    if (action === 'reject' && !rejectReason) {
      return res(400, '参数错误：驳回操作必须提供驳回原因');
    }

    const authRes = await authCollection.doc(id).get();
    if (!authRes.data || authRes.data.length === 0) {
      return res(400, '认证记录不存在');
    }

    const authRecord = authRes.data[0];

    if (authRecord.status !== 'pending') {
      return res(400, `该记录状态为${authRecord.status}，无法进行审核操作`);
    }

    const now = new Date();
    let updateData = {
      updated_date: now,
      audit_date: now,
      auditor_id: auditor_id,
      auditor_name: auditor_name
    };

    if (action === 'approve') {
      updateData.status = 'verified';
      updateData.verified_date = now;
      updateData.rejectReason = '';

      const idCardCheck = await authCollection.where({
        idCard: authRecord.idCard,
        status: 'verified',
        _id: db.command.neq(id)
      }).get();

      if (idCardCheck.data && idCardCheck.data.length > 0) {
        return res(400, '该身份证号已被其他用户认证使用');
      }
    } else {
      updateData.status = 'rejected';
      updateData.rejectReason = rejectReason.trim();
      updateData.verified_date = null;
    }

    const updateRes = await authCollection.doc(id).update(updateData);

    if (updateRes.updated > 0) {
      try {
        await usersCollection.doc(authRecord.user_id).update({
          isRealNameVerified: action === 'approve',
          real_name_verified: action === 'approve',
          is_verified: action === 'approve',
          update_time: now
        });
      } catch (syncErr) {
        console.error('auditRealnameAuth sync user verify error:', syncErr);
      }
    }

    if (updateRes.updated > 0) {
      return res(200, action === 'approve' ? '审核通过' : '审核驳回', {
        id: id,
        status: updateData.status,
        audit_date: updateData.audit_date,
        auditor_id: auditor_id,
        auditor_name: auditor_name,
        rejectReason: updateData.rejectReason || ''
      });
    } else {
      return res(500, '审核失败，请重试');
    }
  } catch (err) {
    console.error('auditRealnameAuth error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
