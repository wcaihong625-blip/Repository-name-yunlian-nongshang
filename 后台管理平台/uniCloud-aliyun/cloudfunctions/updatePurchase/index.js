// 更新采购信息云函数
// 调用方式：uniCloud.callFunction({ name: 'updatePurchase', data: { token, id, ... } })

'use strict';

const { verifyToken } = require('nxt-auth');
const { makeSearchIndexPatch, pickSearchSourceValues, PURCHASE_INDEX_FIELDS } = require('nxt-search-index');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const purchaseCollection = db.collection('purchase_list');

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
      address,
      remarks,
      is_urgent,
      is_long_term,
      deadline,
      price_negotiable,
      settlement_type,
      need_invoice,
      urgency
    } = event;

    // 参数验证
    if (!id) {
      return res(400, '参数错误：采购ID不能为空');
    }

    const negotiable = price_negotiable === true || price_negotiable === 'true' || price_negotiable === 1 || price_negotiable === '1';
    const priceStr = negotiable ? '面议' : (price != null ? String(price).trim() : '');

    if (!title || !category || !specifications || !quantity || !unit || !address) {
      return res(400, '参数错误：必填字段不能为空');
    }
    if (!negotiable && !priceStr) {
      return res(400, '请填写期望单价或选择价格面议');
    }

    // 查询该采购信息，验证归属
    const purchaseRes = await purchaseCollection.doc(id).get();
    if (!purchaseRes.data || purchaseRes.data.length === 0) {
      return res(404, '采购信息不存在');
    }

    const purchase = purchaseRes.data[0];
    if (purchase.user_id !== user_id) {
      return res(403, '无权修改此采购信息');
    }

    // 构建更新数据
    const updateData = {
      title: title.trim(),
      category: category.trim(),
      specifications: specifications.trim(),
      quantity: String(quantity).trim(),
      unit: unit.trim(),
      price: priceStr,
      address: address.trim(),
      remarks: remarks ? String(remarks).trim() : '',
      urgency: urgency || ((is_urgent === true || is_urgent === 'true' || is_urgent === 1 || is_urgent === '1') ? 'Urgent' : 'Normal'),
      is_urgent: !!(is_urgent === true || is_urgent === 'true' || is_urgent === 1 || is_urgent === '1'),
      is_long_term: !!(is_long_term === true || is_long_term === 'true' || is_long_term === 1 || is_long_term === '1'),
      deadline: deadline != null && String(deadline).trim() !== '' ? String(deadline).trim() : '',
      price_negotiable: negotiable,
      settlement_type: settlement_type != null ? String(settlement_type).trim() : '',
      need_invoice: need_invoice != null ? String(need_invoice).trim() : '',
      updated_date: new Date()
    };
    Object.assign(updateData, makeSearchIndexPatch(pickSearchSourceValues(updateData, PURCHASE_INDEX_FIELDS)));

    // 更新数据库
    await purchaseCollection.doc(id).update(updateData);

    return res(200, '修改成功', {
      id: id,
      ...updateData
    });

  } catch (err) {
    console.error('updatePurchase error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
