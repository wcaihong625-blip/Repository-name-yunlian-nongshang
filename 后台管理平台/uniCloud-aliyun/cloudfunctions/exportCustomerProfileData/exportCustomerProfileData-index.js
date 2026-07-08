'use strict';

const uniID = require('uni-id-common');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const _ = db.command;
  const uniIDIns = uniID.createInstance({ context });

  const token = safeString(event.uniIdToken || event.token || '');
  if (!token) return { code: 401, message: '请先登录' };

  try {
    const payload = await uniIDIns.checkToken(token);
    if (!payload || (payload.code !== 0 && !payload.uid) || !payload.uid) {
      return { code: 401, message: '请先登录' };
    }
  } catch (e) {
    return { code: 401, message: '登录失效，请重新登录' };
  }

  const queryList = [];

  if (event.mobile) queryList.push({ mobile: new RegExp(String(event.mobile).trim(), 'i') });
  if (event.first_sales_id) queryList.push({ first_sales_id: String(event.first_sales_id).trim() });
  if (event.current_sales_id) queryList.push({ current_sales_id: String(event.current_sales_id).trim() });
  
  if (event.member_status !== undefined && event.member_status !== null && event.member_status !== '') {
    queryList.push({ member_status: Number(event.member_status) });
  }
  
  if (event.transfer_status !== undefined && event.transfer_status !== null && event.transfer_status !== '') {
    const ts = Number(event.transfer_status);
    if (ts === 0) {
       queryList.push(_.or([{ transfer_status: 0 }, { transfer_status: _.eq(null) }]));
    } else {
       queryList.push({ transfer_status: ts });
    }
  }

  if (event.date_start && event.date_end) {
    const dStart = new Date(event.date_start);
    const dEnd = new Date(event.date_end);
    queryList.push(
      _.or([
        { created_at: _.gte(dStart).and(_.lte(dEnd)) },
        { created_at: _.gte(event.date_start).and(_.lte(event.date_end)) }
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
       const res = await db.collection('customer_profile').where(finalQuery).skip(skip).limit(MAX_LIMIT).orderBy('created_at', 'desc').get();
       if (!res.data || res.data.length === 0) break;
       allData = allData.concat(res.data);
       if (res.data.length < MAX_LIMIT) break;
       skip += MAX_LIMIT;
    }

    const list = allData.map(item => {
      function formatDate(ts) {
        if (!ts) return '-';
        const d = new Date(ts);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
      }

      let member_status_text = '未开通';
      if (item.member_status === 1) member_status_text = '已开通';
      else if (item.member_status === 2) member_status_text = '已过期';

      let transfer_status_text = item.transfer_status === 1 ? '审批中' : '正常';

      return {
        mobile: item.mobile || '',
        nickname: item.nickname || '',
        first_sales_name: item.first_sales_name || '待分配',
        current_sales_name: item.current_sales_name || '-',
        source_channel_name: item.source_channel_name || '-',
        member_status: item.member_status || 0,
        member_status_text: member_status_text,
        member_first_open_time: formatDate(item.member_first_open_time),
        member_last_renew_time: formatDate(item.member_last_renew_time),
        member_expire_time: formatDate(item.member_expire_time),
        transfer_status: item.transfer_status || 0,
        transfer_status_text: transfer_status_text,
        transfer_count: item.transfer_count || 0,
        created_at: formatDate(item.created_at)
      };
    });

    const headers = [
      'mobile', 'nickname', 'first_sales_name', 'current_sales_name', 'source_channel_name',
      'member_status_text', 'member_first_open_time', 'member_last_renew_time', 'member_expire_time',
      'transfer_status_text', 'transfer_count', 'created_at'
    ];

    const headers_zh = [
      '手机号', '昵称', '首次归属业务员', '当前服务业务员', '来源渠道',
      '会员状态', '首次开通时间', '最近续费时间', '会员过期时间',
      '转移状态', '转移次数', '创建系统时间'
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
    console.error('exportCustomerProfileData error:', e);
    return { code: 500, message: '导出失败' };
  }
};
