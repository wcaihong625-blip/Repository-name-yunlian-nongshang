// 更新供应信息云函数
// 调用方式：uniCloud.callFunction({ name: 'updateSupply', data: { token, id, ... } })

'use strict';

const { verifyToken } = require('nxt-auth');
const { makeSearchIndexPatch, pickSearchSourceValues, SUPPLY_INDEX_FIELDS } = require('nxt-search-index');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const supplyCollection = db.collection('supply_list');

  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    // 验证 token 并获取 user_id
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '未登录，请先登录');
    }
    const user_id = tokenResult.userId;

    const {
      id,
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

    // 参数验证
    if (!id) {
      return res(400, '参数错误：供应ID不能为空');
    }

    const truthy = (v) => v === true || v === 1 || v === '1' || v === 'true';
    const negotiable = truthy(price_negotiable);
    const priceStr = negotiable ? '面议' : (price != null ? String(price).trim() : '');

    if (!title || !category || !specifications || !quantity || !unit || !location || !description) {
      return res(400, '参数错误：必填字段不能为空');
    }
    if (!negotiable && !priceStr) {
      return res(400, '请填写单价或选择价格面议');
    }

    if (!images || images.length === 0) {
      return res(400, '参数错误：至少需要上传一张产品图片');
    }

    // 查询该供应信息，验证归属
    const supplyRes = await supplyCollection.doc(id).get();
    if (!supplyRes.data || supplyRes.data.length === 0) {
      return res(404, '供应信息不存在');
    }

    const supply = supplyRes.data[0];
    if (supply.user_id !== user_id) {
      return res(403, '无权修改此供应信息');
    }

    // 构建更新数据
    const updateData = {
      title: title.trim(),
      category: category.trim(),
      specifications: specifications.trim(),
      quantity: String(quantity).trim(),
      unit: unit.trim(),
      price: priceStr,
      location: location.trim(),
      images: Array.isArray(images) ? images : [],
      description: description.trim(),
      price_negotiable: negotiable,
      is_in_stock: is_in_stock === undefined || is_in_stock === null ? true : truthy(is_in_stock),
      is_origin_direct: truthy(is_origin_direct),
      is_long_term_supply: truthy(is_long_term_supply),
      min_order_quantity: min_order_quantity != null ? String(min_order_quantity).trim() : '',
      shipping_method: shipping_method != null ? String(shipping_method).trim() : '',
      updated_date: new Date()
    };
    Object.assign(updateData, makeSearchIndexPatch(pickSearchSourceValues(updateData, SUPPLY_INDEX_FIELDS)));

    // 更新数据库
    await supplyCollection.doc(id).update(updateData);

    return res(200, '修改成功', {
      id: id,
      ...updateData
    });

  } catch (err) {
    console.error('updateSupply error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
