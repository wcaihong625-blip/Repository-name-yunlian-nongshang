'use strict';

const { verifyToken } = require('nxt-auth');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

/**
 * 结算月份导出为「YYYY年MM月」，避免 Excel/WPS 将 2026-04 识别为日期显示成 Apr-26
 */
function formatSettleMonthForCsv(raw) {
  const s = safeString(raw);
  if (!s) return '';
  if (/^\d{4}年\d{2}月$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/);
  if (m) {
    const y = m[1];
    const mo = parseInt(m[2], 10);
    if (mo >= 1 && mo <= 12) {
      const mm = mo < 10 ? `0${mo}` : String(mo);
      return `${y}年${mm}月`;
    }
  }
  return `月份：${s}`;
}

function safeNumber(value) {
  return value === undefined || value === null || isNaN(value) ? 0 : Number(value);
}

function formatDateTime(v) {
  if (v === undefined || v === null || v === '') return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** 与产品导出约定：0 未结算、1 已结算；2 部分结算 */
function settleStatusText(status) {
  const s = Number(status);
  if (s === 0) return '未结算';
  if (s === 1) return '已结算';
  if (s === 2) return '部分结算';
  return '';
}

/**
 * 结算单列表导出：查询条件与 getCommissionSettleList 一致（当前筛选结果，不分页上限内全量）
 */
module.exports = async (event, context) => {
  const db = uniCloud.database();
  const _ = db.command;

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  const settleMonth = safeString(event.settle_month);
  const settleId = safeString(event.settle_id);
  const salesId = safeString(event.sales_id);
  const salesName = safeString(event.sales_name);
  const settleStatus =
    event.settle_status !== undefined && event.settle_status !== null && event.settle_status !== ''
      ? parseInt(event.settle_status, 10)
      : null;

  const MAX_EXPORT = 8000;

  try {
    const query = {};
    if (settleId) query._id = settleId;
    if (settleMonth) query.settle_month = settleMonth;
    if (salesId) query.sales_id = salesId;
    if (salesName) query.sales_name = new RegExp(salesName, 'i');
    if (!Number.isNaN(settleStatus) && settleStatus !== null) query.settle_status = settleStatus;

    const listRes = await db
      .collection('sales_commission_settle')
      .where(query)
      .orderBy('created_at', 'desc')
      .limit(MAX_EXPORT)
      .get();

    const raw = listRes.data || [];

    const headers = [
      'settle_month',
      'sales_name',
      'sales_id',
      'order_count',
      'first_open_count',
      'renewal_count',
      'commission_total',
      'commission_paid',
      'commission_unpaid',
      'settle_status_text',
      'settled_at',
      'remark',
      'created_at',
      '_id'
    ];

    const headers_zh = [
      '结算月份',
      '业务员姓名',
      '业务员ID',
      '订单数',
      '首开单数',
      '续费单数',
      '提成总额',
      '已结金额',
      '未结金额',
      '结算状态',
      '确认结算时间',
      '备注',
      '创建时间',
      '结算单ID'
    ];

    const list = raw.map((item) => ({
      settle_month: formatSettleMonthForCsv(item.settle_month),
      sales_name: safeString(item.sales_name),
      sales_id: safeString(item.sales_id),
      order_count: safeNumber(item.order_count),
      first_open_count: safeNumber(item.first_open_count),
      renewal_count: safeNumber(item.renewal_count),
      commission_total: safeNumber(item.commission_total).toFixed(2),
      commission_paid: safeNumber(item.commission_paid).toFixed(2),
      commission_unpaid: safeNumber(item.commission_unpaid).toFixed(2),
      settle_status_text: settleStatusText(item.settle_status),
      settled_at: formatDateTime(item.settled_at),
      remark: safeString(item.remark).replace(/\r|\n/g, ' '),
      created_at: formatDateTime(item.created_at),
      _id: safeString(item._id)
    }));

    return {
      code: 200,
      message: '导出成功',
      data: {
        headers,
        headers_zh,
        list,
        exported_count: list.length,
        max_export: MAX_EXPORT,
        truncated: raw.length >= MAX_EXPORT
      }
    };
  } catch (e) {
    console.error('exportCommissionSettleData error:', e);
    return { code: 500, message: e.message || '导出数据失败' };
  }
};

