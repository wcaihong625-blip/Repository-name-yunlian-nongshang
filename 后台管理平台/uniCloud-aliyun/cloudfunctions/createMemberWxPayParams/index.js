'use strict';

const { verifyToken } = require('nxt-auth');
const { applyMemberOrderPaidCore } = require('nxt-member-order-apply-paid');
const fs = require('fs');
const path = require('path');
const DEBUG_MARKER = 'CMWPP_DEBUG_20260414_V1';

function normalizePayParams(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (typeof raw.errCode === 'number' && raw.errCode !== 0) return null;
  if (raw.payParams && typeof raw.payParams === 'object') return raw.payParams;
  if (raw.payment && typeof raw.payment === 'object') return raw.payment;
  if (raw.orderInfo && typeof raw.orderInfo === 'object') return raw.orderInfo;
  if (raw.order && typeof raw.order === 'object') return raw.order;
  if (raw.data && typeof raw.data === 'object') {
    if (raw.data.payParams) return raw.data.payParams;
    if (raw.data.payment) return raw.data.payment;
    if (raw.data.orderInfo) return raw.data.orderInfo;
    if (raw.data.order && typeof raw.data.order === 'object') return raw.data.order;
  }
  return null;
}

function toCent(amountYuan) {
  const n = Number(amountYuan);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function isDevEnv() {
  return process.env.NODE_ENV !== 'production';
}

function resolveNotifyUrl(config) {
  if (!config || typeof config !== 'object') return '';
  const notifyUrl = config.notifyUrl;
  if (typeof notifyUrl === 'string') return notifyUrl;
  if (notifyUrl && typeof notifyUrl === 'object') {
    const spaceId = process.env.UNI_CLOUD_SPACE_ID || '';
    if (spaceId && typeof notifyUrl[spaceId] === 'string') return notifyUrl[spaceId];
    const firstKey = Object.keys(notifyUrl)[0];
    if (firstKey && typeof notifyUrl[firstKey] === 'string') return notifyUrl[firstKey];
  }
  return '';
}

function resolveSpaceIdFromConfig(config) {
  const envSpaceId = process.env.UNI_CLOUD_SPACE_ID || '';
  if (envSpaceId) return envSpaceId;
  const notifyUrl = config && config.notifyUrl;
  if (notifyUrl && typeof notifyUrl === 'object') {
    const firstKey = Object.keys(notifyUrl)[0] || '';
    if (firstKey) return firstKey;
  }
  return '';
}

function parseOrderRemarkMeta(remark) {
  try {
    if (remark && typeof remark === 'string' && remark.trim().startsWith('{')) {
      const o = JSON.parse(remark);
      const tier = o.member_tier === 'enterprise' ? 'enterprise' : 'personal';
      const pk = ['month', 'quarter', 'year'].includes(String(o.plan_key)) ? String(o.plan_key) : 'month';
      const orderScene = ['new', 'renew', 'upgrade_plan', 'upgrade_member_type'].includes(String(o.order_scene))
        ? String(o.order_scene)
        : '';
      return {
        member_tier: tier,
        plan_key: pk,
        order_scene: orderScene,
        from_plan_type: ['month', 'quarter', 'year'].includes(String(o.from_plan_type || o.from_plan_key))
          ? String(o.from_plan_type || o.from_plan_key)
          : '',
        to_plan_type: ['month', 'quarter', 'year'].includes(String(o.to_plan_type || o.to_plan_key))
          ? String(o.to_plan_type || o.to_plan_key)
          : pk,
        from_member_type: ['personal', 'enterprise'].includes(String(o.from_member_type || o.from_member_tier))
          ? String(o.from_member_type || o.from_member_tier)
          : tier,
        to_member_type: ['personal', 'enterprise'].includes(String(o.to_member_type || o.member_tier))
          ? String(o.to_member_type || o.member_tier)
          : tier
      };
    }
  } catch (_e) {
    /* ignore */
  }
  return {
    member_tier: 'personal',
    plan_key: 'month',
    order_scene: 'new',
    from_plan_type: '',
    to_plan_type: 'month',
    from_member_type: 'personal',
    to_member_type: 'personal'
  };
}

function normalizeMemberType(v) {
  return String(v || '').trim() === 'enterprise' ? 'enterprise' : 'personal';
}

function normalizePlanType(v, fallback) {
  const s = String(v || '').trim();
  if (s === 'month' || s === 'quarter' || s === 'year') return s;
  return fallback || 'month';
}

function normalizeOptionalPlanType(v) {
  const s = String(v || '').trim();
  if (s === 'month' || s === 'quarter' || s === 'year') return s;
  return '';
}

function normalizeScene(v) {
  const s = String(v || '').trim();
  if (s === 'renew' || s === 'upgrade_plan' || s === 'upgrade_member_type') return s;
  return 'new';
}

function buildPayTitle(meta) {
  const mt = meta.to_member_type === 'enterprise' ? '企业会员' : '个人会员';
  const plan = meta.to_plan_type === 'quarter' ? '季卡' : meta.to_plan_type === 'year' ? '年卡' : '月卡';
  if (meta.order_scene === 'upgrade_member_type') return '云链农商会员类型升级';
  if (meta.order_scene === 'upgrade_plan') return `云链农商${mt}周期升级`;
  if (meta.order_scene === 'renew') return `云链农商${mt}${plan}续费`;
  return `云链农商${mt}${plan}开通`;
}

function loadUniPayConfig() {
  const pluginRoot = path.join(__dirname, '..', 'common', 'uni-config-center', 'uni-pay');
  const hasConfigJs = fs.existsSync(path.join(pluginRoot, 'config.js'));
  const hasConfigJson = fs.existsSync(path.join(pluginRoot, 'config.json'));

  // 1) 优先 uni-config-center
  try {
    const createConfig = require('uni-config-center');
    const configCenter = createConfig({ pluginId: 'uni-pay' });
    const cfg = typeof configCenter.config === 'function' ? configCenter.config() : null;
    if (cfg && typeof cfg === 'object' && Object.keys(cfg).length > 0) {
      return { config: cfg, source: 'uni-config-center' };
    }
    console.warn('[createMemberWxPayParams] uni-config-center 返回空配置', {
      pluginId: 'uni-pay',
      pluginRoot,
      hasConfigJs,
      hasConfigJson
    });
  } catch (_e) {
    console.error('[createMemberWxPayParams] uni-config-center 未安装/未打包，尝试走本地配置兜底', {
      message: _e && _e.message,
      pluginId: 'uni-pay',
      pluginRoot,
      hasConfigJs,
      hasConfigJson
    });
  }

  // 2) 文件兜底：common/uni-config-center/uni-pay/config.js
  const configPath = path.join(__dirname, '..', 'common', 'uni-config-center', 'uni-pay', 'config.js');
  if (fs.existsSync(configPath)) {
    try {
      delete require.cache[require.resolve(configPath)];
      const cfg = require(configPath);
      if (cfg && typeof cfg === 'object') {
        return { config: cfg, source: 'local-file' };
      }
    } catch (err) {
      return { config: null, source: 'local-file', error: err.message };
    }
  }

  return { config: null, source: 'none' };
}

async function getUserWxOpenid(db, userId) {
  if (!userId) return '';
  const userRes = await db.collection('uni-id-users').doc(userId).get();
  const user = userRes && userRes.data && userRes.data[0] ? userRes.data[0] : null;
  if (!user) return '';
  const wxOpenid = user.wx_openid || user.wxOpenid || '';
  return typeof wxOpenid === 'string' ? wxOpenid.trim() : '';
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const memberOrderCollection = db.collection('member_order');
  const res = (code, message, data) => ({ code, message, data: data || null });
  const debugState = {
    order_id: '',
    coupon_code: '',
    pay_amount: null
  };

  try {
    console.log('[createMemberWxPayParams] start', {
      debugMarker: DEBUG_MARKER,
      requestId: context && context.requestId,
      spaceId: process.env.UNI_CLOUD_SPACE_ID || '',
      provider: process.env.UNI_CLOUD_PROVIDER || '',
      platform: context && context.PLATFORM,
      eventKeys: event ? Object.keys(event) : []
    });

    const auth = await verifyToken(event, context);
    if (!auth.success) return res(401, auth.error || '登录状态无效');

    const resumeOrderId = String(event.resume_order_id || event.resume_orderId || '').trim();

    const scene = normalizeScene(event.scene);
    const memberType = normalizeMemberType(event.member_type);
    const planType = normalizePlanType(event.plan_type, 'month');
    const fromPlanType = normalizeOptionalPlanType(event.from_plan_type);
    const toPlanType = normalizePlanType(event.to_plan_type, planType);
    const couponCode = String(event.coupon_code || event.code || '').trim();
    const couponId = String(event.coupon_id || event.coupon_code_id || '').trim();
    debugState.coupon_code = couponCode;
    console.log('[createMemberWxPayParams] coupon received', {
      coupon_code: couponCode,
      coupon_id: couponId,
      has_coupon: !!(couponCode || couponId)
    });

    const cfgResult = loadUniPayConfig();
    const uniPayConfig = cfgResult.config || {};
    const topKeys = Object.keys(uniPayConfig);
    const hasWxpay = !!(uniPayConfig && typeof uniPayConfig.wxpay === 'object');
    const hasWxpayMp = !!(hasWxpay && uniPayConfig.wxpay && typeof uniPayConfig.wxpay.mp === 'object');
    const notifyUrl = resolveNotifyUrl(uniPayConfig);
    const hasNotifyUrl = !!notifyUrl;
    if (isDevEnv()) {
      console.log('[createMemberWxPayParams] uni-pay config check', {
        source: cfgResult.source,
        hasConfig: !!cfgResult.config,
        topKeys,
        hasWxpay,
        hasWxpayMp,
        hasNotifyUrl,
        readError: cfgResult.error || ''
      });
    }

    if (isDevEnv()) {
      console.log('[createMemberWxPayParams] notifyUrl exists', { hasNotifyUrl: !!notifyUrl });
    }

    let orderData;
    let orderMeta = null;
    if (resumeOrderId) {
      const docRes = await memberOrderCollection.doc(resumeOrderId).get();
      const existing = docRes.data && docRes.data[0];
      if (!existing) {
        return res(404, '订单不存在');
      }
      if (String(existing.user_id) !== String(auth.userId)) {
        return res(403, '无权操作该订单');
      }
      const ps = Number(existing.pay_status || 0);
      const os = Number(existing.order_status || 0);
      if (ps === 1 || os === 1) {
        return res(400, '该订单已支付');
      }
      if (ps === 2 || os === 2) {
        return res(400, '订单已失效，请重新下单');
      }

      const cmd = db.command;
      const orderNos = Array.from(
        new Set(
          [existing.order_no, existing.out_trade_no, existing.pay_order_no]
            .map((v) => String(v || '').trim())
            .filter(Boolean)
        )
      );
      const payOrderOr = [{ 'custom.member_order_id': existing._id }, { member_order_id: existing._id }, { biz_order_id: existing._id }];
      if (orderNos.length) {
        payOrderOr.push({ out_trade_no: cmd.in(orderNos) });
        payOrderOr.push({ order_no: cmd.in(orderNos) });
      }
      const paidPayOrderRes = await db
        .collection('uni-pay-orders')
        .where(
          cmd.and([
            { status: 1 },
            cmd.or(payOrderOr)
          ])
        )
        .orderBy('pay_date', 'desc')
        .limit(1)
        .get();
      const paidPayOrder = paidPayOrderRes.data && paidPayOrderRes.data[0];
      if (paidPayOrder) {
        console.log('[createMemberWxPayParams] resume found paid order, start repair', {
          out_trade_no: paidPayOrder.out_trade_no,
          member_order_id: existing._id,
          biz_type: paidPayOrder.custom && paidPayOrder.custom.biz_type
        });
        const repairResult = await applyMemberOrderPaidCore({
          db,
          orderId: existing._id,
          payPayload: {
            out_trade_no: paidPayOrder.out_trade_no,
            transaction_id: paidPayOrder.transaction_id,
            pay_order_no: paidPayOrder.out_trade_no,
            pay_channel: paidPayOrder.provider || 'wxpay',
            pay_time: paidPayOrder.pay_date || new Date(),
            pay_callback_time: paidPayOrder.notify_date || new Date(),
            paid_amount:
              paidPayOrder.total_fee != null && !isNaN(Number(paidPayOrder.total_fee))
                ? Number((Number(paidPayOrder.total_fee) / 100).toFixed(2))
                : undefined
          }
        });
        if (!repairResult.ok) {
          console.error('[createMemberWxPayParams] resume repair failed', {
            out_trade_no: paidPayOrder.out_trade_no,
            member_order_id: existing._id,
            code: repairResult.code,
            message: repairResult.message
          });
          return res(500, repairResult.message || '支付成功但业务同步失败，请稍后重试');
        }
        return res(409, '该订单已支付，已自动同步会员状态', {
          order_id: existing._id,
          order_no: existing.order_no,
          repaired: true,
          out_trade_no: paidPayOrder.out_trade_no
        });
      }

      const meta = parseOrderRemarkMeta(existing.remark);
      const sceneFromOrder = String(existing.order_scene || meta.order_scene || '').trim();
      orderMeta = {
        order_scene: ['new', 'renew', 'upgrade_plan', 'upgrade_member_type'].includes(sceneFromOrder) ? sceneFromOrder : 'new',
        from_member_type: existing.from_member_type || meta.from_member_type || meta.member_tier || 'personal',
        to_member_type: existing.to_member_type || existing.member_type || meta.to_member_type || meta.member_tier || 'personal',
        from_plan_type: existing.from_plan_type || meta.from_plan_type || '',
        to_plan_type: existing.to_plan_type || existing.plan_type || meta.to_plan_type || meta.plan_key || 'month'
      };
      orderData = {
        order_id: existing._id,
        order_no: existing.order_no,
        pay_amount: existing.pay_amount,
        original_amount: existing.original_amount,
        discount_amount: existing.discount_amount
      };
    } else {
      const commonCreateData = {
        uniIdToken: event.uniIdToken || event.uni_id_token || event.token || '',
        token: event.uniIdToken || event.uni_id_token || event.token || '',
        sales_id: event.sales_id || '',
        channel_id: event.channel_id || '',
        invite_code: event.invite_code || '',
        pay_channel: 'wxpay',
        source_type: event.source_type || 'mini_program'
      };
      let pendingResult = null;
      if (scene === 'upgrade_plan') {
        pendingResult = await uniCloud.callFunction({
          name: 'createPlanPeriodUpgradeOrder',
          data: {
            ...commonCreateData,
            target_plan_key: toPlanType
          }
        });
        orderMeta = {
          order_scene: 'upgrade_plan',
          from_member_type: memberType,
          to_member_type: memberType,
          from_plan_type: fromPlanType || '',
          to_plan_type: toPlanType
        };
      } else if (scene === 'upgrade_member_type') {
        pendingResult = await uniCloud.callFunction({
          name: 'createEntMemberUpgradeOrder',
          data: commonCreateData
        });
        orderMeta = {
          order_scene: 'upgrade_member_type',
          from_member_type: 'personal',
          to_member_type: 'enterprise',
          from_plan_type: fromPlanType || '',
          to_plan_type: toPlanType
        };
      } else {
        pendingResult = await uniCloud.callFunction({
          name: 'createPendingMemberOrder',
          data: {
            ...commonCreateData,
            scene,
            member_tier: memberType,
            plan_key: planType,
            coupon_code: couponCode,
            coupon_id: couponId
          }
        });
        orderMeta = {
          order_scene: scene,
          from_member_type: memberType,
          to_member_type: memberType,
          from_plan_type: '',
          to_plan_type: planType
        };
      }
      console.log('[createMemberWxPayParams] createPendingMemberOrder result', {
        ok: !!(pendingResult && pendingResult.result),
        code: pendingResult && pendingResult.result && pendingResult.result.code,
        message: pendingResult && pendingResult.result && pendingResult.result.message
      });
      const pendingBody = pendingResult && pendingResult.result;
      if (!pendingBody || pendingBody.code !== 200 || !pendingBody.data) {
        return res((pendingBody && pendingBody.code) || 500, (pendingBody && pendingBody.message) || '创建会员订单失败');
      }
      orderData = pendingBody.data;
      console.log('[createMemberWxPayParams] pending order created', {
        order_id: orderData.order_id,
        order_no: orderData.order_no,
        pay_amount: orderData.pay_amount,
        coupon_code: orderData.coupon_code || couponCode
      });
    }
    const totalFee = toCent(orderData.pay_amount);
    debugState.order_id = orderData.order_id;
    debugState.pay_amount = orderData.pay_amount;
    console.log('[createMemberWxPayParams] pay amount calculated', {
      order_id: orderData.order_id,
      order_no: orderData.order_no,
      pay_amount: orderData.pay_amount,
      total_fee: totalFee,
      original_amount: orderData.original_amount,
      discount_amount: orderData.discount_amount
    });
    if (totalFee <= 0) {
      console.log('[createMemberWxPayParams] zero pay branch start', {
        order_id: orderData.order_id,
        coupon_code: couponCode,
        pay_amount: orderData.pay_amount
      });
      const zeroResult = await applyMemberOrderPaidCore({
        db,
        orderId: orderData.order_id,
        payPayload: {
          pay_channel: 'zero_amount',
          transaction_id: `ZERO_${String(orderData.order_id).slice(-10)}_${Date.now()}`,
          pay_time: new Date(),
          pay_callback_time: new Date(),
          paid_amount: 0
        }
      });
      if (!zeroResult.ok) {
        return res(zeroResult.code || 500, zeroResult.message || '0元订单开通失败', zeroResult.data);
      }
      console.log('[createMemberWxPayParams] zero pay branch success', {
        order_id: orderData.order_id,
        order_no: orderData.order_no
      });
      return res(200, '开通成功', {
        debug_marker: DEBUG_MARKER,
        zero_pay: true,
        paid: true,
        order_id: orderData.order_id,
        order_no: orderData.order_no,
        pay_amount: 0,
        original_amount: orderData.original_amount,
        discount_amount: orderData.discount_amount,
        result: zeroResult.data
      });
    }

    console.log('[createMemberWxPayParams] wx pay branch start', {
      order_id: orderData.order_id,
      order_no: orderData.order_no,
      pay_amount: orderData.pay_amount,
      total_fee: totalFee
    });

    if (!hasWxpay) {
      return res(500, 'uni-pay 配置缺少 wxpay', {
        debug_marker: DEBUG_MARKER,
        config_source: cfgResult.source
      });
    }
    if (!hasWxpayMp) {
      return res(500, 'uni-pay 配置缺少 wxpay.mp', {
        debug_marker: DEBUG_MARKER,
        config_source: cfgResult.source
      });
    }
    if (!hasNotifyUrl) {
      return res(500, 'uni-pay 配置缺少 notifyUrl', {
        debug_marker: DEBUG_MARKER,
        config_source: cfgResult.source
      });
    }

    const platform = (context && context.PLATFORM) || 'mp-weixin';
    const cloudSpaceId = resolveSpaceIdFromConfig(uniPayConfig);
    const clientInfoForUniPay = {
      platform,
      clientIP: '',
      userAgent: ''
    };
    const cloudInfoForUniPay = {
      spaceId: cloudSpaceId
    };
    const wxOpenid = await getUserWxOpenid(db, auth.userId);
    if (isDevEnv()) {
      console.log('[createMemberWxPayParams] uni-pay createOrder context', {
        hasPlatform: !!clientInfoForUniPay.platform,
        hasSpaceId: !!cloudInfoForUniPay.spaceId,
        hasOpenid: !!wxOpenid,
        platform: clientInfoForUniPay.platform
      });
    }
    if (!wxOpenid) {
      return res(400, '当前账号缺少微信openid，请先重新登录微信后再支付');
    }

    const payTitle = buildPayTitle(orderMeta || {
      order_scene: scene,
      to_member_type: memberType,
      to_plan_type: toPlanType || planType
    });

    const payOrder = await uniCloud.importObject('uni-pay-co').createOrder({
      provider: 'wxpay',
      openid: wxOpenid,
      order_no: orderData.order_no,
      out_trade_no: orderData.order_no,
      total_fee: totalFee,
      type: 'member_personal_month',
      title: payTitle,
      description: payTitle,
      user_id: auth.userId,
      clientInfo: clientInfoForUniPay,
      cloudInfo: cloudInfoForUniPay,
      custom: {
        biz_type: 'member_order_pay',
        member_order_id: orderData.order_id,
        order_scene: (orderMeta && orderMeta.order_scene) || scene,
        from_member_type: (orderMeta && orderMeta.from_member_type) || memberType,
        to_member_type: (orderMeta && orderMeta.to_member_type) || memberType,
        from_plan_type: (orderMeta && orderMeta.from_plan_type) || fromPlanType || '',
        to_plan_type: (orderMeta && orderMeta.to_plan_type) || toPlanType || planType
      }
    });
    console.log('[createMemberWxPayParams] uni-pay-co.createOrder result', {
      hasPayload: !!payOrder,
      keys: payOrder && typeof payOrder === 'object' ? Object.keys(payOrder).slice(0, 20) : []
    });

    const payParams = normalizePayParams(payOrder);
    if (payOrder && typeof payOrder === 'object' && Number(payOrder.errCode || 0) !== 0) {
      return res(500, payOrder.errMsg || 'uni-pay 下单失败', {
        debug_marker: DEBUG_MARKER,
        errCode: payOrder.errCode
      });
    }
    if (!payParams) {
      console.error('[createMemberWxPayParams] pay params parse failed', {
        payOrderType: typeof payOrder,
        payOrderKeys: payOrder && typeof payOrder === 'object' ? Object.keys(payOrder) : []
      });
      return res(500, 'uni-pay 下单成功但未返回支付参数');
    }

    await memberOrderCollection.doc(orderData.order_id).update({
      uni_pay_order: payOrder && typeof payOrder === 'object' ? payOrder : null,
      updated_at: new Date()
    });

    return res(200, '支付参数生成成功', {
      debug_marker: DEBUG_MARKER,
      order_id: orderData.order_id,
      order_no: orderData.order_no,
      pay_amount: orderData.pay_amount,
      pay_params: payParams
    });
  } catch (err) {
    console.error('createMemberWxPayParams error:', {
      message: err && err.message,
      stack: err && err.stack,
      order_id: debugState.order_id,
      coupon_code: debugState.coupon_code,
      pay_amount: debugState.pay_amount,
      errCode: err && err.errCode,
      errMsg: err && err.errMsg,
      detail: err
    });
    if (String(err && err.message || '').includes('uni-pay-co')) {
      return res(500, '未检测到 uni-pay-co，请先在 uniCloud 安装并部署官方 uni-pay', {
        debug_marker: DEBUG_MARKER
      });
    }
    return res(500, err.message || '服务器错误', {
      debug_marker: DEBUG_MARKER
    });
  }
};
