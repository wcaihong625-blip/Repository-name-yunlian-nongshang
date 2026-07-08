/**
 * 供应列表：字段归一化、价格/库存/发货地展示（兼容多后端字段名）
 */
import { getViewCount } from './viewCount.js';

function parseToDate(val) {
    if (val == null || val === '') return null;
    if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
    if (typeof val === 'number') {
        const dt = new Date(val > 1e12 ? val : val * 1000);
        return isNaN(dt.getTime()) ? null : dt;
    }
    const s = String(val).trim();
    if (!s) return null;
    const t = Date.parse(s.replace(/-/g, '/'));
    if (!isNaN(t)) return new Date(t);
    return null;
}

function formatRelativeTimeFromDate(time) {
    if (!time) return '';
    const now = new Date();
    const diff = now - time;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    const y = time.getFullYear();
    const m = String(time.getMonth() + 1).padStart(2, '0');
    const d = String(time.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export function formatSupplyUpdateText(rawTime, fallbackStr) {
    const ds = parseToDate(rawTime);
    if (ds) {
        return formatRelativeTimeFromDate(ds) + '更新';
    }
    if (fallbackStr && String(fallbackStr).trim()) {
        const t = String(fallbackStr).trim();
        return t.includes('更新') ? t : `${t}更新`;
    }
    return '';
}

function truthy(v) {
    return v === true || v === 1 || v === '1' || v === 'true';
}

function firstNum(str) {
    if (str == null || str === '') return NaN;
    const m = String(str).match(/(\d+\.?\d*)/);
    return m ? parseFloat(m[1]) : NaN;
}

function pickSpecLine(r) {
    const parts = [r.spec, r.grade, r.desc_short, r.descShort, r.specifications, r.specification]
        .map((x) => (x != null ? String(x).trim() : ''))
        .filter(Boolean);
    return parts.length ? parts.join(' · ') : '';
}

function pickShipFrom(r) {
    return (
        (r.ship_from && String(r.ship_from).trim()) ||
        (r.origin && String(r.origin).trim()) ||
        (r.location && String(r.location).trim()) ||
        ''
    );
}

function shortRegionLabel(shipFrom) {
    if (!shipFrom) return '';
    const s = String(shipFrom).trim();
    if (s.length <= 8) return s;
    const noSuffix = s.replace(/省|市|自治区|壮族自治区|回族自治区|维吾尔自治区/g, '');
    if (noSuffix.length <= 8) return noSuffix;
    return noSuffix.slice(0, 8) + '…';
}

function extractPriceSortValue(r, priceDisplay) {
    const pmin = r.price_min != null ? r.price_min : r.priceMin != null ? r.priceMin : r.min_price;
    const pmax = r.price_max != null ? r.price_max : r.priceMax != null ? r.priceMax : r.max_price;
    if (pmin != null && pmin !== '') {
        const n = Number(pmin);
        if (!isNaN(n)) return n;
    }
    if (r.price != null && r.price !== '') {
        const n = Number(r.price);
        if (!isNaN(n)) return n;
    }
    return firstNum(priceDisplay);
}

function extractStockSortValue(r) {
    const keys = ['stock', 'inventory', 'quantity', 'supply_amount'];
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (r[k] != null && r[k] !== '') {
            const n = Number(r[k]);
            if (!isNaN(n)) return n;
        }
    }
    return 0;
}

function extractTimeSortValue(r) {
    const raw =
        r.update_time ||
        r.updateTime ||
        r.publish_time ||
        r.publishTime ||
        r.create_time ||
        r.created_date ||
        r.time;
    const d = parseToDate(raw);
    return d ? d.getTime() : 0;
}

const DEFAULT_IMG = '/static/images/default-product.png';

function toCleanString(v) {
    if (v == null) return '';
    const s = String(v).trim();
    return s;
}

function pickFirstText(obj, keys) {
    for (let i = 0; i < keys.length; i++) {
        const val = toCleanString(obj[keys[i]]);
        if (val) return val;
    }
    return '';
}

function parseImageValue(val) {
    if (val == null) return [];
    if (Array.isArray(val)) {
        return val
            .map((it) => toCleanString(it && it.url ? it.url : it))
            .filter(Boolean);
    }
    const s = toCleanString(val);
    if (!s) return [];
    if (s[0] === '[') {
        try {
            const arr = JSON.parse(s);
            if (Array.isArray(arr)) {
                return arr
                    .map((it) => toCleanString(it && it.url ? it.url : it))
                    .filter(Boolean);
            }
        } catch (_e) {
            /* ignore */
        }
    }
    return s
        .split(/[,\n]/)
        .map((it) => toCleanString(it))
        .filter(Boolean);
}

function pickImageList(r) {
    const candidates = [
        r.imageList,
        r.images,
        r.pictures,
        r.photos,
        r.photo_list,
        r.image_list,
        r.gallery
    ];
    let list = [];
    for (let i = 0; i < candidates.length; i++) {
        const parsed = parseImageValue(candidates[i]);
        if (parsed.length) {
            list = parsed;
            break;
        }
    }
    const cover = toCleanString(r.cover || r.image || r.imageUrl || r.pic || r.thumb);
    if (cover && list.indexOf(cover) === -1) {
        list.unshift(cover);
    }
    return list.filter(Boolean);
}

/**
 * 归一化单条供应，写入 _sv 供列表模板使用
 */
export function normalizeSupplyItem(raw) {
    if (!raw || typeof raw !== 'object') {
        raw = {};
    }
    const r = raw;

    const title = (r.title || r.product_name || r.productName || '').trim() || '供应信息';

    const imageList = pickImageList(r);
    let imageUrl = imageList[0] || '';
    if (!imageUrl) {
        imageUrl = DEFAULT_IMG;
    }

    const priceUnit = (r.price_unit && String(r.price_unit).trim()) || (r.unit && String(r.unit).trim()) || '吨';

    let priceDisplay = '';
    if (truthy(r.price_negotiable)) {
        priceDisplay = '面议';
    } else if (r.price_text != null && String(r.price_text).trim() !== '') {
        const pt = String(r.price_text).trim();
        if (pt.indexOf('面议') >= 0) {
            priceDisplay = '面议';
        } else if (pt.indexOf('￥') === 0 || pt.indexOf('¥') === 0) {
            priceDisplay = pt;
        } else {
            priceDisplay = '￥' + pt;
        }
    } else {
        const pm = r.price_min != null ? r.price_min : r.priceMin != null ? r.priceMin : r.min_price;
        const px = r.price_max != null ? r.price_max : r.priceMax != null ? r.priceMax : r.max_price;
        if (pm != null && pm !== '' && px != null && px !== '') {
            const n1 = Number(pm);
            const n2 = Number(px);
            if (!isNaN(n1) && !isNaN(n2)) {
                priceDisplay = n1 === n2 ? `￥${n1} / ${priceUnit}` : `￥${n1}-${n2} / ${priceUnit}`;
            }
        }
        if (!priceDisplay && r.price != null && r.price !== '') {
            if (typeof r.price === 'number' && !isNaN(r.price)) {
                priceDisplay = `￥${r.price} / ${priceUnit}`;
            } else {
                const ps = String(r.price).trim();
                if (ps.indexOf('面议') >= 0) {
                    priceDisplay = '面议';
                } else if (ps.indexOf('￥') === 0 || ps.indexOf('¥') === 0 || ps.indexOf('元') >= 0) {
                    priceDisplay = ps;
                } else {
                    priceDisplay = `￥${ps} / ${priceUnit}`;
                }
            }
        }
    }
    if (!priceDisplay) {
        priceDisplay = '面议';
    }

    const stockUnit =
        (r.unit && String(r.unit).trim()) ||
        (r.price_unit && String(r.price_unit).trim()) ||
        '吨';
    const stockRaw =
        r.stock != null
            ? r.stock
            : r.quantity != null
              ? r.quantity
              : r.supply_amount != null
                ? r.supply_amount
                : r.inventory;
    let stockDisplay = '';
    if (stockRaw != null && String(stockRaw).trim() !== '') {
        stockDisplay = `库存：${String(stockRaw).trim()} ${stockUnit}`;
    }

    const shipFrom = pickShipFrom(r) || pickFirstText(r, ['delivery_place', 'from']);
    const shipDisplay = shipFrom ? `发货地：${shipFrom}` : '';

    const publisherName =
        (r.publisher_name && String(r.publisher_name).trim()) ||
        (r.seller_name && String(r.seller_name).trim()) ||
        (r.publisher && String(r.publisher).trim()) ||
        (r.nickname && String(r.nickname).trim()) ||
        '匿名卖家';

    const publishText = formatSupplyUpdateText(
        r.publish_time || r.publishTime || r.create_time || r.created_date || r.time,
        r.publish_time_text || r.publishTimeText
    );
    const updateText = formatSupplyUpdateText(
        r.update_time || r.updateTime || r.publish_time || r.publishTime || r.create_time || r.created_date,
        r.updateTime || r.time
    );

    const specLine = pickSpecLine(r);
    const productName = pickFirstText(r, ['product_name', 'productName', 'name', 'product']);
    const productVariety = pickFirstText(r, ['product_variety', 'variety_name', 'variety']);
    const categoryName = pickFirstText(r, ['category_name', 'category', 'cate_name', 'type_name']);
    const specification = pickFirstText(r, ['specifications', 'specification', 'spec', 'standard']);
    const originName = pickFirstText(r, ['origin', 'location', 'ship_from']);
    const supplyMode = pickFirstText(r, ['supply_mode', 'supplyMode', 'delivery_mode', 'deliveryMode']);
    const transportMode = pickFirstText(r, ['transport_mode', 'shipping_mode', 'shippingMode', 'delivery_type']);
    const descriptionText = pickFirstText(r, ['description', 'desc_short', 'descShort']);
    const viewsDisplay = String(getViewCount(r));

    const st = r.status;
    const isEnded =
        st === 'expired' ||
        st === 'off_shelf' ||
        st === '已下架' ||
        st === '已结束' ||
        st === 'ended' ||
        st === 'closed';

    const tags = [];
    if (truthy(r.is_in_stock)) {
        tags.push({ text: '现货', cls: 's-tag-stock' });
    }
    if (truthy(r.is_origin_direct) || truthy(r.origin_direct)) {
        tags.push({ text: '产地直发', cls: 's-tag-origin' });
    }
    if (truthy(r.is_long_term_supply) || truthy(r.long_term) || truthy(r.isLongTerm)) {
        tags.push({ text: '可长期供货', cls: 's-tag-long' });
    }
    const tagsLimited = tags.slice(0, 3);
    const realnameVerified = truthy(r.isRealNameVerified) || truthy(r.real_name_verified) || truthy(r.is_verified);
    const enterpriseVerified = truthy(r.isEnterpriseVerified) || truthy(r.enterprise_verified) || truthy(r.is_enterprise_verified);

    const regionBadge = shortRegionLabel(shipFrom);

    const priceSortValue = extractPriceSortValue(r, priceDisplay);
    const stockSortValue = extractStockSortValue(r);
    const timeSortValue = extractTimeSortValue(r);
    const distanceSortValue =
        r.distance != null && !isNaN(Number(r.distance)) ? Number(r.distance) : r.distance_km != null ? Number(r.distance_km) : null;

    const nowMs = Date.now();
    const topUntil = parseToDate(r.top_expire_time);
    const boostUntil = parseToDate(r.promo_boost_expire_time);
    const promoTopActive =
        r.promoTopActive === true || r.promoTopActive === 1
            ? true
            : r.promoTopActive === false || r.promoTopActive === 0
              ? false
              : !!(topUntil && topUntil.getTime() > nowMs);
    const promoBoostActive =
        r.promoBoostActive === true || r.promoBoostActive === 1
            ? true
            : r.promoBoostActive === false || r.promoBoostActive === 0
              ? false
              : !!(boostUntil && boostUntil.getTime() > nowMs);

    return {
        ...r,
        _sv: {
            title,
            imageUrl,
            imageList,
            priceDisplay,
            specLine,
            stockDisplay,
            shipDisplay,
            shipFrom,
            productName,
            productVariety,
            categoryName,
            specification,
            originName,
            supplyMode,
            transportMode,
            descriptionText,
            viewsDisplay,
            publisherName,
            realnameVerified,
            enterpriseVerified,
            publishText,
            updateText,
            regionBadge,
            tagsLimited,
            isEnded,
            endedLabel: isEnded ? (st === 'expired' || st === '已结束' ? '已结束' : '已下架') : '',
            priceSortValue: isNaN(priceSortValue) ? 0 : priceSortValue,
            stockSortValue,
            timeSortValue,
            distanceSortValue,
            promoTopActive,
            promoBoostActive
        }
    };
}
