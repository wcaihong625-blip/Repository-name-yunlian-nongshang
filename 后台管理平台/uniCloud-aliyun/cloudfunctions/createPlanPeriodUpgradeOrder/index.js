'use strict';

/**
 * 周期档位升级（同档月→季/年、季→年）：order_type=4，备注 biz_type=upgrade_period。
 * 云函数名须 ≤30 字符（阿里云限制），故使用 createPlanPeriodUpgradeOrder。
 */
const { verifyToken } = require('nxt-auth');
const { roundMoney } = require('nxt-member-coupon');
const { loadMembershipPromotionConfig, rightsForTierAndPlan } = require('nxt-membership-promotion-config');
const { buildPlanPeriodUpgradeQuoteForUser } = require('nxt-member-upgrade-enterprise');

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const cmd = db.command;
  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success) {
      return res(401, tokenResult.error || '登录状态无效');
    }
    const userId = tokenResult.userId;

    const usersCollection = db.collection('uni-id-users');
    const userRes = await usersCollection.doc(userId).get();
    if (!userRes.data || userRes.data.length === 0) {
      return res(404, '用户不存在');
    }
    const userInfo = userRes.data[0];
    const mobile = userInfo.mobile || '';

    const targetPlanKey = event.target_plan_key != null ? String(event.target_plan_key).trim() : '';
    const mpcfg = await loadMembershipPromotionConfig(db);
    const quote = await buildPlanPeriodUpgradeQuoteForUser(db, userInfo, mpcfg, targetPlanKey);
    if (!quote.ok) {
      return res(400, quote.message || '无法创建周期升级订单');
    }

    const channel_id = event.channel_id ? String(event.channel_id).trim() : '';
    const invite_code = event.invite_code ? String(event.invite_code).trim() : '';
    const req_sales_id = event.sales_id ? String(event.sales_id).trim() : '';

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

    const profileCond = [{ user_id: userId }];
    if (mobile) profileCond.push({ mobile: mobile });
    const profileQuery = await db.collection('customer_profile').where(cmd.or(profileCond)).limit(1).get();
    const currentProfile = profileQuery.data && profileQuery.data.length > 0 ? profileQuery.data[0] : null;
    const customer_id = currentProfile ? currentProfile._id : '';

    const first_sales_id = currentProfile ? currentProfile.first_sales_id || final_sales_id : final_sales_id;
    const first_sales_name = currentProfile ? currentProfile.first_sales_name || final_sales_name : final_sales_name;
    const current_sales_id = final_sales_id || (currentProfile && currentProfile.current_sales_id) || '';
    const current_sales_name = final_sales_name || (currentProfile && currentProfile.current_sales_name) || '';

    if (currentProfile && currentProfile._id) {
      const nowUp = new Date();
      await db
        .collection('customer_profile')
        .doc(currentProfile._id)
        .update({
          mobile: mobile,
          nickname: userInfo.nickname || '',
          avatar: userInfo.avatar || '',
          current_sales_id,
          current_sales_name,
          updated_at: nowUp
        });
    }

    const now = new Date();
    const order_no = 'VIP' + Date.now() + Math.floor(Math.random() * 10000);
    const pay_amount = roundMoney(quote.pay_amount);
    const original_amount = roundMoney(quote.target_price);
    const discount_amount = 0;
    const rights = rightsForTierAndPlan(mpcfg, quote.member_tier, quote.target_plan_key) || {};
    const gift_top_days = Number(rights.gift_top_days || 0);
    const gift_boost_days = Number(rights.gift_boost_days || 0);

    const remarkObj = {
      member_tier: quote.member_tier,
      plan_key: quote.target_plan_key,
      from_plan_key: quote.current_plan_key,
      biz_type: 'upgrade_period',
      target_days: quote.target_days,
      biz_rule_hint:
        '周期档位升级：付目标套餐全价；新到期=原到期+完整目标天数；剩余时长保留。不从今日起算整段周期。'
    };

    const newOrder = {
      order_no,
      user_id: userId,
      customer_id: customer_id || '',
      mobile: mobile,
      order_type: 4,
      order_status: 0,
      pay_status: 0,
      pay_amount,
      original_amount,
      discount_amount,
      coupon_id: '',
      coupon_code: '',
      member_days: quote.target_days,
      member_type: quote.member_tier,
      plan_type: quote.target_plan_key,
      gift_top_days,
      gift_boost_days,
      order_scene: 'upgrade_plan',
      from_member_type: quote.member_tier,
      to_member_type: quote.member_tier,
      from_plan_type: quote.current_plan_key,
      to_plan_type: quote.target_plan_key,
      sales_id: final_sales_id,
      sales_name: final_sales_name,
      first_sales_id,
      first_sales_name,
      channel_id: final_channel_id,
      channel_name: final_channel_name,
      invite_code: final_invite_code,
      commission_type: 'renewal',
      commission_rate: 0,
      commission_amount: 0,
      commission_status: 0,
      pay_channel: event.pay_channel || '',
      source_type: event.source_type || 'mini_program',
      remark: JSON.stringify(remarkObj),
      out_trade_no: order_no,
      pay_order_no: order_no,
      created_at: now,
      updated_at: now
    };

    const orderInsert = await db.collection('member_order').add(newOrder);

    return res(200, '周期档位升级订单已创建', {
      order_id: orderInsert.id,
      order_no,
      order_type: 4,
      pay_status: 0,
      pay_amount,
      original_amount,
      discount_amount,
      sales_id: final_sales_id,
      sales_name: final_sales_name,
      channel_id: final_channel_id,
      channel_name: final_channel_name
    });
  } catch (err) {
    console.error('createPlanPeriodUpgradeOrder error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
