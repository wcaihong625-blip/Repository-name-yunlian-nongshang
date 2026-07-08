// 获取供应列表云函数
// 调用方式：uniCloud.callFunction({ name: 'getSupplyList', data: { page, pageSize, category, region, search, sort, user_id } })

'use strict';
const { tokenizeKeyword } = require('nxt-search-index');
const { readViewCountFromRow, buildPromotionVirtualViewMap } = require('nxt-view-count');

const SUPPLY_LIST_FIELDS = {
  _id: true,
  title: true,
  product_name: true,
  productName: true,
  product_variety: true,
  variety_name: true,
  category: true,
  category_name: true,
  product_category: true,
  specifications: true,
  specification: true,
  spec: true,
  quantity: true,
  unit: true,
  price: true,
  price_negotiable: true,
  location: true,
  origin: true,
  ship_from: true,
  desc_short: true,
  images: true,
  description: true,
  publisher: true,
  user_id: true,
  status: true,
  created_date: true,
  is_in_stock: true,
  is_origin_direct: true,
  is_long_term_supply: true,
  min_order_quantity: true,
  shipping_method: true,
  current_view_count: true,
  view_count: true,
  views: true,
  browse_count: true,
  browseCount: true,
  top_expire_time: true,
  promo_boost_expire_time: true,
  top_sort_flag: true,
  boost_sort_flag: true
};

