<template>
    <!-- pages/profile/profile.wxml -->
    <view class="profile-page">
        <!-- 用户信息头部 -->
        <view class="profile-header">
            <view class="header-content">
                <view class="avatar-wrapper" @tap="changeAvatar">
                    <image class="user-avatar" :src="userInfo.avatar || '/static/images/logo.png'" mode="aspectFill"></image>
                    <view class="avatar-mask">
                        <text class="avatar-edit-text">更换头像</text>
                    </view>
                </view>
                <view class="user-info">
                    <text class="user-name">{{ userInfo.nickname || userInfo.username || '微信用户' }}</text>
                    <view class="user-phone-section">
                        <button 
                            class="phone-display-btn"
                            open-type="getPhoneNumber"
                            @getphonenumber="onBindPhoneNumber"
                            :disabled="bindingPhone"
                            :loading="bindingPhone"
                        >
                            <view v-if="isValidPhone(userInfo.mobile)" class="user-phone">
                                {{ formatPhone(userInfo.mobile) }} 
                                <text class="edit-icon">✎</text>
                            </view>
                            <text v-else class="empty-phone">{{ bindingPhone ? '加载中...' : '点击授权手机号' }}</text>
                        </button>
                    </view>
                    <view class="user-status">
                        <auth-badges
                            :realname-verified="authStatus === 'verified'"
                            :enterprise-verified="enterpriseAuthLabel === 'approved'"
                        />
                    </view>
                </view>
            </view>

            <!-- 统计信息 -->
            <view class="stats-bar">
                <view class="stat-item" @tap="goToMySupply">
                    <text class="stat-value">{{ stats.supply }}</text>
                    <text class="stat-label">我的供应</text>
                </view>
                <view class="stat-item" @tap="goToMyProcurement">
                    <text class="stat-value">{{ stats.procurement }}</text>
                    <text class="stat-label">我的采购</text>
                </view>
                <view class="stat-item" @tap="goToFollowing">
                    <text class="stat-value">{{ followStats.following }}</text>
                    <text class="stat-label">关注</text>
                </view>
                <view class="stat-item" @tap="goToFollowers">
                    <text class="stat-value">{{ followStats.followers }}</text>
                    <text class="stat-label">粉丝</text>
                </view>
            </view>
        </view>

        <!-- 主要内容 -->
        <view class="content-section">
            <!-- 发布按钮 -->
            <button class="publish-btn" @tap="publishSupply">📤 发布供应信息</button>

            <!-- 生意管理 -->
            <view class="menu-section">
                <text class="section-title">生意管理</text>
                <view class="menu-list">
                    <view class="menu-item" @tap="goToMyMember">
                        <view class="menu-icon" style="background: #dcfce7; color: #16a34a">⭐</view>
                        <text class="menu-label">我的会员</text>
                        <text class="menu-arrow">›</text>
                    </view>
                    <view class="menu-item" @tap="goToPromotionCenter">
                        <view class="menu-icon" style="background: #fef9c3; color: #ca8a04">📣</view>
                        <text class="menu-label">推广服务</text>
                        <text class="menu-arrow">›</text>
                    </view>
                    <view class="menu-item" @tap="goToMySupply">
                        <view class="menu-icon" style="background: #dbeafe; color: #3b82f6">📦</view>
                        <text class="menu-label">我的供应</text>
                        <text class="menu-arrow">›</text>
                    </view>
                    <view class="menu-item" @tap="goToMyProcurement">
                        <view class="menu-icon" style="background: #fed7aa; color: #f97316">🛒</view>
                        <text class="menu-label">我的采购</text>
                        <text class="menu-arrow">›</text>
                    </view>
                    <view class="menu-item" @tap="goToOrders">
                        <view class="menu-icon" style="background: #e9d5ff; color: #9333ea">📄</view>
                        <text class="menu-label">订单管理</text>
                        <text class="menu-arrow">›</text>
                    </view>
                    <view v-if="isSales" class="menu-item" @tap="goToSalesCenter">
                        <view class="menu-icon" style="background: #dcfce7; color: #16a34a">📈</view>
                        <text class="menu-label">销售中心</text>
                        <text class="menu-arrow">›</text>
                    </view>
                </view>
            </view>

            <!-- 客户关系 -->
            <view class="menu-section">
                <text class="section-title">客户关系</text>
                <view class="menu-list">
                    <view class="menu-item" @tap="goToFollowing">
                        <view class="menu-icon" style="background: #fce7f3; color: #ec4899">❤️</view>
                        <text class="menu-label">我的关注</text>
                        <text v-if="followStats.following > 0" class="menu-badge">{{ followStats.following }}</text>
                        <text class="menu-arrow">›</text>
                    </view>
                    <view class="menu-item" @tap="goToFollowers">
                        <view class="menu-icon" style="background: #fce7f3; color: #ec4899">👥</view>
                        <text class="menu-label">我的粉丝</text>
                        <text v-if="followStats.followers > 0" class="menu-badge">{{ followStats.followers }}</text>
                        <text class="menu-arrow">›</text>
                    </view>
                    <view class="menu-item" @tap="goToCustomerPhonebook">
                        <view class="menu-icon" style="background: #ccfbf1; color: #14b8a6">📞</view>
                        <text class="menu-label">客户电话簿</text>
                        <text class="menu-arrow">›</text>
                    </view>
                </view>
            </view>

            <!-- 服务与设置 -->
            <view class="menu-section">
                <view class="menu-list">
                    <view class="menu-item" @tap="goToAuth">
                        <view class="menu-icon" style="background: #dcfce7; color: #16a34a">🛡️</view>
                        <text class="menu-label">实名认证</text>
                        <view class="auth-status-wrapper">
                            <text v-if="authStatus === 'verified'" class="auth-status verified">已认证</text>
                            <text v-else-if="authStatus === 'pending'" class="auth-status pending">审核中</text>
                            <text v-else-if="authStatus === 'rejected'" class="auth-status rejected">认证失败</text>
                            <text v-else class="auth-status unverified">未认证</text>
                        </view>
                        <text class="menu-arrow">›</text>
                    </view>
                    <view class="menu-item" @tap="goToEnterpriseAuth">
                        <view class="menu-icon" style="background: #dbeafe; color: #2563eb">🏢</view>
                        <text class="menu-label">企业认证</text>
                        <view class="auth-status-wrapper">
                            <text v-if="enterpriseAuthLabel === 'approved'" class="auth-status verified">已认证</text>
                            <text v-else-if="enterpriseAuthLabel === 'pending'" class="auth-status pending">审核中</text>
                            <text v-else-if="enterpriseAuthLabel === 'rejected'" class="auth-status rejected">已驳回</text>
                            <text v-else class="auth-status unverified">未认证</text>
                        </view>
                        <text class="menu-arrow">›</text>
                    </view>
                    <view class="menu-item" @tap="goToService">
                        <view class="menu-icon" style="background: #f3f4f6; color: #4b5563">📞</view>
                        <text class="menu-label">联系客服</text>
                        <text class="menu-arrow">›</text>
                    </view>
                    <view class="menu-item" @tap="goToSettings">
                        <view class="menu-icon" style="background: #f3f4f6; color: #4b5563">⚙️</view>
                        <text class="menu-label">系统设置</text>
                        <text class="menu-arrow">›</text>
                    </view>
                    <view class="menu-item" @tap="goToVersion">
                        <view class="menu-icon" style="background: #f3f4f6; color: #4b5563">ℹ️</view>
                        <text class="menu-label">版本更新</text>
                        <text class="menu-arrow">›</text>
                    </view>
                </view>
            </view>

            <!-- 退出登录 -->
            <button class="logout-btn" @tap="logout">🚪 退出登录</button>

            <!-- 版本信息 -->
            <text class="version-text">AgriConnect Platform v1.0.5</text>
        </view>
    </view>

    <!-- 简化的图片裁剪组件 -->
    <simple-avatar-cropper 
        :show="showCropper" 
        :src="cropperImageSrc" 
        @confirm="handleCropConfirm"
        @cancel="handleCropCancel"
    ></simple-avatar-cropper>
