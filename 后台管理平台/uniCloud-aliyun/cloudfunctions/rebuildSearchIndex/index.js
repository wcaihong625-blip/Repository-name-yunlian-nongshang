'use strict';

const { requireAdmin } = require('nxt-auth');
const {
  makeSearchIndexPatch,
  pickSearchSourceValues,
  PURCHASE_INDEX_FIELDS,
  SUPPLY_INDEX_FIELDS
} = require('nxt-search-index');

const COLLECTION_MAP = {
  purchase: { name: 'purchase_list', fields: PURCHASE_INDEX_FIELDS },
  supply: { name: 'supply_list', fields: SUPPLY_INDEX_FIELDS }
};

function response(code, message, data) {
  return { code, message, data: data || null };
}

function parsePositiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

exports.main = async (event, context) => {
  const db = uniCloud.database();
  try {
    const adminResult = await requireAdmin(event, context);
    if (!adminResult.success) {
      return response(403, adminResult.error || '仅管理员可调用');
    }

    const mode = String(event.mode || event.type || 'all').trim().toLowerCase();
    const dryRun = event.dry_run === true || event.dryRun === true;
    const limit = parsePositiveInt(event.limit, 0);
    const batchSize = Math.min(parsePositiveInt(event.batchSize, 100), 200);
    const targets = mode === 'all' ? ['purchase', 'supply'] : [mode];

    const unknown = targets.filter((x) => !COLLECTION_MAP[x]);
    if (unknown.length) {
      return response(400, `不支持的 mode/type: ${unknown.join(', ')}`);
    }

    const summary = {};
    for (const target of targets) {
      summary[target] = await rebuildOneCollection({
        db,
        target,
        dryRun,
        limit,
        batchSize
      });
    }

    return response(200, dryRun ? 'dry_run 完成' : '重建完成', {
      mode,
      dry_run: dryRun,
      limit,
      batchSize,
      auth_mode: 'admin',
      summary
    });
  } catch (err) {
    console.error('rebuildSearchIndex error:', err);
    return response(500, '服务器内部错误', { error: err.message });
  }
};

async function rebuildOneCollection({ db, target, dryRun, limit, batchSize }) {
  const targetConfig = COLLECTION_MAP[target];
  const collection = db.collection(targetConfig.name);
  let offset = 0;
  let scanned = 0;
  let updated = 0;
  let failed = 0;
  let failedIds = [];
  const hardLimit = limit > 0 ? limit : Number.MAX_SAFE_INTEGER;

  while (scanned < hardLimit) {
    const size = Math.min(batchSize, hardLimit - scanned);
    const { data } = await collection.skip(offset).limit(size).get();
    if (!data || !data.length) break;

    for (const row of data) {
      scanned += 1;
      const values = pickSearchSourceValues(row, targetConfig.fields);
      const patch = makeSearchIndexPatch(values);
      if (dryRun) continue;
      try {
        await collection.doc(row._id).update({
          ...patch,
          updated_date: row.updated_date || new Date()
        });
        updated += 1;
      } catch (err) {
        failed += 1;
        failedIds.push(String(row._id));
        console.error(`[rebuildSearchIndex] 更新失败: ${target}/${row._id}`, err);
      }
    }

    if (data.length < size) break;
    offset += data.length;
  }

  return {
    collection: targetConfig.name,
    scanned,
    updated,
    failed,
    failed_ids: failedIds.slice(0, 50)
  };
}
