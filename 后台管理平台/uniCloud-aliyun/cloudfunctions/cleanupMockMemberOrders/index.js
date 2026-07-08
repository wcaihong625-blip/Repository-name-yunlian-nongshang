'use strict';

/**
 * cleanupMockMemberOrders：仅清理 / 排查「历史测试会员订单」数据（依据 pay_mock_flag、MOCK_ 流水等规则）。
 * 不参与正式 uni-pay、推广支付、订单落账等主链路；禁止当作模拟支付入口使用。
 */

const { requireAdmin, getConfig } = require('nxt-auth');

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function safeBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  const s = String(value).trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes';
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

function toDoc(res) {
  const d = res && res.data;
  if (!d) return null;
  if (Array.isArray(d)) return d[0] || null;
  return d;
}

function pickListUnique(items) {
  const set = new Set();
  (items || []).forEach((v) => {
    const s = safeString(v);
    if (s) set.add(s);
  });
  return Array.from(set);
}

function chunk(list, size = 50) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

async function resolveUser(db, inputUserId, inputMobile) {
  const users = db.collection('uni-id-users');
  const userId = safeString(inputUserId);
  const mobile = safeString(inputMobile);

  if (userId) {
    const doc = toDoc(await users.doc(userId).get());
    return doc || null;
  }
  if (mobile) {
    const byMobile = await users.where({ mobile }).limit(1).get();
    return (byMobile.data && byMobile.data[0]) || null;
  }
  return null;
}

function assertTestOrder(order) {
  if (!order) return false;
  if (order.pay_mock_flag === true) return true;
  const tx = safeString(order.transaction_id).toUpperCase();
  const ch = safeString(order.pay_channel).toLowerCase();
  if (tx.startsWith('MOCK_')) return true;
  if (ch === 'mock_admin') return true;
  return false;
}

function hasValidExpireTime(value) {
  if (value === undefined || value === null || value === '') return false;
  if (value instanceof Date) return !Number.isNaN(value.getTime());
  const t = new Date(value).getTime();
  return !Number.isNaN(t);
}

function hasMemberState(userDoc, profileDoc) {
  const isVip = !!(userDoc && userDoc.is_vip === true);
  const hasExpire = hasValidExpireTime(userDoc && userDoc.vip_expire_time);
  const memberType = safeString(userDoc && userDoc.member_type);
  const hasMemberType = !!(memberType && memberType !== 'free');
  const profileMemberOn = Number(profileDoc && profileDoc.member_status) === 1;
  return isVip || hasExpire || hasMemberType || profileMemberOn;
}