</template>

<script>
// pages/profile/profile.js - 个人中心页面（简化版）
const app = getApp();
import {
    getFollowStats,
    getAuthStatus,
    getMySupplies,
    getMyProcurements,
    uploadImage,
    updateUserInfo,
    getUserStats,
    getSystemSettings,
    getEnterpriseAuthDetail,
    getUserInfo,
    checkSalesAccess
} from '../../utils/api.js';
import { syncFollowStateFromServer, getFollowState } from '../../utils/followState.js';
import SimpleAvatarCropper from '../../components/simple-avatar-cropper/simple-avatar-cropper.vue';
import AuthBadges from '../../components/auth-badges/auth-badges.vue';

function getStoredToken() {
    return (
        uni.getStorageSync('token') ||
        uni.getStorageSync('uni_id_token') ||
        uni.getStorageSync('uniIdToken') ||
        ''
    );
}

export default {
    components: {
        SimpleAvatarCropper,
        AuthBadges
    },
    data() {
        return {
            // 默认用户信息，避免渲染阶段 userInfo 为空导致报错
            userInfo: {
                username: '微信用户',
                avatar: ''
            },
            authStatus: 'unverified',
            // unverified | pending | verified | rejected
            authInfo: null,
            // 企业认证：none | pending | approved | rejected（用于右侧文案）
            enterpriseAuthLabel: 'none',
            stats: {
                supply: 0,
                procurement: 0,
                views: 0
            },
            followStats: {
                following: 0,
                // 关注数
                followers: 0 // 粉丝数
            },
            // 图片裁剪相关
            showCropper: false,
            cropperImageSrc: '',
            // 客服电话（从系统配置获取）
            customerServicePhone: '400-123-8888',
            // 绑定手机号状态
            bindingPhone: false,
            isProfileLoading: false,
            isFollowStatsLoading: false,
            hasProfileInited: false,
            isSales: false,
            /** 性能：整套接口刷新节流（毫秒），避免 onLoad 后立即 onShow 重复打满请求 */
            _profileFullRefreshMinIntervalMs: 45000,
            _profileLastFullRefreshAt: 0
        };
    },
    onLoad() {
        if (!this.ensureLoggedIn()) {
            this.isSales = false;
            this.loadUserInfo();
            return;
        }
        this.loadUserInfo();
        this.loadFavorites();
        void this.loadSystemSettings();
        this.initProfilePage({ source: 'load' });
    },
    onShow() {
        // 重置页面滚动位置
        uni.pageScrollTo({
            scrollTop: 0,
            duration: 0
        });

        if (!this.ensureLoggedIn()) {
            this.isSales = false;
            return;
        }

        this.loadUserInfo();
        this.loadFavorites();

        const now = Date.now();
        const minMs = this._profileFullRefreshMinIntervalMs || 45000;
        const needFull =
            !this._profileLastFullRefreshAt || now - this._profileLastFullRefreshAt >= minMs;

        if (needFull) {
            void this.loadSystemSettings();
            this.initProfilePage({ source: 'show' });
        } else {
            // #region 性能验收日志（可删）
            console.log('[perf][profile] skip full refresh (throttle)', {
                ageMs: now - this._profileLastFullRefreshAt,
                minMs
            });
            // #endregion
        }
    },
    methods: {
        ensureLoggedIn() {
            const token = getStoredToken();
            if (token) {
                if (app.globalData) {
                    app.globalData.isLoggedIn = true;
                    app.globalData.userInfo = uni.getStorageSync('userInfo') || app.globalData.userInfo;
                }
                return true;
            }

            uni.setStorageSync('redirectUrl', '/pages/profile/profile');
            uni.navigateTo({
                url: '/pages/login/login'
            });
            return false;
        },

        // 手机号脱敏显示
        formatPhone(phone) {
            if (!phone) return '';
            const phoneStr = String(phone).trim();
            // 严格校验：如果是错误信息或非11位数字，直接当做空处理，绝不显示在界面上
            if (!/^\d{11}$/.test(phoneStr)) {
                return '';
            }
            return phoneStr.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
        },
        
        // 验证是否是合法手机号，防止错误信息被当作手机号渲染
        isValidPhone(phone) {
            if (!phone) return false;
            return /^\d{11}$/.test(String(phone).trim());
        },

        async initProfilePage(options = {}) {
            if (this.isProfileLoading) return;

            this.isProfileLoading = true;
            const source = options.source || 'show';
            const t0 = Date.now();

            // #region 性能验收日志（可删）
            console.log('[perf][profile] init start', { source });
            // #endregion

            try {
                // 首屏：关注/实名/企业/统计并行；销售中心入口后台探测，不阻塞首屏
                await Promise.all([
                    this.loadFollowStats(),
                    this.loadAuthStatus(),
                    this.loadEnterpriseAuthLabel(),
                    this.loadStats()
                ]);
                this._profileLastFullRefreshAt = Date.now();
                this.hasProfileInited = true;

                void this.refreshSalesCenterAccess().finally(() => {
                    // #region 性能验收日志（可删）
                    console.log('[perf][profile] sales access done (async)', {
                        source,
                        totalMsSinceInit: Date.now() - t0
                    });
                    // #endregion
                });

                // #region 性能验收日志（可删）
                console.log('[perf][profile] init core done', {
                    source,
                    coreParallelMs: Date.now() - t0
                });
                // #endregion
            } catch (err) {
                console.error('initProfilePage error:', err);
            } finally {
                this.isProfileLoading = false;
            }
        },

        loadUserInfo() {
            const local = uni.getStorageSync('userInfo') || app.globalData.userInfo || {};
            this.setData({
                userInfo: local || {
                    username: '微信用户_Agri88',
                    avatar: ''
                }
            });
            const userId = local.user_id || local._id || local.id;
            if (userId) {
                getUserInfo(userId)
                    .then((prof) => {
                        if (!prof) return;
                        const merged = { ...local, ...prof };
                        this.setData({ userInfo: merged });
                        uni.setStorageSync('userInfo', merged);
                        if (app.globalData) app.globalData.userInfo = merged;
                    })
                    .catch(() => {});
            }
        },

        loadFavorites() {
            const favorites = uni.getStorageSync('favorites') || [];
            // 可以在这里统计收藏数量等
        },

        // 加载关注统计
        loadFollowStats() {
            if (this.isFollowStatsLoading) return Promise.resolve();
            
            // 未登录时不再请求接口，直接走本地数据
            const token = getStoredToken();
            if (!token) {
                this.loadFollowStatsFromLocal();
                return Promise.resolve();
            }

            this.isFollowStatsLoading = true;

            // 调用API获取关注统计，并同步统一关注状态缓存
            return Promise.all([getFollowStats(), syncFollowStateFromServer(true).catch(() => null)])
                .then((resArr) => {
                    const res = Array.isArray(resArr) ? resArr[0] : resArr;
                    // 处理不同的响应格式
                    if (res) {
                        let following = 0;
                        let followers = 0;

                        // 兼容不同的响应格式
                        // 云函数 callCloudFunction 返回的是 data 部分，格式为 { following, followers }
                        if (typeof res.following === 'number' && typeof res.followers === 'number') {
                            following = res.following;
                            followers = res.followers;
                        } else if (res.data) {
                            // 如果还有 data 嵌套
                            following = res.data.following || 0;
                            followers = res.data.followers || 0;
                        } else if (res.result) {
                            following = res.result.following || 0;
                            followers = res.result.followers || 0;
                        }
                        
                        const state = getFollowState();
                        following = Math.max(following, state.followingList.length);
                        followers = Math.max(followers, state.followersList.length);
                        this.setData({
                            followStats: {
                                following: following,
                                followers: followers
                            }
                        });

                        // 同时更新本地存储（作为缓存）
                        uni.setStorageSync('followStats', {
                            following: following,
                            followers: followers,
                            updateTime: Date.now()
                        });
                    } else {
                        console.warn('getFollowStats 返回空数据，使用本地数据');
                        // API调用失败时使用本地数据
                        this.loadFollowStatsFromLocal();
                    }
                })
                .catch((err) => {
                    console.error('加载关注统计失败', err);
                    // API调用失败时使用本地数据或缓存
                    this.loadFollowStatsFromLocal();
                })
                .finally(() => {
                    this.isFollowStatsLoading = false;
                });
        },

        // 从本地存储加载关注统计（作为备用方案）
        loadFollowStatsFromLocal() {
            const cachedStats = uni.getStorageSync('followStats') || {};
            const followingList = uni.getStorageSync('followingList') || [];
            const followersList = uni.getStorageSync('followersList') || [];
            const following = Math.max(Number(cachedStats.following) || 0, followingList.length);
            const followers = Math.max(Number(cachedStats.followers) || 0, followersList.length);
            this.setData({
                followStats: {
                    following,
                    followers
                }
            });
        },

        // 加载统计数据（我的供应、我的采购数量、被浏览数）
        async loadStats() {
            try {
                const currentUser = uni.getStorageSync('userInfo') || app.globalData.userInfo;
                // 读取用户 id 时，使用 user_id 字段
                const userId = currentUser?.user_id;
                
                const [supplyResult, procurementResult, userStats] = await Promise.all([
                    getMySupplies({ page: 1, pageSize: 1 }).catch(() => ({ total: 0 })),
                    getMyProcurements({ page: 1, pageSize: 1 }).catch(() => ({ total: 0 })),
                    userId
                        ? getUserStats(userId).catch(() => ({ product_views_total: 0 }))
                        : Promise.resolve({ product_views_total: 0 })
                ]);

                const productViews =
                    userStats?.product_views_total != null
                        ? userStats.product_views_total
                        : userStats?.data?.product_views_total != null
                          ? userStats.data.product_views_total
                          : 0;
                const viewsTotal = Number.isFinite(Number(productViews)) ? Math.max(0, Math.floor(Number(productViews))) : 0;

                this.setData({
                    stats: {
                        supply: supplyResult.total || 0,
                        procurement: procurementResult.total || 0,
                        views: viewsTotal
                    }
                });

                uni.setStorageSync('userStats', {
                    supply: supplyResult.total || 0,
                    procurement: procurementResult.total || 0,
                    views: viewsTotal,
                    product_views_total: viewsTotal,
                    updateTime: Date.now()
                });
            } catch (err) {
                console.error('加载统计数据失败', err);
                // 失败时尝试从本地获取
                const cachedStats = uni.getStorageSync('userStats');
                const cachedViewsRaw =
                    cachedStats?.product_views_total != null ? cachedStats.product_views_total : cachedStats?.views;
                const cachedViews = Number.isFinite(Number(cachedViewsRaw)) ? Math.max(0, Math.floor(Number(cachedViewsRaw))) : 0;
                this.setData({
                    stats: {
                        supply: cachedStats?.supply || 0,
                        procurement: cachedStats?.procurement || 0,
                        views: cachedViews
                    }
                });
            }
        },

        // 跳转到会员中心
        goToOpenShop() {
            uni.navigateTo({
                url: '/pages/open-shop/open-shop'
            });
        },

        isMemberActiveFromUserInfo(u) {
            if (!u) return false;
            const now = Date.now();
            let expTs = 0;
            const vx = u.vip_expire_time;
            if (vx instanceof Date) {
                expTs = vx.getTime();
            } else if (vx) {
                const t = new Date(vx).getTime();
                expTs = Number.isNaN(t) ? 0 : t;
            }
            const active = u.is_member_active === true || u.is_vip === true;
            const mt = u.member_type || 'free';
            if (!active || expTs <= now) return false;
            return mt === 'personal' || mt === 'enterprise';
        },

        async goToMyMember() {
            const token = getStoredToken();
            if (!token) {
                uni.setStorageSync('redirectUrl', '/pages/profile/profile');
                uni.navigateTo({
                    url: '/pages/login/login'
                });
                return;
            }
            const local = uni.getStorageSync('userInfo') || {};
            const userId = local.user_id || local._id || local.id;
            if (userId) {
                try {
                    const prof = await getUserInfo(userId);
                    if (prof) {
                        const merged = { ...local, ...prof };
                        uni.setStorageSync('userInfo', merged);
                        if (app.globalData) {
                            app.globalData.userInfo = merged;
                        }
                        this.setData({
                            userInfo: merged
                        });
                    }
                } catch (_e) {}
            }
            const u = uni.getStorageSync('userInfo') || this.userInfo || {};
            if (this.isMemberActiveFromUserInfo(u)) {
                uni.navigateTo({
                    url: '/pages/my-member/my-member'
                });
            } else {
                uni.navigateTo({
                    url: '/pages/open-shop/open-shop'
                });
            }
        },

        /**
         * 推广服务入口：pages/promotion-center 为「单条信息推广下单页」，必须由我的供应/我的采购
         * 列表中单条「推广」带 content_id、content_type 进入；此处仅引导用户去对应列表选信息。
         */
        goToPromotionCenter() {
            uni.showActionSheet({
                itemList: ['我的供应', '我的采购'],
                success: (res) => {
                    const idx = res.tapIndex;
                    if (idx === 0) {
                        uni.navigateTo({ url: '/pages/my-supply/my-supply' });
                    } else if (idx === 1) {
                        uni.navigateTo({ url: '/pages/my-procurement/my-procurement' });
                    }
                }
            });
        },

        // 跳转到我的供应
        goToMySupply() {
            uni.navigateTo({
                url: '/pages/my-supply/my-supply'
            });
        },

        // 跳转到我的采购
        goToMyProcurement() {
            uni.navigateTo({
                url: '/pages/my-procurement/my-procurement'
            });
        },

        // 跳转到被浏览
        goToViews() {
            uni.showToast({
                title: '功能开发中',
                icon: 'none'
            });
        },

        // 发布供应
        publishSupply() {
            uni.navigateTo({
                url: '/pages/publish-info/publish-info?tab=supply'
            });
        },

        // 跳转到订单管理
        goToOrders() {
            uni.navigateTo({
                url: '/pages/member-orders/member-orders'
            });
        },

        // 跳转到我的关注
        goToFollowing() {
            uni.navigateTo({
                url: '/pages/follows/follows?tab=following'
            });
        },

        // 跳转到我的粉丝
        goToFollowers() {
            uni.navigateTo({
                url: '/pages/follows/follows?tab=followers'
            });
        },

        // 跳转到销售中心
        goToSalesCenter() {
            uni.navigateTo({
                url: '/pages/sales-center/dashboard'
            });
        },

        /** 静默探测销售中心入口（仅 bind_user_id + status=1，不用 getSalesCenterDashboard） */
        async refreshSalesCenterAccess() {
            if (!getStoredToken()) {
                this.isSales = false;
                return;
            }
            try {
                const data = await checkSalesAccess();
                this.isSales = !!(data && data.hasAccess === true);
            } catch (_e) {
                this.isSales = false;
            }
        },

        // 保留兼容旧入口
        goToFavorites() {
            uni.navigateTo({
                url: '/pages/follows/follows?tab=following'
            });
        },

        // 跳转到客户电话簿
        goToCustomerPhonebook() {
            uni.navigateTo({
                url: '/pages/customer-phonebook/customer-phonebook'
            });
        },

        // 加载认证状态
        loadAuthStatus() {
            // 检查是否已登录（有 token）
            const token = getStoredToken();
            if (!token) {
                console.log('用户未登录，跳过加载认证状态');
                // 从本地存储加载
                const authInfo = uni.getStorageSync('authInfo');
                if (authInfo) {
                    this.setData({
                        authStatus: authInfo.status || 'unverified',
                        authInfo: authInfo
                    });
                }
                return Promise.resolve();
            }
            
            return getAuthStatus()
                .then((res) => {
                    if (res && res.success !== false) {
                        const data = res.data || res;
                        this.setData({
                            authStatus: data.status || 'unverified',
                            authInfo: data
                        });

                        // 更新全局状态
                        if (app.globalData) {
                            app.globalData.authStatus = data.status || 'unverified';
                        }
                        
                        // 同步到本地存储
                        uni.setStorageSync('authInfo', data);
                    } else {
                        // 从本地存储加载
                        const authInfo = uni.getStorageSync('authInfo');
                        if (authInfo) {
                            this.setData({
                                authStatus: authInfo.status || 'unverified',
                                authInfo: authInfo
                            });
                        }
                    }
                })
                .catch((err) => {
                    console.error('加载认证状态失败', err);
                    // 从本地存储加载
                    const authInfo = uni.getStorageSync('authInfo');
                    if (authInfo) {
                        this.setData({
                            authStatus: authInfo.status || 'unverified',
                            authInfo: authInfo
                        });
                    }
                });
        },

        // 跳转到实名认证
        goToAuth() {
            // 如果状态是审核中，不允许再次提交
            if (this.authStatus === 'pending') {
                uni.showToast({
                    title: '审核中，请耐心等待',
                    icon: 'none'
                });
                return;
            }
            uni.navigateTo({
                url: `/pages/real-name-auth/real-name-auth?status=${this.authStatus}`
            });
        },

        // 企业认证入口（进入申请页查看/填写）
        goToEnterpriseAuth() {
            const userInfo = this.userInfo || uni.getStorageSync('userInfo') || {};
            const isEnterpriseMember = userInfo.member_type === 'enterprise' && userInfo.is_member_active === true;
            if (!isEnterpriseMember) {
                uni.showToast({
                    title: '请开通企业会员',
                    icon: 'none'
                });
                return;
            }
            uni.navigateTo({
                url: '/pages/enterprise-auth/enterprise-auth'
            });
        },

        // 拉取企业认证状态，并同步用户资料中的 enterprise 字段
        loadEnterpriseAuthLabel() {
            const token = getStoredToken();
            if (!token) {
                this.setData({ enterpriseAuthLabel: 'none' });
                return Promise.resolve();
            }
            const userInfo = uni.getStorageSync('userInfo') || {};
            const userId = userInfo.user_id || userInfo._id || userInfo.id || '';

            const applyLabel = (detail, mergedUser) => {
                const u = mergedUser || uni.getStorageSync('userInfo') || {};
                const enterpriseMemberActive = u.member_type === 'enterprise' && u.is_member_active === true;
                if (!enterpriseMemberActive) {
                    this.setData({ enterpriseAuthLabel: 'none' });
                    return;
                }
                let st = detail && detail.status ? detail.status : '';
                if (!st) {
                    if (u.enterprise_auth_status === 'approved' || u.isEnterpriseVerified === true || u.is_enterprise_verified === true) {
                        st = 'approved';
                    } else if (u.enterprise_auth_status === 'pending') {
                        st = 'pending';
                    } else if (u.enterprise_auth_status === 'rejected') {
                        st = 'rejected';
                    } else {
                        st = 'none';
                    }
                }
                const label =
                    st === 'approved' ? 'approved' : st === 'pending' ? 'pending' : st === 'rejected' ? 'rejected' : 'none';
                this.setData({ enterpriseAuthLabel: label });
            };

            const pDetail = getEnterpriseAuthDetail().catch(() => null);
            const pUser = userId ? getUserInfo(userId).catch(() => null) : Promise.resolve(null);

            return Promise.all([pDetail, pUser]).then(([detailRaw, prof]) => {
                const detail =
                    detailRaw && (detailRaw.data !== undefined && detailRaw.data !== null ? detailRaw.data : detailRaw);
                let merged = { ...userInfo };
                if (prof) {
                    merged = { ...merged, ...prof };
                    uni.setStorageSync('userInfo', merged);
                    if (app.globalData) {
                        app.globalData.userInfo = merged;
                    }
                    this.setData({ userInfo: merged });
                }
                applyLabel(detail, merged);
            });
        },

        // 加载系统配置（包括客服电话）
        async loadSystemSettings() {
            try {
                const settings = await getSystemSettings();
                const raw =
                    settings &&
                    (settings.customer_service_phone !== undefined && settings.customer_service_phone !== null
                        ? settings.customer_service_phone
                        : '');
                const phone = String(raw)
                    .replace(/【仅为模拟】/g, '')
                    .trim();
                if (phone) {
                    this.setData({ customerServicePhone: phone });
                }
            } catch (error) {
                console.error('加载系统配置失败:', error);
            }
        },

        // 联系客服：先拉最新号码，再自定义确认框，再调起系统拨号
        async goToService() {
            await this.loadSystemSettings();
            let phoneNumber = String(this.customerServicePhone || '400-123-8888')
                .replace(/【仅为模拟】/g, '')
                .trim();
            if (!phoneNumber) {
                phoneNumber = '400-123-8888';
            }
            uni.showModal({
                title: '联系客服',
                content: '是否拨打客服电话：' + phoneNumber + '？',
                confirmText: '拨打',
                cancelText: '取消',
                success: (res) => {
                    if (!res.confirm) return;
                    uni.makePhoneCall({
                        phoneNumber,
                        fail: (err) => {
                            console.error('拨打电话失败', err);
                            uni.showToast({
                                title: '拨打电话失败',
                                icon: 'none'
                            });
                        }
                    });
                }
            });
        },

        // 跳转到系统设置
        goToSettings() {
            uni.navigateTo({
                url: '/pages/system-settings/system-settings'
            });
        },

        // 跳转到版本更新 / 关于页面
        goToVersion() {
            uni.showToast({
                title: '当前已是最新版本',
                icon: 'none'
            });
        },

        // 更换头像 - 使用微信小程序原生API选择图片
        changeAvatar() {
            console.log('[头像更换] 步骤1: 用户点击更换头像');
            
            // 使用微信小程序原生 chooseImage API
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'], // 使用压缩图片，减少上传时间
                sourceType: ['album', 'camera'], // 支持相册和拍照
                success: (res) => {
                    const tempFilePath = res.tempFilePaths[0];
                    console.log('[头像更换] 步骤2: 图片选择成功', tempFilePath);
                    
                    // 显示裁剪器
                    this.setData({
                        cropperImageSrc: tempFilePath,
                        showCropper: true
                    });
                },
                fail: (err) => {
                    console.error('[头像更换] 步骤2失败: 图片选择失败', err);
                    let errorMsg = '选择图片失败';
                    if (err.errMsg) {
                        if (err.errMsg.includes('cancel')) {
                            // 用户取消，不显示错误
                            console.log('[头像更换] 用户取消选择图片');
                            return;
                        }
                        errorMsg = err.errMsg;
                    }
                    uni.showToast({
                        title: errorMsg,
                        icon: 'none',
                        duration: 2000
                    });
                }
            });
        },

        // 裁剪确认 - 上传裁剪后的图片
        handleCropConfirm(croppedImagePath) {
            console.log('[头像更换] 步骤3: 裁剪完成，开始上传', croppedImagePath);
            this.setData({
                showCropper: false,
                cropperImageSrc: ''
            });
            // 直接上传裁剪后的图片
            this.uploadAvatar(croppedImagePath);
        },

        // 裁剪取消
        handleCropCancel() {
            console.log('[头像更换] 用户取消裁剪');
            this.setData({
                showCropper: false,
                cropperImageSrc: ''
            });
        },

        // 上传头像 - 简化版本，更可靠
        uploadAvatar(filePath) {
            console.log('[头像更换] 步骤4: 开始上传头像', filePath);
            
            if (!filePath) {
                console.error('[头像更换] 步骤4失败: 图片路径无效');
                uni.showToast({
                    title: '图片路径无效',
                    icon: 'none'
                });
                return;
            }

            // 显示上传提示
            uni.showLoading({
                title: '上传中...',
                mask: true
            });

            let loadingHidden = false;
            const hideLoading = () => {
                if (!loadingHidden) {
                    loadingHidden = true;
                    uni.hideLoading();
                    console.log('[头像更换] 隐藏加载提示');
                }
            };

            // 设置超时保护（30秒）
            const timeout = setTimeout(() => {
                if (!loadingHidden) {
                    console.error('[头像更换] 上传流程超时');
                    hideLoading();
                    uni.showToast({
                        title: '上传超时，请重试',
                        icon: 'none',
                        duration: 3000
                    });
                }
            }, 30000);

            // 上传图片
            console.log('[头像更换] 步骤5: 调用 uploadImage API');
            uploadImage(filePath)
                .then((res) => {
                    clearTimeout(timeout);
                    console.log('[头像更换] 步骤6: 图片上传成功', res);
                    
                    // 获取头像URL
                    const avatarUrl = res.url || res.data?.url || res.fileID || res;
                    
                    if (!avatarUrl) {
                        console.error('[头像更换] 步骤6失败: 未获取到图片地址', res);
                        throw new Error('上传成功但未获取到图片地址');
                    }
                    
                    console.log('[头像更换] 步骤7: 获取到头像URL', avatarUrl);
                    
                    // 更新用户信息
                    return this.updateUserAvatar(avatarUrl);
                })
                .then(() => {
                    hideLoading();
                    clearTimeout(timeout);
                    console.log('[头像更换] 步骤8: 头像更换完成');
                    uni.showToast({
                        title: '头像更换成功',
                        icon: 'success',
                        duration: 2000
                    });
                })
                .catch((err) => {
                    clearTimeout(timeout);
                    hideLoading();
                    console.error('[头像更换] 上传流程失败:', err);
                    
                    // 获取友好的错误信息
                    let errorMessage = '上传失败，请重试';
                    if (err && err.message) {
                        errorMessage = err.message;
                    } else if (typeof err === 'string') {
                        errorMessage = err;
                    } else if (err && err.errMsg) {
                        // 处理微信小程序错误信息
                        if (err.errMsg.includes('network') || err.errMsg.includes('网络')) {
                            errorMessage = '网络错误，请检查网络连接';
                        } else if (err.errMsg.includes('timeout') || err.errMsg.includes('超时')) {
                            errorMessage = '上传超时，请重试';
                        } else {
                            errorMessage = err.errMsg;
                        }
                    }
                    
                    console.error('[头像更换] 错误详情:', JSON.stringify(err, null, 2));
                    uni.showToast({
                        title: errorMessage,
                        icon: 'none',
                        duration: 3000
                    });
                });
        },

        // 更新用户头像
        async updateUserAvatar(avatarUrl) {
            console.log('[头像更换] 步骤7: 开始更新用户头像到数据库', avatarUrl);
            
            try {
                // 调用API更新用户信息
                console.log('[头像更换] 步骤7.1: 调用 updateUserInfo 云函数');
                const result = await updateUserInfo({
                    avatar: avatarUrl
                });
                
                console.log('[头像更换] 步骤7.2: updateUserInfo 返回结果', result);

                // 更新本地用户信息
                const userInfo = this.userInfo || {};
                userInfo.avatar = avatarUrl;
                this.setData({
                    userInfo: userInfo
                });

                // 更新本地存储
                uni.setStorageSync('userInfo', userInfo);

                // 更新全局用户信息
                const app = getApp();
                if (app && app.globalData && app.globalData.userInfo) {
                    app.globalData.userInfo.avatar = avatarUrl;
                }
                
                console.log('[头像更换] 步骤7.3: 用户头像更新成功');
            } catch (error) {
                console.error('[头像更换] 步骤7失败: 更新用户信息失败', error);
                
                // 获取详细错误信息
                let errorMessage = '更新用户信息失败';
                if (error && error.message) {
                    errorMessage = error.message;
                } else if (typeof error === 'string') {
                    errorMessage = error;
                } else if (error && error.errMsg) {
                    errorMessage = error.errMsg;
                }
                
                console.error('[头像更换] 错误详情:', JSON.stringify(error, null, 2));
                
                // 即使API调用失败，也更新本地显示（离线体验）
                console.warn('[头像更换] 使用降级方案：仅更新本地显示');
                const userInfo = this.userInfo || {};
                userInfo.avatar = avatarUrl;
                this.setData({
                    userInfo: userInfo
                });
                uni.setStorageSync('userInfo', userInfo);
                
                const app = getApp();
                if (app && app.globalData && app.globalData.userInfo) {
                    app.globalData.userInfo.avatar = avatarUrl;
                }
                
                // 抛出错误，让上层处理
                throw new Error(errorMessage);
            }
        },

        // 绑定手机号
        async onBindPhoneNumber(e) {
            // 检查用户是否授权
            if (e.detail.errMsg !== 'getPhoneNumber:ok') {
                uni.showToast({
                    title: '需要授权才能绑定手机号',
                    icon: 'none'
                });
                return;
            }

            this.setData({
                bindingPhone: true
            });

            try {
                // 获取微信登录 code（用于验证）
                const loginRes = await new Promise((resolve, reject) => {
                    uni.login({
                        provider: 'weixin',
                        success: resolve,
                        fail: reject
                    });
                });

                if (!loginRes.code) {
                    throw new Error('获取微信登录凭证失败');
                }

                // 调用云函数绑定手机号
                const phoneCode = e.detail.code;
                const token = getStoredToken();
                
                // 【要求输出的前端日志】
                console.log('[前端日志] 修改手机号读取到 token:', !!token);
                if (token) {
                    console.log('[前端日志] token 前10位:', token.substring(0, 10), '长度:', token.length);
                }
                console.log('[前端日志] 调用 bindPhoneNumber 传参:', {
                    hasToken: !!token,
                    loginCode: loginRes.code ? `<length ${loginRes.code.length}>` : '空',
                    phoneCode: phoneCode ? `<length ${phoneCode.length}>` : '空'
                });

                const res = await uniCloud.callFunction({
                    name: 'bindPhoneNumber',
                    data: {
                        token: token,
                        loginCode: loginRes.code,
                        phoneCode: phoneCode
                    }
                });

                if (res.result && res.result.code === 200) {
                    const { phoneNumber } = res.result.data;
                    
                    // 更新本地用户信息
                    const userInfo = this.userInfo || {};
                    userInfo.mobile = phoneNumber;
                    this.setData({
                        userInfo: userInfo
                    });
                    uni.setStorageSync('userInfo', userInfo);

                    // 更新全局状态
                    if (app.globalData && app.globalData.userInfo) {
                        app.globalData.userInfo.mobile = phoneNumber;
                    }

                    uni.showToast({
                        title: '绑定成功',
                        icon: 'success'
                    });
                } else {
                    throw new Error(res.result?.message || '绑定失败');
                }
            } catch (err) {
                console.error('绑定手机号失败:', err);
                uni.showToast({
                    title: err.message || '绑定失败',
                    icon: 'none'
                });
            } finally {
                this.setData({
                    bindingPhone: false
                });
            }
        },

        // 退出登录
        logout() {
            uni.showModal({
                title: '提示',
                content: '确定要退出登录吗？',
                success: (res) => {
                    if (res.confirm) {
                        app.globalData.logout();
                        uni.redirectTo({
                            url: '/pages/login/login'
                        });
                    }
                }
            });
        }
    }
};
</script>
<style>
@import './profile.css';
</style>
