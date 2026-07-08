<template>
    <view class="page">
        <view v-if="loading" class="state-wrap">
            <text class="state-txt">加载推广效果…</text>
        </view>

        <view v-else-if="!hasValidPromotionDetail" class="state-wrap">
            <text class="state-icon">📊</text>
            <text class="state-title">{{ emptyTitle }}</text>
            <text class="state-txt">{{ loadError || '未找到推广数据' }}</text>
            <button class="btn-outline" @tap="load">重试加载</button>
            <button class="btn-outline btn-second" @tap="goBack">返回</button>
        </view>

        <view v-else class="main-body">
            <!-- 顶部信息卡 -->
            <view class="card top-card">
                <view class="top-row">
                    <image v-if="detail.cover" class="cover" :src="detail.cover" mode="aspectFill" />
                    <view v-else class="cover cover-ph">
                        <text class="ph-txt">无封面</text>
                    </view>
                    <view class="top-main">
                        <text class="title">{{ displayTitle }}</text>
                        <view class="row-tags">
                            <text class="pill">{{ contentTypeLabel }}</text>
                            <text v-if="contentStatusLabel" class="pill pill-ghost">{{ contentStatusLabel }}</text>
                        </view>
                        <text class="sub-line">当前浏览量 {{ formatNum(detail.current_view_count) }}</text>
                        <text class="sub-line muted-sm">发布 {{ publishLine }}</text>
                    </view>
                </view>
            </view>

            <!-- 推广状态卡 -->
            <view class="card">
                <text class="sec">推广状态</text>
                <view class="status-banner" :class="'st-' + promotionStatusTone">
                    <text class="st-main">{{ promotionTypeLabel }} · {{ promotionStatusLabel }}</text>
                </view>
                <view class="kv">
                    <text class="k">推广对象</text>
                    <text class="v">{{ displayTitle }}</text>
                </view>
                <view class="kv">
                    <text class="k">推广类型</text>
                    <text class="v">{{ promotionTypeLabelDetail }}</text>
                </view>
                <view class="kv">
                    <text class="k">推广状态</text>
                    <text class="v">{{ promotionStatusLabel }}</text>
                </view>
                <view class="kv">
                    <text class="k">开始时间</text>
                    <text class="v">{{ formatTime(detail.start_time) }}</text>
                </view>
                <view class="kv">
                    <text class="k">结束时间</text>
                    <text class="v">{{ formatTime(detail.end_time) }}</text>
                </view>
                <view class="kv">
                    <text class="k">推广时长</text>
                    <text class="v">{{ promotionDurationText }}</text>
                </view>
                <view class="kv">
                    <text class="k">支付金额</text>
                    <text class="v strong">¥{{ formatMoney(detail.pay_amount) }}</text>
                </view>
                <view class="kv">
                    <text class="k">会员赠送天数</text>
                    <text class="v">{{ giftDaysLine }}</text>
                </view>
            </view>

            <!-- 核心数据区 -->
            <view class="sec-label">核心数据</view>
            <view class="metrics">
                <view class="metric">
                    <text class="m-val">{{ formatNum(detail.current_view_count) }}</text>
                    <text class="m-lab">当前浏览量</text>
                </view>
                <view class="metric">
                    <text class="m-val accent">{{ formatNum(addedViews) }}</text>
                    <text class="m-lab">推广期间新增浏览</text>
                </view>
                <view class="metric">
                    <text class="m-val">{{ formatNum(detail.added_contact_count, true) }}</text>
                    <text class="m-lab">推广新增联系</text>
                </view>
                <view class="metric">
                    <text class="m-val">{{ formatNum(detail.added_favorite_count, true) }}</text>
                    <text class="m-lab">推广新增收藏</text>
                </view>
            </view>

            <!-- 推广前后对比 -->
            <view class="card">
                <text class="sec">推广前后对比</text>
                <view class="compare">
                    <view class="compare-col">
                        <text class="c-lab">推广前浏览</text>
                        <text class="c-num">{{ formatNum(detail.before_view_count) }}</text>
                    </view>
                    <view class="compare-mid">
                        <text class="arrow">→</text>
                        <text class="delta">+{{ formatNum(addedViews) }}</text>
                    </view>
                    <view class="compare-col align-r">
                        <text class="c-lab">当前浏览</text>
                        <text class="c-num strong">{{ formatNum(detail.current_view_count) }}</text>
                    </view>
                </view>
                <view class="bar-wrap">
                    <view class="bar-track">
                        <view class="bar-fill" :style="{ width: beforeBarPercent + '%' }" />
                    </view>
                    <view class="bar-note">
                        <text>推广前占比示意</text>
                        <text class="strong">{{ beforeBarPercent }}%</text>
                    </view>
                </view>
            </view>

            <!-- 推广时间区 -->
            <view class="card">
                <text class="sec">推广时间</text>
                <view class="timeline">
                    <view class="tl-dot" />
                    <view class="tl-body">
                        <text class="tl-title">起止区间</text>
                        <text class="tl-desc">{{ formatTime(detail.start_time) }} — {{ formatTime(detail.end_time) }}</text>
                    </view>
                </view>
                <text class="hint-block">数据口径：推广前浏览量为推广开始时该信息的累计浏览；当前为实时总浏览；新增浏览 = 当前 − 推广前。</text>
            </view>

            <!-- 结果解读 -->
            <view class="card insight" :class="'ins-' + insight.level">
                <text class="sec">结果解读</text>
                <text class="insight-txt">{{ insight.text }}</text>
            </view>

        </view>

        <view v-if="hasValidPromotionDetail" class="bottom">
            <button class="pay-btn" @tap="onContinuePromo">继续推广</button>
        </view>
    </view>
