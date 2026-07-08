'use strict';

/**
 * 一次性/按需执行：修正 customer_transfer_apply 中 status 与 apply_status 不一致或缺 status 的历史数据。
 * 约定：以 status 为准（0 待审 / 1 通过 / 2 拒绝），apply_status 与 status 对齐。
 *
 * 调用：uniCloud.callFunction({ name: 'fixCustomerTransferApplyStatus', data: { uniIdToken, dry_run: true } })
 * dry_run: true 时只统计不写入。
 */

const { requireAdmin } = require('nxt-auth');

function resp(code, message, data = null) {
  return { code, message, data };
}

exports.main = async (event, context) => {
  const adminResult = await requireAdmin(event, context);
  if (!adminResult.success || !adminResult.userId) {
    return resp(403, adminResult.error || '无后台管理权限');
  }

  const dryRun = !!event.dry_run;
  const db = uniCloud.database();
  const _ = db.command;

  const summary = {
    dry_run: dryRun,
    sync_apply_status_by_status: {},
    missing_status_count: 0,
    missing_status_fixed: 0
  };

  console.log('[fixCustomerTransferApplyStatus] 开始 | dry_run:', dryRun);

  try {
    for (const st of [0, 1, 2]) {
      if (dryRun) {
        const mismatch = await db
          .collection('customer_transfer_apply')
          .where({
            status: st,
            apply_status: _.neq(st)
          })
          .count();
        summary.sync_apply_status_by_status[`status_${st}_need_sync`] = mismatch.total;
        console.log('[fixCustomerTransferApplyStatus] dry_run status=', st, '与 apply_status 不一致条数:', mismatch.total);
      } else {
        const ur = await db
          .collection('customer_transfer_apply')
          .where({ status: st })
          .update({ apply_status: st });
        const n = ur.updated != null ? ur.updated : ur.affectedDocs != null ? ur.affectedDocs : 0;
        summary.sync_apply_status_by_status[`status_${st}_rows_touched`] = n;
        console.log('[fixCustomerTransferApplyStatus] 已按 status=', st, '批量对齐 apply_status, updated:', n);
      }
    }

    const missCnt = await db
      .collection('customer_transfer_apply')
      .where({
        status: _.exists(false),
        apply_status: _.exists(true)
      })
      .count();
    summary.missing_status_count = missCnt.total;
    console.log('[fixCustomerTransferApplyStatus] 缺少 status 字段的文档数:', missCnt.total);

    if (!dryRun && missCnt.total > 0) {
      const pageSize = 100;
      let fixed = 0;
      for (let i = 0; i < 500; i++) {
        const res = await db
          .collection('customer_transfer_apply')
          .where({
            status: _.exists(false),
            apply_status: _.exists(true)
          })
          .limit(pageSize)
          .get();
        const list = res.data || [];
        if (!list.length) break;
        for (const doc of list) {
          const st = Number(doc.apply_status);
          if (st !== 0 && st !== 1 && st !== 2) continue;
          await db.collection('customer_transfer_apply').doc(doc._id).update({ status: st, apply_status: st });
          fixed++;
        }
        if (list.length < pageSize) break;
      }
      summary.missing_status_fixed = fixed;
      console.log('[fixCustomerTransferApplyStatus] 已补全 status 字段条数:', fixed);
    }

    return resp(200, dryRun ? 'dry_run 统计完成（未写入）' : '数据修正完成', summary);
  } catch (e) {
    console.error('[fixCustomerTransferApplyStatus] error:', e);
    return resp(500, e.message || '执行失败');
  }
};
