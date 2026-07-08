'use strict';

const { verifyToken, requireAdmin, createResponse } = require('nxt-auth');
const {
  REPORT_REASON_CODES,
  incrementReportCount,
  rebuildOneUserSummary,
  pickTargetUserId,
  summaryToClientPayload,
  defaultSummaryFromUser,
  loadUserDoc
} = require('nxt-reputation');

const ALLOWED_REPORT_STATUS = new Set([
  'pending',
  'processing',
  'resolved_valid',
  'resolved_invalid',
  'closed'
]);
const REPORT_REASON_TEXT = {
  fake_info: '发布不实信息/虚假内容',
  spam: '发布垃圾广告/骚扰信息',
  illegal_profile: '头像/昵称涉嫌违规',
  fraud: '存在欺诈或资金风险',
  abuse: '言语辱骂/人身攻击',
  other: '其他'
};
const REPORT_STATUS_TRANSITIONS = {
  pending: new Set(['processing', 'resolved_valid', 'resolved_invalid', 'closed']),
  processing: new Set(['resolved_valid', 'resolved_invalid', 'closed']),
  resolved_valid: new Set(['closed']),
  resolved_invalid: new Set(['closed']),
  closed: new Set([])
};

function createRes(code, message, data = null) {
  return { code, message, data };
}

