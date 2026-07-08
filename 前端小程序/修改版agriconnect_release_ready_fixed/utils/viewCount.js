/**
 * 列表卡片浏览量：多字段兼容 + 展示格式化（与采购/供应列表统一）
 */

function parseCountField(value) {
    if (value == null || value === '') {
        return null;
    }
    const n = Number(value);
    if (n !== n || n < 0) {
        return null;
    }
    return Math.floor(n);
}

export function getViewCount(item) {
    if (!item || typeof item !== 'object') {
        return 0;
    }
    // 统一口径：优先后端标准累计浏览字段，再兼容历史字段
    const keys = ['current_view_count', 'view_count', 'views', 'browse_count', 'browseCount', 'read_count'];
    for (let i = 0; i < keys.length; i++) {
        const parsed = parseCountField(item[keys[i]]);
        if (parsed !== null) {
            return parsed;
        }
    }
    return 0;
}

export function formatListViewCount(item) {
    const n = getViewCount(item);
    if (n < 10000) {
        return String(n);
    }
    const w = n / 10000;
    const rounded = w >= 100 ? Math.round(w) : Math.round(w * 10) / 10;
    const s = rounded % 1 === 0 ? String(Math.round(rounded)) : rounded.toFixed(1);
    return s + '万';
}
