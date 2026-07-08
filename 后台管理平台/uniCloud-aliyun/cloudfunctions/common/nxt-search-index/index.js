'use strict';

const SEARCH_VERSION = 1;
const DEFAULT_MAX_TERMS = 260;
const CJK_CHAR_RE = /[\u3400-\u9fff]/;
const ALPHANUM_RE = /^[a-z0-9]+$/;
const STOP_WORDS = new Set(['的', '了', '和', '及', '与', '或', '等', '是', '在', '有', '为', '及其', '供应', '采购']);

function normalizeText(value) {
  return String(value == null ? '' : value)
    .toLowerCase()
    .trim()
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[，。！？、；：,.!?;:~`'"“”‘’【】（）()《》<>[\]{}|\\/+=*&^%$#@]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function tokenizeNormalizedText(normalizedText) {
  if (!normalizedText) return [];
  return normalizedText
    .split(/[\s\-_/]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function isDirtyTerm(term) {
  if (!term) return true;
  if (STOP_WORDS.has(term)) return true;
  if (term.length <= 1 && !CJK_CHAR_RE.test(term) && !ALPHANUM_RE.test(term)) return true;
  return false;
}

function pickCjkChunks(text, minLen = 2, maxLen = 6) {
  if (!text) return [];
  const compact = text.replace(/\s+/g, '');
  if (!compact) return [];
  const chars = Array.from(compact);
  const out = [];
  for (let len = minLen; len <= maxLen; len += 1) {
    for (let i = 0; i + len <= chars.length; i += 1) {
      const chunk = chars.slice(i, i + len).join('');
      if (chunk) out.push(chunk);
    }
  }
  return out;
}

function appendTerms(bucket, term, maxTerms) {
  const normalized = normalizeText(term);
  if (!normalized || isDirtyTerm(normalized) || bucket.size >= maxTerms) return;
  bucket.add(normalized);
}

function buildSearchTerms(rawValues, options = {}) {
  const maxTerms = Number(options.maxTerms) > 0 ? Number(options.maxTerms) : DEFAULT_MAX_TERMS;
  const terms = new Set();
  const values = Array.isArray(rawValues) ? rawValues : [];

  for (const raw of values) {
    const normalized = normalizeText(raw);
    if (!normalized) continue;
    appendTerms(terms, normalized, maxTerms);
    if (terms.size >= maxTerms) break;

    const splitTokens = tokenizeNormalizedText(normalized);
    for (const token of splitTokens) {
      appendTerms(terms, token, maxTerms);
      if (terms.size >= maxTerms) break;
      if (CJK_CHAR_RE.test(token)) {
        const chunks = pickCjkChunks(token, 2, 6);
        for (const chunk of chunks) {
          appendTerms(terms, chunk, maxTerms);
          if (terms.size >= maxTerms) break;
        }
      }
      if (terms.size >= maxTerms) break;
    }
    if (terms.size >= maxTerms) break;
  }

  return Array.from(terms).slice(0, maxTerms);
}

function buildSearchText(rawValues) {
  const values = Array.isArray(rawValues) ? rawValues : [];
  const merged = values
    .map((v) => normalizeText(v))
    .filter(Boolean)
    .join(' ')
    .trim();
  return normalizeText(merged);
}

function makeSearchIndexPatch(rawValues, options = {}) {
  const search_text = buildSearchText(rawValues);
  const search_terms = buildSearchTerms(rawValues, options);
  return {
    search_text,
    search_terms,
    search_version: SEARCH_VERSION
  };
}

function tokenizeKeyword(keyword) {
  const normalized = normalizeText(keyword);
  if (!normalized) return [];
  const baseTokens = tokenizeNormalizedText(normalized);
  if (!baseTokens.length) return [];

  const out = [];
  const seen = new Set();
  for (const token of baseTokens) {
    const finalToken = normalizeText(token);
    if (!finalToken || seen.has(finalToken) || isDirtyTerm(finalToken)) continue;
    seen.add(finalToken);
    out.push(finalToken);
  }
  return out;
}

const PURCHASE_INDEX_FIELDS = [
  'title',
  'product_name',
  'productName',
  'product_variety',
  'variety_name',
  'category',
  'category_name',
  'product_category',
  'specifications',
  'specification',
  'spec',
  'remarks',
  'address',
  'location',
  'region',
  'receiving_address',
  'receive_location'
];

const SUPPLY_INDEX_FIELDS = [
  'title',
  'product_name',
  'productName',
  'product_variety',
  'variety_name',
  'category',
  'category_name',
  'product_category',
  'specifications',
  'specification',
  'spec',
  'description',
  'desc_short',
  'location',
  'origin',
  'ship_from'
];

function pickSearchSourceValues(doc, fields) {
  const source = doc || {};
  return (fields || []).map((key) => source[key]).filter((v) => v !== undefined && v !== null && String(v).trim() !== '');
}

module.exports = {
  SEARCH_VERSION,
  PURCHASE_INDEX_FIELDS,
  SUPPLY_INDEX_FIELDS,
  normalizeText,
  tokenizeKeyword,
  buildSearchText,
  buildSearchTerms,
  makeSearchIndexPatch,
  pickSearchSourceValues
};
