'use strict';

function safeString(value) {
  return value === undefined || value === null ? '' : String(value).trim();
}

function uniqStaffIds(ids) {
  const s = new Set();
  for (const id of ids) {
    const t = safeString(id);
    if (t) s.add(t);
  }
  return [...s];
}

function docFromGet(res) {
  const d = res && res.data;
  if (d == null) return null;
  if (Array.isArray(d)) return d.length ? d[0] : null;
  if (typeof d === 'object') return d;
  return null;
}

/**
 * @param {object} db uniCloud.database()
 * @param {string[]} staffIds sales_staff._id
 * @returns {Promise<Record<string, string>>} id -> sales_code
 */
async function batchSalesCodeByStaffId(db, staffIds) {
  const ids = uniqStaffIds(staffIds);
  if (!ids.length) return {};
  const _ = db.command;
  const map = {};
  const chunk = 50;
  for (let i = 0; i < ids.length; i += chunk) {
    const part = ids.slice(i, i + chunk);
    const res = await db
      .collection('sales_staff')
      .where({ _id: _.in(part) })
      .field({ _id: true, sales_code: true })
      .limit(100)
      .get();
    for (const row of res.data || []) {
      map[safeString(row._id)] = safeString(row.sales_code);
    }
  }
  return map;
}

const YW_RE = /^YW(\d{5})$/i;

/**
 * 下一个 YW#####（与历史 S001 等旧编号并存，仅扫描 YW 五位数字段）
 */
async function computeNextYwSalesCode(db) {
  const res = await db
    .collection('sales_staff')
    .where({ sales_code: new RegExp('^YW\\d{5}$', 'i') })
    .field({ sales_code: true })
    .limit(3000)
    .get();

  let maxNum = 10000;
  for (const row of res.data || []) {
    const m = YW_RE.exec(safeString(row.sales_code));
    if (m) {
      const n = parseInt(m[1], 10);
      if (n > maxNum) maxNum = n;
    }
  }
  const next = maxNum + 1;
  if (next > 99999) {
    const err = new Error('业务员编号已超过 YW99999 上限');
    err.code = 'YW_OVERFLOW';
    throw err;
  }
  return 'YW' + String(next).padStart(5, '0');
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 运营输入业务员编号 → 解析为内部 _id；兼容 24 位十六进制旧版「手填 _id」。
 */
async function resolveStaffByInput(db, rawInput) {
  const raw = safeString(rawInput);
  if (!raw) {
    return { ok: false, code: 400, message: '缺少业务员编号' };
  }

  if (/^[a-f0-9]{24}$/i.test(raw)) {
    const r = await db.collection('sales_staff').doc(raw).get();
    const row = docFromGet(r);
    if (row && row._id) {
      return {
        ok: true,
        data: {
          _id: safeString(row._id),
          sales_code: safeString(row.sales_code),
          sales_name: safeString(row.sales_name)
        }
      };
    }
  }

  const re = new RegExp('^' + escapeRegExp(raw) + '$', 'i');
  const r2 = await db
    .collection('sales_staff')
    .where({ sales_code: re })
    .limit(2)
    .get();
  const rows = r2.data || [];
  if (rows.length === 0) {
    return { ok: false, code: 404, message: '未找到该业务员编号对应的业务员' };
  }
  if (rows.length > 1) {
    return { ok: false, code: 409, message: '业务员编号匹配到多条记录，请联系技术处理' };
  }
  const row = rows[0];
  return {
    ok: true,
    data: {
      _id: safeString(row._id),
      sales_code: safeString(row.sales_code),
      sales_name: safeString(row.sales_name)
    }
  };
}

module.exports = {
  batchSalesCodeByStaffId,
  computeNextYwSalesCode,
  resolveStaffByInput,
  safeString
};
