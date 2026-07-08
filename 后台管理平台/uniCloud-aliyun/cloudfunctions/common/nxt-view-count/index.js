'use strict';

function safeString(v) {
  return v == null ? '' : String(v).trim();
}

function normalizeContentType(contentType) {
  return contentType === 'purchase' ? 'purchase' : 'supply';
}

function contentCollectionName(contentType) {
  return normalizeContentType(contentType) === 'purchase' ? 'purchase_list' : 'supply_list';
}

function readViewCountFromRow(row) {
  if (!row) return 0;
  const raw =
    row.current_view_count != null
      ? row.current_view_count
      : row.view_count != null
        ? row.view_count
        : row.views != null
          ? row.views
          : row.browse_count != null
            ? row.browse_count
            : row.browseCount != null
              ? row.browseCount
              : 0;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

function readPromotionDailyIncrement(row, fallback = 536) {
  const raw = Number(
    row && row.promotion_daily_view_increment != null
      ? row.promotion_daily_view_increment
      : row && row.daily_view_increment != null
        ? row.daily_view_increment
        : fallback
  );
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : Math.max(0, Math.floor(Number(fallback) || 0));
}

function calcOrderVirtualViews(order, nowMs = Date.now()) {
  if (!order || order.promotion_type !== 'boost') return 0;
  const daily = readPromotionDailyIncrement(order, 536);
  if (!daily) return 0;
  const startMs = order.start_time ? new Date(order.start_time).getTime() : 0;
  if (!Number.isFinite(startMs) || startMs <= 0) return 0;
  const endMs = order.end_time ? new Date(order.end_time).getTime() : 0;
  const effectiveEnd = Number.isFinite(endMs) && endMs > 0 ? Math.min(nowMs, endMs) : nowMs;
  if (effectiveEnd < startMs) return 0;
  const elapsedDays = Math.max(1, Math.floor((effectiveEnd - startMs) / 86400000) + 1);
  return daily * elapsedDays;
}

async function fetchContentRow(db, contentType, contentId) {
  const cid = safeString(contentId);
  if (!cid) return null;
  const col = contentCollectionName(contentType);
  const docRes = await db.collection(col).doc(cid).get();
  return docRes.data && docRes.data[0];
}

async function buildPromotionVirtualViewMap(db, contentType, contentIds, nowMs = Date.now()) {
  const ids = Array.isArray(contentIds) ? contentIds.map((x) => safeString(x)).filter(Boolean) : [];
  const map = {};
  if (!ids.length) return map;
  const cmd = db.command;
  const { data: rows } = await db
    .collection('promotion_order')
    .where({
      content_type: normalizeContentType(contentType),
      content_id: cmd.in(ids),
      status: 'active',
      promotion_type: 'boost'
    })
    .get();
  for (const row of rows || []) {
    const cid = safeString(row.content_id);
    if (!cid) continue;
    const added = calcOrderVirtualViews(row, nowMs);
    if (added <= 0) continue;
    map[cid] = (map[cid] || 0) + added;
  }
  return map;
}

module.exports = {
  safeString,
  normalizeContentType,
  contentCollectionName,
  readViewCountFromRow,
  readPromotionDailyIncrement,
  calcOrderVirtualViews,
  fetchContentRow,
  buildPromotionVirtualViewMap
};
