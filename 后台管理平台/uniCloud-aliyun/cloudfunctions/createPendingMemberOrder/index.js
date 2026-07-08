'use strict';
/**
 * 创建「待支付」会员订单：仅落库订单与归因快照，不生效会员、不写提成金额、不延长 VIP。
 * 支付成功后请统一走 applyMemberOrderPaidResult（或未来微信回调内调用同一落账逻辑）。
 */
const { verifyToken } = require('nxt-auth');
const { validateMemberCouponForOrder, roundMoney } = require('nxt-member-coupon');
const {
  loadMembershipPromotionConfig,
  resolveMemberPlan,
  inferPlanKeyFromDays,
  rightsForTierAndPlan
} = require('nxt-membership-promotion-config');

function safeString(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

function getCurrentEnv() {
  let env = process.env.UNI_PLATFORM_ENV || process.env.NODE_ENV;
  if (process.env.UNI_CLOUD_PROVIDER) {
    env = 'production';
    if (
      process.env.UNI_CLOUD_HBUILDERX_DEBUG === 'true' ||
      process.env.NODE_ENV === 'development'
    ) {
      env = 'development';
    }
  }
  return env || 'production';
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const cmd = db.command;

  const customerProfileCollection = db.collection('customer_profile');
  const memberOrderCollection = db.collection('member_order');
  const usersCollection = db.collection('uni-id-users');

  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const env = getCurrentEnv();
    const eventKeys = event && typeof event === 'object' ? Object.keys(event) : [];

    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '登录状态无效');
    }
    const userId = tokenResult.userId;

    const userRes = await usersCollection.doc(userId).get();
    if (!userRes.data || userRes.data.length === 0) {
      return res(404, '用户不存在');
    }
    const userInfo = userRes.data[0];
    const mobile = userInfo.mobile || '';

    const mpcfg = await loadMembershipPromotionConfig(db);
    const tier = event.member_tier === 'enterprise' ? 'enterprise' : 'personal';
    const reqScene = String(event.scene || '').trim();
    const planKey =
      event.plan_key && ['month', 'quarter', 'year'].includes(String(event.plan_key))
        ? String(event.plan_key)
        : inferPlanKeyFromDays(event.member_days);
    const rplan = resolveMemberPlan(mpcfg, tier, planKey);
    if (!rplan.ok) {
      return res(400, rplan.message);
    }
    let pay_amount = roundMoney(rplan.price);
    let original_amount = roundMoney(rplan.price);
    const member_days = rplan.days;
    const rights = rightsForTierAndPlan(mpcfg, tier, planKey) || {};
    const gift_top_days = Number(rights.gift_top_days || 0);
    const gift_boost_days = Number(rights.gift_boost_days || 0);
    const coupon_code_input = safeString(event.coupon_code);
    const coupon_id_input = safeString(event.coupon_id);
    // 兼容前后端命名：channel_id / channelId
    const channel_id = safeString(event.channel_id || event.channelId);
    const invite_code = safeString(event.invite_code || event.inviteCode);
    const req_sales_id = safeString(event.sales_id || event.salesId);

    if (env === 'development') {
      console.log('[createPendingMemberOrder] debug input', {
        requestId: context && context.requestId,
        eventKeys,
        channel_id,
        invite_code,
        sales_id: req_sales_id
      });
    }

    let final_channel_id = '';
    let final_channel_name = '';
    let final_sales_id = '';
    let final_sales_name = '';
    let final_invite_code = '';

    if (channel_id) {
      const channelRes = await db.collection('sales_channel').doc(channel_id).get();
      if (!channelRes.data || channelRes.data.length === 0) {
        return res(400, '无效的渠道ID');
      }
      const channel = channelRes.data[0];
      final_channel_id = channel._id;
      final_channel_name = channel.channel_name;
      final_sales_id = channel.sales_id;
      final_sales_name = channel.sales_name;
      final_invite_code = channel.invite_code;

      if (invite_code && invite_code !== final_invite_code) {
        return res(400, '渠道ID与邀请码不匹配');
      }
    } else if (invite_code) {
      const channelRes = await db.collection('sales_channel').where({ invite_code: invite_code }).get();
      if (!channelRes.data || channelRes.data.length === 0) {
        return res(400, '无效的邀请码');
      }
      const channel = channelRes.data[0];
      final_channel_id = channel._id;
      final_channel_name = channel.channel_name;
      final_sales_id = channel.sales_id;
      final_sales_name = channel.sales_name;
      final_invite_code = channel.invite_code;
    }

    if (req_sales_id && final_sales_id && req_sales_id !== final_sales_id) {
      return res(400, '业务员ID与渠道分配不一致');
    }
    if (!final_sales_id && req_sales_id) {
      const staffRes = await db.collection('sales_staff').doc(req_sales_id).get();
      if (staffRes.data && staffRes.data.length > 0) {
        final_sales_id = staffRes.data[0]._id;
        final_sales_name = staffRes.data[0].sales_name;
      }
    }

    let isFirstOpen = true;
    const historyCond = [{ user_id: userId }];
    if (mobile) historyCond.push({ mobile: mobile });

    const historyOrderQuery = await memberOrderCollection
      .where(cmd.and([cmd.or(historyCond), { order_status: 1 }]))
      .orderBy('pay_time', 'asc')
      .limit(50)
      .get();

    if (historyOrderQuery.data.length > 0) {
      isFirstOpen = false;
    }

    const profileCond = [{ user_id: userId }];
    if (mobile) profileCond.push({ mobile: mobile });

    let profileQuery = await customerProfileCollection.where(cmd.or(profileCond)).get();
    let currentProfile = profileQuery.data.length > 0 ? profileQuery.data[0] : null;

    const now = new Date();
    let first_sales_id = '';
    let first_sales_name = '';
    let current_sales_id = '';
    let current_sales_name = '';
    let source_channel_id = '';
    let source_channel_name = '';

    if (isFirstOpen) {
      first_sales_id = final_sales_id;
      first_sales_name = final_sales_name;
      current_sales_id = final_sales_id;
      current_sales_name = final_sales_name;
      source_channel_id = final_channel_id;
      source_channel_name = final_channel_name;

      if (!currentProfile) {
        const newProfile = {
          user_id: userId,
          mobile: mobile,
          nickname: userInfo.nickname || '',
          avatar: userInfo.avatar || '',
          source_channel_id,
          source_channel_name,
          first_sales_id,
          first_sales_name,
          current_sales_id,
          current_sales_name,
          member_status: 0,
          member_expire_time: null,
          created_at: now,
          updated_at: now
        };
        const addRes = await customerProfileCollection.add(newProfile);
        currentProfile = { _id: addRes.id, ...newProfile };
      } else {
        const updateData = {
          user_id: userId,
          mobile: mobile,
          nickname: userInfo.nickname || '',
          avatar: userInfo.avatar || '',
          current_sales_id,
          current_sales_name,
          updated_at: now
        };
        if (!currentProfile.first_sales_id) {
          updateData.first_sales_id = first_sales_id;
          updateData.first_sales_name = first_sales_name;
        }
        if (!currentProfile.source_channel_id) {
          updateData.source_channel_id = source_channel_id;
          updateData.source_channel_name = source_channel_name;
        }
        await customerProfileCollection.doc(currentProfile._id).update(updateData);
        currentProfile = { ...currentProfile, ...updateData };
      }
    } else {
      if (!currentProfile) {
        const earliestSuccessOrder = historyOrderQuery.data.length > 0 ? historyOrderQuery.data[0] : null;
        const recovered_first_sales_id =
          (earliestSuccessOrder && (earliestSuccessOrder.first_sales_id || earliestSuccessOrder.sales_id)) ||
          final_sales_id ||
          '';
        const recovered_first_sales_name =
          (earliestSuccessOrder && (earliestSuccessOrder.first_sales_name || earliestSuccessOrder.sales_name)) ||
          final_sales_name ||
          '';
        const recovered_source_channel_id =
          (earliestSuccessOrder && earliestSuccessOrder.channel_id) || final_channel_id || '';
        const recovered_source_channel_name =
          (earliestSuccessOrder && earliestSuccessOrder.channel_name) || final_channel_name || '';
        const recovered_current_sales_id = final_sales_id || recovered_first_sales_id || '';
        const recovered_current_sales_name = final_sales_name || recovered_first_sales_name || '';

        const fallbackProfile = {
          user_id: userId,
          mobile: mobile,
          nickname: userInfo.nickname || '',
          avatar: userInfo.avatar || '',
          first_sales_id: recovered_first_sales_id,
          first_sales_name: recovered_first_sales_name,
          current_sales_id: recovered_current_sales_id,
          current_sales_name: recovered_current_sales_name,
          source_channel_id: recovered_source_channel_id,
          source_channel_name: recovered_source_channel_name,
          member_status: 1,
          created_at: now,
          updated_at: now
        };
        const addRes = await customerProfileCollection.add(fallbackProfile);
        currentProfile = { _id: addRes.id, ...fallbackProfile };
      }

      first_sales_id = currentProfile.first_sales_id || '';
      first_sales_name = currentProfile.first_sales_name || '';
      source_channel_id = currentProfile.source_channel_id || '';
      source_channel_name = currentProfile.source_channel_name || '';
      current_sales_id = final_sales_id || currentProfile.current_sales_id || '';
      current_sales_name = final_sales_name || currentProfile.current_sales_name || '';

      await customerProfileCollection.doc(currentProfile._id).update({
        mobile: mobile,
        nickname: userInfo.nickname || '',
        avatar: userInfo.avatar || '',
        current_sales_id,
        current_sales_name,
        updated_at: now
      });
    }

    const order_no = 'VIP' + Date.now() + Math.floor(Math.random() * 10000);
    const commission_type = isFirstOpen ? 'first_open' : 'renewal';
    const orderTypeContext = isFirstOpen ? 'first_open' : 'renewal';
    const order_scene = ['new', 'renew'].includes(reqScene) ? reqScene : isFirstOpen ? 'new' : 'renew';

    /** 结构化备注：落支付后写入用户 member_type（personal/enterprise） */
    const buildMemberOrderRemark = (ev) => {
      const meta = {
        member_tier: ev.member_tier === 'enterprise' ? 'enterprise' : 'personal',
        plan_key: (ev.plan_key && String(ev.plan_key).trim()) || 'year',
        order_scene,
        from_member_type: ev.member_tier === 'enterprise' ? 'enterprise' : 'personal',
        to_member_type: ev.member_tier === 'enterprise' ? 'enterprise' : 'personal',
        from_plan_type: '',
        to_plan_type: (ev.plan_key && String(ev.plan_key).trim()) || 'year'
      };
      const raw = ev.remark;
      if (raw != null && String(raw).trim() !== '') {
        const s = String(raw).trim();
        if (s.startsWith('{')) {
          try {
            return JSON.stringify({ ...JSON.parse(s), ...meta });
          } catch (_e) {
            return JSON.stringify({ ...meta, legacy_note: s });
          }
        }
        return JSON.stringify({ ...meta, legacy_note: s });
      }
      return JSON.stringify(meta);
    };

    let discount_amount = roundMoney(original_amount - pay_amount);
    let coupon_id_snap = '';
    let coupon_code_snap = '';

    if (coupon_code_input || coupon_id_input) {
      const v = await validateMemberCouponForOrder(db, {
        userId,
        orderTypeContext,
        originalAmount: original_amount,
        couponCode: coupon_code_input,
        couponId: coupon_id_input,
        memberType: tier,
        planType: planKey
      });
      if (!v.ok) {
        return res(v.code || 400, v.message || '优惠码不可用');
      }
      const d = v.data;
      original_amount = roundMoney(d.original_amount);
      pay_amount = roundMoney(d.pay_amount);
      discount_amount = roundMoney(d.discount_amount);
      coupon_id_snap = d.coupon._id;
      coupon_code_snap = d.coupon.code || '';
    } else {
      pay_amount = roundMoney(pay_amount);
      original_amount = roundMoney(original_amount);
      discount_amount = roundMoney(original_amount - pay_amount);
      if (discount_amount < 0) discount_amount = 0;
      if (pay_amount < 0) pay_amount = 0;
    }

    const newOrder = {
      order_no,
      user_id: userId,
      customer_id: currentProfile ? currentProfile._id : '',
      mobile: mobile,
      order_type: isFirstOpen ? 1 : 2,
      order_status: 0,
      pay_status: 0,
      pay_amount,
      original_amount,
      discount_amount,
      coupon_id: coupon_id_snap,
      coupon_code_id: coupon_id_snap,
      coupon_code: coupon_code_snap,
      member_days,
      member_type: tier,
      plan_type: planKey,
      gift_top_days,
      gift_boost_days,
      order_scene,
      from_member_type: '',
      to_member_type: tier,
      from_plan_type: '',
      to_plan_type: planKey,
      sales_id: final_sales_id,
      sales_name: final_sales_name,
      first_sales_id,
      first_sales_name,
      channel_id: final_channel_id,
      channel_name: final_channel_name,
      invite_code: final_invite_code,
      commission_type,
      commission_rate: 0,
      commission_amount: 0,
      commission_status: 0,
      pay_channel: event.pay_channel || '',
      source_type: event.source_type || 'mini_program',
      remark: buildMemberOrderRemark(event),
      out_trade_no: order_no,
      pay_order_no: order_no,
      created_at: now,
      updated_at: now
    };

    const orderInsert = await memberOrderCollection.add(newOrder);

    return res(200, '待支付订单已创建', {
      order_id: orderInsert.id,
      order_no,
      order_type: newOrder.order_type,
      pay_status: 0,
      pay_amount,
      original_amount,
      discount_amount,
      zero_pay: pay_amount === 0,
      coupon_id: coupon_id_snap,
      coupon_code_id: coupon_id_snap,
      coupon_code: coupon_code_snap,
      sales_id: final_sales_id,
      sales_name: final_sales_name,
      channel_id: final_channel_id,
      channel_name: final_channel_name
    });
  } catch (err) {
    console.error('createPendingMemberOrder error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
