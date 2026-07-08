<template>
    <!-- pages/member-orders/member-orders.wxml -->
    <view class="member-orders-page">
        <!-- 筛选和排序栏 -->
        <view class="filter-section">
            <!-- 状态筛选：与 pay_status / order_status 对齐 -->
            <view class="filter-bar">
                <view :class="'filter-item ' + (filterStatus === '全部' ? 'active' : '')" data-status="全部" @tap="selectFilter">
                    <text>全部</text>
                </view>
                <view :class="'filter-item ' + (filterStatus === '待支付' ? 'active' : '')" data-status="待支付" @tap="selectFilter">
                    <text>待支付</text>
                </view>
                <view :class="'filter-item ' + (filterStatus === '已支付' ? 'active' : '')" data-status="已支付" @tap="selectFilter">
                    <text>已支付</text>
                </view>
                <view :class="'filter-item ' + (filterStatus === '已取消' ? 'active' : '')" data-status="已取消" @tap="selectFilter">
                    <text>已取消</text>
                </view>
            </view>

            <!-- 排序选择 -->
            <view class="sort-bar">
                <view :class="'sort-item ' + (sortType === 'time' ? 'active' : '')" data-sort="time" @tap="selectSort">
                    <text>按时间</text>
                </view>
                <view :class="'sort-item ' + (sortType === 'amount' ? 'active' : '')" data-sort="amount" @tap="selectSort">
                    <text>按金额</text>
                </view>
            </view>
        </view>

        <!-- 订单列表 -->
        <scroll-view
            class="content-section"
            :scroll-y="true"
            :refresher-enabled="true"
            :refresher-triggered="refreshing"
            @refresherrefresh="onRefresherRefresh"
            @scrolltolower="onScrollToLower"
            lower-threshold="50"
        >
            <!-- 加载状态 -->
            <view v-if="loading && filteredList.length === 0" class="loading-state">
                <text class="loading-text">加载中...</text>
            </view>

            <!-- 空状态 -->
            <view v-else-if="filteredList.length === 0 && !loading" class="empty-state">
                <text class="empty-icon">📋</text>
                <text class="empty-text">暂无会员订单</text>
                <text class="empty-hint">若刚完成支付，下拉可刷新列表</text>
                <button class="open-member-btn" @tap="goToOpenMember">去开通会员</button>
            </view>

            <!-- 订单列表 -->
            <view v-else class="order-list">
                <view class="order-card" v-for="(item, index) in filteredList" :key="item.orderId || index">
                    <!-- 订单头部 -->

                    <view class="order-header">
                        <view class="order-no">
                            <text class="order-no-label">订单编号：</text>
                            <text class="order-no-value">{{ item.orderNo }}</text>
                        </view>
                        <view class="status-badge" :style="'background: ' + item.statusColor + '20; color: ' + item.statusColor + '; border-color: ' + item.statusColor">
                            {{ item.status }}
                        </view>
                    </view>

                    <view class="order-time">
                        <text>下单时间：{{ item.orderTime }}</text>
                    </view>

                    <!-- 订单主体信息 -->

                    <view class="order-body">
                        <view class="info-row">
                            <text class="info-label">会员类型：</text>
                            <text class="info-value member-type">{{ item.memberType }}</text>
                        </view>

                        <view class="info-row">
                            <text class="info-label">订单金额：</text>
                            <text class="info-value amount">¥{{ item.amount }}</text>
                        </view>

                        <view class="info-row">
                            <text class="info-label">支付方式：</text>
                            <text class="info-value">{{ item.paymentMethod }}</text>
                        </view>
                    </view>

                    <!-- 业务信息 -->

                    <view class="order-business">
                        <view class="business-row">
                            <text class="business-label">有效期：</text>
                            <text class="business-value">{{ item.startDate }} 至 {{ item.endDate }}</text>
                        </view>

                        <view class="benefits-section" v-if="item.benefits && item.benefits.length > 0">
                            <text class="benefits-label">权益概要：</text>
                            <view class="benefits-list">
                                <text class="benefit-tag" v-for="(benefit, index1) in item.benefits" :key="index1">
                                    {{ benefit }}
                                </text>
                            </view>
                        </view>
                    </view>

                    <!-- 待支付：继续支付（复用 createMemberWxPayParams / uni-pay，不新建业务订单） -->
                    <view v-if="item.showContinuePay || item.showDeletePending" class="order-actions">
                        <button class="continue-pay-btn" :data-id="item.orderId" @tap.stop="onContinuePay">继续支付</button>
                        <button v-if="item.showDeletePending" class="delete-order-btn" :data-id="item.orderId" @tap.stop="onDeletePendingOrder">
                            删除订单
                        </button>
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
// pages/member-orders/member-orders.js - 会员订单管理页面
import { getMemberOrders, createMemberOrderAndGetPayParams, getMemberOrderPayStatus, deletePendingMemberOrder } from '../../utils/api.js';
import { showLoading, hideLoading } from '../../utils/util.js';
export default {
    data() {
        return {
            filterStatus: '全部',

            // '全部' | '待支付' | '已支付' | '已取消'
            sortType: 'time',

            // 'time' | 'amount' - 时间排序 | 金额排序

            // 订单列表
            orderList: [],

            filteredList: [],

            // 分页
            page: 1,

            pageSize: 10,
            hasMore: true,
            loading: false,
            refreshing: false
        };
    },
    onShow() {
        // 每次进入/从支付页返回均重新拉取，避免只看到空列表或旧缓存
        this.loadOrderList(true);
    },
    async onPullDownRefresh() {
        await this.loadOrderList(true);
        uni.stopPullDownRefresh();
    },
    methods: {
        async onRefresherRefresh() {
            this.refreshing = true;
            try {
                await this.loadOrderList(true);
            } finally {
                this.refreshing = false;
            }
        },

        onScrollToLower() {
            if (this.hasMore && !this.loading) {
                this.loadOrderList(false);
            }
        },

        mapMemberOrderRow(raw) {
            const payStatus = Number(raw.pay_status);
            const orderStatus = Number(raw.order_status);
            const paid = payStatus === 1 || orderStatus === 1;

            let status = '待支付';
            let statusColor = '#f59e0b';
            if (paid) {
                status = '已支付';
                statusColor = '#16a34a';
            } else if (payStatus === 2 || orderStatus === 2) {
                status = '已取消';
                statusColor = '#9ca3af';
            } else if (payStatus === 3) {
                status = '支付失败';
                statusColor = '#ef4444';
            }

            const orderTime = this.formatDateTimeSafe(raw.created_at);
            const ot = Number(raw.order_type);
            let memberType = '首开会员';
            if (ot === 2) memberType = '续费会员';
            else if (ot === 3) memberType = '企业类型升级';
            else if (ot === 4) memberType = '周期档位升级';
            const amountNum = Number(raw.pay_amount != null ? raw.pay_amount : 0);
            const amount = amountNum.toFixed(2);
            const paymentMethod = this.formatPayChannel(raw.pay_channel, paid);
            const startDate = paid ? this.formatDateSafe(raw.expire_time_before) : '—';
            const endDate = paid ? this.formatDateSafe(raw.expire_time_after) : '支付成功后更新';
            const memberLabel = this.memberTypeLabel(raw.member_days);
            const benefits = this.getBenefits(memberLabel);

            const showContinuePay = status === '待支付';
            const showDeletePending = status === '待支付';

            return {
                orderId: raw._id || '',
                orderNo: raw.order_no || '',
                status,
                statusColor,
                orderTime,
                memberType,
                amount,
                paymentMethod,
                startDate,
                endDate,
                benefits,
                showContinuePay,
                showDeletePending,
                rawPayStatus: payStatus,
                rawOrderStatus: orderStatus
            };
        },

        formatDateTimeSafe(v) {
            const d = this.parseDate(v);
            if (!d) return '—';
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const h = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            const s = String(d.getSeconds()).padStart(2, '0');
            return `${y}-${m}-${day} ${h}:${min}:${s}`;
        },

        formatDateSafe(v) {
            const d = this.parseDate(v);
            if (!d) return '—';
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        },

        parseDate(v) {
            if (v === undefined || v === null || v === '') return null;
            const d = v instanceof Date ? v : new Date(v);
            if (Number.isNaN(d.getTime())) return null;
            return d;
        },

        formatPayChannel(ch, paid) {
            if (!paid) return '待支付';
            const c = String(ch || '').toLowerCase();
            if (c.includes('wx')) return '微信支付';
            if (c === 'mock' || c.includes('mock')) return '测试标记（历史）';
            return ch ? String(ch) : '在线支付';
        },

        memberTypeLabel(days) {
            const d = Number(days) || 0;
            if (d >= 300) return '年度会员';
            if (d >= 60) return '季度会员';
            return '月度会员';
        },

        async loadOrderList(refresh = false) {
            if (this.loading && !refresh) {
                return;
            }
            const page = refresh ? 1 : this.page;
            this.setData({
                loading: true
            });

            try {
                const result = await getMemberOrders({ page, pageSize: this.pageSize });
                const rawList = (result && result.list) || [];
                const mapped = rawList.map((row) => this.mapMemberOrderRow(row));
                const newList = refresh ? mapped : [...this.orderList, ...mapped];
                const hasMore = !!(result && result.hasMore);
                this.setData({
                    orderList: newList,
                    page: page + 1,
                    hasMore,
                    loading: false,
                    refreshing: false
                });
                this.filterAndSort();
            } catch (err) {
                console.error('加载会员订单失败', err);
                this.setData({
                    loading: false,
                    refreshing: false
                });
            }
        },

        // 获取权益列表
        getBenefits(memberType) {
            const benefitsMap = {
                月度会员: ['无限次发布供应', '优先展示', '基础客服'],
                季度会员: ['无限次发布供应', '优先展示', '专属客服', '数据分析'],
                年度会员: ['无限次发布供应', '优先展示', '专属客服', '数据分析', '定制服务'],
                企业会员: ['无限次发布供应', '优先展示', '专属客服', '数据分析', '定制服务', 'API接口']
            };
            return benefitsMap[memberType] || benefitsMap['月度会员'];
        },

        // 选择筛选状态
        selectFilter(e) {
            const status = e.currentTarget.dataset.status;
            this.setData({
                filterStatus: status
            });
            this.filterAndSort();
        },

        // 选择排序方式
        selectSort(e) {
            const sortType = e.currentTarget.dataset.sort;
            this.setData({
                sortType: sortType
            });
            this.filterAndSort();
        },

        // 筛选和排序
        filterAndSort() {
            const { filterStatus, orderList, sortType } = this;

            let filtered = orderList.filter((item) => {
                if (filterStatus === '全部') {
                    return true;
                }
                if (filterStatus === '待支付') {
                    return item.status === '待支付';
                }
                return item.status === filterStatus;
            });

            filtered.sort((a, b) => {
                if (sortType === 'time') {
                    return new Date(b.orderTime) - new Date(a.orderTime);
                } else if (sortType === 'amount') {
                    return parseFloat(b.amount) - parseFloat(a.amount);
                }
                return 0;
            });
            this.setData({
                filteredList: filtered
            });
        },
        removeOrderLocally(orderId) {
            const nextOrderList = (this.orderList || []).filter((item) => String(item.orderId) !== String(orderId));
            this.setData({
                orderList: nextOrderList
            });
            this.filterAndSort();
        },

        // 前往开通会员
        goToOpenMember() {
            uni.navigateTo({
                url: '/pages/open-shop/open-shop'
            });
        },

        requestPayment(payParams) {
            return new Promise((resolve, reject) => {
                uni.requestPayment({
                    ...payParams,
                    success: resolve,
                    fail: reject
                });
            });
        },

        async pollOrderPaid(orderId, maxTimes = 10) {
            for (let i = 0; i < maxTimes; i += 1) {
                try {
                    const status = await getMemberOrderPayStatus(orderId);
                    if (status && status.is_paid) {
                        return true;
                    }
                } catch (e) {
                    console.warn('poll order status failed:', e);
                }
                await new Promise((r) => setTimeout(r, 1200));
            }
            return false;
        },

        /** 继续支付：云端校验原单后重新拉取 uni-pay 参数（与开通页同一云函数） */
        async onContinuePay(e) {
            const orderId = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || '';
            if (!orderId) return;
            const row = (this.orderList || []).find((x) => x.orderId === orderId);
            if (!row) {
                uni.showToast({ title: '订单已不在列表，请下拉刷新', icon: 'none' });
                return;
            }
            if (row.status === '已支付') {
                uni.showToast({ title: '该订单已支付', icon: 'none' });
                return;
            }
            if (row.status === '已取消' || row.status === '支付失败') {
                uni.showToast({ title: '订单已失效，请重新下单', icon: 'none' });
                return;
            }
            showLoading('正在拉起支付…');
            try {
                const res = await createMemberOrderAndGetPayParams({ resume_order_id: orderId });
                hideLoading();
                if (!res || !res.pay_params || !res.order_id) {
                    throw new Error('支付参数异常，请稍后重试');
                }
                if (String(res.order_id) !== String(orderId)) {
                    throw new Error('订单不一致，请刷新后重试');
                }
                await this.requestPayment(res.pay_params);
                uni.showToast({ title: '支付已受理，正在确认结果', icon: 'none', duration: 2000 });
                const paid = await this.pollOrderPaid(orderId, 10);
                await this.loadOrderList(true);
                if (paid) {
                    uni.showToast({ title: '支付成功', icon: 'success' });
                } else {
                    uni.showModal({
                        title: '支付处理中',
                        content: '可稍后在「我的会员」或本页下拉刷新查看。',
                        showCancel: false
                    });
                }
            } catch (err) {
                hideLoading();
                const msg = (err && err.errMsg) || (err && err.message) || '网络繁忙，请稍后重试';
                if (String(msg).includes('已支付')) {
                    uni.showToast({ title: '该订单已支付', icon: 'none' });
                    await this.loadOrderList(true);
                    return;
                }
                if (String(msg).includes('失效') || String(msg).includes('重新下单')) {
                    uni.showToast({ title: '订单已失效，请重新下单', icon: 'none' });
                    await this.loadOrderList(true);
                    return;
                }
                if (String(msg).includes('cancel')) {
                    uni.showToast({ title: '已取消支付', icon: 'none' });
                    return;
                }
                uni.showToast({ title: msg, icon: 'none', duration: 2500 });
            }
        },
        onDeletePendingOrder(e) {
            const orderId = (e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) || '';
            if (!orderId) return;
            uni.showModal({
                title: '确认删除',
                content: '确定删除这笔订单吗？删除后将不再显示',
                confirmColor: '#ef4444',
                success: async (res) => {
                    if (!res.confirm) return;
                    try {
                        showLoading('正在删除...');
                        await deletePendingMemberOrder(orderId);
                        hideLoading();
                        this.removeOrderLocally(orderId);
                        this.filterAndSort();
                        uni.showToast({ title: '删除成功', icon: 'success' });
                        this.loadOrderList(true);
                    } catch (err) {
                        hideLoading();
                        const msg = (err && err.message) || '删除失败，请重试';
                        uni.showToast({ title: msg, icon: 'none', duration: 2500 });
                    }
                }
            });
        }
    }
};
</script>
<style>
@import './member-orders.css';
</style>
