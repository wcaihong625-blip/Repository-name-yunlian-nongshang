'use strict';

const { verifyToken } = require('nxt-auth');

/** 每批订单数：事务外批量 find 仍分批，避免单次 $in 过大 */
const ORDER_BATCH_SIZE = 50;

/** 事务内逐条 doc.update 时，每 N 条打一条进度日志，避免日志爆炸 */
const DOC_UPDATE_LOG_EVERY = 100;

const LOG_PREFIX = '[confirmCommissionSettle]';

/** 最终采用的订单更新方式（uniCloud 事务内 where().update 会走 updateMany，当前环境不支持） */
const MEMBER_ORDER_UPDATE_MODE = 'doc.update loop';

/** 结算单在事务内用 doc().update，避免 where().update 触发 updateMany */
const SETTLE_UPDATE_MODE = 'doc.update';

/** 结算单读取字段（避免拉取无关大字段） */
const SETTLE_READ_FIELDS = {
  settle_status: true,
  order_ids: true,
  commission_total: true,
  settle_month: true,
  remark: true
};

/** 事务外校验：订单只取必要字段 */
const MEMBER_ORDER_CHECK_FIELDS = {
  _id: true,
  commission_status: true,
  commission_settlement_id: true,
  commission_settlement_month: true
};

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

/**
 * doc(id).get() 在不同运行环境下 res.data 可能是：
 * - 数组 [doc]（常见）
 * - 单条对象 doc（部分环境）
 * 避免只用 data[0] 把对象形态误判成「无数据」。
 */
function docFromGet(res) {
  const d = res && res.data;
  if (d == null) return null;
  if (Array.isArray(d)) return d.length ? d[0] : null;
  if (typeof d === 'object') return d;
  return null;
}

/** where().get() 的 data 在少数环境下也可能是单对象，统一成数组便于遍历 */
function dataArrayFromQuery(res) {
  const d = res && res.data;
  if (d == null) return [];
  if (Array.isArray(d)) return d;
  if (typeof d === 'object') return [d];
  return [];
}

