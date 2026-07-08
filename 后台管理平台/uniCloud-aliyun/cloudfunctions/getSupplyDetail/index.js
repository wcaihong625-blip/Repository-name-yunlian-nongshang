// 获取供应详情云函数
// 调用方式：uniCloud.callFunction({ name: 'getSupplyDetail', data: { id } })

'use strict';
const { readViewCountFromRow, buildPromotionVirtualViewMap } = require('nxt-view-count');

const SUPPLY_DETAIL_FIELDS = {
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
  images: true,
  description: true,
  desc_short: true,
  publisher: true,
  user_id: true,
  min_order_quantity: true,
  shipping_method: true,
  is_in_stock: true,
  is_origin_direct: true,
  is_long_term_supply: true,
  status: true,
  created_date: true,
  updated_date: true,
  current_view_count: true,
  view_count: true,
  views: true,
  browse_count: true,
  browseCount: true
};

const USER_VERIFY_FIELDS = {
  is_vip: true,
  member_type: true,
  vip_expire_time: true,
  isEnterpriseVerified: true,
  is_enterprise_verified: true,
  enterprise_auth_status: true,
  isRealNameVerified: true,
  real_name_verified: true,
  is_verified: true
};

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const cmd = db.command;
  const supplyCollection = db.collection('supply_list');

  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    const { id } = event;

    if (!id) {
      return res(400, '参数错误：id不能为空');
    }

    console.log('getSupplyDetail 参数:', { id });

    // 查询供应详情
    const queryRes = await supplyCollection.doc(id).field(SUPPLY_DETAIL_FIELDS).get();

    if (!queryRes.data || queryRes.data.length === 0) {
      return res(404, '供应信息不存在');
    }

    const item = queryRes.data[0];

    // 计算相对时间
    const timeAgo = getTimeAgo(item.created_date);

    const realViewCount = readViewCountFromRow(item);
    const clickAdded = 2;
    await supplyCollection.doc(id).update({
      view_count: cmd.inc(clickAdded),
      updated_date: new Date()
    });
    const updatedRealViewCount = realViewCount + clickAdded;
    const promoAddedMap = await buildPromotionVirtualViewMap(db, 'supply', [id]);
    const promoAdded = promoAddedMap[String(id)] || 0;
    const view_count = updatedRealViewCount + promoAdded;

    // 格式化数据
    const formattedData = {
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
      price_negotiable: !!item.price_negotiable,
      location: item.location,
      origin: item.origin || '',
      ship_from: item.ship_from || '',
      imageUrl: item.images && item.images.length > 0 ? item.images[0] : '/static/images/default-product.png',
      images: item.images || [],
      description: item.description,
      desc_short: item.desc_short || '',
      publisher: item.publisher,
      user_id: item.user_id,
      min_order_quantity: item.min_order_quantity || '',
      shipping_method: item.shipping_method || '',
      is_in_stock: !!item.is_in_stock,
      is_origin_direct: !!item.is_origin_direct,
      is_long_term_supply: !!item.is_long_term_supply,
      status: item.status === '审核中' || item.status === '审核失败' ? '已发布' : item.status,
      time: timeAgo,
      updateTime: timeAgo,
      created_date: item.created_date,
      updated_date: item.updated_date,
      view_count
    };

    try {
      const userRes = await db.collection('uni-id-users').doc(item.user_id).field(USER_VERIFY_FIELDS).get();
      const user = userRes && userRes.data && userRes.data[0] ? userRes.data[0] : null;
      const authRes = await db.collection('realname_auth')
        .where({ user_id: String(item.user_id || ''), status: 'verified' })
        .limit(1)
        .get();
      const realnameVerified = !!(
        (user && (user.isRealNameVerified || user.real_name_verified || user.is_verified)) ||
        (authRes.data && authRes.data.length)
      );
      let expTs = 0;
      const rawExp = user && user.vip_expire_time;
      if (rawExp instanceof Date) expTs = rawExp.getTime();
      else if (rawExp != null && rawExp !== '') {
        const t = new Date(rawExp).getTime();
        expTs = Number.isFinite(t) ? t : 0;
      }
      const enterpriseMemberActive = !!(user && user.is_vip === true && user.member_type === 'enterprise' && expTs > Date.now());
      const enterpriseVerified = enterpriseMemberActive && !!(
        user && (user.isEnterpriseVerified || user.is_enterprise_verified || user.enterprise_auth_status === 'approved')
      );
      formattedData.isRealNameVerified = realnameVerified;
      formattedData.real_name_verified = realnameVerified;
      formattedData.is_verified = realnameVerified;
      formattedData.isEnterpriseVerified = enterpriseVerified;
      formattedData.enterprise_verified = enterpriseVerified;
    } catch (_e) {}

    console.log('供应详情查询成功:', formattedData.id);

    return res(200, '获取成功', formattedData);
  } catch (err) {
    console.error('getSupplyDetail error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};

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



