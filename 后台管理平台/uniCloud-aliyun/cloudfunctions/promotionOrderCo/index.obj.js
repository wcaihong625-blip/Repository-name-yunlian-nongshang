'use strict';

const { verifyToken, requireAdmin, getConfig } = require('nxt-auth');
const {
  loadMembershipPromotionConfig,
  resolvePromotionPrice,
  resolveUserMemberKind,
  rightsForTierAndPlan
} = require('nxt-membership-promotion-config');
const { fetchPaidMemberOrders, inferPlanKeyFromPaidOrdersForTier } = require('nxt-member-upgrade-enterprise');
const { mergeActivePromotionOntoContent, refreshContentPromotionFields } = require('nxt-content-promotion-sync');
const { safeString, readViewCountFromRow } = require('nxt-view-count');

function safeNum(v, d = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
}

async function fetchContentRow(db, content_type, content_id) {
  const cid = safeString(content_id);
  if (!cid) return null;
  const col = content_type === 'purchase' ? 'purchase_list' : 'supply_list';
  const docRes = await db.collection(col).doc(cid).get();
  return docRes.data && docRes.data[0];
}

async function resolveGiftPlanKey(db, userId, memberKind) {
  if (memberKind !== 'personal' && memberKind !== 'enterprise') return 'month';
  const orders = await fetchPaidMemberOrders(db, userId, 40);
  const pk = inferPlanKeyFromPaidOrdersForTier(orders, memberKind);
  return pk && ['month', 'quarter', 'year'].includes(pk) ? pk : 'month';
}

async function giftSnapshot(db, userId, user, cfg, memberKind) {
  if (memberKind !== 'personal' && memberKind !== 'enterprise') {
    return { gift_top_left: 0, gift_boost_left: 0, gift_top_total: 0, gift_boost_total: 0 };
  }
  const planKey = await resolveGiftPlanKey(db, userId, memberKind);
  const rights = rightsForTierAndPlan(cfg, memberKind, planKey);
  const gt = Number(rights.gift_top_days != null ? rights.gift_top_days : rights.gift_top_count) || 0;
  const gb = Number(rights.gift_boost_days != null ? rights.gift_boost_days : rights.gift_boost_count) || 0;
  const tu = safeNum(user.gift_top_used);
  const bu = safeNum(user.gift_boost_used);
  return {
    gift_top_total: gt,
    gift_boost_total: gb,
    gift_top_left: Math.max(0, gt - tu),
    gift_boost_left: Math.max(0, gb - bu)
  };
}

async function giftSnapshotCreate(db, userId, user, cfg, memberKind) {
  if (memberKind !== 'personal' && memberKind !== 'enterprise') {
    return { gift_top_left: 0, gift_boost_left: 0 };
  }
  const planKey = await resolveGiftPlanKey(db, userId, memberKind);
  const rights = rightsForTierAndPlan(cfg, memberKind, planKey);
  const gt = Number(rights.gift_top_days != null ? rights.gift_top_days : rights.gift_top_count) || 0;
  const gb = Number(rights.gift_boost_days != null ? rights.gift_boost_days : rights.gift_boost_count) || 0;
  const tu = safeNum(user.gift_top_used);
  const bu = safeNum(user.gift_boost_used);
  return {
    gift_top_left: Math.max(0, gt - tu),
    gift_boost_left: Math.max(0, gb - bu)
  };
}

function canUseInternalSecret(event) {
  const cfg = getConfig() || {};
  const secret = cfg.pay_callback && safeString(cfg.pay_callback.internal_secret);
  if (!secret) return false;
  return safeString(event.internal_secret) === secret;
}

async function loadGlobalDailyViewIncrement(db) {
  const r = await db.collection('platform_settings').doc('default').get();
  const row = r.data && r.data[0];
  const raw = Number(row && row.promotion_daily_view_increment != null ? row.promotion_daily_view_increment : 536);
  return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : 536;
}

