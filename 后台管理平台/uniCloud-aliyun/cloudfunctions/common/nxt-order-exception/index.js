'use strict';

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/** 命中多种异常时，取主展示类型（优先级从高到低） */
const EXCEPTION_ORDER = [
  'missing_customer_id',
  'missing_customer_name',
  'missing_sales',
  'invalid_order_type',
  'settled_missing_id',
  'settled_missing_month',
  'commission_unsettled'
];

const EXCEPTION_LABELS = {
  commission_unsettled: '有提成金额但未结算',
  settled_missing_id: '已结算但缺结算单ID',
  settled_missing_month: '已结算但缺结算月份',
  missing_customer_id: '已支付但缺客户ID',
  missing_customer_name: '已支付但缺客户姓名',
  missing_sales: '已支付但缺业务员信息',
  invalid_order_type: '已支付但订单类型无效'
};

function buildSingleExceptionCondition(_, code) {
  switch (code) {
    case 'commission_unsettled':
      return _.and([{ commission_amount: _.gt(0) }, { commission_status: 0 }]);
    case 'settled_missing_id':
      return _.and([
        { commission_status: 1 },
        _.or([
          { commission_settlement_id: _.exists(false) },
          { commission_settlement_id: null },
          { commission_settlement_id: '' }
        ])
      ]);
    case 'settled_missing_month':
      return _.and([
        { commission_status: 1 },
        _.or([
          { commission_settlement_month: _.exists(false) },
          { commission_settlement_month: null },
          { commission_settlement_month: '' }
        ])
      ]);
    case 'missing_customer_id':
      return _.and([
        { order_status: 1 },
        _.or([{ customer_id: _.exists(false) }, { customer_id: null }, { customer_id: '' }])
      ]);
    case 'missing_customer_name':
      return _.and([
        { order_status: 1 },
        { customer_id: _.and(_.neq(''), _.neq(null)) },
        _.or([{ customer_name: _.exists(false) }, { customer_name: null }, { customer_name: '' }])
      ]);
    case 'missing_sales':
      return _.and([
        { order_status: 1 },
        _.or([
          _.or([{ sales_id: _.exists(false) }, { sales_id: null }, { sales_id: '' }]),
          _.or([{ sales_name: _.exists(false) }, { sales_name: null }, { sales_name: '' }])
        ])
      ]);
    case 'invalid_order_type':
      return _.and([{ order_status: 1 }, _.and([{ order_type: _.neq(1) }, { order_type: _.neq(2) }])]);
    default:
      return null;
  }
}

/** exceptionType 为空：任意一种异常 */
function buildExceptionWhere(_, exceptionType) {
  const t = safeString(exceptionType);
  if (!t) {
    const parts = EXCEPTION_ORDER.map((c) => buildSingleExceptionCondition(_, c)).filter(Boolean);
    return _.or(parts);
  }
  const one = buildSingleExceptionCondition(_, t);
  return one || _.and([{ _id: '__impossible__' }]);
}

/** 待处理：缺省、空串、pending；未关闭：待处理 + 跟进中 */
function buildHandleWhere(_, handleStatus) {
  const s = safeString(handleStatus);
  if (!s) return null;

  const pendingCond = _.or([
    { handle_status: _.exists(false) },
    { handle_status: null },
    { handle_status: '' },
    { handle_status: 'pending' }
  ]);

  if (s === 'open') {
    return _.or([pendingCond, { handle_status: 'processing' }]);
  }
  if (s === 'pending') {
    return pendingCond;
  }
  return { handle_status: s };
}

function orderMatchesException(doc, code) {
  const os = Number(doc.order_status);
  const ca = Number(doc.commission_amount) || 0;
  const cs = Number(doc.commission_status);
  const ot = doc.order_type;

  const empty = (v) => v === undefined || v === null || String(v).trim() === '';

  switch (code) {
    case 'commission_unsettled':
      return ca > 0 && cs === 0;
    case 'settled_missing_id':
      return cs === 1 && empty(doc.commission_settlement_id);
    case 'settled_missing_month':
      return cs === 1 && empty(doc.commission_settlement_month);
    case 'missing_customer_id':
      return os === 1 && empty(doc.customer_id);
    case 'missing_customer_name':
      return os === 1 && !empty(doc.customer_id) && empty(doc.customer_name);
    case 'missing_sales':
      return os === 1 && (empty(doc.sales_id) || empty(doc.sales_name));
    case 'invalid_order_type':
      return os === 1 && Number(ot) !== 1 && Number(ot) !== 2;
    default:
      return false;
  }
}

function pickPrimaryException(doc) {
  for (const c of EXCEPTION_ORDER) {
    if (orderMatchesException(doc, c)) return c;
  }
  return '';
}

function labelForException(code) {
  return EXCEPTION_LABELS[code] || code || '—';
}

module.exports = {
  safeString,
  EXCEPTION_ORDER,
  EXCEPTION_LABELS,
  buildExceptionWhere,
  buildHandleWhere,
  orderMatchesException,
  pickPrimaryException,
  labelForException
};
