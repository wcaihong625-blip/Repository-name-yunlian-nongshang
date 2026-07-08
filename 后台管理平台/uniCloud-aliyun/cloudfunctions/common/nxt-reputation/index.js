'use strict';

const REPORT_REASON_CODES = new Set(['fake_info', 'spam', 'illegal_profile', 'fraud', 'abuse', 'other']);

function pickTargetUserId(event) {
  const e = event || {};
  return (
    e.target_user_id ||
    e.viewed_user_id ||
    e.user_id ||
    e.reported_user_id ||
    ''
  ).toString().trim();
}

function defaultSummaryFromUser(user) {
  const u = user || {};
  return {
    user_id: u._id || '',
    user_name: u.nickname || u.username || '用户',
    reputation_score: 60,
    positive_rate: 0,
    review_count: 0,
    report_count: 0,
    valid_report_count: 0,
    publish_purchase_count: Number(u.procurement_count) || 0,
    publish_supply_count: Number(u.supply_count) || 0,
    total_view_count: Number(u.profile_views) || 0,
    contact_count: Number(u.contact_count) || 0,
    favorite_count: Number(u.favorite_count) || 0,
    is_verified: !!u.isRealNameVerified,
    is_enterprise_verified: !!u.isEnterpriseVerified,
    risk_level: 'normal',
    last_calculated_at: Date.now()
  };
}

function riskFromCounts(validReport, totalReport) {
  const v = Number(validReport) || 0;
  const t = Number(totalReport) || 0;
  if (v >= 5) return 'warning';
  if (v >= 2 || t >= 8) return 'mild';
  return 'normal';
}

function computeReputationScore(positiveRate, validReport, reviewCount, avgScore) {
  let score = 70;
  const pr = Number(positiveRate) || 0;
  score += Math.min(25, Math.round(pr * 0.25));
  score -= Math.min(40, (Number(validReport) || 0) * 6);
  const rc = Number(reviewCount) || 0;
  const av = Number(avgScore) || 0;
  if (rc > 0 && av > 0) {
    score += Math.min(15, Math.round((av - 3) * 5));
  }
  return Math.max(0, Math.min(100, Math.round(score)));
}

async function loadUserDoc(db, userId) {
  if (!userId) return null;
  const res = await db
    .collection('uni-id-users')
    .doc(userId)
    .get()
    .catch(() => ({ data: [] }));
  return res.data && res.data[0] ? res.data[0] : null;
}

/**
 * 确保 user_reputation_summary 存在；返回文档（含 _id）
 */
async function ensureSummaryDoc(db, userId) {
  const col = db.collection('user_reputation_summary');
  const exist = await col
    .where({ user_id: userId })
    .limit(1)
    .get()
    .catch(() => ({ data: [] }));
  if (exist.data && exist.data.length) {
    return exist.data[0];
  }
  const user = await loadUserDoc(db, userId);
  if (!user) {
    return null;
  }
  const now = Date.now();
  const row = {
    ...defaultSummaryFromUser(user),
    user_id: userId,
    created_at: now,
    updated_at: now
  };
  const addRes = await col.add(row);
  return { _id: addRes.id, ...row };
}

async function incrementReportCount(db, reportedUserId) {
  const doc = await ensureSummaryDoc(db, reportedUserId);
  if (!doc || !doc._id) return;
  const col = db.collection('user_reputation_summary');
  const report_count = Number(doc.report_count) + 1;
  const risk_level = riskFromCounts(doc.valid_report_count || 0, report_count);
  const now = Date.now();
  await col.doc(doc._id).update({
    report_count,
    risk_level,
    updated_at: now
  });
}

async function adjustValidReportCount(db, reportedUserId, delta) {
  const col = db.collection('user_reputation_summary');
  let exist = await col
    .where({ user_id: reportedUserId })
    .limit(1)
    .get()
    .catch(() => ({ data: [] }));
  if (!exist.data || !exist.data.length) {
    const ensured = await ensureSummaryDoc(db, reportedUserId);
    if (!ensured || !ensured._id) {
      return;
    }
    exist = await col
      .where({ user_id: reportedUserId })
      .limit(1)
      .get()
      .catch(() => ({ data: [] }));
  }
  if (!exist.data || !exist.data.length) {
    return;
  }
  const doc = exist.data[0];
  let valid_report_count = Math.max(0, Number(doc.valid_report_count || 0) + delta);
  const report_count = Number(doc.report_count || 0);
  const risk_level = riskFromCounts(valid_report_count, report_count);
  const now = Date.now();
  await col.doc(doc._id).update({
    valid_report_count,
    risk_level,
    updated_at: now
  });
}

