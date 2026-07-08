<template>
    <!-- pages/my-procurement/my-procurement.wxml -->
    <view class="my-procurement-page">
        <!-- 数据统计栏 -->
        <view class="header-section">
            <view class="stats-bar">
                <view :class="'stat-item ' + (filterStatus === '全部' ? 'active' : '')" data-status="全部" @tap="selectStatus">
                    <text class="stat-value">{{ stats.total }}</text>
                    <text class="stat-label">全部</text>
                </view>
                <view :class="'stat-item ' + (filterStatus === '已发布' ? 'active' : '')" data-status="已发布" @tap="selectStatus">
                    <text class="stat-value">{{ stats.published }}</text>
                    <text class="stat-label">已发布</text>
                </view>
                <view :class="'stat-item ' + (filterStatus === '已下架' ? 'active' : '')" data-status="已下架" @tap="selectStatus">
                    <text class="stat-value">{{ stats.offline }}</text>
                    <text class="stat-label">已下架</text>
                </view>
            </view>
            <view class="search-row">
                <input
                    class="search-input"
                    type="text"
                    confirm-type="search"
                    placeholder="搜索我的采购：产品 / 分类 / 规格 / 地址"
                    :value="searchInputValue"
                    @input="onSearchInput"
                    @confirm="onSearchConfirm"
                />
            </view>
            <scroll-view class="category-scroll" :scroll-x="true" :show-scrollbar="false">
                <view class="category-chip-list">
                    <view
                        v-for="(item, idx) in categoryOptions"
                        :key="'cat-' + idx"
                        :class="'category-chip ' + (categoryFilter === item ? 'active' : '')"
                        :data-category="item"
                        @tap="onCategoryTap"
                    >
                        {{ item }}
                    </view>
                </view>
            </scroll-view>
        </view>

        <!-- 内容列表 -->
        <scroll-view
            class="content-section"
            :scroll-y="true"
            :refresher-enabled="true"
            :refresher-triggered="refreshing"
            @refresherrefresh="onPullDownRefresh"
            @scrolltolower="onReachBottom"
            lower-threshold="50"
        >
            <!-- 空状态 -->
            <view v-if="filteredList.length === 0 && !loading" class="empty-state">
                <text class="empty-icon">🛒</text>
                <text class="empty-text">您还没有发布任何采购</text>
                <button class="publish-btn" @tap="goToPublish">去发布</button>
            </view>

            <!-- 采购列表 -->
            <view v-else class="procurement-list">
                <view class="procurement-card" :data-id="item.id" @tap="goToEdit" v-for="(item, index) in filteredList" :key="index">
                    <view class="card-content">
                        <!-- 右侧信息 -->
                        <view class="card-info">
                            <view class="card-title-row">
                                <text class="card-title">{{ item.title }}</text>
                                <view class="card-title-meta">
                                    <view v-if="item._pv && item._pv.promoBoostActive" class="meta-badge meta-badge-boost">加急推广中</view>
                                    <view v-if="item._pv && item._pv.promoTopActive" class="meta-badge meta-badge-top">置顶</view>
                                    <view
                                        class="status-badge"
                                        :style="'background: ' + item.statusColor + '20; color: ' + item.statusColor + '; border-color: ' + item.statusColor"
                                    >
                                        {{ item.status }}
                                    </view>
                                </view>
                            </view>

                            <view class="card-details">
                                <view class="detail-item">
                                    <text class="detail-label">品类：</text>
                                    <text class="detail-value">{{ item.category }}</text>
                                </view>
                                <view class="detail-item">
                                    <text class="detail-label">期望单价：</text>
                                    <text class="detail-value price">{{ item.price }}</text>
                                </view>
                                <view class="detail-item">
                                    <text class="detail-label">采购数量：</text>
                                    <text class="detail-value">{{ item.quantity }}</text>
                                </view>
                                <view class="detail-item">
                                    <text class="detail-label">收货地址：</text>
                                    <text class="detail-value">{{ item.address }}</text>
                                </view>
                            </view>
                        </view>
                    </view>

                    <view class="card-metrics-bar">
                        <view class="view-data-card">
                            <view class="view-data-card-accent"></view>
                            <view class="view-data-card-inner">
                                <view class="view-data-meta">
                                    <text class="view-data-caption">浏览量</text>
                                </view>
                                <text class="view-data-value">{{ formatListViewCount(item) }}</text>
                            </view>
                        </view>
                        <view class="metrics-time-wrap">
                            <text class="metrics-time">发布时间：{{ item.publishTime }}</text>
                        </view>
                    </view>

                    <!-- 操作按钮 -->

                    <view class="card-actions" @tap.stop.prevent="">
                        <button class="action-btn edit-btn" :data-id="item.id" @tap.stop.prevent="goToEdit">编辑</button>
                        <button class="action-btn promote-btn" :data-id="item.id" @tap.stop.prevent="goToPromotion">推广</button>
                        <button
                            v-if="item.promotion_order_id"
                            class="action-btn effect-btn"
                            :data-oid="item.promotion_order_id"
                            @tap.stop.prevent="goToPromotionEffect"
                        >查看效果</button>
                        <button :class="'action-btn ' + (item.status === '已发布' ? 'offline-btn' : 'online-btn')" :data-id="item.id" @tap.stop.prevent="toggleStatus">
                            {{ item.status === '已发布' ? '下架' : '上架' }}
                        </button>
                        <button class="action-btn delete-btn" :data-id="item.id" @tap.stop.prevent="deleteProcurement">删除</button>
                    </view>
                </view>

                <!-- 加载更多提示 -->
                <view v-if="loading" class="loading-more">
                    <text>加载中...</text>
                </view>
                <view v-else-if="!hasMore && filteredList.length > 0" class="no-more">
                    <text>没有更多了</text>
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script>
// pages/my-procurement/my-procurement.js
import { PROCUREMENT_CATEGORIES } from '../../utils/constants.js';
import { getMyProcurements, updateProcurementStatus, deleteProcurement } from '../../utils/api.js';
import { getStatusColor, formatDateSimple, calculateListStats, showError, showSuccess } from '../../utils/util.js';
import { normalizeProcurementItem } from '../../utils/procurementDisplay.js';
import { getViewCount, formatListViewCount } from '../../utils/viewCount.js';
export default {
    data() {
        return {
            filterStatus: '全部',
            // '全部' | '已发布' | '已下架'

            procurementList: [],
            filteredList: [],
            // 统计数据
            stats: {
                total: 0,
                // 全部
                published: 0,
                // 已发布
                offline: 0
                // 已下架
            },
            page: 1,
            pageSize: 10,
            hasMore: true,
            loading: false,
            refreshing: false,
            categoryFilter: '全部产品',
            categoryOptions: ['全部产品'],
            searchInputValue: '',
            searchQuery: ''
        };
    },
    onLoad() {
        this.loadProcurementList();
    },
    onShow() {
        // 从编辑页面返回时刷新列表
        this.loadProcurementList(true);
    },
    methods: {
        getViewCount(item) {
            return getViewCount(item);
        },
        formatListViewCount(item) {
            return formatListViewCount(item);
        },
        // 下拉刷新
        onPullDownRefresh() {
            this.setData({
                refreshing: true,
                page: 1,
                hasMore: true,
                procurementList: []
            });
            this.loadProcurementList(true);
        },
        // 上拉加载更多
        onReachBottom() {
            if (this.hasMore && !this.loading) {
                this.loadProcurementList();
            }
        },
        // 加载采购列表
        async loadProcurementList(refresh = false) {
            if (this.loading) {
                return;
            }
            const page = refresh ? 1 : this.page;
            this.setData({
                loading: true
            });

            try {
                const result = await getMyProcurements({
                    page: page,
                    pageSize: this.pageSize
                });

                const newList = refresh ? result.list : [...this.procurementList, ...result.list];
                
                // 格式化数据，添加状态颜色等
                // 将"审核中"和"审核失败"状态自动转换为"已发布"
                const formattedList = newList.map((item) => {
                    let status = item.status;
                    if (status === '审核中' || status === '审核失败') {
                        status = '已发布';
                    }
                    const vc = getViewCount(item);
                    const norm = normalizeProcurementItem({ ...item, id: item.id || item._id });
                    return {
                        ...norm,
                        status: status,
                        statusColor: getStatusColor(status),
                        publishTime: formatDateSimple(item.created_date ? new Date(item.created_date) : new Date()),
                        view_count: vc,
                        viewCount: vc
                    };
                });

            this.setData({
                    procurementList: formattedList,
                page: page + 1,
                    hasMore: result.hasMore || false,
                loading: false,
                refreshing: false
            });
            this.calculateStats();
            this.updateCategoryOptions();
            this.filterItems();
            } catch (err) {
                console.error('加载失败', err);
                this.setData({
                    loading: false,
                    refreshing: false
                });
                showError('加载失败');
            }
        },

        // 计算统计数据
        calculateStats() {
            const stats = calculateListStats(this.procurementList);
            this.setData({
                stats
            });
        },

        // 选择状态
        selectStatus(e) {
            const status = e.currentTarget.dataset.status;
            this.setData({
                filterStatus: status
            });
            this.filterItems();
        },
        onCategoryTap(e) {
            const category = e.currentTarget.dataset.category || '全部产品';
            this.setData({
                categoryFilter: category
            });
            this.filterItems();
        },
        onSearchInput(e) {
            const value = (e.detail && e.detail.value) || '';
            this.setData({
                searchInputValue: value
            });
        },
        onSearchConfirm() {
            this.setData({
                searchQuery: (this.searchInputValue || '').trim()
            });
            this.filterItems();
        },
        normalizeText(v) {
            return String(v == null ? '' : v).trim().toLowerCase();
        },
        extractCategory(item) {
            return (
                item.category_name ||
                item.product_category ||
                item.category ||
                item._pv?.productName ||
                ''
            );
        },
        updateCategoryOptions() {
            const set = new Set();
            (this.procurementList || []).forEach((item) => {
                const cat = String(this.extractCategory(item) || '').trim();
                if (cat) set.add(cat);
            });
            this.setData({
                categoryOptions: ['全部产品', ...Array.from(set)]
            });
        },
        matchSearch(item, keyword) {
            const kw = this.normalizeText(keyword);
            if (!kw) return true;
            const pv = item._pv || {};
            const fields = [
                item.title,
                item.product_name,
                item.productName,
                item.product_variety,
                item.variety_name,
                item.category,
                item.category_name,
                item.product_category,
                item.specifications,
                item.specification,
                item.spec,
                item.address,
                item.location,
                pv.title,
                pv.productName,
                pv.spec,
                pv.location
            ];
            return fields.some((f) => this.normalizeText(f).includes(kw));
        },

        // 筛选
        filterItems() {
            const { filterStatus, procurementList, categoryFilter, searchQuery } = this;
            let filtered = procurementList.filter((item) => {
                const matchStatus = filterStatus === '全部' || item.status === filterStatus;
                const cat = String(this.extractCategory(item) || '').trim();
                const matchCategory = categoryFilter === '全部产品' || cat === categoryFilter;
                const matchSearch = this.matchSearch(item, searchQuery);
                return matchStatus && matchCategory && matchSearch;
            });

            // 有效置顶优先，再按发布时间倒序（与公开采购列表一致）
            filtered.sort((a, b) => {
                const ta = Number(a.top_sort_flag) > 0 || (a._pv && a._pv.promoTopActive) ? 1 : 0;
                const tb = Number(b.top_sort_flag) > 0 || (b._pv && b._pv.promoTopActive) ? 1 : 0;
                if (tb !== ta) return tb - ta;
                return new Date(b.publishTime) - new Date(a.publishTime);
            });
            this.setData({
                filteredList: filtered
            });
        },

        // 点击卡片 - 跳转到编辑页面
        goToEdit(e) {
            const id = e.currentTarget.dataset.id;
            uni.navigateTo({
                url: `/pages/edit-procurement/edit-procurement?id=${id}`
            });
        },

        goToPromotion(e) {
            const id = e.currentTarget.dataset.id;
            const item = this.procurementList.find((p) => p.id === id);
            if (!item) return;
            const vc = getViewCount(item);
            const title = encodeURIComponent(item.title || '');
            uni.navigateTo({
                url: `/pages/promotion-center/promotion-center?content_id=${encodeURIComponent(
                    String(id)
                )}&content_type=purchase&title=${title}&view_count=${vc}&published_at=${encodeURIComponent(item.publishTime || '')}`
            });
        },

        goToPromotionEffect(e) {
            const oid = e.currentTarget.dataset.oid;
            if (!oid) {
                uni.showToast({ title: '暂无推广记录', icon: 'none' });
                return;
            }
            uni.navigateTo({
                url: `/pages/promotion-effect/promotion-effect?promotion_order_id=${encodeURIComponent(String(oid))}`
            });
        },

        // 上架/下架
        async toggleStatus(e) {
            const id = e.currentTarget.dataset.id;
            const item = this.procurementList.find((p) => p.id === id);
            if (!item) {
                return;
            }
            const newStatus = item.status === '已发布' ? '已下架' : '已发布';
            const action = newStatus === '已发布' ? '上架' : '下架';
            uni.showModal({
                title: '确认操作',
                content: `确定要${action}这条采购信息吗？`,
                success: async (res) => {
                    if (res.confirm) {
                        try {
                            // 调用API更新服务器状态
                            await updateProcurementStatus(id, newStatus);
                            // 更新本地状态
                            this.updateItemStatus(id, newStatus);
                            showSuccess(`${action}成功`);
                        } catch (err) {
                            console.error(`${action}失败`, err);
                            showError(`${action}失败，请重试`);
                        }
                    }
                }
            });
        },

        // 更新项目状态
        updateItemStatus(id, status) {
            const procurementList = this.procurementList.map((item) => {
                if (item.id === id) {
                    return {
                        ...item,
                        status: status,
                        statusColor: getStatusColor(status),
                        updateTime: formatDateSimple(new Date())
                    };
                }
                return item;
            });
            this.setData({
                procurementList
            });
            this.calculateStats();
            this.filterItems();
        },

        // 删除采购
        async deleteProcurement(e) {
            const id = e.currentTarget.dataset.id;
            const item = this.procurementList.find((p) => p.id === id);
            uni.showModal({
                title: '确认删除',
                content: `确定要删除"${item.title}"吗？删除后无法恢复。`,
                confirmColor: '#ef4444',
                success: async (res) => {
                    if (res.confirm) {
                        try {
                            await deleteProcurement(id);
                        this.removeItem(id);
                            showSuccess('删除成功');
                        } catch (err) {
                            console.error('删除失败', err);
                            showError('删除失败，请重试');
                        }
                    }
                }
            });
        },

        // 移除项目
        removeItem(id) {
            const procurementList = this.procurementList.filter((item) => item.id !== id);
            this.setData({
                procurementList
            });
            this.calculateStats();
            this.filterItems();
        },


        // 去发布
        goToPublish() {
            uni.navigateTo({
                url: '/pages/publish-info/publish-info?tab=procurement'
            });
        }
    }
};
</script>
<style>
@import './my-procurement.css';
</style>
