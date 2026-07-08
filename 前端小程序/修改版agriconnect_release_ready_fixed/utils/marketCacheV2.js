/**
 * 行情页本地缓存 v4：主备 + 元信息（与页面约定结构，勿随意改 key）
 */

export const STORAGE_ACTIVE = 'market_cache_active_v4';
export const STORAGE_BACKUP = 'market_cache_backup_v4';
export const STORAGE_META = 'market_cache_meta_v4';
const LEGACY_STORAGE_ACTIVE_KEYS = ['market_cache_active_v3', 'market_cache_active_v2'];
const LEGACY_STORAGE_BACKUP_KEYS = ['market_cache_backup_v3', 'market_cache_backup_v2'];

/** 轻量 pointer 检查节流：10 分钟内不重复（与「无缓存首进」无关） */
export const POINTER_CHECK_MIN_INTERVAL_MS = 10 * 60 * 1000;

const LOG_PREFIX = '[perf][market-cache]';

export function perfLog(...args) {
  console.log(LOG_PREFIX, ...args);
}

export function readStorageJson(key, defaultVal = null) {
  try {
    const s = uni.getStorageSync(key);
    if (s == null || s === '') return defaultVal;
    if (typeof s === 'object') return s;
    return JSON.parse(String(s));
  } catch (e) {
    return defaultVal;
  }
}

export function writeStorageJson(key, val) {
  try {
    uni.setStorageSync(key, typeof val === 'string' ? val : JSON.stringify(val));
    return true;
  } catch (e) {
    perfLog('写入失败', key, e);
    return false;
  }
}

export function hasValidMarketPayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  const products = Array.isArray(payload.bundleProducts) ? payload.bundleProducts : [];
  return validateBundleProducts(products);
}

export function readActivePayload() {
  const latest = readStorageJson(STORAGE_ACTIVE, null);
  if (hasValidMarketPayload(latest)) return latest;
  for (const key of LEGACY_STORAGE_ACTIVE_KEYS) {
    const legacy = readStorageJson(key, null);
    if (hasValidMarketPayload(legacy)) return legacy;
  }
  return null;
}

export function readBackupPayload() {
  const latest = readStorageJson(STORAGE_BACKUP, null);
  if (hasValidMarketPayload(latest)) return latest;
  for (const key of LEGACY_STORAGE_BACKUP_KEYS) {
    const legacy = readStorageJson(key, null);
    if (hasValidMarketPayload(legacy)) return legacy;
  }
  return null;
}

export function readMeta() {
  const m = readStorageJson(STORAGE_META, null);
  return m && typeof m === 'object' ? m : null;
}

export function writeMeta(partial) {
  const prev = readMeta() || {};
  const next = { ...prev, ...partial };
  writeStorageJson(STORAGE_META, next);
  return next;
}

/** 更新前：将当前 active 复制到 backup */
export function copyActiveToBackup() {
  const active = readActivePayload();
  if (!hasValidMarketPayload(active)) return false;
  writeStorageJson(STORAGE_BACKUP, active);
  return true;
}

/** 从 bundle 中抽取 products 数组（与行情页逻辑一致） */
export function extractBundleProducts(bundle) {
  if (!bundle) return [];
  const arr =
    (bundle && Array.isArray(bundle.products) && bundle.products) ||
    (bundle && Array.isArray(bundle.data) && bundle.data) ||
    (bundle && Array.isArray(bundle.items) && bundle.items) ||
    (Array.isArray(bundle) ? bundle : []);
  return Array.isArray(arr) ? arr : [];
}

export function validateBundleProducts(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return false;
  return arr.some((item) => {
    if (!item || typeof item !== 'object') return false;
    const name = String(item.name || item.productName || item.product || item.item || '').trim();
    const origin =
      item.origin_prices ||
      item.origin_markets ||
      item.originMarkets ||
      item.origins ||
      [];
    const wholesale =
      item.wholesale_prices ||
      item.wholesale_markets ||
      item.wholesaleMarkets ||
      item.wholesales ||
      [];
    const hasOrigin = Array.isArray(origin) && origin.length > 0;
    const hasWholesale = Array.isArray(wholesale) && wholesale.length > 0;
    return !!name || hasOrigin || hasWholesale;
  });
}

/** 用 pointer 对象生成版本标识（用于判断是否与上次一致） */
export function getPointerVersionKey(pointer) {
  if (pointer == null) return '';
  try {
    if (typeof pointer === 'string') return pointer;
    return JSON.stringify(pointer);
  } catch (e) {
    return String(pointer);
  }
}

/** 取第一个非空字符串（用于解析 pointer 中的 URL） */
function firstNonEmptyString(...candidates) {
  for (const v of candidates) {
    if (v == null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return '';
}

export function buildUrlsFromPointer(pointer) {
  if (!pointer || typeof pointer !== 'object') {
    return { bundleUrl: '', analysisUrl: '' };
  }
  const bundleUrl = firstNonEmptyString(
    pointer.fileID,
    pointer.fileId,
    pointer.publicUrl,
    pointer.public_url,
    pointer.bundle_url,
    pointer.url,
    pointer.fileUrl,
    pointer.bundleUrl,
    pointer.bundle_publicUrl,
    pointer.bundle_public_url,
    pointer.bundle_fileID,
    pointer.bundle_fileId,
    pointer.data_url,
    pointer.dataUrl
  );
  const analysisUrl =
    pointer.analysis_publicUrl ||
    pointer.analysis_public_url ||
    pointer.analysis_url ||
    pointer.analysisUrl ||
    pointer.analysis_fileID ||
    pointer.analysis_fileId ||
    '';
  return { bundleUrl, analysisUrl };
}

/**
 * 与 hydrate 一致：active 或 backup 任一侧 hasValidMarketPayload 即视为本地有可展示缓存。
 * 供 pointer / 全量拉取决策与验收日志使用。
 */
export function getLocalCacheState() {
  const activePayload = readActivePayload();
  const backupPayload = readBackupPayload();
  const activeValid = !!activePayload;
  const backupValid = !!backupPayload;
  let activeLen = 0;
  if (activePayload && Array.isArray(activePayload.bundleProducts)) {
    activeLen = activePayload.bundleProducts.length;
  } else {
    const raw = readStorageJson(STORAGE_ACTIVE, null);
    activeLen = raw && Array.isArray(raw.bundleProducts) ? raw.bundleProducts.length : 0;
  }
  let backupLen = 0;
  if (backupPayload && Array.isArray(backupPayload.bundleProducts)) {
    backupLen = backupPayload.bundleProducts.length;
  } else {
    const rawB = readStorageJson(STORAGE_BACKUP, null);
    backupLen = rawB && Array.isArray(rawB.bundleProducts) ? rawB.bundleProducts.length : 0;
  }
  return {
    hasValidLocalCache: activeValid || backupValid,
    activeValid,
    backupValid,
    activeLen,
    backupLen
  };
}

/** 从 bundle / pointer 推导数据日期（辅助展示，不作为删缓存条件） */
export function inferDataDate(bundle, pointer) {
  const gen =
    (bundle && (bundle.generated_at || bundle.updated_at || bundle.data_date)) ||
    (pointer && (pointer.data_date || pointer.dataDate || pointer.updated_at)) ||
    '';
  if (!gen) return '';
  const d = new Date(gen);
  if (isNaN(d.getTime())) return String(gen).slice(0, 10);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
