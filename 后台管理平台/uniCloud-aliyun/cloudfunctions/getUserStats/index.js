// 获取用户统计数据云函数
// 调用方式：uniCloud.callFunction({ name: 'getUserStats', data: { user_id } })

'use strict';
const { verifyToken } = require('nxt-auth');
const { readViewCountFromRow, buildPromotionVirtualViewMap } = require('nxt-view-count');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const usersCollection = db.collection('uni-id-users');
  const supplyCollection = db.collection('supply_list');
  const purchaseCollection = db.collection('purchase_list');

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
        return res(403, '无权查询其他用户的统计信息');
      }
    }

    console.log('getUserStats 参数:', { user_id });

    // 查询用户信息（包含统计字段）
    const queryRes = await usersCollection.doc(user_id).get();

    if (!queryRes.data || queryRes.data.length === 0) {
      return res(404, '用户不存在');
    }

    const user = queryRes.data[0];

    // 从用户表获取统计字段
    let supplyCount = user.supply_count || 0;
    let procurementCount = user.procurement_count || 0;
    const profile_views = Number(user.profile_views) || 0;

    // 如果用户表字段未更新，从实际数据表统计（作为备用）
    // 并行查询供应和采购数量
    const [supplyCountRes, procurementCountRes] = await Promise.all([
      supplyCollection.where({ user_id: user_id }).count().catch(() => ({ total: 0 })),
      purchaseCollection.where({ user_id: user_id }).count().catch(() => ({ total: 0 }))
    ]);

    // 如果用户表字段为0或不存在，使用实时统计的数据
    if (supplyCount === 0 && supplyCountRes.total > 0) {
      supplyCount = supplyCountRes.total;
    }
    if (procurementCount === 0 && procurementCountRes.total > 0) {
      procurementCount = procurementCountRes.total;
    }

    const [supplyViewsTotal, purchaseViewsTotal] = await Promise.all([
      sumViewCountForUser(db, supplyCollection, user_id, 'supply'),
      sumViewCountForUser(db, purchaseCollection, user_id, 'purchase')
    ]);
    const product_views_total = supplyViewsTotal + purchaseViewsTotal;

    const statsData = {
      supply: supplyCount,
      procurement: procurementCount,
      profile_views,
      product_views_total
    };

    console.log('用户统计数据查询成功:', { user_id, ...statsData });

    return res(200, '获取成功', statsData);
  } catch (err) {
    console.error('getUserStats error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};

/** 累加某用户在某集合上的 view_count（兼容缺省字段，分页避免单次过大） */
async function sumViewCountForUser(db, collection, userId, contentType) {
  const nowMs = Date.now();
  const PAGE = 500;
  let skip = 0;
  let sum = 0;
  for (;;) {
    const { data } = await collection
      .where({ user_id: userId })
      .field({ _id: true, view_count: true, views: true, browse_count: true })
      .skip(skip)
      .limit(PAGE)
      .get();
    const list = data || [];
    if (!list.length) {
      break;
    }
    const ids = list.map((d) => String(d._id || '')).filter(Boolean);
    const promoMap = ids.length ? await buildPromotionVirtualViewMap(db, contentType, ids, nowMs) : {};
    for (const doc of list) {
      const realViews = readViewCountFromRow(doc);
      const virtualViews = promoMap[String(doc._id || '')] || 0;
      sum += realViews + virtualViews;
    }
    if (list.length < PAGE) {
      break;
    }
    skip += PAGE;
  }
  return sum;
}
















