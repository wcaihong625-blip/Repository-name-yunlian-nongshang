// utils/util.js - 通用工具函数

// 格式化时间
export function formatTime(date) {
    const now = new Date();
    const target = new Date(date);
    const diff = now - target;
    const minute = 60000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (diff < minute) {
        return '刚刚';
    } else if (diff < hour) {
        return Math.floor(diff / minute) + '分钟前';
    } else if (diff < day) {
        return Math.floor(diff / hour) + '小时前';
    } else if (diff < 7 * day) {
        return Math.floor(diff / day) + '天前';
    } else {
        const year = target.getFullYear();
        const month = target.getMonth() + 1;
        const day = target.getDate();
        return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;
    }
}

// 格式化日期
export function formatDate(date, format = 'YYYY-MM-DD') {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');
    return format.replace('YYYY', year).replace('MM', month).replace('DD', day).replace('HH', hour).replace('mm', minute).replace('ss', second);
}

// 手机号验证
export function validatePhone(phone) {
    return /^1[3-9]\d{9}$/.test(phone);
}

// 显示加载提示
export function showLoading(title = '加载中...') {
    uni.showLoading({
        title: title,
        mask: true
    });
}

// 隐藏加载提示
export function hideLoading() {
    uni.hideLoading();
}

// 显示成功提示
export function showSuccess(title) {
    uni.showToast({
        title: title,
        icon: 'success',
        duration: 2000
    });
}

// 显示错误提示
export function showError(title) {
    uni.showToast({
        title: title,
        icon: 'none',
        duration: 2000
    });
}

// 显示确认对话框
export function showConfirm(content) {
    return new Promise((resolve) => {
        uni.showModal({
            title: '提示',
            content: content,
            success: (res) => {
                resolve(res.confirm);
            },
            fail: () => {
                resolve(false);
            }
        });
    });
}

// 拨打电话
export function makePhoneCall(phone) {
    uni.makePhoneCall({
        phoneNumber: phone,
        fail: (err) => {
            console.error('拨打电话失败', err);
            showError('拨打电话失败');
        }
    });
}

// 防抖函数
export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// 节流函数
export function throttle(func, wait) {
    let timeout;
    return function (...args) {
        if (!timeout) {
            timeout = setTimeout(() => {
                timeout = null;
                func.apply(this, args);
            }, wait);
        }
    };
}

// 深拷贝
export function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }
    if (obj instanceof Date) {
        return new Date(obj.getTime());
    }
    if (obj instanceof Array) {
        return obj.map((item) => deepClone(item));
    }
    if (typeof obj === 'object') {
        const cloned = {};
        Object.keys(obj).forEach((key) => {
            cloned[key] = deepClone(obj[key]);
        });
        return cloned;
    }
}

// 格式化日期为 YYYY-MM-DD 格式（简化版，用于列表显示）
export function formatDateSimple(date) {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 获取状态颜色
export function getStatusColor(status) {
    const colors = {
        '已发布': '#16a34a',
        '已下架': '#9ca3af',
        '审核中': '#f59e0b',
        '审核失败': '#ef4444'
    };
    return colors[status] || '#9ca3af';
}

// 解析时间字符串为分钟数（用于排序）
export function parseTimeToMinutes(timeStr) {
    if (!timeStr) {
        return 0;
    }
    if (timeStr.includes('分钟前')) {
        const minutes = parseInt(timeStr) || 0;
        return minutes;
    } else if (timeStr.includes('小时前')) {
        const hours = parseInt(timeStr) || 0;
        return hours * 60;
    } else if (timeStr.includes('天前')) {
        const days = parseInt(timeStr) || 0;
        return days * 24 * 60;
    } else if (timeStr.includes('周前')) {
        const weeks = parseInt(timeStr) || 0;
        return weeks * 7 * 24 * 60;
    }
    return 0;
}

// 计算列表统计数据（按状态分组）
export function calculateListStats(list, statusField = 'status') {
    const stats = {
        total: list.length,
        published: 0,
        offline: 0
    };
    list.forEach((item) => {
        const status = item[statusField];
        switch (status) {
            case '已发布':
                stats.published++;
                break;
            case '已下架':
                stats.offline++;
                break;
        }
    });
    return stats;
}

// CommonJS导出（兼容require, 仅在支持 module 的环境下执行，避免 H5 报错）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        formatTime,
        formatDate,
        formatDateSimple,
        validatePhone,
        showLoading,
        hideLoading,
        showSuccess,
        showError,
        showConfirm,
        makePhoneCall,
        debounce,
        throttle,
        deepClone,
        getStatusColor,
        parseTimeToMinutes,
        calculateListStats
    };
}
