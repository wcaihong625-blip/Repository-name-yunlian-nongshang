'use strict';

const { verifyToken } = require('nxt-auth');
const { safeString, fetchContentRow, readViewCountFromRow, calcOrderVirtualViews, buildPromotionVirtualViewMap } = require('nxt-view-count');

function res(code, message, data) {
  return { code, message, data: data || null };
}

function formatDateLabel(ts) {
  if (!ts) return '';
  const d = ts instanceof Date ? ts : new Date(ts);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function pickCover(content_type, row) {
  if (!row) return '';
  if (content_type === 'supply') {
    const imgs = row.images;
    if (Array.isArray(imgs) && imgs.length > 0 && safeString(imgs[0])) {
      return safeString(imgs[0]);
    }
  }
  return '';
}

function mapEffectUiStatus(orderStatus) {
  const s = safeString(orderStatus);
  if (s === 'active') return 'active';
  if (s === 'expired') return 'expired';
  if (s === 'paid' || s === 'pending') return 'pending';
  if (s === 'cancelled') return 'ended';
  return s || 'pending';
}

async function calcContentAllActiveVirtualViews(db, content_type, content_id) {
  const cid = safeString(content_id);
  if (!cid) return 0;
  const map = await buildPromotionVirtualViewMap(db, content_type, [cid]);
  return map[cid] || 0;
}

exports.main = async (event, context) => {
  const db = uniCloud.database();

  try {
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '登录状态无效');
    }
    const userId = tokenResult.userId;

    const promotion_order_id = safeString(event.promotion_order_id || event.order_id);
    if (!promotion_order_id) {
      return res(400, '缺少 promotion_order_id');
    }

    const orderRes = await db.collection('promotion_order').doc(promotion_order_id).get();
    const order = orderRes.data && orderRes.data[0];
    if (!order) {
      return res(404, '推广订单不存在');
    }
    if (String(order.user_id) !== String(userId)) {
      return res(403, '无权查看该推广订单');
    }

    const content_type = order.content_type === 'purchase' ? 'purchase' : 'supply';
    const contentRow = await fetchContentRow(db, content_type, order.content_id);
    if (!contentRow) {
      return res(404, '关联的采购/供应信息不存在或已删除');
    }

    const realCurrentViewCount = readViewCountFromRow(contentRow);
    const virtualAddedByOrder = calcOrderVirtualViews(order);
    const virtualAddedAllActive = await calcContentAllActiveVirtualViews(
      db,
      content_type,
      order.content_id
    );
    const current_view_count = realCurrentViewCount + virtualAddedAllActive;
    const beforeStored = order.before_view_count;
    const before_view_count =
      beforeStored != null && Number.isFinite(Number(beforeStored))
        ? Math.max(0, Math.floor(Number(beforeStored)))
        : Math.max(0, current_view_count - virtualAddedByOrder);
    const addedRaw = current_view_count - before_view_count;
    const added_view_count = Number.isFinite(addedRaw) ? Math.max(0, Math.floor(addedRaw)) : 0;

    console.log('[getPromotionEffectDetail]', {
      promotion_order_id,
      content_id: safeString(order.content_id),
      content_type,
      status: order.status,
      before_view_count,
      current_view_count,
      added_view_count,
      virtual_added_by_order: virtualAddedByOrder,
      virtual_added_all_active: virtualAddedAllActive
    });

    const title = safeString(contentRow.title || order.title);
    const cover = pickCover(content_type, contentRow);
    const content_status = safeString(contentRow.status || '');
    const publishedRaw =
      content_type === 'purchase'
        ? contentRow.publish_date || contentRow.created_date
        : contentRow.created_date;
    const published_at = formatDateLabel(publishedRaw);

    const pay_amount = Number(order.paid_amount != null ? order.paid_amount : order.price);
    const payAmount = Number.isFinite(pay_amount) ? pay_amount : 0;

    let uiStatus = mapEffectUiStatus(order.status);
    const endTs = order.end_time ? new Date(order.end_time).getTime() : 0;
    if (uiStatus === 'active' && endTs > 0 && endTs < Date.now()) {
      uiStatus = 'expired';
    }

    const durationDays = [1, 3, 7].includes(Number(order.duration_days)) ? Number(order.duration_days) : null;
    const giftDaysUsed =
      order.use_gift_quota === true ? Math.max(0, Math.floor(Number(order.gift_quota_count) || 0)) : 0;

    const payload = {
      promotion_order_id,
      content_id: safeString(order.content_id),
      content_type,
      title,
      cover,
      content_status,
      published_at,
      promotion_type: order.promotion_type === 'boost' ? 'boost' : 'top',
      promotion_type_label: order.promotion_type === 'boost' ? '加急曝光' : '置顶',
      status: uiStatus,
      start_time: order.start_time,
      end_time: order.end_time,
      duration_days: durationDays,
      pay_amount: payAmount,
      use_gift_quota: order.use_gift_quota === true,
      gift_quota_days: giftDaysUsed,
      before_view_count,
      current_view_count,
      added_view_count,
      added_contact_count: 0,
      added_favorite_count: 0
    };

    return res(200, '获取成功', payload);
  } catch (err) {
    console.error('getPromotionEffectDetail error:', err);
    return res(500, err.message || '服务器内部错误');
  }
};