/**
 * 重算单个用户信誉汇总（写入表）
 */
async function rebuildOneUserSummary(db, userId) {
  const user = await loadUserDoc(db, userId);
  if (!user) {
    return { ok: false, error: '用户不存在' };
  }
  const now = Date.now();
  const reportCol = db.collection('user_report');
  const reviewCol = db.collection('user_reputation_review');
  const supplyCol = db.collection('supply_list');
  const purchaseCol = db.collection('purchase_list');

  const [allRep, validRep, reviews, supplyC, purchaseC] = await Promise.all([
    reportCol.where({ reported_user_id: userId }).count().catch(() => ({ total: 0 })),
    reportCol.where({ reported_user_id: userId, status: 'resolved_valid' }).count().catch(() => ({ total: 0 })),
    reviewCol
      .where({ target_user_id: userId, status: 'normal' })
      .field({ score: true })
      .get()
      .catch(() => ({ data: [] })),
    supplyCol.where({ user_id: userId }).count().catch(() => ({ total: 0 })),
    purchaseCol.where({ user_id: userId }).count().catch(() => ({ total: 0 }))
  ]);

  const report_count = allRep.total || 0;
  const valid_report_count = validRep.total || 0;
  const list = reviews.data || [];
  const review_count = list.length;
  let sumScore = 0;
  list.forEach((r) => {
    sumScore += Number(r.score) || 0;
  });
  const avgScore = review_count ? sumScore / review_count : 0;
  let good = 0;
  list.forEach((r) => {
    if ((Number(r.score) || 0) >= 4) good += 1;
  });
  const positive_rate = review_count ? Math.round((good / review_count) * 100) : 0;
  const risk_level = riskFromCounts(valid_report_count, report_count);
  const reputation_score = computeReputationScore(positive_rate, valid_report_count, review_count, avgScore);

  const row = {
    user_id: userId,
    user_name: user.nickname || user.username || '用户',
    reputation_score,
    positive_rate,
    review_count,
    report_count,
    valid_report_count,
    publish_purchase_count: purchaseC.total || 0,
    publish_supply_count: supplyC.total || 0,
    total_view_count: Number(user.profile_views) || 0,
    contact_count: Number(user.contact_count) || 0,
    favorite_count: Number(user.favorite_count) || 0,
    is_verified: !!user.isRealNameVerified,
    is_enterprise_verified: !!user.isEnterpriseVerified,
    risk_level,
    last_calculated_at: now,
    updated_at: now
  };

  const sumCol = db.collection('user_reputation_summary');
  const exist = await sumCol.where({ user_id: userId }).limit(1).get().catch(() => ({ data: [] }));
  if (exist.data && exist.data.length) {
    await sumCol.doc(exist.data[0]._id).update(row);
  } else {
    row.created_at = now;
    await sumCol.add(row);
  }
  return { ok: true, data: row };
}

function summaryToClientPayload(doc, user) {
  const d = doc || {};
  const u = user || {};
  const base = {
    reputation_score: Number(d.reputation_score) || 0,
    positive_rate: Number(d.positive_rate) || 0,
    report_count: Number(d.report_count) || 0,
    valid_report_count: Number(d.valid_report_count) || 0,
    is_verified: d.is_verified != null ? !!d.is_verified : !!u.isRealNameVerified,
    is_enterprise_verified:
      d.is_enterprise_verified != null ? !!d.is_enterprise_verified : !!u.isEnterpriseVerified,
    risk_level: d.risk_level || 'normal',
    publish_purchase_count: Number(d.publish_purchase_count) || 0,
    publish_supply_count: Number(d.publish_supply_count) || 0,
    total_view_count: Number(d.total_view_count) || 0,
    contact_count: Number(d.contact_count) || 0,
    favorite_count: Number(d.favorite_count) || 0
  };
  return base;
}

module.exports = {
  REPORT_REASON_CODES,
  pickTargetUserId,
  defaultSummaryFromUser,
  ensureSummaryDoc,
  incrementReportCount,
  adjustValidReportCount,
  rebuildOneUserSummary,
  summaryToClientPayload,
  loadUserDoc
};
