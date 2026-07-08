'use strict';

/**
 * 将推广订单的生效窗口同步到采购/供应主表，供列表排序与前端「置顶/加急」展示。
 * top_sort_flag: 0|1，配合列表 orderBy('top_sort_flag','desc')
 */

function safeString(v) {
  return v == null ? '' : String(v).trim();
}

function contentCollectionName(content_type) {
  return content_type === 'purchase' ? 'purchase_list' : 'supply_list';
}

function ts(v) {
  if (!v) return 0;
  const d = v instanceof Date ? v.getTime() : new Date(v).getTime();
  return Number.isFinite(d) ? d : 0;
}

/**
 * 根据当前仍「生效中」的推广订单，重算主表上的置顶/加急到期与排序位。
 */
async function refreshContentPromotionFields(db, content_type, content_id) {
  const cmd = db.command;
  const cid = safeString(content_id);
  const ctype = content_type === 'purchase' ? 'purchase' : 'supply';
  if (!cid || !['purchase', 'supply'].includes(ctype)) return;

  const now = new Date();
  const colName = contentCollectionName(ctype);
  const po = db.collection('promotion_order');

  const { data: tops } = await po
    .where({
      content_id: cid,
      content_type: ctype,
      promotion_type: 'top',
      status: 'active',
      end_time: cmd.gt(now)
    })
    .get();

  const { data: boosts } = await po
    .where({
      content_id: cid,
      content_type: ctype,
      promotion_type: 'boost',
      status: 'active',
      end_time: cmd.gt(now)
    })
    .get();

  let topExpire = 0;
  for (const r of tops || []) {
    topExpire = Math.max(topExpire, ts(r.end_time));
  }
  let boostExpire = 0;
  for (const r of boosts || []) {
    boostExpire = Math.max(boostExpire, ts(r.end_time));
  }

  const patch = {
    top_expire_time: topExpire > 0 ? new Date(topExpire) : null,
    top_sort_flag: topExpire > 0 ? 1 : 0,
    promo_boost_expire_time: boostExpire > 0 ? new Date(boostExpire) : null,
    boost_sort_flag: boostExpire > 0 ? 1 : 0,
    updated_date: now
  };

  await db.collection(colName).doc(cid).update(patch);
  console.log('[nxt-content-promotion-sync.refreshContentPromotionFields]', {
    content_id: cid,
    content_type: ctype,
    top_expire_time: patch.top_expire_time,
    promo_boost_expire_time: patch.promo_boost_expire_time,
    top_sort_flag: patch.top_sort_flag,
    boost_sort_flag: patch.boost_sort_flag
  });
}

/**
 * 推广刚激活时：把本单结束时间并入主表（多条推广取更晚的到期）。
 * @param {{ promotion_order_id?: string, content_id: string, content_type: string, promotion_type: string, endMs: number }} p
 */
async function mergeActivePromotionOntoContent(db, p) {
  const ctypeRaw = p.content_type === 'purchase' ? 'purchase' : 'supply';
  const cid = safeString(p.content_id);
  const endMs = Number(p.endMs) || 0;
  if (!cid || !endMs) return;

  const colName = contentCollectionName(ctypeRaw);
  const docRes = await db.collection(colName).doc(cid).get();
  const row = docRes.data && docRes.data[0];
  if (!row) return;

  const now = new Date();
  const patch = { updated_date: now };
  const ptype = p.promotion_type === 'boost' ? 'boost' : 'top';

  if (ptype === 'top') {
    const prev = ts(row.top_expire_time);
    const next = Math.max(prev, endMs);
    patch.top_expire_time = new Date(next);
    patch.top_sort_flag = 1;
  } else {
    const prev = ts(row.promo_boost_expire_time);
    const next = Math.max(prev, endMs);
    patch.promo_boost_expire_time = new Date(next);
    patch.boost_sort_flag = 1;
  }

  await db.collection(colName).doc(cid).update(patch);

  const oid = safeString(p.promotion_order_id);
  const fields =
    ptype === 'top'
      ? { top_expire_time: patch.top_expire_time, top_sort_flag: patch.top_sort_flag }
      : { promo_boost_expire_time: patch.promo_boost_expire_time, boost_sort_flag: patch.boost_sort_flag };
  console.log('[nxt-content-promotion-sync.mergeActivePromotionOntoContent]', {
    promotion_order_id: oid || '(none)',
    content_id: cid,
    content_type: ctypeRaw,
    promotion_type: ptype,
    fields_written: fields
  });
}

module.exports = {
  refreshContentPromotionFields,
  mergeActivePromotionOntoContent
};
