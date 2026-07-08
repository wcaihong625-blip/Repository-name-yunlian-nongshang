// utils/api.js - API请求封装
import { getViewCount } from './viewCount.js';
const baseURL = 'https://your-api-domain.com/api'; // 替换为实际API地址

// 云函数调用封装
let isShowingVipModal = false;

function getStoredToken() {
    return (
        uni.getStorageSync('token') ||
        uni.getStorageSync('uni_id_token') ||
        uni.getStorageSync('uniIdToken') ||
        ''
    );
}

function clearStoredAuth() {
    uni.removeStorageSync('token');
    uni.removeStorageSync('uni_id_token');
    uni.removeStorageSync('uniIdToken');
    uni.removeStorageSync('uni_id_token_expired');
    uni.removeStorageSync('userInfo');
}

function redirectToLogin(message = '登录状态已失效，请重新登录') {
    const pages = getCurrentPages();
    const currentPage = pages[pages.length - 1];
    if (currentPage && currentPage.route && currentPage.route !== 'pages/login/login') {
        uni.setStorageSync('redirectUrl', `/${currentPage.route}`);
    }

    try {
        const app = getApp();
        if (app && app.globalData) {
            app.globalData.isLoggedIn = false;
            app.globalData.userInfo = null;
        }
    } catch (error) {
        console.warn('[API] 重置全局登录态失败:', error);
    }

    clearStoredAuth();
    uni.showToast({
        title: message,
        icon: 'none',
        duration: 2000
    });
    setTimeout(() => {
        uni.reLaunch({
            url: '/pages/login/login'
        });
    }, 300);
}

function callCloudFunction(name, data = {}) {
    return new Promise((resolve, reject) => {
        // 自动添加token到请求数据中（如果用户已登录）
        const token = getStoredToken();
        const userInfo = uni.getStorageSync('userInfo') || {};
        const finalData = { ...data };
        if (token) {
            finalData.token = token;
            finalData.uniIdToken = token;
        }

        const userId = userInfo.user_id || userInfo._id || userInfo.id || '';
        // 公开供应/采购列表不应带当前 user_id，否则只会查到「自己的」数据，搜索全站失效
        const skipAutoUserId =
            (name === 'getSupplyList' || name === 'getPurchaseList') && finalData.my !== true;
        if (userId && !skipAutoUserId && finalData.user_id == null) {
            finalData.user_id = userId;
        }

        uniCloud.callFunction({
            name: name,
            data: finalData,
            success: (res) => {
                // 上线勿打印完整入参/出参，避免 token 与业务数据进入客户端日志

                // 检查云函数是否调用成功
                if (!res.result) {
                    const errorMsg = '云函数返回数据格式错误';
                    console.error(`云函数 ${name} 返回错误:`, res);
                    uni.showToast({
                        title: errorMsg,
                        icon: 'none',
                        duration: 3000
                    });
                    reject(new Error(errorMsg));
                    return;
                }

                // 检查业务逻辑是否成功
                if (res.result.code === 200) {
                    resolve(res.result.data);
                } else {
                    const message = res.result?.message || res.result?.errMsg || '请求失败';
                    console.error(`云函数 ${name} 返回错误:`, res.result);

                    if (res.result.code === 401) {
                        redirectToLogin(message);
                        reject(new Error(message));
                        return;
                    }

                    if (res.result.code === 403 && (res.result.needVip === true || res.result.vipRestricted === true)) {
                        if (!isShowingVipModal) {
                            isShowingVipModal = true;
                            uni.showModal({
                                title: '功能受限',
                                content: '该功能仅会员可用，您可以前往会员中心开通会员或兑换优惠码。',
                                confirmText: '去会员中心',
                                cancelText: '先看看',
                                success: (modalRes) => {
                                    if (modalRes.confirm) {
                                        uni.navigateTo({
                                            url: '/pages/open-shop/open-shop'
                                        });
                                    }
                                },
                                complete: () => {
                                    isShowingVipModal = false;
                                }
                            });
                        }
                    } else {
                        uni.showToast({
                            title: message,
                            icon: 'none',
                            duration: 3000
                        });
                    }
                    reject(new Error(message));
                }
            },
            fail: (err) => {
                console.error(`云函数 ${name} 调用失败:`, err);

                let errorMessage = '网络错误，请检查网络连接';

                // 根据错误类型提供更详细的错误信息
                if (err.errMsg) {
                    if (err.errMsg.includes('not found') || err.errMsg.includes('不存在')) {
                        errorMessage = `云函数 ${name} 不存在，请检查后端正式源是否已在 云链农商后台管理平台/uniCloud-aliyun 上传部署`;
                    } else if (err.errMsg.includes('network')) {
                        errorMessage = '网络连接失败，请检查网络';
                    } else if (err.errMsg.includes('timeout')) {
                        errorMessage = '请求超时，请重试';
                    } else {
                        errorMessage = err.errMsg;
                    }
                }

                uni.showToast({
                    title: errorMessage,
                    icon: 'none',
                    duration: 3000
                });
                reject(new Error(errorMessage));
            }
        });
    });
}

/**
 * 静默调用云函数：失败不弹 toast，用于可选/未部署接口（如信誉汇总），避免首页报错刷屏
 */
function callCloudFunctionSilent(name, data = {}) {
    return new Promise((resolve) => {
        const token = getStoredToken();
        const userInfo = uni.getStorageSync('userInfo') || {};
        const finalData = { ...data };
        if (token) {
            finalData.token = token;
            finalData.uniIdToken = token;
        }
        const uid = userInfo.user_id || userInfo._id || userInfo.id || '';
        const skipAutoUserId =
            (name === 'getSupplyList' || name === 'getPurchaseList') && finalData.my !== true;
        if (uid && !skipAutoUserId && finalData.user_id == null) {
            finalData.user_id = uid;
        }
        uniCloud.callFunction({
            name,
            data: finalData,
            success: (res) => {
                if (res.result && res.result.code === 200) {
                    resolve(res.result.data);
                } else {
                    console.warn(`[API] ${name} 业务未成功:`, res.result);
                    resolve(null);
                }
            },
            fail: (err) => {
                console.warn(`[API] ${name} 调用失败（静默）:`, err);
                resolve(null);
            }
        });
    });
}

