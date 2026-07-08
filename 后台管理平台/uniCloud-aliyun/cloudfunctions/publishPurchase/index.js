'use strict';

const { verifyToken } = require('nxt-auth');
const { makeSearchIndexPatch, pickSearchSourceValues, PURCHASE_INDEX_FIELDS } = require('nxt-search-index');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const purchaseCollection = db.collection('purchase_list');
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
      address,
      remarks,
      urgency,
      is_urgent,
      is_long_term,
      deadline,
      price_negotiable,
      settlement_type,
      need_invoice
    } = event;

    const negotiable = price_negotiable === true || price_negotiable === 'true' || price_negotiable === 1;
    const priceStr = negotiable ? '面议' : (price != null ? String(price).trim() : '');

    if (!title || !category || !specifications || !quantity || !unit || !address) {
      return res(400, '参数错误：必填字段不能为空');
    }
    if (!negotiable && !priceStr) {
      return res(400, '请填写期望单价或选择价格面议');
    }

    const userRes = await usersCollection.doc(user_id).get();
    if (!userRes.data || userRes.data.length === 0) {
      return res(400, '用户不存在');
    }

    const user = userRes.data[0];
    const publisher = user.nickname || user.username || '未知用户';

    const urgentFlag = !!(is_urgent === true || is_urgent === 'true' || is_urgent === 1 || is_urgent === '1');
    const longTermFlag = !!(is_long_term === true || is_long_term === 'true' || is_long_term === 1 || is_long_term === '1');

    const purchaseData = {
      title: title.trim(),
      category: category.trim(),
      specifications: specifications.trim(),
      quantity: quantity.trim(),
      unit: unit.trim(),
      price: priceStr,
      address: address.trim(),
      remarks: remarks ? remarks.trim() : '',
      user_id: user_id,
      publisher: publisher,
      status: '已发布',
      urgency: urgency || (urgentFlag ? 'Urgent' : 'Normal'),
      is_urgent: urgentFlag,
      is_long_term: longTermFlag,
      deadline: deadline != null && String(deadline).trim() !== '' ? String(deadline).trim() : '',
      price_negotiable: negotiable,
      settlement_type: settlement_type != null ? String(settlement_type).trim() : '',
      need_invoice: need_invoice != null ? String(need_invoice).trim() : '',
      view_count: 0,
      created_date: new Date(),
      updated_date: new Date()
    };
    Object.assign(purchaseData, makeSearchIndexPatch(pickSearchSourceValues(purchaseData, PURCHASE_INDEX_FIELDS)));

    const insertRes = await purchaseCollection.add(purchaseData);

    if (insertRes.id) {
      return res(200, '发布成功', {
        id: insertRes.id,
        ...purchaseData
      });
    } else {
      return res(500, '发布失败，请重试');
    }
  } catch (err) {
    console.error('publishPurchase error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
