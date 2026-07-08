/**
 * 采购列表：字段归一化与时间展示（兼容多后端字段名，对齐原型规则）
 */

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

function pad2(n) {
    return String(n).padStart(2, '0');
}

export function normalizeProcurementItem(raw) {
    if (!raw || typeof raw !== 'object') {
        raw = {};
    }
    const r = raw;

    const unitRaw = r.unit != null && String(r.unit).trim() !== '' ? String(r.unit).trim() : '';
    const qty = r.quantity != null ? String(r.quantity).trim() : '';
    const defaultUnit = '吨';
    const unit = unitRaw || (qty ? defaultUnit : '');

    let quantityDisplay = '';
    if (qty && unit) {
        quantityDisplay = `${qty} ${unit}`;
    } else if (qty) {
        quantityDisplay = `${qty} ${defaultUnit}`;
    } else if (r.quantity_text) {
        quantityDisplay = String(r.quantity_text);
    }

    const truthy = (v) => v === true || v === 1 || v === '1';
    const isUrgent = truthy(r.is_urgent) || !!(r.urgent || r.urgency === 'Urgent' || r.urgency === 'urgent');
    const isLongTerm = truthy(r.is_long_term) || !!(r.long_term || r.longTerm || r.isLongTerm);
    const isVerified = truthy(r.is_verified) || !!(r.verified || r.real_name_verified || r.enterprise_verified);
    const isEnterprise = !!(r.enterprise_verified || r.is_enterprise || r.enterpriseVerified);
    const isRealname = !!(r.real_name_verified || r.is_realname || r.realname_verified);

    const productName = (r.product_name || r.productName || '').trim();

    let title = (r.title || '').trim();
    if (!title) {
        const prefix = isLongTerm ? '长期求购' : '求购';
        if (productName && quantityDisplay) {
            title = `${prefix}${productName} ${quantityDisplay}`;
        } else if (productName) {
            title = `${prefix}${productName}`;
        } else if (r.category) {
            title = quantityDisplay ? `${prefix}${r.category} ${quantityDisplay}` : `${prefix}${r.category}`;
        } else {
            title = '采购需求';
        }
    }

    const priceUnit = '斤';
    const pm = r.price_min != null ? r.price_min : r.priceMin;
    const px = r.price_max != null ? r.price_max : r.priceMax;
    let priceDisplay = '';
    if (r.price_negotiable === true || r.price_negotiable === 'true' || r.price_negotiable === 1 || r.price_negotiable === '1') {
        priceDisplay = '面议';
    } else if (r.price_text != null && String(r.price_text).trim() !== '') {
        priceDisplay = String(r.price_text).trim();
    } else if (pm != null && pm !== '' && px != null && px !== '') {
        const n1 = Number(pm);
        const n2 = Number(px);
        if (!isNaN(n1) && !isNaN(n2) && n1 === n2) {
            priceDisplay = `${n1} 元/${priceUnit}`;
        } else {
            priceDisplay = `${pm}-${px} 元/${priceUnit}`;
        }
    } else if (r.price != null && r.price !== '') {
        const p = String(r.price).trim();
        if (p.includes('面议')) {
            priceDisplay = '面议';
        } else {
            priceDisplay = p.includes('元') ? p : `${p} 元/${priceUnit}`;
        }
    } else {
        priceDisplay = '面议';
    }

    const spec = (r.spec || r.specifications || r.specification || '').trim();

    const location = (
        r.location ||
        r.receive_location ||
        r.receiving_location ||
        r.address ||
        r.region ||
        r.receiving_address ||
        ''
    ).trim();

    const deadlineRaw = r.deadline || r.end_time || r.deadline_at || r.endTime || '';

    const publishRaw = r.publish_time || r.time || r.createTime || r.created_at || r.create_time || r.publishTime || '';

    let isEnded = !!(
        r.status === 'expired' ||
        r.status === '已结束' ||
        r.status === 'closed' ||
        r.status === 'ended' ||
        r.closed
    );
    const deadlineDate = parseToDate(deadlineRaw);
    if (!isEnded && deadlineDate && deadlineDate.getTime() < Date.now()) {
        isEnded = true;
    }

    let publisherName = (r.publisher_name || r.publisher || r.nickname || r.username || '').trim();
    if (!publisherName) {
        publisherName = '匿名用户';
    }
    let publisherRole = (r.publisher_role || r.role || r.identity || r.user_type || '').trim();
    const avatarUrl = (
        r.publisher_avatar ||
        r.avatar_url ||
        r.avatarUrl ||
        r.avatar ||
        r.avatar_file ||
        (r.userInfo && (r.userInfo.avatar || r.userInfo.avatar_url || r.userInfo.avatarUrl)) ||
        ''
    ).trim();

    if (!publisherRole) {
        publisherRole = '采购方';
    }

    let lat = r.latitude != null ? Number(r.latitude) : r.lat != null ? Number(r.lat) : NaN;
    let lng = r.longitude != null ? Number(r.longitude) : r.lng != null ? Number(r.lng) : NaN;
    if (isNaN(lat)) lat = null;
    if (isNaN(lng)) lng = null;

    const id = r.id != null && r.id !== '' ? r.id : r._id != null ? r._id : '';

    /** 推广置顶/加急：优先使用列表接口下发的布尔位，否则用主表到期时间与当前时间比较 */
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

    let priceSortValue = NaN;
    if (pm != null && pm !== '' && !isNaN(Number(pm))) {
        const n1 = Number(pm);
        const n2 = px != null && px !== '' && !isNaN(Number(px)) ? Number(px) : n1;
        priceSortValue = (n1 + n2) / 2;
    } else if (r.price != null && r.price !== '' && !isNaN(Number(r.price))) {
        priceSortValue = Number(r.price);
    } else if (priceDisplay && !String(priceDisplay).includes('面议')) {
        const m = String(priceDisplay).match(/(\d+(?:\.\d+)?)/);
        if (m) priceSortValue = Number(m[1]);
    }
    const qtyNum = r.quantity != null && r.quantity !== '' ? Number(r.quantity) : NaN;
    const qtySortValue = !isNaN(qtyNum) ? qtyNum : 0;
    const publishDate = parseToDate(publishRaw) || parseToDate(r.created_date);
    const timeSortValue = publishDate ? publishDate.getTime() : 0;

    return {
        ...r,
        id,
        _pv: {
            title,
            productName,
            quantityDisplay,
            priceDisplay,
            spec,
            location,
            deadlineRaw,
            deadlineDate,
            publishRaw,
            isUrgent,
            isLongTerm,
            isVerified,
            isEnded,
            publisherName,
            publisherRole,
            avatarUrl,
            isEnterprise,
            isRealname,
            lat,
            lng,
            promoTopActive,
            promoBoostActive,
            priceSortValue: Number.isFinite(priceSortValue) ? priceSortValue : 0,
            qtySortValue,
            timeSortValue,
            distanceSortValue: null
        }
    };
}