function getCloudCo(name) {
    return uniCloud.importObject(name, { customUI: true });
}

/** 云对象业务成功：全项目默认 200；sales-biz-co 历史曾返回 0，做窄范围兼容避免误判失败 */
function isCloudObjectBizOk(objectName, code) {
    if (code === 200) return true;
    if (objectName === 'sales-biz-co' && code === 0) return true;
    return false;
}

function callCloudObject(name, method, data = {}) {
    return new Promise((resolve, reject) => {
        const token = getStoredToken();
        const userInfo = uni.getStorageSync('userInfo') || {};
        const finalData = { ...data };
        if (token) {
            finalData.token = token;
            finalData.uniIdToken = token;
        }
        const userId = userInfo.user_id || userInfo._id || userInfo.id || '';
        if (userId) {
            finalData.user_id = userId;
        }
        const obj = getCloudCo(name);
        obj[method](finalData)
            .then((result) => {
                if (!result || typeof result !== 'object') {
                    const errorMsg = '云对象返回数据格式错误';
                    console.error(`[API] ${name}.${method}`, result);
                    uni.showToast({
                        title: errorMsg,
                        icon: 'none',
                        duration: 3000
                    });
                    reject(new Error(errorMsg));
                    return;
                }
                if (isCloudObjectBizOk(name, result.code)) {
                    resolve(result.data);
                } else {
                    const message = result.message || result.errMsg || '请求失败';
                    console.error(`[API] ${name}.${method} 返回错误:`, result);
                    if (result.code === 401) {
                        redirectToLogin(message);
                        reject(new Error(message));
                        return;
                    }
                    if (result.code === 403 && (result.needVip === true || result.vipRestricted === true)) {
                        if (!isShowingVipModal) {
                            isShowingVipModal = true;
                            uni.showModal({
                                title: '功能受限',
                                content: '该功能仅会员可用，您可以前往会员中心开通会员或兑换优惠码。',
                                confirmText: '去会员中心',
                                cancelText: '先看看',
                                success: (modalRes) => {
                                    if (modalRes.confirm) {
                                        uni.navigateTo({
                                            url: '/pages/open-shop/open-shop'
                                        });
                                    }
                                },
                                complete: () => {
                                    isShowingVipModal = false;
                                }
                            });
                        }
                    } else {
                        uni.showToast({
                            title: message,
                            icon: 'none',
                            duration: 3000
                        });
                    }
                    reject(new Error(message));
                }
            })
            .catch((err) => {
                console.error(`[API] ${name}.${method} 调用失败:`, err);
                const errorMessage = err.message || '网络错误，请检查网络连接';
                uni.showToast({
                    title: errorMessage,
                    icon: 'none',
                    duration: 3000
                });
                reject(new Error(errorMessage));
            });
    });
}

function callCloudObjectSilent(name, method, data = {}) {
    return new Promise((resolve) => {
        const token = getStoredToken();
        const userInfo = uni.getStorageSync('userInfo') || {};
        const finalData = { ...data };
        if (token) {
            finalData.token = token;
            finalData.uniIdToken = token;
        }
        const uid = userInfo.user_id || userInfo._id || userInfo.id || '';
        if (uid) {
            finalData.user_id = uid;
        }
        const obj = getCloudCo(name);
        obj[method](finalData)
            .then((result) => {
                if (result && isCloudObjectBizOk(name, result.code)) {
                    resolve(result.data);
                } else {
                    console.warn(`[API] ${name}.${method} 业务未成功:`, result);
                    resolve(null);
                }
            })
            .catch((err) => {
                console.warn(`[API] ${name}.${method} 调用失败（静默）:`, err);
                resolve(null);
            });
    });
}

// 请求封装
function request(options) {
    return new Promise((resolve, reject) => {
        const token = getStoredToken();
        uni.request({
            url: baseURL + options.url,
            method: options.method || 'GET',
            data: options.data || {},
            header: {
                'Content-Type': 'application/json',
                Authorization: token ? `Bearer ${token}` : '',
                ...options.header
            },
            success: (res) => {
                if (res.statusCode === 200) {
                    resolve(res.data);
                } else if (res.statusCode === 401) {
                    // token过期，跳转登录
                    redirectToLogin(res.data?.message || '登录状态已过期，请重新登录');
                    reject(res);
                } else {
                    uni.showToast({
                        title: res.data.message || '请求失败',
                        icon: 'none'
                    });
                    reject(res);
                }
            },
            fail: (err) => {
                uni.showToast({
                    title: '网络错误，请检查网络连接',
                    icon: 'none'
                });
                reject(err);
            }
        });
    });
}

// 获取采购列表（使用云函数）
function getProcurements(params) {
    return callCloudFunction('getPurchaseList', {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10,
        category: params?.category,
        region: params?.region,
        search: params?.search,
        sort: params?.sort || 'timeDesc',
        my: params?.my || false // 如果my为true，云函数会从token中获取用户ID
    });
}

// 获取供应列表（使用云函数）
function getSupplies(params) {
    return callCloudFunction('getSupplyList', {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10,
        category: params?.category,
        region: params?.region,
        search: params?.search,
        sort: params?.sort || 'timeDesc',
        my: params?.my || false // 如果my为true，云函数会从token中获取用户ID
    });
}

// ==========================================
// 行情数据源（正式固定入口）
// ==========================================
const CACHE_DURATION = 60 * 1000;

let marketDataCache = { data: null, timestamp: 0 };

