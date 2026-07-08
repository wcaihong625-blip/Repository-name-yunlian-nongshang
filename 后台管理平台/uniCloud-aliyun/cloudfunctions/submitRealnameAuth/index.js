'use strict';

const { verifyToken } = require('nxt-auth');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const authCollection = db.collection('realname_auth');
  const usersCollection = db.collection('uni-id-users');

  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '未登录，请先登录');
    }
    const user_id = tokenResult.userId;

    const {
      realName,
      idCard,
      idCardFront,
      idCardBack,
      gender,
      nation,
      birthday,
      address,
      issueAuthority,
      validDate,
      validFrom,
      validTo,
      ocr_provider,
      ocr_doc_type,
      ocr_snapshot
    } = event;

    if (!realName || !idCard || !idCardFront) {
      return res(400, '参数错误：必填字段不能为空');
    }

    if (realName.trim().length < 2 || realName.trim().length > 20) {
      return res(400, '真实姓名长度应在2-20个字符之间');
    }

    const idCardRegex = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
    if (!idCardRegex.test(idCard)) {
      return res(400, '身份证号码格式不正确');
    }

    const userRes = await usersCollection.doc(user_id).get();
    if (!userRes.data || userRes.data.length === 0) {
      return res(400, '用户不存在');
    }

    const existingAuth = await authCollection.where({
      user_id: user_id
    }).get();

    if (existingAuth.data && existingAuth.data.length > 0) {
      const authRecord = existingAuth.data[0];
      if (authRecord.status === 'pending' || authRecord.status === 'verified') {
        return res(400, '您已有认证记录，无法重复提交');
      }
      if (authRecord.status === 'rejected') {
        const updateData = {
          realName: realName.trim(),
          idCard: idCard.toUpperCase(),
          idCardFront: idCardFront,
          idCardBack: idCardBack || '',
          gender: gender ? String(gender).trim() : '',
          nation: nation ? String(nation).trim() : '',
          birthday: birthday ? String(birthday).trim() : '',
          address: address ? String(address).trim() : '',
          issueAuthority: issueAuthority ? String(issueAuthority).trim() : '',
          validDate: validDate ? String(validDate).trim() : '',
          validFrom: validFrom ? String(validFrom).trim() : '',
          validTo: validTo ? String(validTo).trim() : '',
          ocr_provider: ocr_provider ? String(ocr_provider).trim() : '',
          ocr_doc_type: ocr_doc_type ? String(ocr_doc_type).trim() : '',
          ocr_snapshot: ocr_snapshot && typeof ocr_snapshot === 'object' ? ocr_snapshot : null,
          status: 'pending',
          rejectReason: '',
          updated_date: new Date()
        };

        const updateRes = await authCollection.doc(authRecord._id).update(updateData);

        if (updateRes.updated > 0) {
          return res(200, '提交成功，等待审核', {
            id: authRecord._id,
            status: 'pending',
            ...updateData
          });
        } else {
          return res(500, '提交失败，请重试');
        }
      }
    }

    const idCardCheck = await authCollection.where({
      idCard: idCard.toUpperCase(),
      status: 'verified'
    }).get();

    if (idCardCheck.data && idCardCheck.data.length > 0) {
      const existingRecord = idCardCheck.data[0];
      if (existingRecord.user_id !== user_id) {
        return res(400, '该身份证号已被其他用户认证使用');
      }
    }

    const authData = {
      user_id: user_id,
      realName: realName.trim(),
      idCard: idCard.toUpperCase(),
      idCardFront: idCardFront,
      idCardBack: idCardBack || '',
      gender: gender ? String(gender).trim() : '',
      nation: nation ? String(nation).trim() : '',
      birthday: birthday ? String(birthday).trim() : '',
      address: address ? String(address).trim() : '',
      issueAuthority: issueAuthority ? String(issueAuthority).trim() : '',
      validDate: validDate ? String(validDate).trim() : '',
      validFrom: validFrom ? String(validFrom).trim() : '',
      validTo: validTo ? String(validTo).trim() : '',
      ocr_provider: ocr_provider ? String(ocr_provider).trim() : '',
      ocr_doc_type: ocr_doc_type ? String(ocr_doc_type).trim() : '',
      ocr_snapshot: ocr_snapshot && typeof ocr_snapshot === 'object' ? ocr_snapshot : null,
      status: 'pending',
      created_date: new Date(),
      updated_date: new Date()
    };

    if (existingAuth.data && existingAuth.data.length > 0) {
      const updateRes = await authCollection.doc(existingAuth.data[0]._id).update(authData);

      if (updateRes.updated > 0) {
        return res(200, '提交成功，等待审核', {
          id: existingAuth.data[0]._id,
          ...authData
        });
      } else {
        return res(500, '提交失败，请重试');
      }
    } else {
      const insertRes = await authCollection.add(authData);

      if (insertRes.id) {
        return res(200, '提交成功，等待审核', {
          id: insertRes.id,
          ...authData
        });
      } else {
        return res(500, '提交失败，请重试');
      }
    }
  } catch (err) {
    console.error('submitRealnameAuth error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
