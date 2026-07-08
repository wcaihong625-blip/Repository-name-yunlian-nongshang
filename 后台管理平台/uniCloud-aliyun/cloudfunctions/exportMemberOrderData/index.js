'use strict';

const { verifyToken } = require('nxt-auth');
const { batchSalesCodeByStaffId } = require('nxt-sales-staff');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const _ = db.command;

  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }
  const uid = tokenResult.userId;

  if (event.user_id && String(event.user_id) !== String(uid)) {
    return { code: 403, message: '身份校验失败' };
  }

  const queryList = [];

  if (event.mobile) queryList.push({ mobile: new RegExp(String(event.mobile).trim(), 'i') });
  const custId = safeString(event.customer_id);
  if (custId) queryList.push({ customer_id: custId });
  const orderId = safeString(event.order_id);
  if (orderId) queryList.push({ _id: orderId });
  if (event.sales_id) queryList.push({ sales_id: String(event.sales_id).trim() });
  if (event.sales_name) queryList.push({ sales_name: new RegExp(String(event.sales_name).trim(), 'i') });
  
  if (event.order_type !== undefined && event.order_type !== null && event.order_type !== '') {
    queryList.push({ order_type: Number(event.order_type) });
  }
  const orderScene = safeString(event.order_scene);
  if (orderScene) {
    queryList.push({ order_scene: orderScene });
  }
  if (event.order_status !== undefined && event.order_status !== null && event.order_status !== '') {
    const ost = Number(event.order_status);
    if (ost === 2) {
      queryList.push(_.or([{ order_status: 2 }, { pay_status: 2 }]));
    } else {
      queryList.push({ order_status: ost });
    }
  }
  if (event.commission_status !== undefined && event.commission_status !== null && event.commission_status !== '') {
    queryList.push({ commission_status: Number(event.commission_status) });
  }
  const csm = safeString(event.commission_settlement_month);
  if (csm) {
    queryList.push({ commission_settlement_month: csm });
  }
  if (event.date_start && event.date_end) {
    const dStart = new Date(event.date_start);
    const dEnd = new Date(event.date_end);
    queryList.push(
      _.or([
        { pay_time: _.gte(dStart).and(_.lte(dEnd)) },
        { pay_time: _.gte(event.date_start).and(_.lte(event.date_end)) }
      ])
    );
  }

  const ex = safeString(event.exception_type);
  if (ex === 'commission_unsettled') {
    queryList.push(_.and([{ commission_amount: _.gt(0) }, { commission_status: 0 }]));
  } else if (ex === 'settled_missing_id') {
    queryList.push(
      _.and([
        { commission_status: 1 },
        _.or([
          { commission_settlement_id: _.exists(false) },
          { commission_settlement_id: null },
          { commission_settlement_id: '' }
        ])
      ])
    );
  } else if (ex === 'settled_missing_month') {
    queryList.push(
      _.and([
        { commission_status: 1 },
        _.or([
          { commission_settlement_month: _.exists(false) },
          { commission_settlement_month: null },
          { commission_settlement_month: '' }
        ])
      ])
    );
  } else if (ex === 'missing_customer_id') {
    queryList.push(
      _.and([
        { order_status: 1 },
        _.or([{ customer_id: _.exists(false) }, { customer_id: null }, { customer_id: '' }])
      ])
    );
  } else if (ex === 'missing_customer_name') {
    queryList.push(
      _.and([
        { order_status: 1 },
        { customer_id: _.and(_.neq(''), _.neq(null)) },
        _.or([{ customer_name: _.exists(false) }, { customer_name: null }, { customer_name: '' }])
      ])
    );
  } else if (ex === 'missing_sales') {
    queryList.push(
      _.and([
        { order_status: 1 },
        _.or([
          _.or([{ sales_id: _.exists(false) }, { sales_id: null }, { sales_id: '' }]),
          _.or([{ sales_name: _.exists(false) }, { sales_name: null }, { sales_name: '' }])
        ])
      ])
    );
  } else if (ex === 'invalid_order_type') {
    queryList.push(
      _.and([
        { order_status: 1 },
        _.and([{ order_type: _.neq(1) }, { order_type: _.neq(2) }])
      ])
    );
  }

  let finalQuery = {};
  if (queryList.length > 0) {
    finalQuery = _.and(queryList);
  }

  try {
    const MAX_LIMIT = 1000;
    let allData = [];
    let skip = 0;
    while(true) {
       const res = await db.collection('member_order').where(finalQuery).skip(skip).limit(MAX_LIMIT).orderBy('created_at', 'desc').get();
       if (!res.data || res.data.length === 0) break;
       allData = allData.concat(res.data);
       if (res.data.length < MAX_LIMIT) break;
       skip += MAX_LIMIT;
    }

    const sidList = [];
    for (const item of allData) {
      if (item.sales_id) sidList.push(item.sales_id);
    }
    const salesCodeMap = await batchSalesCodeByStaffId(db, sidList);

    const list = allData.map(item => {
      function formatDate(ts) {
        if (!ts) return '-';
        const d = new Date(ts);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      }

      let order_type_text = '未知';
      if (item.order_type === 1) order_type_text = '首开';
      else if (item.order_type === 2) order_type_text = '续费';
      else if (item.order_type === 3) order_type_text = '类型升级';
      else if (item.order_type === 4) order_type_text = '周期升级';
      let order_scene_text = '-';
      if (item.order_scene === 'new') order_scene_text = '新开通';
      else if (item.order_scene === 'renew') order_scene_text = '续费';
      else if (item.order_scene === 'upgrade_plan') order_scene_text = '周期升级';
      else if (item.order_scene === 'upgrade_member_type') order_scene_text = '类型升级';
      const memberTypeText = (v) => (v === 'enterprise' ? '企业' : v === 'personal' ? '个人' : '-');
      const planTypeText = (v) => (v === 'year' ? '年卡' : v === 'quarter' ? '季卡' : v === 'month' ? '月卡' : '-');
      const upgrade_path_text =
        item.order_scene === 'upgrade_member_type'
          ? `${memberTypeText(item.from_member_type)}→${memberTypeText(item.to_member_type)}`
          : item.order_scene === 'upgrade_plan'
            ? `${planTypeText(item.from_plan_type)}→${planTypeText(item.to_plan_type)}`
            : '-';
      
      let order_status_text = '未知';
      if (item.order_status === 0) order_status_text = '待支付';
      else if (item.order_status === 1) order_status_text = '支付成功';
      else if (item.order_status === 2) order_status_text = '已取消';

      let commission_status_text = item.commission_status === 1 ? '已结算' : '未结算';
      
      let commission_type_text = item.commission_type;
      if (item.commission_type === 'first_open') commission_type_text = '首开提成';
      else if (item.commission_type === 'renewal') commission_type_text = '续费提成';

      let currentRate = Number(item.commission_rate) || 0;
      let displayRate = Number((currentRate * 100).toFixed(2));

      const sid = item.sales_id ? String(item.sales_id).trim() : '';
      return {
        order_no: item.order_no || '',
        mobile: item.mobile || '',
        order_type: item.order_type,
        order_type_text: order_type_text,
        order_scene: safeString(item.order_scene),
        order_scene_text,
        from_member_type: safeString(item.from_member_type),
        to_member_type: safeString(item.to_member_type),
        from_plan_type: safeString(item.from_plan_type),
        to_plan_type: safeString(item.to_plan_type),
        upgrade_path_text,
        order_status: item.order_status,
        order_status_text: order_status_text,
        pay_amount: item.pay_amount || 0,
        original_amount: item.original_amount || 0,
        member_days: item.member_days || 0,
        pay_time: formatDate(item.pay_time),
        first_sales_name: item.first_sales_name || '',
        sales_staff_code: sid ? salesCodeMap[sid] || '' : '',
        sales_name: item.sales_name || '',
        channel_name: item.channel_name || '',
        commission_type: item.commission_type || '',
        commission_type_text: commission_type_text || '',
        commission_rate: displayRate,
        commission_amount: item.commission_amount || 0,
        commission_status: item.commission_status,
        commission_status_text: commission_status_text,
        commission_settlement_id: safeString(item.commission_settlement_id),
        commission_settlement_month: safeString(item.commission_settlement_month),
        commission_settle_time: formatDate(item.commission_settle_time),
        created_at: formatDate(item.created_at)
      };
    });

    const headers = [
      'order_no', 'mobile', 'order_type_text', 'order_scene_text', 'upgrade_path_text', 'order_status_text', 'pay_amount', 'original_amount',
      'member_days', 'pay_time', 'first_sales_name', 'sales_staff_code', 'sales_name', 'channel_name', 
      'commission_type_text', 'commission_rate', 'commission_amount', 
      'commission_status_text', 'commission_settlement_id', 'commission_settlement_month',
      'commission_settle_time', 'created_at'
    ];

    const headers_zh = [
      '订单号', '用户手机号', '订单类型', '订单场景', '升级路径', '支付状态', '支付金额', '原价金额', 
      '购买天数', '支付时间', '首次归属业务员', '提成业务员编号', '现提成业务员', '来源渠道', 
      '提成类型', '提成比例(%)', '提成金额', '结算状态', '提成结算单ID', '提成结算月份',
      '结算审批时间', '创建时间'
    ];

    return {
      code: 200,
      message: '导出成功',
      data: {
        headers,
        headers_zh,
        list
      }
    };
  } catch (e) {
    console.error('exportMemberOrderData error:', e);
    return { code: 500, message: '导出失败' };
  }
};