function fetchJsonNoCache(url) {
    // 添加 cache bust 避免 CDN 缓存
    const cacheBustUrl = url + (url.includes('?') ? '&' : '?') + `ts=${Date.now()}`;
    return new Promise((resolve, reject) => {
        uni.request({
            url: cacheBustUrl,
            method: 'GET',
            dataType: 'json',
            success: (res) => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    if (typeof res.data === 'string') {
                        const text = res.data.trim();
                        if (/^<!doctype html/i.test(text) || /^<html/i.test(text)) {
                            reject(new Error(`返回HTML错误页: ${cacheBustUrl}`));
                            return;
                        }
                        try {
                            resolve(JSON.parse(text));
                        } catch (e) {
                            reject(new Error(`JSON解析失败: ${cacheBustUrl}`));
                        }
                        return;
                    }
                    resolve(res.data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${cacheBustUrl}`));
                }
            },
            fail: (err) => {
                console.error('[API] market request failed:', { url: cacheBustUrl, err });
                reject(new Error(err.errMsg || `Network failed: ${cacheBustUrl}`));
            }
        });
    });
}

function processRawData(rawData) {
    if (!rawData) return { meta: {}, products: [] };

    const meta = rawData.meta || {};
    const rawProducts = Array.isArray(rawData.products) ? rawData.products : [];

    // 最小映射:保留所有原始字段
    const products = rawProducts.map(item => ({
        type: item.type || 'origin',
        name: item.name || item.product || item.productName || '',
        price: item.price,
        unit: item.unit,
        date: item.date,
        region: item.location || item.place || item.market || '',
        category: item.category,
        trend: item.trend,
        ...item
    }));

    return {
        meta: {
            updateTime: meta.update_date && meta.update_time
                ? `${meta.update_date} ${meta.update_time}`
                : '',
            ...meta
        },
        products
    };
}

function applyFilters(data, params) {
    let { products, meta } = data;

    // 关键:必须按type过滤
    if (params.type && params.type !== 'analysis') {
        if (params.type === 'origin') {
            products = products.filter(p => p.type === 'origin');
        } else if (params.type === 'wholesale') {
            products = products.filter(p => p.type === 'wholesale');
        }
    }

    // 品种/地区搜索过滤
    if (params.name) {
        products = products.filter(p => p.name && p.name.includes(params.name.trim()));
    }

    if (params.location) {
        products = products.filter(p => p.region && p.region.includes(params.location.trim()));
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 500; // 加大分页避免漏数据
    const start = (page - 1) * pageSize;

    return {
        type: params.type,
        meta,
        products: products.slice(start, start + pageSize)
    };
}

// 获取市场行情（正式固定入口：get-latest-pointer -> pointer_url -> fileID/analysis_publicUrl）
export async function getMarketTrends(params) {
    console.log('[API] getMarketTrends (official pointer flow)', params);

    try {
        // 1. Check Cache
        if (marketDataCache.data && Array.isArray(marketDataCache.data.products) && marketDataCache.data.products.length && (Date.now() - marketDataCache.timestamp < CACHE_DURATION)) {
            console.log('[API] Using cache');
            return applyFilters(marketDataCache.data, params);
        }

        // 2. 固定入口：先从云函数获取 pointer_url
        const pointerEntry = await callCloudFunction('get-latest-pointer', {});
        const pointerUrl = pointerEntry && pointerEntry.pointer_url;
        if (!pointerUrl) {
            throw new Error('固定入口返回缺少 pointer_url');
        }

        // 3. 读取 pointer JSON，再取 fileID
        let rawData = null;
        console.log('[API] Fetching pointer from pointer_url...');
        const pointer = await fetchJsonNoCache(pointerUrl);

        // 4. 优先使用 pointer.fileID（正式结构）
        if (pointer && pointer.fileID) {
            console.log('[API] Using fileID from pointer:', pointer.fileID);
            rawData = await fetchJsonNoCache(pointer.fileID);
        } else if (pointer && pointer.publicUrl) {
            console.log('[API] Using publicUrl from pointer (compat)');
            rawData = await fetchJsonNoCache(pointer.publicUrl);
        } else {
            throw new Error('Pointer missing fileID and publicUrl');
        }

        // 4. Process & Cache
        const processedData = processRawData(rawData);
        if (!processedData.products || !processedData.products.length) {
            throw new Error('行情数据为空');
        }
        marketDataCache = { data: processedData, timestamp: Date.now() };
        uni.setStorageSync('market_data_cache', processedData);

        return applyFilters(processedData, params);

    } catch (error) {
        console.error('[API] market pointer flow failed:', error);

        const cached = uni.getStorageSync('market_data_cache');
        if (cached && Array.isArray(cached.products) && cached.products.length) {
            console.log('[API] Using storage cache');
            return applyFilters(cached, params);
        }

        throw error;
    }
}

// 发布供应信息（使用云函数）
function publishSupply(data) {
    // token会自动通过callCloudFunction传递，user_id从token中获取
    return callCloudFunction('publishSupply', data);
}

// 发布采购信息（使用云函数）
function publishProcurement(data) {
    // token会自动通过callCloudFunction传递，user_id从token中获取
    return callCloudFunction('publishPurchase', data);
}

// 上传图片（直接使用云存储）
function uploadImage(filePath) {
    return new Promise((resolve, reject) => {
        console.log('[图片上传] 步骤1: 开始上传流程', filePath);

        // 验证文件路径
        if (!filePath) {
            const errorMessage = '文件路径无效';
            console.error('[图片上传] 步骤1失败:', errorMessage);
            reject(new Error(errorMessage));
            return;
        }

        // 获取文件扩展名
        const extMatch = filePath.match(/\.(\w+)$/);
        const fileExtension = extMatch ? extMatch[1] : 'jpg';

        // 生成唯一文件名
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const fileName = `avatar_${timestamp}_${randomStr}.${fileExtension}`;
        const cloudPath = `images/avatars/${fileName}`;

        console.log('[图片上传] 步骤2: 准备上传', {
            cloudPath,
            fileExtension,
            fileName
        });

        // 设置超时（30秒）
        let isResolved = false;
        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                console.error('[图片上传] 步骤3失败: 上传超时');
                const errorMessage = '上传超时，请检查网络连接后重试';
                uni.showToast({
                    title: errorMessage,
                    icon: 'none',
                    duration: 3000
                });
                reject(new Error(errorMessage));
            }
        }, 30000);

        // 检查是否在微信开发者工具中
        // #ifdef MP-WEIXIN
        const systemInfo = uni.getSystemInfoSync();
        const isDevTools = systemInfo.platform === 'devtools';
        if (isDevTools) {
            console.warn('[图片上传] 检测到微信开发者工具环境，可能影响上传功能');
        }
        // #endif

        console.log('[图片上传] 步骤3: 调用 uniCloud.uploadFile');

        // 直接使用 uniCloud.uploadFile 上传到云存储
        uniCloud.uploadFile({
            filePath: filePath,
            cloudPath: cloudPath,
            success: (res) => {
                if (isResolved) {
                    console.warn('[图片上传] 已超时，忽略成功回调');
                    return; // 如果已经超时，忽略成功回调
                }
                clearTimeout(timeout);
                isResolved = true;

                console.log('[图片上传] 步骤4: 上传成功', res);

                // 验证返回结果
                if (!res || !res.fileID) {
                    console.error('[图片上传] 步骤4失败: 返回数据格式错误', res);
                    const errorMessage = '上传失败：返回数据格式错误';
                    uni.showToast({
                        title: errorMessage,
                        icon: 'none',
                        duration: 3000
                    });
                    reject(new Error(errorMessage));
                    return;
                }

                // 返回格式与云函数保持一致
                const result = {
                    url: res.fileID,
                    fileID: res.fileID,
                    data: {
                        url: res.fileID,
                        fileID: res.fileID
                    }
                };

                console.log('[图片上传] 步骤5: 返回结果', result);
                resolve(result);
            },
            fail: (err) => {
                if (isResolved) {
                    console.warn('[图片上传] 已超时，忽略失败回调');
                    return; // 如果已经超时，忽略失败回调
                }
                clearTimeout(timeout);
                isResolved = true;

                console.error('[图片上传] 步骤4失败: 上传失败', err);
                let errorMessage = '上传失败，请重试';

                // 根据错误类型提供更详细的错误信息
                if (err && err.errMsg) {
                    console.error('[图片上传] 错误信息:', err.errMsg);
                    if (err.errMsg.includes('network') || err.errMsg.includes('网络')) {
                        errorMessage = '网络错误，请检查网络连接';
                    } else if (err.errMsg.includes('permission') || err.errMsg.includes('权限')) {
                        errorMessage = '没有上传权限，请检查云存储配置';
                    } else if (err.errMsg.includes('space') || err.errMsg.includes('空间')) {
                        errorMessage = '云存储空间不足';
                    } else if (err.errMsg.includes('timeout') || err.errMsg.includes('超时')) {
                        errorMessage = '上传超时，请重试';
                    } else if (err.errMsg.includes('not found') || err.errMsg.includes('不存在')) {
                        errorMessage = '云存储服务未配置，请检查云服务配置';
                    } else if (err.errMsg.includes('cancel') || err.errMsg.includes('取消')) {
                        errorMessage = '上传已取消';
                    } else {
                        errorMessage = err.errMsg;
                    }
                } else if (err && err.message) {
                    errorMessage = err.message;
                }

                console.error('[图片上传] 错误详情:', JSON.stringify(err, null, 2));
                reject(new Error(errorMessage));
            }
        });
    });
}

function normalizeListViewCount(list) {
    if (!Array.isArray(list)) {
        return list;
    }
    return list.map((item) => {
        const view_count = getViewCount(item);
        return { ...item, view_count };
    });
}

// 获取我的供应列表（使用云函数）
function getMySupplies(params) {
    return callCloudFunction('getSupplyList', {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10,
        category: params?.category,
        region: params?.region,
        search: params?.search,
        sort: params?.sort || 'timeDesc',
        my: true // 查询"我的"列表，云函数会从token中获取用户ID
    }).then((data) => {
        if (data && Array.isArray(data.list)) {
            return { ...data, list: normalizeListViewCount(data.list) };
        }
        return data;
    });
}

// 获取供应详情（使用云函数）
function getSupplyDetail(id) {
    return callCloudFunction('getSupplyDetail', {
        id: id
    });
}

// 更新供应信息（使用云函数）
function updateSupply(id, data) {
    // token会自动通过callCloudFunction传递，user_id从token中获取
    return callCloudFunction('updateSupply', {
        id: id,
        ...data
    });
}

// 更新供应状态（使用云函数）
function updateSupplyStatus(id, status) {
    // token会自动通过callCloudFunction传递
    return callCloudFunction('updateItemStatus', {
        id: id,
        type: 'supply',
        status: status
    });
}

// 删除供应（使用云函数）
function deleteSupply(id) {
    // token会自动通过callCloudFunction传递
    return callCloudFunction('deleteItem', {
        id: id,
        type: 'supply'
    });
}

// 获取我的采购列表（使用云函数）
function getMyProcurements(params) {
    return callCloudFunction('getPurchaseList', {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10,
        category: params?.category,
        search: params?.search,
        my: true // 查询"我的"列表，云函数会从token中获取用户ID
    }).then((data) => {
        if (data && Array.isArray(data.list)) {
            return { ...data, list: normalizeListViewCount(data.list) };
        }
        return data;
    });
}

// 获取采购详情（使用云函数）
function getProcurementDetail(id) {
    return callCloudFunction('getProcurementDetail', {
        id: id
    });
}

// 更新采购信息
function updateProcurement(id, data) {
    // token会自动通过callCloudFunction传递，user_id从token中获取
    return callCloudFunction('updatePurchase', {
        id: id,
        ...data
    });
}

// 更新采购状态（使用云函数）
function updateProcurementStatus(id, status) {
    // token会自动通过callCloudFunction传递
    return callCloudFunction('updateItemStatus', {
        id: id,
        type: 'purchase',
        status: status
    });
}

// 删除采购（使用云函数）
function deleteProcurement(id) {
    // token会自动通过callCloudFunction传递
    return callCloudFunction('deleteItem', {
        id: id,
        type: 'purchase'
    });
}

// 获取会员订单列表（当前用户；云对象 memberOrderCo.myOrders）
function getMemberOrders(params) {
    return callCloudObject('memberOrderCo', 'myOrders', {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10
    });
}

// 删除待支付会员订单（仅允许删除当前用户的待支付订单）
function deletePendingMemberOrder(orderId) {
    return callCloudObject('memberOrderCo', 'deletePendingOrder', {
        order_id: orderId || ''
    });
}

// 获取用户信息（使用云函数）
// 注意：getUserProfile 是 getUserInfo 的别名，保留以保持向后兼容
function getUserInfo(userId, options = {}) {
    return callCloudFunction('getUserInfo', {
        user_id: userId,
        contact_scene: options.contactScene || ''
    });
}

// 获取用户个人主页信息（使用云函数）
// 这是 getUserInfo 的别名，语义更清晰
function getUserProfile(userId) {
    return getUserInfo(userId);
}

// 获取用户的供应信息（使用云函数）
// 注意：此函数用于查看其他用户的公开供应信息，不进行用户身份验证
function getUserSupplies(userId, params) {
    // 对于查看其他用户的信息，我们仍然需要通过其他方式实现
    // 这里暂时保留原有逻辑，但建议在云函数中添加user_id参数用于查看指定用户的公开信息
    return callCloudFunction('getSupplyList', {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10,
        category: params?.category,
        region: params?.region,
        search: params?.search,
        sort: params?.sort || 'timeDesc',
        target_user_id: userId // 查看指定用户的公开供应（需要云函数支持此参数）
    });
}

// 获取用户的采购信息（使用云函数）
// 注意：此函数用于查看其他用户的公开采购信息，不进行用户身份验证
function getUserProcurements(userId, params) {
    // 对于查看其他用户的信息，我们仍然需要通过其他方式实现
    // 这里暂时保留原有逻辑，但建议在云函数中添加user_id参数用于查看指定用户的公开信息
    return callCloudFunction('getPurchaseList', {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10,
        category: params?.category,
        search: params?.search,
        target_user_id: userId // 查看指定用户的公开采购（需要云函数支持此参数）
    });
}

// 获取用户信誉与评价（历史 HTTP，保留兼容）
function getUserReputation(userId) {
    return request({
        url: `/users/${userId}/reputation`,
        method: 'GET'
    });
}

/**
 * 用户信誉汇总（云对象 reputationCo.getSummary，未部署时返回 null）
 * @param {string} userId 被查看用户 ID
 */
function getUserReputationSummary(userId) {
    return callCloudObjectSilent('reputationCo', 'getSummary', {
        target_user_id: userId,
        viewed_user_id: userId
    });
}

/**
 * 用户评价列表（云对象 reputationCo.getReviews）
 * @param {string} userId
 * @param {{ page?: number, pageSize?: number }} params
 */
function getUserReputationReviews(userId, params) {
    return callCloudObjectSilent('reputationCo', 'getReviews', {
        target_user_id: userId,
        viewed_user_id: userId,
        page: params?.page || 1,
        pageSize: params?.pageSize || 50
    });
}

/**
 * 提交用户举报（云对象 reputationCo.submitReport）
 * @param {Object} payload 见前端 user-profile 组装字段
 */
function submitUserReport(payload) {
    return callCloudObject('reputationCo', 'submitReport', payload);
}

/**
 * 提交用户评价（云对象 reputationCo.submitReview）
 */
function submitUserReview(payload) {
    return callCloudObject('reputationCo', 'submitReview', payload);
}

// 获取我的关注列表（云对象 socialCo.follows）
function getMyFollows(params) {
    return callCloudObject('socialCo', 'follows', {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10
    });
}

// 获取关注我的列表（云对象 socialCo.followers）
function getMyFollowers(params) {
    return callCloudObject('socialCo', 'followers', {
        page: params?.page || 1,
        pageSize: params?.pageSize || 10
    });
}

// 关注用户（云对象 socialCo.follow）
function followUser(userId) {
    return callCloudObject('socialCo', 'follow', {
        following_id: userId
    });
}

// 取消关注用户（云对象 socialCo.unfollow）
function unfollowUser(userId) {
    return callCloudObject('socialCo', 'unfollow', {
        following_id: userId
    });
}

// 获取关注统计（云对象 socialCo.stats）
function getFollowStats() {
    const userInfo = uni.getStorageSync('userInfo') || {};
    const userId = userInfo.user_id || userInfo._id || userInfo.id || '';
    return callCloudObject('socialCo', 'stats', {
        user_id: userId
    });
}

// 记录用户主页被浏览（云对象 socialCo.recordView）
function recordProfileView(userId) {
    return callCloudObject('socialCo', 'recordView', {
        viewed_user_id: userId
    });
}

// 获取用户统计数据（包括被浏览数）
function getUserStats(userId) {
    // 兼容不同后端字段命名，避免“用户不存在”的参数字段不匹配
    return callCloudFunction('getUserStats', {
        user_id: userId,
        uid: userId,
        _id: userId
    }).then((data) => {
        if (!data || typeof data !== 'object') {
            return data;
        }
        const raw = data.product_views_total != null ? data.product_views_total : data.data?.product_views_total;
        const product_views_total = Number.isFinite(Number(raw)) ? Math.max(0, Math.floor(Number(raw))) : 0;
        return { ...data, product_views_total };
    });
}

// 获取客户联系人列表（使用云函数）
// 返回：平台联系人（关注的用户）+ 手动添加的联系人
function getCustomerContacts() {
    return callCloudObject('customerContactCo', 'list', {});
}

// 手动添加联系人（云对象 customerContactCo.add）
function addManualContact(data) {
    return callCloudObject('customerContactCo', 'add', {
        name: data.name,
        phone: data.phone,
        company: data.company || '',
        note: data.note || ''
    });
}

function getProcurementContact(targetUserId) {
    return callCloudObject('customerContactCo', 'getProcurementContact', {
        targetUserId
    });
}

// 更新联系人备注/信息（使用云函数）
// 注意：可以更新手动添加的联系人和平台联系人的覆盖数据（不影响原始用户数据）
// 参数说明：
//   - contactId: 手动联系人的ID，或平台联系人的覆盖记录ID（可选）
//   - data: 包含 name, phone, note, platformUserId(平台联系人时) 或 contactId(手动联系人时)
function updateContactNote(contactId, data) {
    // token会自动通过callCloudFunction传递，user_id从token中获取
    const params = {
        name: data.name,
        phone: data.phone,
        note: data.note
    };

    // 如果是平台联系人，传递 platformUserId；否则传递 contactId
    // 严格验证 platformUserId 是否为有效的非空字符串
    if (data.platformUserId && typeof data.platformUserId === 'string' && data.platformUserId.trim()) {
        // 平台联系人：使用 platformUserId
        params.platformUserId = data.platformUserId.trim();
        // 平台联系人不需要 contactId，即使提供了也会被忽略
        console.log('[API] 更新平台联系人，platformUserId:', params.platformUserId);
    } else if (data.contactId && typeof data.contactId === 'string' && data.contactId.trim()) {
        // 手动联系人：使用 data 中的 contactId（优先）
        params.contactId = data.contactId.trim();
        console.log('[API] 更新手动联系人，contactId:', params.contactId);
    } else if (contactId && (typeof contactId === 'string' || typeof contactId === 'object')) {
        // 手动联系人：使用第一个参数 contactId
        params.contactId = typeof contactId === 'string' ? contactId.trim() : contactId;
        console.log('[API] 更新手动联系人，contactId (from param):', params.contactId);
    } else {
        // 如果既没有 platformUserId 也没有 contactId，报错
        const errorMsg = '参数错误：必须提供有效的 platformUserId（平台联系人）或 contactId（手动联系人）';
        console.error('[API]', errorMsg, { contactId, data });
        return Promise.reject(new Error(errorMsg));
    }

    return callCloudObject('customerContactCo', 'updateNote', params);
}

// 删除/移除联系人（云对象 customerContactCo.remove）
// 注意：手动添加的联系人会真正删除，平台联系人只是标记为隐藏
function deleteContact(contactId) {
    return callCloudObject('customerContactCo', 'remove', {
        contactId: contactId
    });
}

// 获取实名认证状态（使用云函数）
function getAuthStatus() {
    // token会自动通过callCloudFunction传递；同时补传 user_id 兼容旧后端
    const userInfo = uni.getStorageSync('userInfo') || {};
    const userId = userInfo.user_id || userInfo._id || userInfo.id || '';
    return callCloudFunction('getRealnameAuthStatus', {
        user_id: userId
    });
}

// 提交实名认证信息（使用云函数）
function submitAuthInfo(data) {
    // token会自动通过callCloudFunction传递，user_id从token中获取
    return callCloudFunction('submitRealnameAuth', {
        realName: data.realName,
        idCard: data.idCard,
        idCardFront: data.idCardFront,
        idCardBack: data.idCardBack,
        gender: data.gender,
        nation: data.nation,
        birthday: data.birthday,
        address: data.address,
        issueAuthority: data.issueAuthority,
        validDate: data.validDate,
        validFrom: data.validFrom,
        validTo: data.validTo,
        ocr_provider: data.ocr_provider,
        ocr_doc_type: data.ocr_doc_type,
        ocr_snapshot: data.ocr_snapshot
    });
}

function recognizeAuthOcr(params) {
    return callCloudFunction('recognizeAuthOcr', {
        scene: params?.scene,
        docType: params?.docType,
        fileId: params?.fileId
    });
}

// 获取当前用户企业认证详情（云对象 enterpriseAuthCo.getDetail）
function getEnterpriseAuthDetail() {
    return callCloudObject('enterpriseAuthCo', 'getDetail', {});
}

// 提交企业认证申请（云对象 enterpriseAuthCo.submit）
function submitEnterpriseAuth(data) {
    return callCloudObject('enterpriseAuthCo', 'submit', {
        enterprise_name: data.enterprise_name,
        credit_code: data.credit_code,
        contact_name: data.contact_name,
        contact_mobile: data.contact_mobile,
        province: data.province,
        city: data.city,
        district: data.district,
        address: data.address,
        business_license_url: data.business_license_url,
        remark: data.remark,
        legal_person: data.legal_person,
        company_type: data.company_type,
        establish_date: data.establish_date,
        valid_period: data.valid_period,
        business_scope: data.business_scope,
        license_number: data.license_number,
        ocr_provider: data.ocr_provider,
        ocr_doc_type: data.ocr_doc_type,
        ocr_snapshot: data.ocr_snapshot
    });
}

// 获取实名认证详情（包含驳回原因等）
function getAuthDetail() {
    return request({
        url: '/auth/real-name/detail',
        method: 'GET'
    });
}

// 更新用户信息（使用云函数）
function updateUserInfo(data) {
    // token会自动通过callCloudFunction传递，user_id从token中获取
    return callCloudFunction('updateUserProfile', data);
}

// 获取系统配置（使用云函数）
// 返回系统配置信息，包括客服电话等
function getSystemSettings() {
    return callCloudFunction('getSystemSettings', {});
}

// 更新系统配置（使用云函数）
// 注意：此接口需要管理员权限，供后台管理面板使用
// settings: { customer_service_phone?: string }
function updateSystemSettings(settings) {
    // token会自动通过callCloudFunction传递
    // TODO: 后续接入后台管理面板时，确保传递了管理员token
    return callCloudFunction('updateSystemSettings', {
        settings: settings
    });
}

// 历史兼容：旧页面若仍调用 getMarketTrendsOld，则转发到 getMarketTrends（正式固定入口链路）
function getMarketTrendsOld(params) {
    console.warn('[API] getMarketTrendsOld is deprecated, redirecting to getMarketTrends (official pointer flow)');
    return getMarketTrends({
        type: params?.type || 'origin',
        category: params?.category,
        name: params?.subCategory,
        location: params?.search
    });
}

// 兑换会员优惠码（云对象 memberCouponCo.redeem）
function redeemVipCode(code) {
    return callCloudObject('memberCouponCo', 'redeem', {
        code
    });
}

// ==========================================
// 会员订单：标准链路 = 待支付下单 + 支付落账（后台/微信回调）
// ==========================================
//
// 主入口：createPendingMemberOrder（云函数同名）
// 成功返回 data 含 order_id、order_no、pay_status(0)、order_type、sales_name 等；不包含 vip 到期（须支付成功后才有）。
//
// 历史兼容：createMemberOrder（云函数）仍为「下单即支付成功」，仅供旧脚本/排查，新业务勿用。
function createPendingMemberOrder(params) {
    const p = params || {};
    /** 金额由云端按 platform_settings 配置计算，不传 pay_amount / original_amount */
    const cloudData = {
        sales_id: p.sales_id || '',
        channel_id: p.channel_id || '',
        invite_code: p.invite_code || '',
        member_tier: p.member_tier || 'personal',
        plan_key: p.plan_key || 'year',
        pay_channel: p.pay_channel || '',
        source_type: p.source_type || 'mini_program',
        remark: p.remark || '',
        coupon_code: p.coupon_code || '',
        coupon_id: p.coupon_id || ''
    };
    console.log('[VIP][api] createPendingMemberOrder 入参:', cloudData);
    return callCloudFunction('createPendingMemberOrder', cloudData);
}

/**
 * 个人会员月卡微信支付主链路：
 * 1) 后端按配置创建 member_order（待支付）
 * 2) 后端调 uni-pay 生成微信支付参数
 */
function createMemberOrderAndGetPayParams(params) {
    const p = params || {};
    /** 新开通传 member_type/plan_type；待支付「继续支付」传 resume_order_id，云端复用原单调 uni-pay */
    const payload = {
        resume_order_id: p.resume_order_id || p.order_id || '',
        scene: p.scene || '',
        member_type: p.member_type || '',
        plan_type: p.plan_type || '',
        from_plan_type: p.from_plan_type || '',
        to_plan_type: p.to_plan_type || '',
        sales_id: p.sales_id || '',
        channel_id: p.channel_id || '',
        invite_code: p.invite_code || '',
        source_type: p.source_type || 'mini_program',
        coupon_code: p.coupon_code || '',
        coupon_id: p.coupon_id || p.coupon_code_id || ''
    };
    return callCloudFunction('createMemberWxPayParams', payload);
}

function getMemberOrderPayStatus(orderId) {
    return callCloudFunction('getMemberOrderPayStatus', {
        order_id: orderId || ''
    });
}

/** 预览个人→企业类型升级应付金额（不落库）。规则：按剩余时间与同档企业套餐价折算；支付成功后到期不变，仅升级类型与权益。云端函数名：previewEntMemberUpgrade（≤30 字符）。 */
function previewUpgradeEnterpriseMember(params) {
    const p = params || {};
    return callCloudFunction('previewEntMemberUpgrade', {
        sales_id: p.sales_id || '',
        channel_id: p.channel_id || '',
        invite_code: p.invite_code || ''
    });
}

/** 创建企业类型升级待支付订单（order_type=3）。落账后：member_type=enterprise，vip 到期不变。云端函数名：createEntMemberUpgradeOrder（≤30 字符）。 */
function createPendingUpgradeEnterpriseMemberOrder(params) {
    const p = params || {};
    return callCloudFunction('createEntMemberUpgradeOrder', {
        sales_id: p.sales_id || '',
        channel_id: p.channel_id || '',
        invite_code: p.invite_code || '',
        pay_channel: p.pay_channel || '',
        source_type: p.source_type || 'mini_program'
    });
}

/** 预览同档周期升级（月→季/年、季→年，不落库）。规则：付目标套餐标价；新到期=原到期+完整目标天数；剩余时长保留。 */
function previewUpgradePlanPeriod(params) {
    const p = params || {};
    return callCloudFunction('previewUpgradePlanPeriod', {
        target_plan_key: p.target_plan_key || '',
        sales_id: p.sales_id || '',
        channel_id: p.channel_id || '',
        invite_code: p.invite_code || ''
    });
}

/** 创建周期升级待支付订单（order_type=4，备注 biz_type=upgrade_period）。落账后：类型不变，vip=原到期+目标整段天数。云端函数名：createPlanPeriodUpgradeOrder（≤30 字符）。 */
function createPendingUpgradePlanPeriodOrder(params) {
    const p = params || {};
    return callCloudFunction('createPlanPeriodUpgradeOrder', {
        target_plan_key: p.target_plan_key || '',
        sales_id: p.sales_id || '',
        channel_id: p.channel_id || '',
        invite_code: p.invite_code || '',
        pay_channel: p.pay_channel || '',
        source_type: p.source_type || 'mini_program'
    });
}

function getMembershipPromotionConfig() {
    return callCloudObject('membershipConfigCo', 'getConfig', {});
}

function createPromotionOrder(params) {
    const p = params || {};
    return callCloudObject('promotionOrderCo', 'create', {
        content_id: p.content_id || '',
        content_type: p.content_type || '',
        promotion_type: p.promotion_type || 'top',
        duration_days: p.duration_days != null ? Number(p.duration_days) : 7,
        daily_view_increment: p.daily_view_increment != null ? Number(p.daily_view_increment) : 536,
        use_gift_quota: !!(p.use_gift_quota === true || p.use_gift_quota === 1 || p.use_gift_quota === 'true')
    });
}

function activatePromotionOrder(orderId, extra) {
    const e = extra || {};
    return callCloudObject('promotionOrderCo', 'activate', {
        order_id: orderId || '',
        skip_pay_check: !!e.skip_pay_check
    });
}

/** 推广订单微信支付参数（uni-pay → 微信小程序），金额须 >0 */
function createPromotionWxPayParams(params) {
    const p = params || {};
    return callCloudFunction('createPromotionWxPayParams', {
        promotion_order_id: p.promotion_order_id || p.order_id || ''
    });
}

/** 支付成功后轮询订单状态（微信异步通知落账，勿在客户端伪造已支付） */
function getPromotionOrderPayStatus(orderId) {
    return callCloudObjectSilent('promotionOrderCo', 'getPayStatus', {
        order_id: orderId || ''
    });
}

/**
 * 推广效果详情（云函数 getPromotionEffectDetail）
 * 入参：{ promotion_order_id }
 * 返回字段见「推广效果」页与产品文档约定。
 */
function getPromotionEffectDetail(params) {
    const p = params || {};
    return callCloudFunction('getPromotionEffectDetail', {
        promotion_order_id: p.promotion_order_id || p.order_id || ''
    });
}

function validateMemberCouponCode(params) {
    const p = params || {};
    return callCloudObject('memberCouponCo', 'validate', {
        code: (p.code || '').trim(),
        coupon_id: p.coupon_id || '',
        order_type_context: p.order_type_context || '',
        order_type: p.order_type,
        original_amount: p.original_amount != null ? Number(p.original_amount) : 888,
        member_tier: p.member_tier || '',
        plan_key: p.plan_key || '',
        member_days: p.member_days
    });
}

function completeZeroAmountMemberOrder(orderId) {
    return callCloudFunction('completeZeroAmountMemberOrder', {
        order_id: orderId || ''
    });
}

/**
 * @deprecated 历史兼容：对应云函数 createMemberOrder（即时开通）。请改用 createPendingMemberOrder。
 */
function createMemberOrder(params) {
    const cloudData = {
        sales_id:    (params && params.sales_id)    || '',
        channel_id:  (params && params.channel_id)  || '',
        invite_code: (params && params.invite_code) || '',
        pay_amount:  (params && params.pay_amount)  || 588,
        original_amount: (params && params.original_amount) || 888,
        member_days: (params && params.member_days) || 365
    };
    console.warn('[VIP][api] createMemberOrder 已废弃，仅兼容旧调用；请改用 createPendingMemberOrder');
    console.log('[VIP_TEST][api] createMemberOrder 实际传入云函数的渠道与金额字段:');
    console.log('  sales_id        =', cloudData.sales_id || '(空)');
    console.log('  channel_id      =', cloudData.channel_id || '(空)');
    console.log('  invite_code     =', cloudData.invite_code || '(空)');
    console.log('  pay_amount      =', cloudData.pay_amount);
    console.log('  original_amount =', cloudData.original_amount);
    console.log('  member_days     =', cloudData.member_days);
    return callCloudFunction('createMemberOrder', cloudData);
}

/**
 * 销售中心相关接口 (Sales Center 1.0)
 */
/** 轻量探测是否有销售中心入口权限（静默，成功返回 data，失败/非 200 返回 null） */
function checkSalesAccess() {
    return callCloudObjectSilent('sales-biz-co', 'checkSalesAccess');
}

function getSalesCenterDashboard() {
    return callCloudObject('sales-biz-co', 'getSalesCenterDashboard');
}

function getSalesPromotionInfo() {
    return callCloudObject('sales-biz-co', 'getSalesPromotionInfo');
}

function getMySalesCustomers(params) {
    return callCloudObject('sales-biz-co', 'getMySalesCustomers', params);
}

function getMySalesCommission(params) {
    return callCloudObject('sales-biz-co', 'getMySalesCommission', params);
}

// ==========================================
// 销售来源追踪工具函数
// ==========================================

/**
 * 保存销售来源到本地缓存
 * @param {Object} sourceInfo - 来源信息 {sales_id, channel_id, invite_code}
 */
export function saveSalesSourceToStorage(sourceInfo) {
    if (!sourceInfo) return;
    
    const storageKey = 'sales_source_info';
    const data = {
        sales_id: sourceInfo.sales_id || '',
        channel_id: sourceInfo.channel_id || '',
        invite_code: sourceInfo.invite_code || '',
        saved_at: Date.now()
    };
    
    // 只有当有实际参数时才保存，避免覆盖已有参数
    if (data.sales_id || data.channel_id || data.invite_code) {
        console.log('[SalesSource] 保存来源参数到缓存:', data);
        uni.setStorageSync(storageKey, data);
    }
}

/**
 * 从本地缓存读取销售来源
 * @returns {Object|null} 来源信息
 */
export function getSalesSourceFromStorage() {
    const storageKey = 'sales_source_info';
    const data = uni.getStorageSync(storageKey);
    if (data) {
        // 如果缓存超过24小时，可以考虑过期（可选，当前不设硬性限制）
        console.log('[SalesSource] 从缓存读取来源参数:', data);
        return data;
    }
    return null;
}

/**
 * 清除销售来源缓存
 */
export function clearSalesSourceFromStorage() {
    const storageKey = 'sales_source_info';
    uni.removeStorageSync(storageKey);
    console.log('[SalesSource] 已清除来源参数缓存');
}

// ES6 导出（用于 import）
// 注意：getMarketTrends 已在上面使用 export function 直接导出，这里不再重复导出
export {
    callCloudFunction,
    request,
    getProcurements,
    getSupplies,
    publishSupply,
    publishProcurement,
    uploadImage,
    getMySupplies,
    getSupplyDetail,
    updateSupply,
    updateSupplyStatus,
    deleteSupply,
    getMyProcurements,
    getProcurementDetail,
    updateProcurement,
    updateProcurementStatus,
    deleteProcurement,
    getMemberOrders,
    deletePendingMemberOrder,
    getUserInfo,
    getUserProfile,
    getUserSupplies,
    getUserProcurements,
    getUserReputation,
    getUserReputationSummary,
    getUserReputationReviews,
    submitUserReport,
    submitUserReview,
    getMyFollows,
    getMyFollowers,
    followUser,
    unfollowUser,
    getFollowStats,
    recordProfileView,
    getUserStats,
    getCustomerContacts,
    getProcurementContact,
    addManualContact,
    updateContactNote,
    deleteContact,
    getAuthStatus,
    submitAuthInfo,
    recognizeAuthOcr,
    getEnterpriseAuthDetail,
    submitEnterpriseAuth,
    getAuthDetail,
    updateUserInfo,
    getSystemSettings,
    updateSystemSettings,
    redeemVipCode,
    callCloudObjectSilent,
    createPendingMemberOrder,
    createMemberOrderAndGetPayParams,
    getMemberOrderPayStatus,
    previewUpgradeEnterpriseMember,
    createPendingUpgradeEnterpriseMemberOrder,
    previewUpgradePlanPeriod,
    createPendingUpgradePlanPeriodOrder,
    getMembershipPromotionConfig,
    createPromotionOrder,
    activatePromotionOrder,
    createPromotionWxPayParams,
    getPromotionOrderPayStatus,
    getPromotionEffectDetail,
    validateMemberCouponCode,
    completeZeroAmountMemberOrder,
    createMemberOrder,
    checkSalesAccess,
    getSalesCenterDashboard,
    getSalesPromotionInfo,
    getMySalesCustomers,
    getMySalesCommission
};
