<script>
// app.js
import { syncFollowStateFromServer } from './utils/followState.js';
function getStoredToken() {
    return (
        uni.getStorageSync('token') ||
        uni.getStorageSync('uni_id_token') ||
        uni.getStorageSync('uniIdToken') ||
        ''
    );
}

function clearStoredToken() {
    uni.removeStorageSync('token');
    uni.removeStorageSync('uni_id_token');
    uni.removeStorageSync('uniIdToken');
    uni.removeStorageSync('uni_id_token_expired');
}

/** 开发工具 / uni 热更新用的内部 WebSocket 噪声，与业务无关 */
function shouldIgnoreDevWebSocketNoise(msg) {
    if (!msg || typeof msg !== 'string') return false;
    const m = msg;
    if (m.includes('closeSocket') && (m.includes('1006') || m.includes('The code must be either 1000'))) {
        return true;
    }
    if (m.includes('WebSocket connection to') && (m.includes(':8090') || m.includes('mp-weixin'))) {
        return true;
    }
    if (m.includes('SystemError') && m.includes('closeSocket')) {
        return true;
    }
    if (m.includes('appServiceSDKScriptError') && m.includes('closeSocket')) {
        return true;
    }
    return false;
}

function normalizeAppErrorMessage(err) {
    if (err == null) return '';
    if (typeof err === 'string') return err;
    try {
        return err.errMsg || err.message || JSON.stringify(err);
    } catch (_e) {
        return String(err);
    }
}

export default {
    data() {
        return {};
    },
    globalData: {
        userInfo: null,
        isLoggedIn: false,
        isAdminMode: false,
        currentTab: 'procurement',

        // 登录方法
        // 注意：不要在这里设置 token，token 应该由登录接口返回后直接设置
        login(userInfo, token = '') {
            // 合并缓存中已有的 userInfo（防止如 mobile 等字段被局部覆盖丢失）
            const existingUserInfo = uni.getStorageSync('userInfo') || {};
            const mergedUserInfo = { ...existingUserInfo, ...userInfo };

            this.userInfo = mergedUserInfo;
            this.isLoggedIn = true;
            uni.setStorageSync('userInfo', mergedUserInfo);

            if (token) {
                // 同步写入 uniCloud/uni-id 默认识别的 token 键，兼容统一鉴权。
                uni.setStorageSync('token', token);
                uni.setStorageSync('uni_id_token', token);
                uni.setStorageSync('uniIdToken', token);
            }
        },

        // 登出方法
        logout() {
            this.userInfo = null;
            this.isLoggedIn = false;
            this.isAdminMode = false;
            uni.removeStorageSync('userInfo');
            clearStoredToken();
        },

        // 设置管理员模式
        setAdminMode(isAdmin) {
            this.isAdminMode = isAdmin;
        },

        // 全局事件系统：通知profile页面更新粉丝数量和统计数据
        updateProfileFollowStats() {
            // 获取页面栈，找到profile页面实例
            const pages = getCurrentPages();
            const profilePage = pages.find((page) => {
                return page.route === 'pages/profile/profile';
            });
            if (profilePage) {
                const vm = profilePage.$vm || profilePage;
                // 延迟执行，确保关注操作已完成
                setTimeout(() => {
                    syncFollowStateFromServer(true).catch(() => {});
                    // 更新粉丝统计
                    if (vm && typeof vm.loadFollowStats === 'function') {
                        vm.loadFollowStats();
                    }
                    // 同时更新统计数据（包括被浏览数）
                    if (vm && typeof vm.loadStats === 'function') {
                        vm.loadStats();
                    }
                }, 300);
            }
        },

        // 全局事件系统：通知关注页面刷新数据
        refreshFollowsPage() {
            // 获取页面栈，找到follows页面实例
            const pages = getCurrentPages();
            const followsPage = pages.find((page) => {
                return page.route === 'pages/follows/follows';
            });
            if (followsPage) {
                // 延迟执行，确保关注操作已完成
                setTimeout(() => {
                    syncFollowStateFromServer(true).catch(() => {});
                    // 刷新当前tab的数据
                    const vm = followsPage.$vm || followsPage;
                    if (vm && typeof vm.loadTabData === 'function') {
                        const activeTab = vm.activeTab || 'following';
                        vm.loadTabData(activeTab, true);
                    }
                }, 500);
            }
        }
    },
    onLaunch() {
        // 检查登录状态
        const token = getStoredToken();
        const userInfo = uni.getStorageSync('userInfo');
        if (token && userInfo) {
            this.globalData.isLoggedIn = true;
            this.globalData.userInfo = userInfo;
        }

        // 获取系统信息（使用新的API替代已废弃的wx.getSystemInfo）
        const deviceInfo = uni.getDeviceInfo();
        const windowInfo = uni.getWindowInfo();
        const appBaseInfo = uni.getAppBaseInfo();

        // 合并信息以保持向后兼容
        this.globalData.systemInfo = {
            ...deviceInfo,
            ...windowInfo,
            ...appBaseInfo
        };

        // 处理微信开发者工具的 WebSocket 错误（日志回显相关）
        // 这个错误是开发工具内部问题，不影响实际功能，可以安全忽略
        // #ifdef MP-WEIXIN
        try {
            // 拦截全局错误报告
            if (typeof wx !== 'undefined') {
                // 保存原始的错误报告函数（如果存在）
                const originalErrorReport = wx.errorReport || (() => {});
                
                // 重写错误报告函数
                wx.errorReport = function (error) {
                    const errMsg = normalizeAppErrorMessage(error);
                    if (shouldIgnoreDevWebSocketNoise(errMsg)) {
                        return;
                    }
                    if (originalErrorReport && typeof originalErrorReport === 'function') {
                        originalErrorReport.call(this, error);
                    }
                };
            }
        } catch (e) {
            // 如果设置错误处理失败，不影响应用启动
            console.warn('设置 WebSocket 错误处理失败:', e);
        }
        // #endif
    },
    onError(err) {
        // 全局错误处理：忽略开发工具的已知错误
        // #ifdef MP-WEIXIN
        if (err) {
            const errMsg = normalizeAppErrorMessage(err);
            if (shouldIgnoreDevWebSocketNoise(errMsg)) {
                return;
            }

            // 忽略 DOM API 错误（document.querySelector/document.getElementById 等）
            // 这些错误通常来自开发者工具的调试脚本或第三方库，不影响小程序实际运行
            if (errMsg.includes('document.querySelector') || 
                errMsg.includes('document.getElementById') ||
                errMsg.includes('document.querySelector is not a function') ||
                errMsg.includes('document.getElementById is not a function')) {
                // 这是开发者工具调试脚本的问题，可以安全忽略
                return;
            }

            // 忽略 500 错误（通常是开发工具的资源加载问题）
            if (errMsg.includes('Failed to load resource') && errMsg.includes('500')) {
                // 这是开发工具的资源加载问题，不影响实际运行
                return;
            }
        }
        // #endif
        
        // 其他错误正常输出
        console.error('App Error:', err);
    }
};
</script>
<style>
@import './app.css';
</style>