</template>

<script>
import { getPromotionEffectDetail } from '../../utils/api.js';

export default {
    data() {
        return {
            loading: true,
            promotion_order_id: '',
            detail: null,
            loadError: ''
        };
    },
    computed: {
        hasValidPromotionDetail() {
            return this.isValidPromotionDetailPayload(this.detail);
        },
        displayTitle() {
            return (this.detail && this.detail.title) || '未命名信息';
        },
        contentTypeLabel() {
            const t = this.detail && this.detail.content_type;
            if (t === 'supply') return '供应';
            if (t === 'purchase') return '采购';
            return '信息';
        },
        contentStatusLabel() {
            const s = this.detail && this.detail.content_status;
            return s ? String(s) : '';
        },
        publishLine() {
            const p = this.detail && this.detail.published_at;
            return p ? String(p) : '以服务端为准';
        },
        promotionTypeLabel() {
            const t = this.detail && this.detail.promotion_type;
            return t === 'boost' ? '加急曝光' : '置顶';
        },
        promotionTypeLabelDetail() {
            const d = this.detail;
            if (!d) return '—';
            if (d.promotion_type_label) return String(d.promotion_type_label);
            return this.promotionTypeLabel;
        },
        giftDaysLine() {
            const d = this.detail;
            if (!d) return '—';
            if (!d.use_gift_quota) return '未使用会员赠送天数';
            const n = Number(d.gift_quota_days);
            if (Number.isFinite(n) && n > 0) {
                const kind =
                    d.promotion_type === 'boost' ? '赠送加急曝光天数' : '赠送置顶天数';
                return `已抵扣 ${n} 天（${kind}）`;
            }
            return '已使用会员赠送天数';
        },
        promotionStatusLabel() {
            const s = this.detail && this.detail.status;
            if (s === 'active' || s === 'running' || s === 'ongoing') return '进行中';
            if (s === 'pending' || s === 'scheduled' || s === 'waiting' || s === 'paid') return '待生效';
            if (s === 'ended' || s === 'finished' || s === 'expired' || s === 'cancelled') return '已结束';
            return s ? String(s) : '—';
        },
        promotionStatusTone() {
            const s = this.detail && this.detail.status;
            if (s === 'active' || s === 'running' || s === 'ongoing') return 'on';
            if (s === 'pending' || s === 'scheduled' || s === 'waiting' || s === 'paid') return 'wait';
            if (s === 'expired' || s === 'ended' || s === 'finished' || s === 'cancelled') return 'off';
            return 'off';
        },
        addedViews() {
            if (!this.detail) return 0;
            const fromApi = Number(this.detail.added_view_count);
            if (Number.isFinite(fromApi)) return Math.max(0, Math.floor(fromApi));
            const cur = Number(this.detail.current_view_count);
            const bef = Number(this.detail.before_view_count);
            const c = Number.isFinite(cur) ? cur : 0;
            const b = Number.isFinite(bef) ? bef : 0;
            return Math.max(0, Math.floor(c - b));
        },
        promotionDurationText() {
            const d = this.detail;
            if (!d || !d.start_time || !d.end_time) return '—';
            const a = this.parseTime(d.start_time);
            const b = this.parseTime(d.end_time);
            if (!a || !b || b <= a) return '—';
            const ms = b - a;
            const days = Math.floor(ms / 86400000);
            const hours = Math.floor((ms % 86400000) / 3600000);
            if (days > 0) return `${days} 天${hours > 0 ? hours + ' 小时' : ''}`;
            if (hours > 0) return `${hours} 小时`;
            return '不足 1 小时';
        },
        beforeBarPercent() {
            const cur = Number(this.detail && this.detail.current_view_count);
            const bef = Number(this.detail && this.detail.before_view_count);
            const c = Number.isFinite(cur) ? cur : 0;
            const b = Number.isFinite(bef) ? bef : 0;
            if (c <= 0) return 0;
            const p = Math.round((b / c) * 100);
            return Math.min(100, Math.max(0, p));
        },
        emptyTitle() {
            const m = (this.loadError || '').trim();
            if (m.includes('不存在') || m.includes('404')) return '暂无法展示';
            if (m.includes('无权')) return '无法查看';
            if (m.includes('参数')) return '链接无效';
            return '暂无推广效果数据';
        },
        insight() {
            const added = this.addedViews;
            const before = Math.max(Number(this.detail && this.detail.before_view_count) || 0, 1);
            const ratio = added / before;
            if (added <= 0) {
                return {
                    level: 'low',
                    text: '曝光提升有限，建议优化标题、主图、内容与价格等，让信息更容易被点击。'
                };
            }
            if (ratio >= 0.35 || added >= 200) {
                return { level: 'high', text: '曝光提升明显，推广带来的浏览增长较为可观。' };
            }
            if (added >= 8 || ratio >= 0.06) {
                return { level: 'mid', text: '曝光有提升，可结合咨询与收藏数据判断是否继续加码推广。' };
            }
            return {
                level: 'low',
                text: '曝光提升有限，建议优化标题/内容/价格等，或适当延长推广时长观察效果。'
            };
        }
    },
    onLoad(q) {
        this.promotion_order_id = (q && q.promotion_order_id) || (q && q.order_id) || '';
        this.load();
    },
    onPullDownRefresh() {
        this.load().finally(() => uni.stopPullDownRefresh());
    },
    methods: {
        /** 避免 {} 或仅壳对象被当成「有详情」，导致中间区空白、底部按钮仍显示 */
        isValidPromotionDetailPayload(d) {
            if (!d || typeof d !== 'object') {
                return false;
            }
            const keys = Object.keys(d);
            if (keys.length === 0) {
                return false;
            }
            const oid = d.promotion_order_id != null ? d.promotion_order_id : d.order_id != null ? d.order_id : d.id;
            if (oid != null && String(oid).trim() !== '') {
                return true;
            }
            return ['title', 'content_id', 'promotion_type', 'status'].some((k) => {
                const v = d[k];
                if (v == null || v === '') {
                    return false;
                }
                if (typeof v === 'number') {
                    return Number.isFinite(v);
                }
                return String(v).trim() !== '';
            });
        },
        parseTime(v) {
            if (v == null || v === '') return null;
            if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
            const n = Date.parse(String(v));
            return Number.isNaN(n) ? null : n;
        },
        formatTime(v) {
            const ts = this.parseTime(v);
            if (!ts) return '—';
            const d = new Date(ts);
            const y = d.getFullYear();
            const m = `${d.getMonth() + 1}`.padStart(2, '0');
            const day = `${d.getDate()}`.padStart(2, '0');
            const h = `${d.getHours()}`.padStart(2, '0');
            const min = `${d.getMinutes()}`.padStart(2, '0');
            return `${y}-${m}-${day} ${h}:${min}`;
        },
        formatNum(n, placeholderDash) {
            if (n == null || n === '') {
                return placeholderDash ? '—' : '0';
            }
            const x = Number(n);
            if (Number.isNaN(x)) return placeholderDash ? '—' : '0';
            if (placeholderDash && x === 0) return '—';
            return String(Math.round(x));
        },
        formatMoney(n) {
            const x = Number(n);
            if (Number.isNaN(x)) return '0.00';
            return x.toFixed(2);
        },
        async load() {
            if (!this.promotion_order_id) {
                this.loading = false;
                this.detail = null;
                this.loadError = '缺少推广订单参数，请从「我的采购/我的供应」中点击「查看效果」进入；若刚支付完成，请稍等数秒再试。';
                return;
            }
            this.loading = true;
            this.loadError = '';
            try {
                const data = await getPromotionEffectDetail({ promotion_order_id: this.promotion_order_id });
                const raw = data && typeof data === 'object' ? data : null;
                if (!this.isValidPromotionDetailPayload(raw)) {
                    this.detail = null;
                    this.loadError =
                        '未查询到有效的推广效果数据：可能订单号无效、内容已删除，或数据尚未同步。请下拉刷新，或返回列表重新打开「查看效果」。';
                } else {
                    this.detail = raw;
                    this.loadError = '';
                }
            } catch (e) {
                this.detail = null;
                const raw = (e && e.message) || '';
                if (String(raw).includes('404') || String(raw).includes('不存在')) {
                    this.loadError = '推广订单不存在或已被清理，请返回列表确认。';
                } else if (String(raw).includes('403') || String(raw).includes('无权')) {
                    this.loadError = '无权查看该推广单，请确认是否本人订单。';
                } else if (String(raw).includes('401')) {
                    this.loadError = '登录已失效，请重新登录后再试。';
                } else {
                    this.loadError = raw || '加载失败，请检查网络后重试。';
                }
            } finally {
                this.loading = false;
            }
        },
        goBack() {
            uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
        },
        onContinuePromo() {
            const d = this.detail;
            if (!this.isValidPromotionDetailPayload(d) || !d.content_id || !d.content_type) {
                uni.showToast({ title: '缺少信息参数', icon: 'none' });
                return;
            }
            const titleQ = encodeURIComponent(d.title || '');
            const pub = d.published_at ? encodeURIComponent(String(d.published_at)) : '';
            const vc = d.current_view_count != null ? String(d.current_view_count) : '';
            let url = `/pages/promotion-center/promotion-center?content_id=${encodeURIComponent(
                String(d.content_id)
            )}&content_type=${encodeURIComponent(String(d.content_type))}&title=${titleQ}`;
            if (vc) url += `&view_count=${vc}`;
            if (pub) url += `&published_at=${pub}`;
            uni.navigateTo({ url, fail: () => uni.showToast({ title: '无法打开推广页', icon: 'none' }) });
        }
    }
};
</script>

