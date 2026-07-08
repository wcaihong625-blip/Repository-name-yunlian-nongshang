'use strict';

const { verifyToken } = require('nxt-auth');
const { makeSearchIndexPatch, pickSearchSourceValues, SUPPLY_INDEX_FIELDS } = require('nxt-search-index');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const supplyCollection = db.collection('supply_list');
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
      title,
      category,
      specifications,
      quantity,
      unit,
      price,
      location,
      images,
      description,
      price_negotiable,
      is_in_stock,
      is_origin_direct,
      is_long_term_supply,
      min_order_quantity,
      shipping_method
    } = event;

    const negotiable =
      price_negotiable === true || price_negotiable === 'true' || price_negotiable === 1 || price_negotiable === '1';
    const priceStr = negotiable ? '面议' : price != null ? String(price).trim() : '';

    if (!title || !category || !specifications || !quantity || !unit || !location || !description) {
      return res(400, '参数错误：必填字段不能为空');
    }
    if (!negotiable && !priceStr) {
      return res(400, '请填写单价或选择价格面议');
    }

    if (!images || images.length === 0) {
      return res(400, '参数错误：至少需要上传一张产品图片');
    }

    const userRes = await usersCollection.doc(user_id).get();
    if (!userRes.data || userRes.data.length === 0) {
      return res(400, '用户不存在');
    }

    const user = userRes.data[0];
    const publisher = user.nickname || user.username || '未知用户';

    const truthy = (v) => v === true || v === 1 || v === '1' || v === 'true';
    const inStock =
      is_in_stock === undefined || is_in_stock === null ? true : truthy(is_in_stock);

    const supplyData = {
      title: title.trim(),
      category: category.trim(),
      specifications: specifications.trim(),
      quantity: quantity.trim(),
      unit: unit.trim(),
      price: priceStr,
      location: location.trim(),
      images: Array.isArray(images) ? images : [],
      description: description.trim(),
      user_id: user_id,
      publisher: publisher,
      status: '已发布',
      price_negotiable: negotiable,
      is_in_stock: inStock,
      is_origin_direct: truthy(is_origin_direct),
      is_long_term_supply: truthy(is_long_term_supply),
      min_order_quantity: min_order_quantity != null ? String(min_order_quantity).trim() : '',
      shipping_method: shipping_method != null ? String(shipping_method).trim() : '',
      view_count: 0,
      created_date: new Date(),
      updated_date: new Date()
    };
    Object.assign(supplyData, makeSearchIndexPatch(pickSearchSourceValues(supplyData, SUPPLY_INDEX_FIELDS)));

    const insertRes = await supplyCollection.add(supplyData);

    if (insertRes.id) {
      return res(200, '发布成功', {
        id: insertRes.id,
        ...supplyData
      });
    } else {
      return res(500, '发布失败，请重试');
    }
  } catch (err) {
    console.error('publishSupply error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