module.exports = {
  _before() {},

  async create(event = {}, context) {
    const db = uniCloud.database();
    const res = (code, message, data) => ({ code, message, data: data || null });

    try {
      const tokenResult = await verifyToken(event, context);
      if (!tokenResult.success) {
        return res(401, tokenResult.error || '登录状态无效');
      }
      const userId = tokenResult.userId;

      const content_id = String(event.content_id || '').trim();
      const content_type = String(event.content_type || '').trim();
      const promotion_type = event.promotion_type === 'boost' ? 'boost' : 'top';
      const duration_days = Number(event.duration_days);
      const daily_view_increment_raw = Number(event.daily_view_increment);
      const globalDailyIncrement = await loadGlobalDailyViewIncrement(db);
      const daily_view_increment = Number.isFinite(daily_view_increment_raw)
        ? Math.max(0, Math.floor(daily_view_increment_raw))
        : globalDailyIncrement;
      const use_gift_quota =
        event.use_gift_quota === true || event.use_gift_quota === 'true' || event.use_gift_quota === 1;
      const eventTitle = safeString(event.title);

      if (!content_id || !['supply', 'purchase'].includes(content_type)) {
        return res(400, '参数错误：content_id / content_type');
      }
      if (![1, 3, 7].includes(duration_days)) {
        return res(400, '参数错误：duration_days 须为 1、3 或 7');
      }

      const userRes = await db.collection('uni-id-users').doc(userId).get();
      const user = userRes.data && userRes.data[0];
      if (!user) {
        return res(404, '用户不存在');
      }

      const cfg = await loadMembershipPromotionConfig(db);
      const memberKind = resolveUserMemberKind(user, Date.now());
      const pr = resolvePromotionPrice(cfg, promotion_type, duration_days, memberKind);
      if (!pr.ok) {
        return res(400, pr.message);
      }

      let title = eventTitle;
      if (content_type === 'supply') {
        const docRes = await db.collection('supply_list').doc(content_id).get();
        const row = docRes.data && docRes.data[0];
        if (!row) return res(404, '供应信息不存在');
        if (String(row.user_id) !== String(userId)) {
          return res(403, '无权推广该条供应');
        }
        title = title || row.title || '';
      } else {
        const docRes = await db.collection('purchase_list').doc(content_id).get();
        const row = docRes.data && docRes.data[0];
        if (!row) return res(404, '采购信息不存在');
        if (String(row.user_id) !== String(userId)) {
          return res(403, '无权推广该条采购');
        }
        title = title || row.title || '';
      }

      const snap = await giftSnapshotCreate(db, userId, user, cfg, memberKind);
      let finalPrice = safeNum(pr.price);
      let originPrice = safeNum(pr.origin_price != null ? pr.origin_price : pr.price);
      let useGift = false;
      let gift_quota_type = 'none';
      let gift_quota_count = 0;

      if (use_gift_quota) {
        if (memberKind !== 'personal' && memberKind !== 'enterprise') {
          return res(400, '仅会员可使用赠送天数');
        }
        if (promotion_type === 'top') {
          if (snap.gift_top_left < duration_days) {
            return res(400, `赠送置顶天数不足：本次需 ${duration_days} 天，当前剩余 ${snap.gift_top_left} 天`);
          }
          useGift = true;
          gift_quota_type = 'top';
          gift_quota_count = duration_days;
        } else {
          if (snap.gift_boost_left < duration_days) {
            return res(400, `赠送加急曝光天数不足：本次需 ${duration_days} 天，当前剩余 ${snap.gift_boost_left} 天`);
          }
          useGift = true;
          gift_quota_type = 'boost';
          gift_quota_count = duration_days;
        }
        finalPrice = 0;
      }

      const now = new Date();
      const order_no = 'PRM' + Date.now() + Math.floor(Math.random() * 10000);
      const nickname = user.nickname || user.username || '';

      const doc = {
        order_no,
        user_id: userId,
        nickname,
        content_id,
        content_type,
        title,
        promotion_type,
        duration_days,
        daily_view_increment,
        price: finalPrice,
        origin_price: originPrice,
        member_type: memberKind,
        pay_status: 0,
        status: 'pending',
        use_gift_quota: useGift,
        gift_quota_type,
        gift_quota_count,
        gift_quota_applied: false,
        created_at: now,
        updated_at: now
      };

      const ins = await db.collection('promotion_order').add(doc);
      const oid = ins.id || ins._id || '';

      const need_pay = finalPrice > 0;
      const can_activate_directly = !need_pay;

      return res(200, '订单已创建', {
        order_id: oid,
        order_no,
        amount: finalPrice,
        price: finalPrice,
        origin_price: originPrice,
        need_pay,
        can_activate_directly,
        promotion_type,
        duration_days,
        daily_view_increment,
        member_type: memberKind,
        pay_status: 0,
        status: 'pending',
        use_gift_quota: useGift,
        gift_quota_type,
        gift_quota_count
      });
    } catch (err) {
      console.error('promotionOrderCo.create', err);
      return res(500, err.message || '服务器错误');
    }
  },

  async activate(event = {}, context) {
    const db = uniCloud.database();
    const cmd = db.command;
    const res = (code, message, data) => ({ code, message, data: data || null });

    try {
      const admin = await requireAdmin(event, context);
      const tokenResult = await verifyToken(event, context);
      const internalTrusted = canUseInternalSecret(event);
      const isAdmin = admin.success === true;
      if (!isAdmin && !tokenResult.success && !internalTrusted) {
        return res(401, tokenResult.error || admin.error || '未登录');
      }
      const callerId = tokenResult.success ? tokenResult.userId : '';
      if (!isAdmin && !internalTrusted && !callerId) {
        return res(401, '未登录');
      }

      const orderId = String(event.order_id || event.id || '').trim();
      if (!orderId) {
        return res(400, '缺少 order_id');
      }

      const orderRes = await db.collection('promotion_order').doc(orderId).get();
      const order = orderRes.data && orderRes.data[0];
      if (!order) {
        return res(404, '订单不存在');
      }

      if (!isAdmin && !internalTrusted && String(order.user_id) !== String(callerId)) {
        return res(403, '无权操作该订单');
      }

      if (order.status === 'active') {
        return res(200, '已生效', {
          idempotent: true,
          order_id: orderId,
          status: 'active',
          start_time: order.start_time,
          end_time: order.end_time
        });
      }

      if (order.status === 'cancelled') {
        return res(400, '订单已取消，无法生效');
      }
      if (order.status === 'expired') {
        return res(400, '订单已过期，无法再次生效');
      }

      const price = safeNum(order.price);
      const payOk = Number(order.pay_status) === 1;
      const skipPay = isAdmin === true && event.skip_pay_check === true;

      if (price > 0 && !payOk && !skipPay) {
        return res(400, '请先完成支付后再激活');
      }

      const durationDays = [1, 3, 7].includes(Number(order.duration_days)) ? Number(order.duration_days) : 7;
      const now = Date.now();
      const startMs = now;
      const endMs = startMs + durationDays * 86400000;

      const contentRow = await fetchContentRow(db, order.content_type, order.content_id);
      const beforeViewCount = readViewCountFromRow(contentRow);

      const useGift = order.use_gift_quota === true && price === 0;
      const giftType = order.promotion_type === 'top' ? 'top' : 'boost';
      const giftCount = useGift
        ? Math.max(durationDays, safeNum(order.gift_quota_count, durationDays))
        : 0;
      const alreadyApplied = order.gift_quota_applied === true;

      let rolledGift = false;
      const incField = giftType === 'top' ? 'gift_top_used' : 'gift_boost_used';

      if (useGift && !alreadyApplied) {
        const userRes = await db.collection('uni-id-users').doc(order.user_id).get();
        const user = userRes.data && userRes.data[0];
        if (!user) {
          return res(404, '用户不存在');
        }
        const cfg = await loadMembershipPromotionConfig(db);
        const memberKind = resolveUserMemberKind(user, now);
        const snap = await giftSnapshot(db, order.user_id, user, cfg, memberKind);
        const left = giftType === 'top' ? snap.gift_top_left : snap.gift_boost_left;
        if (left < giftCount) {
          return res(400, '赠送天数不足，无法激活');
        }
        await db
          .collection('uni-id-users')
          .doc(order.user_id)
          .update({
            [incField]: cmd.inc(giftCount)
          });
        rolledGift = true;
      }

      try {
        const pendingWhere = {
          _id: orderId,
          status: cmd.in(['pending', 'paid'])
        };
        const upBody = {
          status: 'active',
          start_time: new Date(startMs),
          end_time: new Date(endMs),
          pay_time: price > 0 ? order.pay_time || new Date(now) : order.pay_time || null,
          pay_status: 1,
          before_view_count: beforeViewCount,
          updated_at: new Date(now)
        };
        if (useGift) {
          upBody.gift_quota_applied = true;
        }

        const up = await db.collection('promotion_order').where(pendingWhere).update(upBody);
        const updated =
          Number(
            (up && (up.updated != null ? up.updated : up.result && up.result.updated != null ? up.result.updated : 0)) || 0
          ) || 0;

        if (!updated) {
          const again = await db.collection('promotion_order').doc(orderId).get();
          const o2 = again.data && again.data[0];
          if (o2 && o2.status === 'active') {
            if (rolledGift) {
              await db
                .collection('uni-id-users')
                .doc(order.user_id)
                .update({
                  [incField]: cmd.inc(-giftCount)
                });
            }
            return res(200, '已生效', {
              idempotent: true,
              order_id: orderId,
              status: 'active',
              start_time: o2.start_time,
              end_time: o2.end_time
            });
          }
          if (rolledGift) {
            await db
              .collection('uni-id-users')
              .doc(order.user_id)
              .update({
                [incField]: cmd.inc(-giftCount)
              });
          }
          return res(409, '订单状态已变更，请刷新后重试');
        }

        // 同步主表置顶/加急到期与排序位，列表页据此排序与展示（过期由 expireBatch 回刷）
        try {
          await mergeActivePromotionOntoContent(db, {
            promotion_order_id: orderId,
            content_id: order.content_id,
            content_type: order.content_type,
            promotion_type: order.promotion_type,
            endMs
          });
          const fields =
            order.promotion_type === 'boost'
              ? 'promo_boost_expire_time, boost_sort_flag'
              : 'top_expire_time, top_sort_flag';
          console.log('[promotionOrderCo.activate] 主表已合并推广到期', {
            promotion_order_id: orderId,
            content_id: order.content_id,
            content_type: order.content_type,
            promotion_type: order.promotion_type,
            duration_days: durationDays,
            pay_status: Number(order.pay_status || 0),
            is_active: true,
            fields_written: fields,
            endMs
          });
        } catch (syncErr) {
          console.error('mergeActivePromotionOntoContent', syncErr);
        }

        return res(200, '推广已生效', {
          order_id: orderId,
          status: 'active',
          start_time: upBody.start_time,
          end_time: upBody.end_time,
          promotion_type: order.promotion_type,
          duration_days: durationDays
        });
      } catch (e) {
        if (rolledGift) {
          try {
            await db
              .collection('uni-id-users')
              .doc(order.user_id)
              .update({
                [incField]: cmd.inc(-giftCount)
              });
          } catch (_r) {}
        }
        throw e;
      }
    } catch (err) {
      console.error('promotionOrderCo.activate', err);
      return res(500, err.message || '服务器错误');
    }
  },

  async expireBatch(event = {}, context) {
    const db = uniCloud.database();
    const cmd = db.command;
    const res = (code, message, data) => ({ code, message, data: data || null });

    try {
      if (!canUseInternalSecret(event)) {
        const admin = await requireAdmin(event, context);
        if (!admin.success) {
          return res(401, admin.error || '无权限：需管理员或 internal_secret');
        }
      }

      const now = Date.now();
      const nowDate = new Date(now);

      const col = db.collection('promotion_order');
      const expiringSnap = await col
        .where({
          status: 'active',
          end_time: cmd.lt(nowDate)
        })
        .get();
      const expiringRows = expiringSnap.data || [];

      const result = await col
        .where({
          status: 'active',
          end_time: cmd.lt(nowDate)
        })
        .update({
          status: 'expired',
          updated_at: nowDate
        });

      const updated =
        Number(
          (result &&
            (result.updated != null ? result.updated : result.result && result.result.updated != null
              ? result.result.updated
              : 0)) ||
            0
        ) || 0;

      const seen = new Set();
      for (const r of expiringRows) {
        const key = `${r.content_type}:${r.content_id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        try {
          await refreshContentPromotionFields(db, r.content_type, r.content_id);
        } catch (e) {
          console.error('refreshContentPromotionFields', e);
        }
      }

      return res(200, '扫描完成', { expired_count: updated || 0, scanned_at: now });
    } catch (err) {
      console.error('promotionOrderCo.expireBatch', err);
      return res(500, err.message || '服务器错误');
    }
  },

  async markPaidAndActivate(event = {}, context) {
    const db = uniCloud.database();
    const cmd = db.command;
    const res = (code, message, data) => ({ code, message, data: data || null });

    try {
      const admin = await requireAdmin(event, context);
      const tokenResult = await verifyToken(event, context);
      const internalTrusted = canUseInternalSecret(event);
      const isAdmin = admin.success === true;

      const orderIdPre = safeString(event.order_id || event.id);
      const logDenied = (extra) => {
        console.warn('[promotionOrderCo.markPaidAndActivate] denied', {
          operator_type: 'rejected_user',
          promotion_order_id: orderIdPre || '(none)',
          content_id: '',
          content_type: '',
          reason: 'caller_not_admin_and_not_internal_secret',
          ...extra
        });
      };

      if (!isAdmin && !internalTrusted) {
        logDenied({ had_login: tokenResult.success === true });
        return res(
          401,
          '禁止：markPaidAndActivate 仅允许管理员或携带正确 internal_secret 的服务端内部调用（普通用户请走微信支付回调链路）',
          {
            denied: true,
            code_hint: 'PROMO_MARK_PAID_FORBIDDEN',
            operator_type: 'rejected_user'
          }
        );
      }

      const operatorType = isAdmin ? 'admin' : 'internal_secret';

      const orderId = orderIdPre;
      if (!orderId) {
        return res(400, '缺少 order_id');
      }

      const orderRes = await db.collection('promotion_order').doc(orderId).get();
      const order = orderRes.data && orderRes.data[0];
      if (!order) {
        return res(404, '订单不存在');
      }

      const contentIdLog = safeString(order.content_id);
      const contentTypeLog = safeString(order.content_type);
      const promotionTypeLog = order.promotion_type === 'boost' ? 'boost' : 'top';
      const durationDaysLog = [1, 3, 7].includes(Number(order.duration_days)) ? Number(order.duration_days) : Number(order.duration_days) || 0;

      if (order.status === 'cancelled') {
        console.warn('[promotionOrderCo.markPaidAndActivate] skip cancelled', {
          operator_type: operatorType,
          promotion_order_id: orderId,
          content_id: contentIdLog,
          content_type: contentTypeLog
        });
        return res(400, '订单已取消');
      }
      if (order.status === 'expired') {
        console.warn('[promotionOrderCo.markPaidAndActivate] skip expired', {
          operator_type: operatorType,
          promotion_order_id: orderId,
          content_id: contentIdLog,
          content_type: contentTypeLog
        });
        return res(400, '订单已过期');
      }

      console.log('[promotionOrderCo.markPaidAndActivate] begin', {
        operator_type: operatorType,
        promotion_order_id: orderId,
        order_no: safeString(order.order_no),
        content_id: contentIdLog,
        content_type: contentTypeLog,
        promotion_type: promotionTypeLog,
        duration_days: durationDaysLog,
        pay_status_before: Number(order.pay_status || 0),
        status_before: safeString(order.status)
      });

      const now = new Date();
      const paidAmount = safeNum(event.paid_amount, safeNum(order.price, 0));
      const payChannel = safeString(event.pay_channel || order.pay_channel || '');
      const transactionId = safeString(event.transaction_id || '');
      const payWhere = {
        _id: orderId,
        status: cmd.in(['pending', 'paid']),
        pay_status: cmd.neq(1)
      };
      const upPay = await db.collection('promotion_order').where(payWhere).update({
        pay_status: 1,
        status: order.status === 'active' ? 'active' : 'paid',
        pay_time: now,
        pay_channel: payChannel,
        paid_amount: paidAmount,
        transaction_id: transactionId,
        updated_at: now
      });
      const payUpdated =
        Number(
          (upPay && (upPay.updated != null ? upPay.updated : upPay.result && upPay.result.updated != null ? upPay.result.updated : 0)) || 0
        ) || 0;
      if (!payUpdated) {
        const again = await db.collection('promotion_order').doc(orderId).get();
        const o2 = again.data && again.data[0];
        console.log('[promotionOrderCo.markPaidAndActivate] pay_row_skip', {
          operator_type: operatorType,
          promotion_order_id: orderId,
          pay_status: o2 ? Number(o2.pay_status || 0) : -1,
          status: o2 ? o2.status : ''
        });
      }

      const activateResult = await this.activate(
        {
          ...event,
          order_id: orderId,
          skip_pay_check: false
        },
        context
      );
      if (activateResult && activateResult.code === 200) {
        console.log('[promotionOrderCo.markPaidAndActivate] ok', {
          operator_type: operatorType,
          promotion_order_id: orderId,
          order_no: safeString(order.order_no),
          content_id: contentIdLog,
          content_type: contentTypeLog,
          promotion_type: promotionTypeLog,
          duration_days: durationDaysLog,
          pay_status: 1,
          is_active: true
        });
        return res(200, '支付成功并已生效', {
          order_id: orderId,
          pay_status: 1,
          activate: activateResult.data || null
        });
      }
      console.error('[promotionOrderCo.markPaidAndActivate] activate_fail', {
        operator_type: operatorType,
        promotion_order_id: orderId,
        activate_code: activateResult && activateResult.code,
        activate_message: activateResult && activateResult.message
      });
      return activateResult || res(500, '支付落账后激活失败');
    } catch (err) {
      console.error('promotionOrderCo.markPaidAndActivate', err);
      return res(500, err.message || '服务器错误');
    }
  },

  /** 管理后台修改推广订单「每日增加浏览量」配置（仅管理员） */
  async updateDailyViewIncrement(event = {}, context) {
    const db = uniCloud.database();
    const res = (code, message, data) => ({ code, message, data: data || null });
    try {
      const admin = await requireAdmin(event, context);
      if (!admin.success) {
        return res(401, admin.error || '无权限：仅管理员可操作');
      }
      const orderId = safeString(event.order_id || event.id);
      if (!orderId) {
        return res(400, '缺少 order_id');
      }
      const raw = Number(event.daily_view_increment);
      if (!Number.isFinite(raw) || raw < 0) {
        return res(400, 'daily_view_increment 必须是大于等于 0 的数字');
      }
      const daily = Math.floor(raw);
      const up = await db.collection('promotion_order').doc(orderId).update({
        daily_view_increment: daily,
        updated_at: new Date()
      });
      const updated =
        Number(
          (up && (up.updated != null ? up.updated : up.result && up.result.updated != null ? up.result.updated : 0)) || 0
        ) || 0;
      if (!updated) {
        return res(404, '订单不存在或未更新');
      }
      return res(200, '修改成功', {
        order_id: orderId,
        daily_view_increment: daily
      });
    } catch (err) {
      console.error('promotionOrderCo.updateDailyViewIncrement', err);
      return res(500, err.message || '服务器错误');
    }
  },

  /** 读取推广浏览量全局配置（默认 536） */
  async getGlobalDailyViewIncrement(event = {}, context) {
    const db = uniCloud.database();
    const res = (code, message, data) => ({ code, message, data: data || null });
    try {
      const admin = await requireAdmin(event, context);
      if (!admin.success) {
        return res(401, admin.error || '无权限：仅管理员可操作');
      }
      const daily = await loadGlobalDailyViewIncrement(db);
      return res(200, '获取成功', {
        promotion_daily_view_increment: daily
      });
    } catch (err) {
      console.error('promotionOrderCo.getGlobalDailyViewIncrement', err);
      return res(500, err.message || '服务器错误');
    }
  },

  /** 设置推广浏览量全局配置，并可选应用到全部历史推广订单 */
  async setGlobalDailyViewIncrement(event = {}, context) {
    const db = uniCloud.database();
    const res = (code, message, data) => ({ code, message, data: data || null });
    try {
      const admin = await requireAdmin(event, context);
      if (!admin.success) {
        return res(401, admin.error || '无权限：仅管理员可操作');
      }
      const raw = Number(event.promotion_daily_view_increment != null ? event.promotion_daily_view_increment : event.daily_view_increment);
      if (!Number.isFinite(raw) || raw < 0) {
        return res(400, 'promotion_daily_view_increment 必须是大于等于 0 的数字');
      }
      const daily = Math.floor(raw);
      const applyToAllExisting =
        event.apply_to_all_existing === true ||
        event.apply_to_all_existing === 1 ||
        event.apply_to_all_existing === '1' ||
        event.apply_to_all_existing === 'true';

      const now = new Date();
      const settingsCol = db.collection('platform_settings');
      const exist = await settingsCol.doc('default').get();
      const hasDoc = !!(exist.data && exist.data[0]);
      if (hasDoc) {
        await settingsCol.doc('default').update({
          promotion_daily_view_increment: daily,
          update_time: Date.now()
        });
      } else {
        await settingsCol.add({
          _id: 'default',
          promotion_daily_view_increment: daily,
          create_time: Date.now(),
          update_time: Date.now()
        });
      }

      let updatedCount = 0;
      if (applyToAllExisting) {
        const up = await db.collection('promotion_order').where({}).update({
          daily_view_increment: daily,
          updated_at: now
        });
        updatedCount =
          Number(
            (up && (up.updated != null ? up.updated : up.result && up.result.updated != null ? up.result.updated : 0)) || 0
          ) || 0;
      }

      return res(200, '设置成功', {
        promotion_daily_view_increment: daily,
        apply_to_all_existing: applyToAllExisting,
        updated_count: updatedCount
      });
    } catch (err) {
      console.error('promotionOrderCo.setGlobalDailyViewIncrement', err);
      return res(500, err.message || '服务器错误');
    }
  },

  /** 管理后台批量修改「每日增加浏览量」（仅管理员） */
  async batchUpdateDailyViewIncrement(event = {}, context) {
    const db = uniCloud.database();
    const cmd = db.command;
    const res = (code, message, data) => ({ code, message, data: data || null });
    try {
      const admin = await requireAdmin(event, context);
      if (!admin.success) {
        return res(401, admin.error || '无权限：仅管理员可操作');
      }
      const rawDaily = Number(event.daily_view_increment);
      if (!Number.isFinite(rawDaily) || rawDaily < 0) {
        return res(400, 'daily_view_increment 必须是大于等于 0 的数字');
      }
      const daily = Math.floor(rawDaily);

      const where = {};
      const promotionType = safeString(event.promotion_type);
      const contentType = safeString(event.content_type);
      const status = safeString(event.status);
      const payStatusRaw = event.pay_status;
      const useGiftRaw = event.use_gift_quota;
      const nickname = safeString(event.nickname);
      const dateRange = Array.isArray(event.date_range) ? event.date_range : [];

      if (promotionType) where.promotion_type = promotionType;
      if (contentType) where.content_type = contentType;
      if (status) where.status = status;
      if (payStatusRaw !== '' && payStatusRaw !== null && payStatusRaw !== undefined) {
        const payStatus = Number(payStatusRaw);
        if (Number.isFinite(payStatus)) {
          where.pay_status = payStatus;
        }
      }
      if (useGiftRaw === true || useGiftRaw === '1' || useGiftRaw === 1) {
        where.use_gift_quota = true;
      } else if (useGiftRaw === false || useGiftRaw === '0' || useGiftRaw === 0) {
        where.use_gift_quota = cmd.or([{ use_gift_quota: false }, { use_gift_quota: cmd.exists(false) }]);
      }
      if (nickname) {
        where.nickname = new RegExp(nickname, 'i');
      }
      if (dateRange.length === 2 && dateRange[0] && dateRange[1]) {
        where.created_at = cmd.and(cmd.gte(Number(dateRange[0])), cmd.lte(Number(dateRange[1])));
      }

      const updateRes = await db.collection('promotion_order').where(where).update({
        daily_view_increment: daily,
        updated_at: new Date()
      });
      const updated =
        Number(
          (updateRes &&
            (updateRes.updated != null
              ? updateRes.updated
              : updateRes.result && updateRes.result.updated != null
                ? updateRes.result.updated
                : 0)) || 0
        ) || 0;
      return res(200, '批量修改成功', {
        updated_count: updated,
        daily_view_increment: daily
      });
    } catch (err) {
      console.error('promotionOrderCo.batchUpdateDailyViewIncrement', err);
      return res(500, err.message || '服务器错误');
    }
  },

  /** 小程序支付成功后轮询：仅返回当前用户订单的支付/生效状态（不落账） */
  async getPayStatus(event = {}, context) {
    const db = uniCloud.database();
    const res = (code, message, data) => ({ code, message, data: data || null });

    try {
      const tokenResult = await verifyToken(event, context);
      if (!tokenResult.success) {
        return res(401, tokenResult.error || '登录状态无效');
      }
      const userId = tokenResult.userId;
      const orderId = safeString(event.order_id || event.id);
      if (!orderId) {
        return res(400, '缺少 order_id');
      }
      const orderRes = await db.collection('promotion_order').doc(orderId).get();
      const order = orderRes.data && orderRes.data[0];
      if (!order) {
        return res(404, '订单不存在');
      }
      if (String(order.user_id) !== String(userId)) {
        return res(403, '无权查看该订单');
      }
      const payOk = Number(order.pay_status) === 1;
      const active = order.status === 'active';
      const priceNum = safeNum(order.price, 0);
      const st = order.status || 'pending';
      const canResumeWxPay = !payOk && priceNum > 0 && (st === 'pending' || st === 'paid');
      console.log('[promotionOrderCo.getPayStatus]', {
        promotion_order_id: orderId,
        order_no: safeString(order.order_no),
        pay_status: Number(order.pay_status || 0),
        status: st,
        is_paid: payOk,
        is_active: active,
        promotion_type: order.promotion_type === 'boost' ? 'boost' : 'top',
        duration_days: order.duration_days,
        price: priceNum
      });
      return res(200, 'ok', {
        order_id: orderId,
        order_no: order.order_no,
        pay_status: Number(order.pay_status || 0),
        status: st,
        is_paid: payOk,
        is_active: active,
        content_id: safeString(order.content_id),
        content_type: safeString(order.content_type),
        title: safeString(order.title),
        price: priceNum,
        promotion_type: order.promotion_type === 'boost' ? 'boost' : 'top',
        duration_days: order.duration_days,
        can_resume_wx_pay: canResumeWxPay
      });
    } catch (err) {
      console.error('promotionOrderCo.getPayStatus', err);
      return res(500, err.message || '服务器错误');
    }
  }
};