<style scoped>
.page {
    min-height: 100vh;
    background: #f0fdf4;
    box-sizing: border-box;
    padding-bottom: calc(140rpx + env(safe-area-inset-bottom));
}
.main-body {
    padding: 24rpx 24rpx 32rpx;
    box-sizing: border-box;
}
.state-wrap {
    min-height: 55vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80rpx 32rpx;
    box-sizing: border-box;
}
.state-icon {
    font-size: 64rpx;
    margin-bottom: 16rpx;
}
.state-title {
    font-size: 32rpx;
    font-weight: 700;
    color: #374151;
    margin-bottom: 12rpx;
    display: block;
}
.state-txt {
    font-size: 28rpx;
    color: #6b7280;
    text-align: center;
    line-height: 1.5;
    padding: 0 24rpx;
}
.btn-outline {
    margin-top: 32rpx;
    background: #fff;
    color: #16a34a;
    border: 2rpx solid #16a34a;
    border-radius: 44rpx;
    font-size: 28rpx;
}
.btn-second {
    margin-top: 16rpx;
    color: #4b5563;
    border-color: #d1d5db;
}
.card {
    background: #fff;
    border-radius: 20rpx;
    padding: 28rpx;
    margin-bottom: 24rpx;
    box-shadow: 0 4rpx 20rpx rgba(22, 101, 52, 0.06);
}
.top-card .top-row {
    display: flex;
    gap: 20rpx;
}
.cover {
    width: 168rpx;
    height: 168rpx;
    border-radius: 16rpx;
    flex-shrink: 0;
    background: #ecfdf5;
}
.cover-ph {
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2rpx dashed #bbf7d0;
}
.ph-txt {
    font-size: 22rpx;
    color: #86efac;
}
.top-main {
    flex: 1;
    min-width: 0;
}
.title {
    font-size: 32rpx;
    font-weight: 700;
    color: #14532d;
    line-height: 1.35;
    display: block;
}
.row-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 12rpx;
    margin-top: 12rpx;
}
.pill {
    background: #dcfce7;
    color: #166534;
    font-size: 22rpx;
    padding: 6rpx 16rpx;
    border-radius: 8rpx;
}
.pill-ghost {
    background: #f3f4f6;
    color: #4b5563;
}
.sub-line {
    display: block;
    margin-top: 10rpx;
    font-size: 24rpx;
    color: #166534;
    font-weight: 600;
}
.muted-sm {
    color: #9ca3af !important;
    font-weight: 400 !important;
}
.sec {
    font-size: 30rpx;
    font-weight: 700;
    color: #111827;
    display: block;
    margin-bottom: 20rpx;
}
.sec-label {
    font-size: 26rpx;
    font-weight: 700;
    color: #166534;
    margin: 8rpx 4rpx 16rpx;
}
.status-banner {
    padding: 20rpx 24rpx;
    border-radius: 14rpx;
    margin-bottom: 20rpx;
}
.st-on {
    background: linear-gradient(135deg, #ecfdf5, #d1fae5);
}
.st-wait {
    background: #fffbeb;
}
.st-off {
    background: #f3f4f6;
}
.st-main {
    font-size: 28rpx;
    font-weight: 700;
    color: #14532d;
}
.st-wait .st-main {
    color: #92400e;
}
.st-off .st-main {
    color: #4b5563;
}
.kv {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 14rpx 0;
    border-bottom: 1rpx solid #f3f4f6;
    font-size: 26rpx;
}
.kv:last-child {
    border-bottom: none;
}
.k {
    color: #6b7280;
}
.v {
    color: #374151;
    max-width: 60%;
    text-align: right;
}
.strong {
    font-weight: 700;
    color: #16a34a;
}
.metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
    margin-bottom: 8rpx;
}
.metric {
    width: calc(50% - 8rpx);
    background: #fff;
    border-radius: 20rpx;
    padding: 28rpx 20rpx;
    box-shadow: 0 4rpx 20rpx rgba(22, 101, 52, 0.06);
    box-sizing: border-box;
}
.m-val {
    font-size: 40rpx;
    font-weight: 800;
    color: #14532d;
    font-variant-numeric: tabular-nums;
    display: block;
}
.m-val.accent {
    color: #16a34a;
}
.m-lab {
    font-size: 22rpx;
    color: #6b7280;
    margin-top: 8rpx;
    display: block;
}
.compare {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24rpx;
}
.compare-col {
    flex: 1;
}
.align-r {
    text-align: right;
}
.c-lab {
    font-size: 22rpx;
    color: #9ca3af;
    display: block;
    margin-bottom: 8rpx;
}
.c-num {
    font-size: 36rpx;
    font-weight: 800;
    color: #374151;
    font-variant-numeric: tabular-nums;
}
.compare-mid {
    padding: 0 16rpx;
    text-align: center;
}
.arrow {
    font-size: 28rpx;
    color: #86efac;
    display: block;
}
.delta {
    font-size: 24rpx;
    color: #16a34a;
    font-weight: 700;
}
.bar-wrap {
    margin-top: 8rpx;
}
.bar-track {
    height: 16rpx;
    border-radius: 999rpx;
    background: #ecfdf5;
    overflow: hidden;
}
.bar-fill {
    height: 100%;
    border-radius: 999rpx;
    background: linear-gradient(90deg, #86efac, #16a34a);
    transition: width 0.35s ease;
}
.bar-note {
    display: flex;
    justify-content: space-between;
    margin-top: 12rpx;
    font-size: 22rpx;
    color: #9ca3af;
}
.timeline {
    display: flex;
    gap: 20rpx;
    margin-bottom: 16rpx;
}
.tl-dot {
    width: 16rpx;
    height: 16rpx;
    margin-top: 10rpx;
    border-radius: 50%;
    background: #16a34a;
    flex-shrink: 0;
    box-shadow: 0 0 0 6rpx #dcfce7;
}
.tl-body {
    flex: 1;
}
.tl-title {
    font-size: 26rpx;
    font-weight: 700;
    color: #111827;
    display: block;
}
.tl-desc {
    font-size: 24rpx;
    color: #6b7280;
    margin-top: 8rpx;
    display: block;
    line-height: 1.45;
}
.hint-block {
    font-size: 22rpx;
    color: #9ca3af;
    line-height: 1.5;
    display: block;
}
.insight.ins-high {
    border-left: 6rpx solid #16a34a;
}
.insight.ins-mid {
    border-left: 6rpx solid #22c55e;
}
.insight.ins-low {
    border-left: 6rpx solid #fbbf24;
}
.insight-txt {
    font-size: 26rpx;
    color: #374151;
    line-height: 1.55;
    display: block;
}
.bottom {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 100;
    padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 -4rpx 16rpx rgba(22, 101, 52, 0.08);
    box-sizing: border-box;
}
.pay-btn {
    width: 100%;
    height: 88rpx;
    line-height: 88rpx;
    background: linear-gradient(135deg, #22c55e, #15803d);
    color: #fff;
    font-size: 32rpx;
    font-weight: 700;
    border-radius: 44rpx;
    border: none;
}
.pay-btn::after {
    border: none;
}
</style>