module.exports = {
  _before() {},

  async submitReport(event = {}, context) {
    const res = createResponse;
    const db = uniCloud.database();

    try {
      const auth = await verifyToken(event, context);
      if (!auth.success) {
        return res(401, auth.error || '请先登录');
      }
      const reporterId = auth.userId;
      const {
        reported_user_id,
        reported_user_name,
        reporter_user_name,
        report_reason_code,
        report_reason,
        report_description,
        page_source,
        related_content_id,
        related_content_type,
        evidence_urls
      } = event;

      const rid = (reported_user_id || '').toString().trim();
      if (!rid) {
        return res(400, '缺少被举报用户');
      }
      if (rid === String(reporterId)) {
        return res(400, '不能举报自己');
      }
      const code = (report_reason_code || '').toString().trim();
      if (!REPORT_REASON_CODES.has(code)) {
        return res(400, '举报原因无效');
      }

      const userCheck = await db.collection('uni-id-users').doc(rid).get();
      if (!userCheck.data || !userCheck.data.length) {
        return res(404, '被举报用户不存在');
      }

      const now = Date.now();
      const row = {
        reported_user_id: rid,
        reported_user_name: (reported_user_name || '').toString().slice(0, 200),
        reporter_user_id: String(reporterId),
        reporter_user_name: (reporter_user_name || '').toString().slice(0, 200),
        report_reason_code: code,
        report_reason: (report_reason || REPORT_REASON_TEXT[code] || '').toString().slice(0, 200),
        report_description: (report_description || '').toString().slice(0, 2000),
        page_source: (page_source || 'user_profile').toString().slice(0, 100),
        related_content_id: (related_content_id || rid).toString().slice(0, 128),
        related_content_type: (related_content_type || 'user').toString().slice(0, 64),
        evidence_urls: Array.isArray(evidence_urls) ? evidence_urls.filter((x) => typeof x === 'string').slice(0, 9) : [],
        status: 'pending',
        created_at: now,
        updated_at: now
      };

      const addRes = await db.collection('user_report').add(row);
      await incrementReportCount(db, rid);

      return res(200, '举报已提交', { _id: addRes.id, id: addRes.id });
    } catch (err) {
      console.error('reputationCo.submitReport', err);
      return res(500, '服务器错误', { error: err.message });
    }
  },

  async handleReport(event = {}, context) {
    const res = createResponse;
    const db = uniCloud.database();

    try {
      const admin = await requireAdmin(event, context);
      if (!admin.success) {
        return res(403, admin.error || '无权限');
      }

      const report_id = (event.report_id || event._id || '').toString().trim();
      const status = (event.status || '').toString().trim();
      if (!report_id) {
        return res(400, '缺少举报单ID');
      }
      if (!ALLOWED_REPORT_STATUS.has(status)) {
        return res(400, '状态值无效');
      }

      const col = db.collection('user_report');
      const docRes = await col.doc(report_id).get();
      if (!docRes.data || !docRes.data.length) {
        return res(404, '举报记录不存在');
      }
      const oldRow = docRes.data[0];
      const reportedUserId = oldRow.reported_user_id;
      const oldStatus = (oldRow.status || '').toString();
      if (oldStatus === status) {
        return res(200, '状态未变化', { _id: report_id, status });
      }
      const allowedNext = REPORT_STATUS_TRANSITIONS[oldStatus] || new Set();
      if (!allowedNext.has(status)) {
        return res(400, `状态流转不允许：${oldStatus} -> ${status}`);
      }

      const adminName =
        admin.user && (admin.user.username || admin.user.nickname || admin.user.mobile)
          ? String(admin.user.username || admin.user.nickname || admin.user.mobile)
          : '管理员';

      const now = Date.now();
      const patch = {
        status,
        admin_handle_result: (event.admin_handle_result || '').toString().slice(0, 500),
        admin_handle_note: (event.admin_handle_note || '').toString().slice(0, 2000),
        handled_by: admin.userId,
        handled_by_name: adminName.slice(0, 100),
        handled_at: now,
        updated_at: now
      };

      await col.doc(report_id).update(patch);

      if (reportedUserId) {
        await rebuildOneUserSummary(db, reportedUserId).catch((e) => console.error('rebuild summary:', e));
      }

      return res(200, '处理成功', { _id: report_id, status });
    } catch (err) {
      console.error('reputationCo.handleReport', err);
      return res(500, '服务器错误', { error: err.message });
    }
  },

  async getSummary(event = {}) {
    const db = uniCloud.database();
    try {
      const targetId = pickTargetUserId(event);
      if (!targetId) {
        return createRes(400, '缺少用户ID');
      }

      const user = await loadUserDoc(db, targetId);
      if (!user) {
        return createRes(404, '用户不存在');
      }

      const sumRes = await db
        .collection('user_reputation_summary')
        .where({ user_id: targetId })
        .limit(1)
        .get()
        .catch(() => ({ data: [] }));

      let doc = sumRes.data && sumRes.data[0] ? sumRes.data[0] : null;
      if (!doc) {
        const def = defaultSummaryFromUser(user);
        def.user_id = targetId;
        const payload = summaryToClientPayload(def, user);
        return createRes(200, 'ok', payload);
      }

      const payload = summaryToClientPayload(doc, user);
      if (payload.total_view_count === 0 && user.profile_views) {
        payload.total_view_count = Number(user.profile_views) || 0;
      }
      if (payload.publish_supply_count === 0 && user.supply_count) {
        payload.publish_supply_count = Number(user.supply_count) || 0;
      }
      if (payload.publish_purchase_count === 0 && user.procurement_count) {
        payload.publish_purchase_count = Number(user.procurement_count) || 0;
      }
      return createRes(200, 'ok', payload);
    } catch (err) {
      console.error('reputationCo.getSummary', err);
      return createRes(500, '服务器错误', { error: err.message });
    }
  },

  async getReviews(event = {}) {
    const db = uniCloud.database();
    try {
      const targetId = pickTargetUserId(event);
      if (!targetId) {
        return createRes(400, '缺少用户ID');
      }

      const page = Math.max(1, parseInt(event.page, 10) || 1);
      const pageSize = Math.min(50, Math.max(1, parseInt(event.pageSize, 10) || 20));
      const skip = (page - 1) * pageSize;

      const col = db.collection('user_reputation_review');
      const where = { target_user_id: targetId, status: 'normal' };

      const countRes = await col.where(where).count().catch(() => ({ total: 0 }));
      const total = countRes.total || 0;

      const listRes = await col
        .where(where)
        .orderBy('created_at', 'desc')
        .skip(skip)
        .limit(pageSize)
        .get()
        .catch(() => ({ data: [] }));

      const list = (listRes.data || []).map((r) => ({
        id: r._id,
        _id: r._id,
        score: r.score,
        content: r.content || '',
        tags: r.tags || [],
        created_at: r.created_at,
        review_user_name: r.review_user_name || '用户',
        review_user_id: r.review_user_id,
        is_anonymous: false
      }));

      return createRes(200, 'ok', { list, total, page, pageSize });
    } catch (err) {
      console.error('reputationCo.getReviews', err);
      return createRes(500, '服务器错误', { error: err.message });
    }
  },

  async submitReview(event = {}, context) {
    const res = createResponse;
    const db = uniCloud.database();

    try {
      const auth = await verifyToken(event, context);
      if (!auth.success) {
        return res(401, auth.error || '请先登录');
      }
      const reviewerId = auth.userId;
      const targetId = (event.target_user_id || event.user_id || '').toString().trim();
      const score = Math.min(5, Math.max(1, parseInt(event.score, 10) || 0));
      const content = (event.content || '').toString().slice(0, 2000);
      let tags = [];
      if (Array.isArray(event.tags)) {
        tags = event.tags.map((t) => String(t).slice(0, 32)).filter(Boolean).slice(0, 20);
      }

      if (!targetId) {
        return res(400, '缺少被评价用户');
      }
      if (String(targetId) === String(reviewerId)) {
        return res(400, '不能评价自己');
      }
      if (!score) {
        return res(400, '请选择评分');
      }

      const uRes = await db.collection('uni-id-users').doc(targetId).get();
      if (!uRes.data || !uRes.data.length) {
        return res(404, '用户不存在');
      }
      const targetUser = uRes.data[0];
      const rvRes = await db.collection('uni-id-users').doc(reviewerId).get();
      const rv = (rvRes.data && rvRes.data[0]) || {};
      const reviewUserName = (event.review_user_name || rv.nickname || rv.username || '用户').toString().slice(0, 100);

      const now = Date.now();
      await db.collection('user_reputation_review').add({
        target_user_id: targetId,
        target_user_name: (targetUser.nickname || targetUser.username || '用户').slice(0, 100),
        review_user_id: String(reviewerId),
        review_user_name: event.is_anonymous ? '匿名用户' : reviewUserName,
        score,
        content,
        tags,
        status: 'normal',
        source_type: 'mini_program',
        related_content_id: (event.related_content_id || '').toString().slice(0, 128),
        created_at: now,
        updated_at: now
      });

      await rebuildOneUserSummary(db, targetId).catch((e) => console.error('rebuild after review:', e));

      return res(200, '评价已提交', { target_user_id: targetId });
    } catch (err) {
      console.error('reputationCo.submitReview', err);
      return res(500, '服务器错误', { error: err.message });
    }
  },

  async rebuildSummary(event = {}, context) {
    const res = createResponse;

    try {
      const admin = await requireAdmin(event, context);
      if (!admin.success) {
        return res(403, admin.error || '无权限');
      }

      const userId = (event.user_id || event.target_user_id || '').toString().trim();
      if (!userId) {
        return res(400, '请传入 user_id');
      }

      const db = uniCloud.database();
      const out = await rebuildOneUserSummary(db, userId);
      if (!out.ok) {
        return res(400, out.error || '重算失败');
      }
      return res(200, '重算完成', out.data);
    } catch (err) {
      console.error('reputationCo.rebuildSummary', err);
      return res(500, '服务器错误', { error: err.message });
    }
  }
};
