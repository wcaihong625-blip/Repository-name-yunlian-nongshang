'use strict';

const mpc = require('nxt-membership-promotion-config');
const { loadMembershipPromotionConfig } = mpc;
const { inferLastPlanKeyFromPaidOrders, fetchPaidMemberOrders } = require('nxt-member-upgrade-enterprise');

/** uniCloud doc().get() 的 data 可能为单对象或数组，统一取首条 */
function firstDocFromGet(getRes) {
  const d = getRes && getRes.data;
  if (d == null) return null;
  if (Array.isArray(d)) return d.length ? d[0] : null;
  if (typeof d === 'object') return d;
  return null;
}

function getVipState(user) {
  const now = Date.now();
  let expTs = 0;
  const rawExp = user && user.vip_expire_time;
  if (rawExp instanceof Date) expTs = rawExp.getTime();
  else if (rawExp != null && rawExp !== '') {
    const t = new Date(rawExp).getTime();
    expTs = Number.isNaN(t) ? 0 : t;
  }
  const isVip = !!(user && user.is_vip === true && expTs > now);
  let memberType = (user && user.member_type) || 'free';
  if (!isVip) {
    memberType = 'free';
  } else if (memberType !== 'enterprise' && memberType !== 'personal') {
    memberType = 'personal';
  }
  return {
    isVip,
    memberType,
    expTs
  };
}

/**
 * 按会员类型 + 套餐周期取权益；云端未同步新公共模块时回退到 rightsForTier。
 */
function resolveMemberRightsSnapshot(cfg, memberType, planKey) {
  if (memberType !== 'personal' && memberType !== 'enterprise') return null;
  const pk = ['month', 'quarter', 'year'].includes(planKey) ? planKey : 'month';
  try {
    if (typeof mpc.rightsForTierAndPlan === 'function') {
      return mpc.rightsForTierAndPlan(cfg || {}, memberType, pk);
    }
  } catch (e) {
    console.error('getUserInfo.rightsForTierAndPlan', e);
  }
  try {
    if (typeof mpc.rightsForTier === 'function') {
      return mpc.rightsForTier(cfg || {}, memberType);
    }
  } catch (e2) {
    console.error('getUserInfo.rightsForTier', e2);
  }
  return null;
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const usersCollection = db.collection('uni-id-users');

  const res = (code, message, data) => {
    return { code, message, data: data || null };
  };

  try {
    const { user_id, contact_scene } = event;

    if (!user_id) {
      return res(400, '参数错误：user_id不能为空');
    }

    void contact_scene;

    const queryRes = await usersCollection.doc(user_id).get();
    const user = firstDocFromGet(queryRes);

    if (!user) {
      return res(404, '用户不存在');
    }

    const vipState = getVipState(user);
    const is_vip = vipState.isVip;
    const member_type = vipState.memberType;

    let cfg = null;
    try {
      cfg = await loadMembershipPromotionConfig(db);
    } catch (_e) {
      cfg = null;
    }
    let member_plan_key = '';
    const uidForOrders = user._id || user.id || user_id;
    try {
      if (uidForOrders) {
        const paidOrders = await fetchPaidMemberOrders(db, uidForOrders, 40);
        member_plan_key = inferLastPlanKeyFromPaidOrders(paidOrders) || '';
      }
    } catch (_e) {
      member_plan_key = '';
    }

    const planForRights = ['month', 'quarter', 'year'].includes(member_plan_key) ? member_plan_key : 'month';
    const rights = member_type === 'free' ? null : resolveMemberRightsSnapshot(cfg, member_type, planForRights);

    const contact_quota_total = rights ? rights.contact_purchase_quota : 0;
    const contact_quota_used = Math.max(0, Number(user.contact_quota_used) || 0);
    const contact_quota_left = Math.max(0, contact_quota_total - contact_quota_used);

    const giftTopCap = rights
      ? Number(rights.gift_top_days != null ? rights.gift_top_days : rights.gift_top_count) || 0
      : 0;
    const giftBoostCap = rights
      ? Number(rights.gift_boost_days != null ? rights.gift_boost_days : rights.gift_boost_count) || 0
      : 0;
    const gift_top_total = giftTopCap;
    const gift_top_used = Math.max(0, Number(user.gift_top_used) || 0);
    const gift_top_left = Math.max(0, gift_top_total - gift_top_used);

    const gift_boost_total = giftBoostCap;
    const gift_boost_used = Math.max(0, Number(user.gift_boost_used) || 0);
    const gift_boost_left = Math.max(0, gift_boost_total - gift_boost_used);

    let realnameVerified = !!(user.isRealNameVerified || user.real_name_verified || user.is_verified);
    if (!realnameVerified) {
      try {
        const authRes = await db.collection('realname_auth')
          .where({ user_id: String(user_id), status: 'verified' })
          .limit(1)
          .get();
        realnameVerified = !!(authRes.data && authRes.data.length > 0);
      } catch (_e) {
        realnameVerified = false;
      }
    }

    const enterpriseMemberActive = is_vip === true && member_type === 'enterprise';
    const enterpriseVerified = enterpriseMemberActive && !!(
      user.isEnterpriseVerified ||
      user.is_enterprise_verified ||
      user.enterprise_auth_status === 'approved'
    );

    const formattedData = {
      user_id: user._id,
      username: user.username || '',
      nickname: user.nickname || user.username || '用户',
      mobile: user.mobile || '',
      avatar: user.avatar || '',
      location: user.location || '',
      industry: user.industry || '',
      bio: user.bio || '',
      isRealNameVerified: realnameVerified,
      real_name_verified: realnameVerified,
      is_verified: realnameVerified,
      isEnterpriseVerified: enterpriseVerified,
      is_enterprise_verified: enterpriseVerified,
      enterprise_auth_status: user.enterprise_auth_status || '',
      enterprise_name: user.enterprise_name || user.companyName || '',
      companyName: user.companyName || user.enterprise_name || '',
      is_vip: is_vip,
      vip_level: user.vip_level || 0,
      vip_expire_time: user.vip_expire_time || 0,
      vip_expire_time_text: user.vip_expire_time_text || '',
      member_type,
      is_member_active: is_vip,
      member_expire_time: user.vip_expire_time || 0,
      member_expire_time_text: user.vip_expire_time_text || '',
      contact_quota_total,
      contact_quota_used,
      contact_quota_left,
      gift_top_total,
      gift_top_used,
      gift_top_left,
      gift_boost_total,
      gift_boost_used,
      gift_boost_left,
      /** 与 gift_*_total 相同语义：会员当前套餐下的赠送「天数」总额度 */
      gift_top_days_total: gift_top_total,
      gift_top_days_used: gift_top_used,
      gift_top_days_left: gift_top_left,
      gift_boost_days_total: gift_boost_total,
      gift_boost_days_used: gift_boost_used,
      gift_boost_days_left: gift_boost_left,
      member_rights_snapshot: rights,
      member_plan_key
    };

    return res(200, '获取成功', formattedData);
  } catch (err) {
    console.error('getUserInfo error:', err);
    return res(500, '服务器内部错误', { error: err.message });
  }
};
