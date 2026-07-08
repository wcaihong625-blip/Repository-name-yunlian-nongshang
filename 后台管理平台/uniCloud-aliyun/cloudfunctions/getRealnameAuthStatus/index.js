// 获取实名认证状态云函数
// 调用方式：uniCloud.callFunction({ name: 'getRealnameAuthStatus', data: { token } })
// 或者：uniCloud.callFunction({ name: 'getRealnameAuthStatus', data: { user_id: '...' } })（向后兼容）

'use strict';
const { verifyToken } = require('nxt-auth');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const authCollection = db.collection('realname_auth');

  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '登录状态无效');
    }
    const user_id = tokenResult.userId;

    // 兼容字段校验：user_id / uid / _id 任传其一则须与 token 身份一致
    const ids = [event.user_id, event.uid, event._id].filter(
      (v) => v != null && String(v).trim() !== ''
    );
    for (const id of ids) {
      if (String(id) !== String(user_id)) {
        return res(403, '无权查询其他用户的实名认证状态');
      }
    }

    // 查询该用户的认证记录
    const authRes = await authCollection.where({
      user_id: user_id
    }).orderBy('created_date', 'desc').limit(1).get();

    if (!authRes.data || authRes.data.length === 0) {
      // 没有认证记录，返回未认证状态
      return res(200, '获取成功', {
        status: 'unverified',
        realName: '',
        idCard: '',
        idCardFront: '',
        idCardBack: '',
        rejectReason: ''
      });
    }

    const authRecord = authRes.data[0];

    // 身份证号脱敏处理
    const maskIdCard = (idCard) => {
      if (!idCard || idCard.length < 8) {
        return idCard;
      }
      return idCard.substring(0, 4) + '********' + idCard.substring(idCard.length - 4);
    };

    // 根据状态返回数据
    const result = {
      status: authRecord.status || 'unverified',
      realName: authRecord.realName || '',
      idCard: authRecord.status === 'verified' ? maskIdCard(authRecord.idCard) : maskIdCard(authRecord.idCard),
      idCardFront: authRecord.idCardFront || '',
      idCardBack: authRecord.idCardBack || '',
      gender: authRecord.gender || '',
      nation: authRecord.nation || '',
      birthday: authRecord.birthday || '',
      address: authRecord.address || '',
      issueAuthority: authRecord.issueAuthority || '',
      validDate: authRecord.validDate || '',
      validFrom: authRecord.validFrom || '',
      validTo: authRecord.validTo || '',
      rejectReason: authRecord.rejectReason || '',
      created_date: authRecord.created_date,
      verified_date: authRecord.verified_date || null,
      audit_date: authRecord.audit_date || null
    };

    return res(200, '获取成功', result);
  } catch (err) {
    console.error('getRealnameAuthStatus error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