async function buildUserVerifyMap(db, userIds) {
  const ids = Array.from(new Set((userIds || []).map((id) => String(id || '')).filter(Boolean)));
  const result = {};
  if (!ids.length) return result;

  const usersRes = await db.collection('uni-id-users')
    .where({ _id: db.command.in(ids) })
    .field({
      _id: true,
      is_vip: true,
      member_type: true,
      vip_expire_time: true,
      isEnterpriseVerified: true,
      is_enterprise_verified: true,
      enterprise_auth_status: true,
      isRealNameVerified: true,
      real_name_verified: true,
      is_verified: true
    })
    .get();

  const realnameRes = await db.collection('realname_auth')
    .where({
      user_id: db.command.in(ids),
      status: 'verified'
    })
    .field({ user_id: true })
    .get();

  const realnameSet = new Set((realnameRes.data || []).map((row) => String(row.user_id || '')));
  (usersRes.data || []).forEach((u) => {
    const uid = String(u._id || '');
    let expTs = 0;
    const rawExp = u.vip_expire_time;
    if (rawExp instanceof Date) expTs = rawExp.getTime();
    else if (rawExp != null && rawExp !== '') {
      const t = new Date(rawExp).getTime();
      expTs = Number.isNaN(t) ? 0 : t;
    }
    const enterpriseMemberActive = u.is_vip === true && u.member_type === 'enterprise' && expTs > Date.now();
    result[uid] = {
      isRealNameVerified: !!(u.isRealNameVerified || u.real_name_verified || u.is_verified || realnameSet.has(uid)),
      isEnterpriseVerified: enterpriseMemberActive && !!(
        u.isEnterpriseVerified || u.is_enterprise_verified || u.enterprise_auth_status === 'approved'
      )
    };
  });
  ids.forEach((uid) => {
    if (!result[uid]) {
      result[uid] = {
        isRealNameVerified: realnameSet.has(uid),
        isEnterpriseVerified: false
      };
    }
  });
  return result;
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const cmd = db.command;
  const supplyCollection = db.collection('supply_list');

  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    const {
      page = 1,
      pageSize = 10,
      category,
      region,
      search,
      sort = 'timeDesc',
      user_id // 如果提供user_id，则只返回该用户发布的供应
    } = event;

    console.log('getSupplyList 参数:', { page, pageSize, category, region, search, sort, user_id });

    // 构建查询条件
    const baseCondition = {};

    // 如果提供了user_id，只查询该用户的供应
    if (user_id) {
      baseCondition.user_id = user_id;
      console.log('查询我的供应列表，user_id:', user_id);
    } else {
      // 公开列表显示已发布的，以及审核中的（审核中的会在返回时转换为已发布）
      baseCondition.status = cmd.in(['已发布', '审核中']);
      console.log('查询公开供应列表，状态过滤: 已发布 或 审核中');
    }

    // 分类筛选
    if (category && category !== '全部') {
      baseCondition.category = category;
    }

    const whereCondition = { ...baseCondition };
    const keywordTokens = [];
    keywordTokens.push(...tokenizeKeyword(search));
    if (region && region !== '全国') {
      keywordTokens.push(...tokenizeKeyword(region));
    }
    const uniqueKeywordTokens = Array.from(new Set(keywordTokens.filter(Boolean)));
    if (uniqueKeywordTokens.length) {
      whereCondition.search_terms = cmd.all(uniqueKeywordTokens);
    }

    // 构建查询
    let query = supplyCollection.where(whereCondition);

    // 排序：仅按“仍在有效期内”的置顶/加急时间字段优先，避免过期旧 sort_flag 干扰
    query = query.orderBy('top_expire_time', 'desc').orderBy('promo_boost_expire_time', 'desc');
    switch (sort) {
      case 'priceAsc':
        query = query.orderBy('price', 'asc');
        break;
      case 'priceDesc':
        query = query.orderBy('price', 'desc');
        break;
      case 'timeDesc':
        query = query.orderBy('created_date', 'desc');
        break;
      case 'timeAsc':
        query = query.orderBy('created_date', 'asc');
        break;
      default:
        query = query.orderBy('created_date', 'desc');
    }

    // 分页
    const skip = (page - 1) * pageSize;
    query = query.field(SUPPLY_LIST_FIELDS).skip(skip).limit(pageSize);

    // 执行查询
    const queryRes = await query.get();
    console.log('getSupplyList 查询结果数量:', queryRes.data.length);
    if (queryRes.data && queryRes.data[0]) {
      const s0 = queryRes.data[0];
      console.log('getSupplyList 样例推广字段:', {
        id: s0._id,
        top_sort_flag: s0.top_sort_flag,
        boost_sort_flag: s0.boost_sort_flag,
        top_expire_time: s0.top_expire_time,
        promo_boost_expire_time: s0.promo_boost_expire_time
      });
    }

    // 获取总数
    const countRes = await supplyCollection.where(whereCondition).count();
    console.log('总记录数:', countRes.total, '关键词:', uniqueKeywordTokens);

    const nowMs = Date.now();
    const listIds = (queryRes.data || []).map((x) => String(x._id || '')).filter(Boolean);
    const promoDailyAddedMap = await buildPromotionVirtualViewMap(db, 'supply', listIds, nowMs);
    const promotionFlags = (row) => {
      const topMs = row.top_expire_time ? new Date(row.top_expire_time).getTime() : 0;
      const boostMs = row.promo_boost_expire_time ? new Date(row.promo_boost_expire_time).getTime() : 0;
      return {
        promoTopActive: Number.isFinite(topMs) && topMs > nowMs,
        promoBoostActive: Number.isFinite(boostMs) && boostMs > nowMs
      };
    };

    // 格式化数据
    let formattedData = queryRes.data.map(item => {
      // 计算相对时间
      const timeAgo = getTimeAgo(item.created_date);
      
      // 如果是"审核中"或"审核失败"状态，自动转换为"已发布"
      let status = item.status;
      if (status === '审核中' || status === '审核失败') {
        status = '已发布';
      }
      
      const pf = promotionFlags(item);
      return {
        id: item._id,
        title: item.title,
        product_name: item.product_name || '',
        productName: item.productName || '',
        product_variety: item.product_variety || '',
        variety_name: item.variety_name || '',
        category: item.category,
        category_name: item.category_name || '',
        product_category: item.product_category || '',
        specifications: item.specifications,
        specification: item.specification || '',
        spec: item.spec || '',
        quantity: item.quantity,
        unit: item.unit,
        price: item.price,
        price_negotiable: item.price_negotiable,
        location: item.location,
        origin: item.origin || '',
        ship_from: item.ship_from || '',
        desc_short: item.desc_short || '',
        imageUrl: item.images && item.images.length > 0 ? item.images[0] : '/static/images/default-product.png',
        images: item.images || [],
        description: item.description,
        publisher: item.publisher,
        user_id: item.user_id,
        status: status,
        time: timeAgo,
        updateTime: timeAgo,
        created_date: item.created_date,
        is_in_stock: item.is_in_stock,
        is_origin_direct: item.is_origin_direct,
        is_long_term_supply: item.is_long_term_supply,
        min_order_quantity: item.min_order_quantity,
        shipping_method: item.shipping_method,
        isFavorite: false, // 前端需要根据本地存储判断
        view_count: readViewCountFromRow(item) + (promoDailyAddedMap[String(item._id)] || 0),
        top_expire_time: item.top_expire_time,
        promo_boost_expire_time: item.promo_boost_expire_time,
        top_sort_flag: item.top_sort_flag,
        boost_sort_flag: item.boost_sort_flag,
        promoTopActive: pf.promoTopActive,
        promoBoostActive: pf.promoBoostActive,
        promotion_order_id: ''
      };
    });

    if (user_id) {
      formattedData = await enrichPromotionOrderHints(db, user_id, 'supply', formattedData);
    }

    const verifyMap = await buildUserVerifyMap(db, formattedData.map((item) => item.user_id));
    formattedData = formattedData.map((item) => {
      const verify = verifyMap[String(item.user_id || '')] || {};
      return {
        ...item,
        isRealNameVerified: !!verify.isRealNameVerified,
        real_name_verified: !!verify.isRealNameVerified,
        is_verified: !!verify.isRealNameVerified,
        isEnterpriseVerified: !!verify.isEnterpriseVerified,
        enterprise_verified: !!verify.isEnterpriseVerified
      };
    });

    return res(200, '获取成功', {
      list: formattedData,
      total: countRes.total,
      page: page,
      pageSize: pageSize,
      hasMore: skip + formattedData.length < countRes.total
    });
  } catch (err) {
    console.error('getSupplyList error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};

/**
 * 我的供应列表：为每条信息附带最近一次「进行中/已结束」推广订单 ID，供小程序「查看效果」入口使用。
 */
async function enrichPromotionOrderHints(db, userId, contentType, list) {
  const cmd = db.command;
  const ids = list.map((x) => String(x.id || '')).filter(Boolean);
  if (!ids.length || !userId) {
    return list.map((item) => ({ ...item, promotion_order_id: '' }));
  }
  const { data: rows } = await db
    .collection('promotion_order')
    .where({
      user_id: String(userId),
      content_type: contentType,
      content_id: cmd.in(ids),
      status: cmd.in(['active', 'expired'])
    })
    .get();

  const best = {};
  const ts = (t) => {
    if (!t) return 0;
    const d = t instanceof Date ? t.getTime() : new Date(t).getTime();
    return Number.isFinite(d) ? d : 0;
  };
  for (const row of rows || []) {
    const cid = String(row.content_id);
    const prev = best[cid];
    if (!prev || ts(row.start_time) >= ts(prev.start_time)) {
      best[cid] = row;
    }
  }

  return list.map((item) => {
    const oid = best[String(item.id)] && best[String(item.id)]._id;
    return { ...item, promotion_order_id: oid ? String(oid) : item.promotion_order_id || '' };
  });
}

// 计算相对时间
function getTimeAgo(timestamp) {
  if (!timestamp) return '';
  
  const now = new Date();
  const time = timestamp instanceof Date ? timestamp : new Date(timestamp);
  const diff = now - time;
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) {
    return '刚刚';
  } else if (minutes < 60) {
    return `${minutes}分钟前`;
  } else if (hours < 24) {
    return `${hours}小时前`;
  } else if (days < 30) {
    return `${days}天前`;
  } else {
    const year = time.getFullYear();
    const month = String(time.getMonth() + 1).padStart(2, '0');
    const day = String(time.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}