function buildResetPlan(targetUserId) {
  return {
    'uni-id-users': {
      target_user_id: targetUserId,
      fields: {
        is_vip: false,
        vip_expire_time: null,
        vip_expire_time_text: '',
        vip_level: 'normal',
        vip_source: '',
        member_type: 'free',
        contact_quota_used: 0,
        gift_top_used: 0,
        gift_boost_used: 0
      }
    },
    customer_profile_by_user_id: {
      target_user_id: targetUserId,
      fields: {
        member_status: 0,
        member_expire_time: null,
        member_first_open_time: null,
        member_last_renew_time: null
      }
    }
  };
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const cmd = db.command;
  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const admin = await requireAdmin(event, context);
    if (!admin.success) {
      return res(401, admin.error || '仅管理员可操作');
    }

    const env = getCurrentEnv();
    const cfg = getConfig() || {};
    const allowInProd = !!(cfg.member_order_cleanup && cfg.member_order_cleanup.allow_in_production);
    // 生产环境放开：只要管理员调用即可执行；配置项保留，便于后续再次收紧策略

    const dryRun = safeBoolean(event.dry_run, true);
    const onlyMock = safeBoolean(event.only_mock, true);
    const targetUser = await resolveUser(db, event.user_id, event.mobile);
    if (!targetUser) {
      return res(404, '未找到目标用户（请检查 user_id 或手机号）');
    }

    const targetUserId = safeString(targetUser._id);
    const targetMobile = safeString(targetUser.mobile);
    if (!targetUserId) {
      return res(400, '目标用户ID为空');
    }

    const profileQuery = await db.collection('customer_profile').where({ user_id: targetUserId }).limit(200).get();
    const profileList = profileQuery.data || [];
    const currentProfile = profileList[0] || null;
    const canRollbackStateOnly = hasMemberState(targetUser, currentProfile);

    const orderQuery = await db
      .collection('member_order')
      .where({ user_id: targetUserId })
      .orderBy('created_at', 'desc')
      .limit(500)
      .get();
    const allOrders = orderQuery.data || [];
    const candidateOrders = onlyMock ? allOrders.filter(assertTestOrder) : allOrders;

    if (candidateOrders.length === 0) {
      if (!canRollbackStateOnly) {
        return res(200, '未找到可清理的测试会员订单，且当前用户无可回滚会员状态', {
          mode: dryRun ? 'dry_run' : 'state_only_cleanup',
          dry_run: dryRun,
          user_id: targetUserId,
          mobile: targetMobile,
          scanned_order_count: allOrders.length,
          matched_order_count: 0,
          member_state_detected: false
        });
      }

      const stateOnlySummary = {
        mode: dryRun ? 'dry_run' : 'state_only_cleanup',
        dry_run: dryRun,
        planned_mode: 'state_only_cleanup',
        user_id: targetUserId,
        mobile: targetMobile,
        scanned_order_count: allOrders.length,
        matched_order_count: 0,
        member_state_detected: true,
        delete_plan: {
          member_order: 0,
          member_order_remark: 0,
          member_coupon_use_log: 0,
          uni_pay_orders: 0
        },
        reset_plan: buildResetPlan(targetUserId)
      };

      if (dryRun) {
        return res(200, 'dry-run 完成：未命中订单，已进入仅回滚会员状态预演', stateOnlySummary);
      }

      const txStateOnly = await db.startTransaction();
      try {
        await txStateOnly.collection('uni-id-users').doc(targetUserId).update({
          is_vip: false,
          vip_expire_time: null,
          vip_expire_time_text: '',
          vip_level: 'normal',
          vip_source: '',
          member_type: 'free',
          contact_quota_used: 0,
          gift_top_used: 0,
          gift_boost_used: 0
        });

        for (const p of profileList) {
          const pid = safeString(p && p._id);
          if (!pid) continue;
          await txStateOnly.collection('customer_profile').doc(pid).update({
            member_status: 0,
            member_expire_time: null,
            member_first_open_time: null,
            member_last_renew_time: null,
            updated_at: new Date()
          });
        }

        await txStateOnly.commit();
      } catch (err) {
        try {
          await txStateOnly.rollback();
        } catch (_rb) {
          // ignore
        }
        throw err;
      }

      return res(200, '仅回滚会员状态完成', stateOnlySummary);
    }

    const orderIds = pickListUnique(candidateOrders.map((o) => o._id));
    const orderNos = pickListUnique(candidateOrders.map((o) => o.order_no));
    const outTradeNos = pickListUnique(candidateOrders.map((o) => o.out_trade_no));
    const payOrderNos = pickListUnique(candidateOrders.map((o) => o.pay_order_no));
    const orderIdChunks = chunk(orderIds, 50);

    let remarkIds = [];
    for (const idPart of orderIdChunks) {
      const remarkRes = await db
        .collection('member_order_remark')
        .where({ order_id: cmd.in(idPart) })
        .field({ _id: true })
        .get();
      remarkIds = remarkIds.concat(pickListUnique((remarkRes.data || []).map((r) => r._id)));
    }

    let couponLogs = [];
    for (const idPart of orderIdChunks) {
      const logRes = await db
        .collection('member_coupon_use_log')
        .where({ order_id: cmd.in(idPart), status: 'used' })
        .get();
      couponLogs = couponLogs.concat(logRes.data || []);
    }

    const couponRollbackMap = {};
    couponLogs.forEach((log) => {
      const codeId = safeString(log.code_id);
      if (!codeId) return;
      couponRollbackMap[codeId] = (couponRollbackMap[codeId] || 0) + 1;
    });

    let uniPayOrderIds = [];
    if (orderNos.length || outTradeNos.length || payOrderNos.length || orderIds.length) {
      const uniPayOr = [];
      if (targetUserId) uniPayOr.push({ user_id: targetUserId });
      if (orderNos.length) uniPayOr.push({ order_no: cmd.in(orderNos) });
      if (outTradeNos.length) uniPayOr.push({ out_trade_no: cmd.in(outTradeNos) });
      if (payOrderNos.length) uniPayOr.push({ out_trade_no: cmd.in(payOrderNos) });
      if (orderIds.length) uniPayOr.push({ 'custom.member_order_id': cmd.in(orderIds) });
      const uniPayQuery = await db.collection('uni-pay-orders').where(cmd.or(uniPayOr)).field({ _id: true }).get();
      uniPayOrderIds = pickListUnique((uniPayQuery.data || []).map((r) => r._id));
    }

    const summary = {
      mode: dryRun ? 'dry_run' : 'full_cleanup',
      dry_run: dryRun,
      planned_mode: 'full_cleanup',
      user_id: targetUserId,
      mobile: targetMobile,
      cleaned_order_ids: orderIds,
      matched_order_count: candidateOrders.length,
      delete_plan: {
        member_order: candidateOrders.length,
        member_order_remark: remarkIds.length,
        member_coupon_use_log: couponLogs.length,
        uni_pay_orders: uniPayOrderIds.length
      },
      reset_plan: buildResetPlan(targetUserId),
      coupon_rollback_count_by_code_id: couponRollbackMap
    };

    if (dryRun) {
      return res(200, 'dry-run 完成，未执行删除', summary);
    }

    const tx = await db.startTransaction();
    try {
      for (const remarkId of remarkIds) {
        await tx.collection('member_order_remark').doc(remarkId).remove();
      }
      for (const log of couponLogs) {
        const logId = safeString(log && log._id);
        if (!logId) continue;
        await tx.collection('member_coupon_use_log').doc(logId).remove();
      }

      const rollbackEntries = Object.entries(couponRollbackMap);
      for (const [codeId, decCount] of rollbackEntries) {
        const cnt = Number(decCount || 0);
        if (cnt <= 0) continue;
        await tx
          .collection('member_coupon_code')
          .where({ _id: codeId, used_count: cmd.gte(cnt) })
          .update({ used_count: cmd.inc(-cnt) });
      }

      for (const orderId of orderIds) {
        await tx.collection('member_order').doc(orderId).remove();
      }

      await tx.collection('uni-id-users').doc(targetUserId).update({
        is_vip: false,
        vip_expire_time: null,
        vip_expire_time_text: '',
        vip_level: 'normal',
        vip_source: '',
        member_type: 'free',
        contact_quota_used: 0,
        gift_top_used: 0,
        gift_boost_used: 0
      });

      for (const p of profileList) {
        const pid = safeString(p && p._id);
        if (!pid) continue;
        await tx.collection('customer_profile').doc(pid).update({
          member_status: 0,
          member_expire_time: null,
          member_first_open_time: null,
          member_last_renew_time: null,
          updated_at: new Date()
        });
      }

      for (const uniPayOrderId of uniPayOrderIds) {
        await tx.collection('uni-pay-orders').doc(uniPayOrderId).remove();
      }

      await tx.commit();
    } catch (err) {
      try {
        await tx.rollback();
      } catch (_rb) {
        // ignore
      }
      throw err;
    }

    return res(200, '测试会员订单清理完成', summary);
  } catch (err) {
    console.error('cleanupMockMemberOrders error:', err);
    return res(500, err.message || '服务器错误');
  }
};
