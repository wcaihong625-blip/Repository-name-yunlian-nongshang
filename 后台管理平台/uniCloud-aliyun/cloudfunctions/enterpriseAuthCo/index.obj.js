'use strict';

const { verifyToken, requireAdmin } = require('nxt-auth');

const CREDIT_CODE_RE = /^[0-9A-HJ-NPQRTUWXY]{2}\d{6}[0-9A-HJ-NPQRTUWXY]{10}$/i;
const MOBILE_RE = /^1\d{10}$/;

module.exports = {
  _before() {},

  async submit(event = {}, context) {
    const db = uniCloud.database();
    const col = db.collection('enterprise_auth');
    const usersCollection = db.collection('uni-id-users');

    const res = (code, message, data) => ({ code, message, data: data || null });

    try {
      const tokenResult = await verifyToken(event, context);
      if (!tokenResult.success) {
        return res(401, tokenResult.error || '未登录，请先登录');
      }
      const user_id = tokenResult.userId;

      const {
        enterprise_name,
        credit_code,
        contact_name,
        contact_mobile,
        province,
        city,
        district,
        address,
        business_license_url,
        remark,
        legal_person,
        company_type,
        establish_date,
        valid_period,
        business_scope,
        license_number,
        ocr_provider,
        ocr_doc_type,
        ocr_snapshot
      } = event;

      if (!enterprise_name || !String(enterprise_name).trim()) {
        return res(400, '请输入企业名称');
      }
      if (!credit_code || !String(credit_code).trim()) {
        return res(400, '请输入统一社会信用代码');
      }
      const cc = String(credit_code).trim().toUpperCase();
      if (!CREDIT_CODE_RE.test(cc)) {
        return res(400, '统一社会信用代码格式不正确（应为18位）');
      }
      if (!contact_name || !String(contact_name).trim()) {
        return res(400, '请输入联系人姓名');
      }
      if (!contact_mobile || !MOBILE_RE.test(String(contact_mobile).trim())) {
        return res(400, '请输入正确的联系手机号');
      }
      if (!province || !city || !district) {
        return res(400, '请选择企业所在地');
      }
      if (!business_license_url || !String(business_license_url).trim()) {
        return res(400, '请上传营业执照照片');
      }

      const userRes = await usersCollection.doc(user_id).get();
      if (!userRes.data || userRes.data.length === 0) {
        return res(400, '用户不存在');
      }
      const u = userRes.data[0];
      const nickname = u.nickname || u.username || '';
      const mobile = u.mobile || '';

      const existing = await col.where({ user_id }).limit(1).get();
      const now = Date.now();

      if (existing.data && existing.data.length > 0) {
        const row = existing.data[0];
        if (row.status === 'pending') {
          return res(400, '审核中，请耐心等待');
        }
        if (row.status === 'approved') {
          return res(400, '您已通过企业认证，无需重复提交');
        }
      }

      const payload = {
        user_id,
        nickname,
        mobile,
        enterprise_name: String(enterprise_name).trim(),
        credit_code: cc,
        contact_name: String(contact_name).trim(),
        contact_mobile: String(contact_mobile).trim(),
        province: String(province).trim(),
        city: String(city).trim(),
        district: String(district).trim(),
        address: address != null ? String(address).trim() : '',
        legal_person: legal_person != null ? String(legal_person).trim() : '',
        company_type: company_type != null ? String(company_type).trim() : '',
        establish_date: establish_date != null ? String(establish_date).trim() : '',
        valid_period: valid_period != null ? String(valid_period).trim() : '',
        business_scope: business_scope != null ? String(business_scope).trim() : '',
        license_number: license_number != null ? String(license_number).trim() : '',
        business_license_url: String(business_license_url).trim(),
        remark: remark != null ? String(remark).trim() : '',
        ocr_provider: ocr_provider != null ? String(ocr_provider).trim() : '',
        ocr_doc_type: ocr_doc_type != null ? String(ocr_doc_type).trim() : '',
        ocr_snapshot: ocr_snapshot && typeof ocr_snapshot === 'object' ? ocr_snapshot : null,
        status: 'pending',
        reject_reason: '',
        admin_remark: '',
        reviewed_by: '',
        reviewed_at: null,
        updated_at: now
      };

      if (existing.data && existing.data.length > 0) {
        const _id = existing.data[0]._id;
        await col.doc(_id).update(payload);
        await usersCollection.doc(user_id).update({
          isEnterpriseVerified: false,
          is_enterprise_verified: false,
          enterprise_auth_status: 'pending',
          update_time: now
        });
        return res(200, '提交成功，等待审核', { id: _id, status: 'pending', ...payload });
      }

      payload.created_at = now;
      const addRes = await col.add(payload);
      await usersCollection.doc(user_id).update({
        isEnterpriseVerified: false,
        is_enterprise_verified: false,
        enterprise_auth_status: 'pending',
        update_time: now
      });
      return res(200, '提交成功，等待审核', { id: addRes.id, status: 'pending', ...payload });
    } catch (err) {
      console.error('enterpriseAuthCo.submit', err);
      return res(500, '服务器内部错误', { error: err.message });
    }
  },

  async getDetail(event = {}, context) {
    const db = uniCloud.database();
    const col = db.collection('enterprise_auth');

    const res = (code, message, data) => ({ code, message, data: data || null });

    try {
      const tokenResult = await verifyToken(event, context);
      if (!tokenResult.success) {
        return res(401, tokenResult.error || '登录状态无效');
      }
      const user_id = tokenResult.userId;

      const ids = [event.user_id, event.uid, event._id].filter((v) => v != null && String(v).trim() !== '');
      for (const id of ids) {
        if (String(id) !== String(user_id)) {
          return res(403, '无权查询其他用户的企业认证信息');
        }
      }

      const q = await col.where({ user_id }).limit(1).get();

      if (!q.data || q.data.length === 0) {
        return res(200, '获取成功', {
          status: 'none',
          enterprise_name: '',
          credit_code: '',
          contact_name: '',
          contact_mobile: '',
          province: '',
          city: '',
          district: '',
          address: '',
          business_license_url: '',
          remark: '',
          reject_reason: ''
        });
      }

      const r = q.data[0];
      const maskMobile = (m) => {
        if (!m || m.length < 7) return m || '';
        return String(m).replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
      };

      return res(200, '获取成功', {
        _id: r._id,
        status: r.status,
        enterprise_name: r.enterprise_name || '',
        credit_code: r.credit_code || '',
        contact_name: r.contact_name || '',
        contact_mobile: maskMobile(r.contact_mobile),
        contact_mobile_full: r.contact_mobile || '',
        province: r.province || '',
        city: r.city || '',
        district: r.district || '',
        address: r.address || '',
        legal_person: r.legal_person || '',
        company_type: r.company_type || '',
        establish_date: r.establish_date || '',
        valid_period: r.valid_period || '',
        business_scope: r.business_scope || '',
        license_number: r.license_number || '',
        business_license_url: r.business_license_url || '',
        remark: r.remark || '',
        reject_reason: r.reject_reason || '',
        created_at: r.created_at,
        updated_at: r.updated_at,
        reviewed_at: r.reviewed_at
      });
    } catch (err) {
      console.error('enterpriseAuthCo.getDetail', err);
      return res(500, '服务器内部错误', { error: err.message });
    }
  },

  async getList(event = {}, context) {
    const db = uniCloud.database();
    const cmd = db.command;
    const col = db.collection('enterprise_auth');
    const usersCollection = db.collection('uni-id-users');

    const res = (code, message, data) => ({ code, message, data: data || null });

    try {
      const adminResult = await requireAdmin(event, context);
      if (!adminResult.success) {
        return res(403, adminResult.error || '无后台审批权限');
      }

      const {
        page = 1,
        pageSize = 20,
        status = '',
        enterprise_name = '',
        contact_mobile = '',
        created_from = null,
        created_to = null
      } = event;

      const whereParts = [];
      if (status) {
        whereParts.push({ status });
      }
      if (enterprise_name && String(enterprise_name).trim()) {
        whereParts.push({
          enterprise_name: new RegExp(String(enterprise_name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        });
      }
      if (contact_mobile && String(contact_mobile).trim()) {
        whereParts.push({
          contact_mobile: new RegExp(String(contact_mobile).trim(), 'i')
        });
      }
      if (created_from != null && created_to != null) {
        whereParts.push({
          created_at: cmd.and(cmd.gte(Number(created_from)), cmd.lte(Number(created_to)))
        });
      }

      let query = col;
      if (whereParts.length === 1) {
        query = query.where(whereParts[0]);
      } else if (whereParts.length > 1) {
        query = query.where(cmd.and(...whereParts));
      }

      const countRes = await query.count();
      const total = countRes.total || 0;
      const skip = (page - 1) * pageSize;
      const listRes = await query.orderBy('created_at', 'desc').skip(skip).limit(pageSize).get();

      const rows = listRes.data || [];
      const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
      const userMap = {};
      if (userIds.length) {
        const ur = await usersCollection
          .where({ _id: cmd.in(userIds) })
          .field({ _id: true, nickname: true, username: true, mobile: true })
          .get();
        (ur.data || []).forEach((u) => {
          userMap[u._id] = u;
        });
      }

      const list = rows.map((item) => {
        const u = userMap[item.user_id] || {};
        const loc = [item.province, item.city, item.district].filter(Boolean).join(' ');
        return {
          ...item,
          user_nickname: u.nickname || u.username || item.nickname || '',
          user_mobile_snapshot: u.mobile || item.mobile || '',
          location_text: loc
        };
      });

      return res(200, '获取成功', {
        list,
        total,
        page,
        pageSize,
        hasMore: skip + list.length < total
      });
    } catch (err) {
      console.error('enterpriseAuthCo.getList', err);
      return res(500, '服务器内部错误', { error: err.message });
    }
  },

  async handle(event = {}, context) {
    const db = uniCloud.database();
    const col = db.collection('enterprise_auth');
    const usersCollection = db.collection('uni-id-users');

    const res = (code, message, data) => ({ code, message, data: data || null });

    try {
      const adminResult = await requireAdmin(event, context);
      if (!adminResult.success) {
        return res(403, adminResult.error || '无后台审批权限');
      }
      const auditor_id = adminResult.userId;

      const { id, action, rejectReason = '', admin_remark = '' } = event;

      if (!id || !action) {
        return res(400, '参数错误：id、action不能为空');
      }
      if (action !== 'approve' && action !== 'reject') {
        return res(400, '参数错误：action只能是approve或reject');
      }
      if (action === 'reject' && !String(rejectReason).trim()) {
        return res(400, '参数错误：驳回操作必须填写驳回原因');
      }

      const docRes = await col.doc(id).get();
      if (!docRes.data || docRes.data.length === 0) {
        return res(400, '认证记录不存在');
      }
      const record = docRes.data[0];
      if (record.status !== 'pending') {
        return res(400, `该记录状态为${record.status}，无法审核`);
      }

      const now = Date.now();
      const user_id = record.user_id;

      if (action === 'approve') {
        await col.doc(id).update({
          status: 'approved',
          reject_reason: '',
          admin_remark: String(admin_remark || '').trim(),
          reviewed_by: auditor_id,
          reviewed_at: now,
          updated_at: now
        });

        await usersCollection.doc(user_id).update({
          isEnterpriseVerified: true,
          is_enterprise_verified: true,
          enterprise_auth_status: 'approved',
          enterprise_name: record.enterprise_name || '',
          companyName: record.enterprise_name || '',
          update_time: now
        });

        return res(200, '审核通过', {
          id,
          status: 'approved',
          user_id,
          enterprise_name: record.enterprise_name || ''
        });
      }

      await col.doc(id).update({
        status: 'rejected',
        reject_reason: String(rejectReason).trim(),
        admin_remark: String(admin_remark || '').trim(),
        reviewed_by: auditor_id,
        reviewed_at: now,
        updated_at: now
      });

      await usersCollection.doc(user_id).update({
        isEnterpriseVerified: false,
        is_enterprise_verified: false,
        enterprise_auth_status: 'rejected',
        update_time: now
      });

      return res(200, '已驳回', { id, status: 'rejected', user_id });
    } catch (err) {
      console.error('enterpriseAuthCo.handle', err);
      return res(500, '服务器内部错误', { error: err.message });
    }
  }
};