function normalizeOrderIds(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const seen = new Set();
  const out = [];
  for (const id of raw) {
    if (id === undefined || id === null) continue;
    const s = String(id).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

module.exports = async (event, context) => {
  const db = uniCloud.database();
  const _ = db.command;

  // 与项目 nxt-auth 一致：异步鉴权必须 await，并传入 context
  const tokenResult = await verifyToken(event, context);
  if (!tokenResult.success || !tokenResult.userId) {
    return { code: 401, message: tokenResult.error || '登录失效，请重新登录' };
  }

  const settleId = safeString(event.settle_id);
  const remark = safeString(event.remark);

  if (!settleId) {
    return { code: 400, message: '缺少参数 settle_id' };
  }

  console.log(LOG_PREFIX, 'start', {
    settle_id: settleId,
    batch_size: ORDER_BATCH_SIZE,
    member_order_update_mode: MEMBER_ORDER_UPDATE_MODE,
    settle_update_mode: SETTLE_UPDATE_MODE
  });

  // ========== 事务外：find/get ==========
  const settleRes = await db.collection('sales_commission_settle').doc(settleId).field(SETTLE_READ_FIELDS).get();
  const settleData = docFromGet(settleRes); // 勿改用 data[0] 单一路径

  if (!settleData) {
    return { code: 404, message: '结算单不存在' };
  }
  if (Number(settleData.settle_status) === 1) {
    return { code: 400, message: '该结算单已经结算，不可重复操作' };
  }

  const orderIds = normalizeOrderIds(settleData.order_ids);
  /** 事务外筛出的、当前仍为未结算的订单 id（事务内仅对这些 id 做 doc.update） */
  const unsettledOrderIds = [];

  if (orderIds.length > 0) {
    const batches = chunkArray(orderIds, ORDER_BATCH_SIZE);
    for (let bi = 0; bi < batches.length; bi += 1) {
      const batch = batches[bi];
      const unSettledOrdersRes = await db
        .collection('member_order')
        .where({
          _id: _.in(batch),
          commission_status: 0
        })
        .field(MEMBER_ORDER_CHECK_FIELDS)
        .get();
      const rows = dataArrayFromQuery(unSettledOrdersRes);
      for (let ri = 0; ri < rows.length; ri += 1) {
        const row = rows[ri];
        if (row && row._id != null) {
          unsettledOrderIds.push(String(row._id));
        }
      }
      console.log(LOG_PREFIX, 'pre_txn_batch_verify', {
        settle_id: settleId,
        batch_index: bi + 1,
        batch_size: batch.length,
        unsettled_in_batch: rows.length
      });
    }

    if (unsettledOrderIds.length === 0) {
      console.log(LOG_PREFIX, 'pre_txn_fail_no_unsettled', {
        settle_id: settleId,
        order_ids_count: orderIds.length,
        to_update_order_count: 0
      });
      return { code: 400, message: '当前结算单对应订单已被处理，无需重复结算' };
    }
  }

  const toUpdateOrderCount = unsettledOrderIds.length;

  console.log(LOG_PREFIX, 'pre_txn_summary', {
    settle_id: settleId,
    order_ids_count: orderIds.length,
    to_update_order_count: toUpdateOrderCount,
    member_order_update_mode: MEMBER_ORDER_UPDATE_MODE,
    note: '事务内禁止 get；订单用 doc(id).update 逐条写，结算单用 doc(settleId).update'
  });

  const commissionTotal = Number(settleData.commission_total) || 0;
  const settleMonth = safeString(settleData.settle_month);
  const remarkFinal = remark || settleData.remark;

  // ========== 事务内：仅 doc().update，不使用 where().update（避免底层 updateMany）==========
  const transaction = await db.startTransaction();
  const nowDate = new Date();
  let updatedOrderCount = 0;

  try {
    if (unsettledOrderIds.length > 0) {
      for (let i = 0; i < unsettledOrderIds.length; i += 1) {
        const oid = unsettledOrderIds[i];
        // 确认结算回写 member_order（与设计一致，缺一不可）
        const orderUpdateRes = await transaction.collection('member_order').doc(oid).update({
          commission_status: 1,
          commission_settlement_id: settleId,
          commission_settlement_month: settleMonth,
          commission_settle_time: nowDate,
          updated_at: nowDate
        });
        const u = Number(orderUpdateRes.updated) || 0;
        updatedOrderCount += u;
        if ((i + 1) % DOC_UPDATE_LOG_EVERY === 0 || i + 1 === unsettledOrderIds.length) {
          console.log(LOG_PREFIX, 'txn_doc_update_progress', {
            settle_id: settleId,
            processed: i + 1,
            total: unsettledOrderIds.length,
            cumulative_updated: updatedOrderCount
          });
        }
      }

      if (updatedOrderCount === 0) {
        await transaction.rollback();
        console.log(LOG_PREFIX, 'txn_fail_no_order_updated', {
          settle_id: settleId,
          to_update_order_count: toUpdateOrderCount,
          member_order_update_mode: MEMBER_ORDER_UPDATE_MODE
        });
        return { code: 400, message: '当前结算单对应订单已被处理，无需重复结算' };
      }
    }

    // 主档须含 settled_at，供列表展示「确认结算时间」
    const settleUpdateRes = await transaction.collection('sales_commission_settle').doc(settleId).update({
      commission_paid: commissionTotal,
      commission_unpaid: 0,
      settle_status: 1,
      settled_at: nowDate,
      remark: remarkFinal,
      updated_at: nowDate
    });

    const settleUpdated = Number(settleUpdateRes.updated) || 0;
    console.log(LOG_PREFIX, 'settle_update_result', {
      settle_id: settleId,
      settle_update_mode: SETTLE_UPDATE_MODE,
      settle_updated: settleUpdated,
      order_ids_count: orderIds.length,
      to_update_order_count: toUpdateOrderCount,
      txn_updated_order_count: updatedOrderCount
    });

    if (settleUpdated === 0) {
      await transaction.rollback();
      console.log(LOG_PREFIX, 'txn_fail_settle_update', { settle_id: settleId });
      return { code: 400, message: '该结算单已经结算，不可重复操作' };
    }

    await transaction.commit();

    console.log(LOG_PREFIX, 'success', {
      settle_id: settleId,
      order_ids_count: orderIds.length,
      to_update_order_count: toUpdateOrderCount,
      member_order_update_mode: MEMBER_ORDER_UPDATE_MODE,
      settle_update_mode: SETTLE_UPDATE_MODE,
      txn_updated_order_count: updatedOrderCount,
      settle_updated: settleUpdated
    });

    return {
      code: 200,
      message: '结算成功',
      data: {
        settle_id: settleId,
        settle_status: 1,
        commission_paid: commissionTotal,
        commission_unpaid: 0,
        updated_order_count: updatedOrderCount
      }
    };
  } catch (e) {
    try {
      await transaction.rollback();
    } catch (rbErr) {
      console.error('confirmCommissionSettle rollback error:', rbErr);
    }
    console.error('confirmCommissionSettle error:', e);
    return { code: 500, message: e.message || '结算失败，请稍后再试' };
  }
};