/** 详情等：无 deadline 可展示「长期有效」 */
export function formatDeadlineMeta(item) {
    const pv = item._pv || item;
    if (!pv.deadlineRaw && !pv.deadlineDate) {
        return '长期有效';
    }
    const d = pv.deadlineDate || parseToDate(pv.deadlineRaw);
    if (!d) {
        return typeof pv.deadlineRaw === 'string' ? pv.deadlineRaw : '长期有效';
    }
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    if (dStart.getTime() === todayStart.getTime()) {
        return `今天${hm}`;
    }
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/**
 * 列表卡片一行：无截止则空串（不展示中段）；否则「YYYY-MM-DD截止」或「今天HH:mm截止」
 */
export function formatDeadlineCardRow(item) {
    const pv = item._pv || item;
    if (!pv.deadlineRaw && !pv.deadlineDate) {
        return '';
    }
    const d = pv.deadlineDate || parseToDate(pv.deadlineRaw);
    if (!d) {
        const s = typeof pv.deadlineRaw === 'string' ? pv.deadlineRaw.trim() : '';
        return s && !s.includes('截止') ? `${s}截止` : s;
    }
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const hm = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    if (dStart.getTime() === todayStart.getTime()) {
        return `今天${hm}截止`;
    }
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}截止`;
}

export function formatPublishRelative(item) {
    const publishRaw = (item._pv && item._pv.publishRaw) || item.publishRaw || '';
    if (!publishRaw) return '';
    const d = parseToDate(publishRaw);
    if (!d) return typeof publishRaw === 'string' ? publishRaw : '';
    const diff = Date.now() - d.getTime();
    if (diff < 0) return '刚刚';
    const m = Math.floor(diff / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return `${m}分钟前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}小时前`;
    const dayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    if (d >= dayStart) return '今天';
    return `${d.getMonth() + 1}月${d.getDate()}日`;
}

/** 原型：相对发布时间含「分钟」「小时」则算今日发布标签 */
export function isTodayPublishTag(item) {
    const t = formatPublishRelative(item);
    if (!t) return false;
    return t.indexOf('分钟') !== -1 || t.indexOf('小时') !== -1;
}

export function distanceKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const toR = (x) => (x * Math.PI) / 180;
    const dLat = toR(lat2 - lat1);
    const dLng = toR(lng2 - lng1);
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
