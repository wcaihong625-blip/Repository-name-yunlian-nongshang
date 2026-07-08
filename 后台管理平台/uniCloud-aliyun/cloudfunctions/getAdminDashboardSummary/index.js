'use strict';

const { verifyToken } = require('nxt-auth');
const { getMonthBoundaries, fetchEligibleOrders } = require('nxt-commission-month');
const { buildExceptionWhere, buildHandleWhere } = require('nxt-order-exception');

function safeString(v) {
  return v === undefined || v === null ? '' : String(v).trim();
}

function shanghaiDayString() {
  return new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Shanghai' }).slice(0, 10);
}

function shanghaiCurrentYm() {
  return shanghaiDayString().slice(0, 7);
}

function shanghaiTodayBounds() {
  const day = shanghaiDayString();
  const start = new Date(`${day}T00:00:00+08:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end };
}

function mapOrderRow(o) {
  if (!o) return null;
  return {
    _id: safeString(o._id),
    order_no: safeString(o.order_no),
    order_type: o.order_type,
    order_status: o.order_status,
    pay_status: o.pay_status,
    pay_amount: o.pay_amount,
    mobile: safeString(o.mobile),
    customer_name: safeString(o.customer_name),
    created_at: o.created_at,
    pay_time: o.pay_time
  };
}

function mapTransferRow(r) {
  if (!r) return null;
  return {
    _id: safeString(r._id),
    customer_name: safeString(r.customer_name),
    mobile: safeString(r.mobile),
    status: r.status,
    from_sales_name: safeString(r.from_sales_name),
    to_sales_name: safeString(r.to_sales_name),
    created_at: r.created_at
  };
}

function mapSettleRow(r) {
  if (!r) return null;
  return {
    _id: safeString(r._id),
    settle_month: safeString(r.settle_month),
    sales_name: safeString(r.sales_name),
    commission_total: r.commission_total,
    settle_status: r.settle_status,
    created_at: r.created_at
  };
}

function mapCouponLogRow(r) {
  if (!r) return null;
  return {
    _id: safeString(r._id),
    code: safeString(r.code),
    mobile: safeString(r.mobile),
    order_no: safeString(r.order_no),
    used_at: r.used_at
  };
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  const _ = db.command;
  const res = (code, message, data) => ({ code, message, data: data || null });

  try {
    const tokenResult = await verifyToken(event, context);
    if (!tokenResult.success || !tokenResult.userId) {
      return res(401, tokenResult.error || '登录失效，请重新登录', null);
    }

    const ym = shanghaiCurrentYm();
    const bounds = getMonthBoundaries(ym);
    if (!bounds) {
      return res(500, '月份计算失败', null);
    }

    const { start: dayStart, end: dayEnd } = shanghaiTodayBounds();
    const moCol = db.collection('member_order');
    const trCol = db.collection('customer_transfer_apply');
    const cpCol = db.collection('member_coupon_code');
    const logCol = db.collection('member_coupon_use_log');
    const stCol = db.collection('sales_commission_settle');

    const exOpenWhere = _.and([buildExceptionWhere(_, ''), buildHandleWhere(_, 'open')]);
    const exNameOpenWhere = _.and([buildExceptionWhere(_, 'missing_customer_name'), buildHandleWhere(_, 'open')]);
    const missingMobileWhere = _.and([
      { order_status: 1 },
      _.or([{ mobile: _.exists(false) }, { mobile: null }, { mobile: '' }])
    ]);

    const monthPaidTime = _.or([
      { pay_time: _.gte(bounds.start).and(_.lte(bounds.end)) },
      { pay_time: _.gte(bounds.start.getTime()).and(_.lte(bounds.end.getTime())) }
    ]);

    const [
      pendingMo,
      todayNewMo,
      monthFirst,
      monthRenewal,
      pendingComm,
      pendingTransfer,
      openEx,
      enabledCoupon,
      orderPaid,
      orderCanceled,
      orderZero,
      todoName,
      todoMobile,
      usedCouponCodes,
      todayNewCoupon,
      todayVerify,
      monthSettledBills
    ] = await Promise.all([
      moCol.where({ pay_status: 0, order_status: 0 }).count(),
      moCol
        .where({
          created_at: _.and(_.gte(new Date(dayStart)), _.lte(new Date(dayEnd)))
        })
        .count(),
      moCol
        .where(
          _.and([{ order_type: 1, order_status: 1 }, monthPaidTime])
        )
        .count(),
      moCol
        .where(
          _.and([{ order_type: 2, order_status: 1 }, monthPaidTime])
        )
        .count(),
      moCol
        .where({
          order_status: 1,
          commission_status: 0,
          commission_amount: _.gt(0)
        })
        .count(),
      trCol.where({ status: 0 }).count(),
      moCol.where(exOpenWhere).count(),
      cpCol.where({ status: 'enabled' }).count(),
      moCol.where({ order_status: 1 }).count(),
      moCol.where(_.or([{ order_status: 2 }, { pay_status: 2 }])).count(),
      moCol
        .where(
          _.and([
            { order_status: 1 },
            _.or([
              { pay_amount: 0 },
              { pay_amount: _.exists(false) },
              { pay_amount: null }
            ])
          ])
        )
        .count(),
      moCol.where(exNameOpenWhere).count(),
      moCol.where(missingMobileWhere).count(),
      cpCol.where({ used_count: _.gt(0) }).count(),
      cpCol
        .where({
          created_at: _.and(_.gte(new Date(dayStart)), _.lte(new Date(dayEnd)))
        })
        .count(),
      logCol
        .where({
          used_at: _.and(_.gte(new Date(dayStart)), _.lte(new Date(dayEnd)))
        })
        .count(),
      stCol.where({ settle_month: ym, settle_status: 1 }).count()
    ]);

    const { orders: eligibleOrders, lockedOrderCount } = await fetchEligibleOrders(db, _, ym, bounds, null);
    let monthEstimated = 0;
    for (const o of eligibleOrders) {
      monthEstimated += Number(o.commission_amount) || 0;
    }
    monthEstimated = Number(monthEstimated.toFixed(2));

    const [
      recentCreated,
      recentPaid,
      recentTransfer,
      recentSettle,
      recentLogs
    ] = await Promise.all([
      moCol.orderBy('created_at', 'desc').limit(8).get(),
      moCol.where({ order_status: 1 }).orderBy('pay_time', 'desc').limit(8).get(),
      trCol.orderBy('created_at', 'desc').limit(8).get(),
      stCol.orderBy('created_at', 'desc').limit(8).get(),
      logCol.where({ status: 'used' }).orderBy('used_at', 'desc').limit(8).get()
    ]);

    const data = {
      meta: { settle_month: ym, server_day: shanghaiDayString() },
      cards: {
        pending_member_orders: pendingMo.total || 0,
        today_new_member_orders: todayNewMo.total || 0,
        month_first_open_orders: monthFirst.total || 0,
        month_renewal_orders: monthRenewal.total || 0,
        pending_commission_orders: pendingComm.total || 0,
        pending_transfer_apply: pendingTransfer.total || 0,
        open_exception_orders: openEx.total || 0,
        enabled_coupon_codes: enabledCoupon.total || 0
      },
      panels: {
        order_summary: {
          pending: pendingMo.total || 0,
          paid: orderPaid.total || 0,
          canceled: orderCanceled.total || 0,
          zero_amount: orderZero.total || 0
        },
        commission_summary: {
          pending_commission_orders: pendingComm.total || 0,
          month_estimated_commission: monthEstimated,
          month_eligible_orders: eligibleOrders.length,
          locked_pending_order_slots: lockedOrderCount,
          month_settled_bills: monthSettledBills.total || 0
        },
        coupon_summary: {
          enabled_coupon_codes: enabledCoupon.total || 0,
          used_coupon_codes: usedCouponCodes.total || 0,
          today_new_coupon_codes: todayNewCoupon.total || 0,
          today_verify_count: todayVerify.total || 0
        }
      },
      todos: {
        missing_customer_name_orders: todoName.total || 0,
        missing_mobile_orders: todoMobile.total || 0
      },
      recent: {
        member_orders: (recentCreated.data || []).map(mapOrderRow).filter(Boolean),
        member_orders_paid: (recentPaid.data || []).map(mapOrderRow).filter(Boolean),
        transfer_apply: (recentTransfer.data || []).map(mapTransferRow).filter(Boolean),
        commission_settle_recent: (recentSettle.data || []).map(mapSettleRow).filter(Boolean),
        coupon_use_logs: (recentLogs.data || []).map(mapCouponLogRow).filter(Boolean)
      }
    };

    return res(0, 'ok', data);
  } catch (e) {
    console.error('[getAdminDashboardSummary]', e);
    return res(500, e.message || '查询失败', null);
  }
};
