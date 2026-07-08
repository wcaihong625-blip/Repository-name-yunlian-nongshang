<template>
    <view class="page">
        <view v-if="!hasContent && !resumeOrderId && !pendingPayBanner" class="card empty">
            <text class="empty-title">推广服务</text>
            <text class="empty-desc">请从「我的供应」或「我的采购」列表中，点击单条信息的「推广」进入本页。</text>
            <button class="member-primary-btn-lg promo-page-btn" @tap="goBack">返回</button>
        </view>

        <view v-else-if="resumeOrderId && !hasContent" class="card empty">
            <text class="empty-title">正在加载待支付订单</text>
            <text class="empty-desc">请稍候…</text>
        </view>

        <view v-else class="promo-main">
            <view v-if="pendingPayBanner" class="card resume-banner">
                <text class="resume-banner-title">待支付推广订单</text>
                <text class="resume-banner-desc">将使用当前订单继续调起微信支付，支付成功后自动生效；请勿重复创建新单。</text>
            </view>
            <view v-if="lastPendingOrderId && !resumeOrderId && hasContent && !pendingPayBanner" class="card resume-tip">
                <text class="resume-tip-txt">检测到上一笔待支付推广单，可点击下方「继续支付」。</text>
                <button class="resume-mini-btn" @tap="bindLastPendingResume">继续支付上一笔</button>
            </view>
            <!-- 1 推广对象（单条信息） -->
            <view class="card block-card">
                <text class="block-label">推广对象</text>
                <text class="obj-title">{{ displayTitle }}</text>
                <view class="obj-meta">
                    <text class="pill">{{ contentTypeLabel }}</text>
                    <text class="meta-t">浏览量 {{ viewCount }}</text>
                    <text class="meta-t">{{ publishLine }}</text>
                </view>
            </view>

            <view v-if="!topEnabled && !boostEnabled" class="card">
                <text class="warn">当前平台已关闭置顶与加急推广，如有疑问请联系客服。</text>
            </view>

            <template v-else>
                <!-- 2 推广类型 -->
                <view class="card block-card">
                    <text class="block-label">推广类型</text>
                    <view class="seg">
                        <view
                            v-if="topEnabled"
                            :class="['seg-item', promoKind === 'top' ? 'on' : '']"
                            @tap="promoKind = 'top'"
                        >置顶</view>
                        <view
                            v-if="boostEnabled"
                            :class="['seg-item', promoKind === 'boost' ? 'on' : '']"
                            @tap="promoKind = 'boost'"
                        >加急曝光</view>
                    </view>
                </view>

                <!-- 3 推广时长 / 套餐 -->
                <view class="card block-card">
                    <text class="block-label">推广时长</text>
                    <view class="dur-row">
                        <view v-for="d in durations" :key="d" :class="['dur', durationDays === d ? 'dur-on' : '']" @tap="durationDays = d">{{ d }} 天</view>
                    </view>
                </view>

                <!-- 4 赠送天数抵扣 -->
                <view v-if="isMember && (giftTopLeft > 0 || giftBoostLeft > 0)" class="card block-card gift-card">
                    <text class="block-label">赠送天数抵扣</text>
                    <view class="gift-row" v-if="giftTopLeft >= 0"><text class="k">当前可用 · 置顶</text><text class="v">{{ giftTopLeft }} 天</text></view>
                    <view class="gift-row" v-if="giftBoostLeft >= 0"><text class="k">当前可用 · 加急</text><text class="v">{{ giftBoostLeft }} 天</text></view>
                    <view v-if="canOfferGiftSwitch" class="gift-switch">
                        <text class="sw-label">使用赠送置顶/加急曝光天数抵扣（满足条件时 0 元直接生效）</text>
                        <switch :checked="preferUseGift" color="#16a34a" @change="onGiftSwitch" />
                    </view>
                    <text v-if="preferUseGift && canUseGiftForCurrentType" class="gift-tip">本次将抵扣赠送额度，应付 ¥0</text>
                    <text v-else-if="isMember" class="gift-tip muted-sm">不勾选则按会员专享价/非会员价由服务端计价</text>
                </view>

                <!-- 5 价格与应付（单买档位价 + 最终应付） -->
                <view class="card block-card settle-card">
                    <text class="block-label">费用明细</text>
                    <view class="sum-line"><text class="sk">信息类型</text><text class="sv">{{ contentTypeLabel }}</text></view>
                    <view class="sum-line"><text class="sk">推广类型</text><text class="sv">{{ promoKind === 'boost' ? '加急曝光' : '置顶' }}</text></view>
                    <view class="sum-line"><text class="sk">推广时长</text><text class="sv">{{ durationDays }} 天</text></view>
                    <view class="sum-line"><text class="sk">当前身份</text><text class="sv">{{ memberKindLabel }}</text></view>
                    <view class="sum-line subprice-row">
                        <text class="sk">单买价（非会员 / 个人专享 / 企业专享）</text>
                        <text class="sv small">¥{{ priceFree }} / ¥{{ pricePersonal }} / ¥{{ priceEnterprise }}</text>
                    </view>
                    <view class="sum-line"><text class="sk">是否使用赠送</text><text class="sv">{{ preferUseGift && canUseGiftForCurrentType ? '是' : '否' }}</text></view>
                    <view class="sum-line total-line">
                        <text class="sk strong">最终应付</text>
                        <text class="sv amount-lg">¥{{ displayPayAmount }}</text>
                    </view>
                    <text class="hint">{{ priceHintLine }}</text>
                </view>

                <view class="card block-card">
                    <text class="block-label">说明</text>
                    <text class="txt">置顶：列表排序优先展示；加急：醒目标识并优先出现在「急购」类筛选中。</text>
                </view>
            </template>
        </view>

        <view v-if="hasContent || pendingPayBanner" class="bottom">
            <button class="member-primary-btn-lg promo-page-btn" :disabled="!canSubmit" @tap="onPayTap">{{ payBtnLabel }}</button>
        </view>
    </view>
</template>

<script>
import {
    getUserInfo,
    getMembershipPromotionConfig,
    createPromotionOrder,
    activatePromotionOrder,
    createPromotionWxPayParams,
    getPromotionOrderPayStatus
} from '../../utils/api.js';
import { membershipPromotionDefaults } from '../../utils/membershipPromotionDefaults.js';
import { resolveMembershipConfigForDisplay, formatPromotionPriceCell } from '../../utils/memberPricingMarketing.js';

export default {
    data() {
        return {
            content_id: '',
            content_type: '',
            title: '',
            view_count: 0,
            published_at: '',
            promoKind: 'top',
            durationDays: 7,
            durations: [1, 3, 7],
            memberKind: 'free',
            mpConfig: null,
            paying: false,
            activating: false,
            giftTopLeft: 0,
            giftBoostLeft: 0,
            isMember: false,
            preferUseGift: false,
            lastPendingOrderId: '',
            resumeOrderId: '',
            pendingPayBanner: false
        };
    },
    computed: {
        mpCfg() {
            return resolveMembershipConfigForDisplay(
                this.mpConfig && typeof this.mpConfig === 'object' ? this.mpConfig : membershipPromotionDefaults
            );
        },
        hasContent() {
            return !!(this.content_id && this.content_type);
        },
        displayTitle() {
            return this.title || '未命名信息';
        },
        contentTypeLabel() {
            return this.content_type === 'supply' ? '供应' : this.content_type === 'purchase' ? '采购' : '信息';
        },
        viewCount() {
            return this.view_count != null ? this.view_count : 0;
        },
        publishLine() {
            return this.published_at ? `发布 ${this.published_at}` : '发布时间以详情为准';
        },
        topEnabled() {
            return this.mpCfg.feature_switches && this.mpCfg.feature_switches.promotion_top_enabled !== false;
        },
        boostEnabled() {
            return this.mpCfg.feature_switches && this.mpCfg.feature_switches.promotion_boost_enabled !== false;
        },
        canUseGiftForCurrentType() {
            if (!this.isMember) return false;
            const need = Number(this.durationDays) || 7;
            if (this.promoKind === 'top') return this.giftTopLeft >= need;
            return this.giftBoostLeft >= need;
        },
        canOfferGiftSwitch() {
            return this.isMember && this.canUseGiftForCurrentType;
        },
        displayPayAmount() {
            if (this.preferUseGift && this.canUseGiftForCurrentType) {
                return 0;
            }
            return this.readPrice(this.memberKind);
        },
        canSubmit() {
            if (this.pendingPayBanner && this.resumeOrderId) {
                return !this.paying && !this.activating;
            }
            if (!this.hasContent) return false;
            if (this.promoKind === 'top' && !this.topEnabled) return false;
            if (this.promoKind === 'boost' && !this.boostEnabled) return false;
            return !this.paying && !this.activating;
        },
        payBtnLabel() {
            if (!this.topEnabled && !this.boostEnabled) return '推广未开放';
            if (this.paying) return '提交中…';
            if (this.pendingPayBanner && this.resumeOrderId) return '继续微信支付';
            if (this.preferUseGift && this.canUseGiftForCurrentType) return '立即开通推广';
            return '立即支付';
        },
        memberKindLabel() {
            if (this.memberKind === 'enterprise') return '企业会员';
            if (this.memberKind === 'personal') return '个人会员';
            return '非会员';
        },
        priceFree() {
            return this.readPrice('free');
        },
        pricePersonal() {
            return this.readPrice('personal');
        },
        priceEnterprise() {
            return this.readPrice('enterprise');
        },
        priceHintLine() {
            if (this.preferUseGift && this.canUseGiftForCurrentType) {
                return `本次使用会员赠送天数抵扣（${this.durationDays} 天），订单金额为 ¥0，提交后将直接生效。`;
            }
            if (this.memberKind === 'enterprise') return '你当前享受企业会员推广价（与下单计价一致）。';
            if (this.memberKind === 'personal') return '你当前享受个人会员推广价（与下单计价一致）。';
            return '开通会员可享更低推广价；下单金额以服务端校验为准。';
        }
    },
    watch: {
        promoKind() {
            if (!this.canOfferGiftSwitch) {
                this.preferUseGift = false;
            }
        }
    },
    async onLoad(q) {
        this.content_id = (q && q.content_id) || '';
        this.content_type = (q && q.content_type) || '';
        if (q && q.title) {
            try {
                this.title = decodeURIComponent(String(q.title));
            } catch (_e) {
                this.title = String(q.title);
            }
        }
        if (q && q.view_count != null && q.view_count !== '') {
            this.view_count = parseInt(String(q.view_count), 10) || 0;
        }
        if (q && q.published_at) {
            try {
                this.published_at = decodeURIComponent(String(q.published_at));
            } catch (_e) {
                this.published_at = String(q.published_at);
            }
        }
        this.resumeOrderId = (q && q.resume_order_id) || '';
        await this.initPage();
    },
    methods: {
        onGiftSwitch(e) {
            this.preferUseGift = !!(e.detail && e.detail.value);
        },
        readPrice(tier) {
            const pt = this.promoKind === 'boost' ? 'boost' : 'top';
            const t = tier === 'enterprise' || tier === 'personal' ? tier : 'free';
            const s = formatPromotionPriceCell(this.mpCfg, pt, t, String(this.durationDays));
            if (s === '—') return 0;
            const n = Number(s);
            return Number.isFinite(n) ? n : 0;
        },
        async initPage() {
            try {
                const cfg = await getMembershipPromotionConfig().catch(() => membershipPromotionDefaults);
                this.mpConfig = cfg;
                if (!this.topEnabled && this.boostEnabled) this.promoKind = 'boost';
                else if (this.topEnabled) this.promoKind = 'top';
                else this.promoKind = 'boost';
            } catch (_e) {
                this.mpConfig = membershipPromotionDefaults;
            }
            await this.loadMemberAndGifts();
            if (this.resumeOrderId) {
                await this.loadResumePayContext(this.resumeOrderId);
            }
        },
        bindLastPendingResume() {
            if (!this.lastPendingOrderId) return;
            this.resumeOrderId = this.lastPendingOrderId;
            this.loadResumePayContext(this.resumeOrderId);
        },
        async loadResumePayContext(orderId) {
            this.pendingPayBanner = false;
            if (!orderId) return;
            try {
                const st = await getPromotionOrderPayStatus(orderId);
                if (!st) {
                    uni.showToast({ title: '无法获取订单状态', icon: 'none' });
                    this.resumeOrderId = '';
                    return;
                }
                if (st.is_active) {
                    uni.showToast({ title: '该推广已生效', icon: 'success' });
                    this.resumeOrderId = '';
                    this.lastPendingOrderId = '';
                    return;
                }
                if (!st.can_resume_wx_pay) {
                    uni.showToast({ title: '当前订单不可继续支付（可能已关闭或无需支付）', icon: 'none' });
                    this.resumeOrderId = '';
                    return;
                }
                this.content_id = st.content_id || this.content_id;
                this.content_type = st.content_type || this.content_type;
                this.title = st.title || this.title;
                if (st.promotion_type === 'boost' || st.promotion_type === 'top') {
                    this.promoKind = st.promotion_type;
                }
                if ([1, 3, 7].includes(Number(st.duration_days))) {
                    this.durationDays = Number(st.duration_days);
                }
                this.pendingPayBanner = true;
                this.preferUseGift = false;
            } catch (_e) {
                uni.showToast({ title: '加载待支付订单失败', icon: 'none' });
                this.resumeOrderId = '';
            }
        },
        async loadMemberAndGifts() {
            const u = uni.getStorageSync('userInfo') || {};
            const userId = u._id || u.user_id;
            if (!userId) {
                this.memberKind = 'free';
                this.isMember = false;
                this.giftTopLeft = 0;
                this.giftBoostLeft = 0;
                return;
            }
            try {
                const res = await getUserInfo(userId);
                if (res && res.member_type === 'enterprise') this.memberKind = 'enterprise';
                else if (res && res.member_type === 'personal') this.memberKind = 'personal';
                else if (res && res.is_vip) this.memberKind = 'personal';
                else this.memberKind = 'free';
                this.isMember = !!(res && (res.is_member_active || res.is_vip));
                this.giftTopLeft = res && res.gift_top_left != null ? res.gift_top_left : 0;
                this.giftBoostLeft = res && res.gift_boost_left != null ? res.gift_boost_left : 0;
                if (!this.canOfferGiftSwitch) this.preferUseGift = false;
            } catch (_e) {
                this.memberKind = 'free';
                this.isMember = false;
                this.giftTopLeft = 0;
                this.giftBoostLeft = 0;
            }
        },
        successMessage(promoType) {
            return promoType === 'boost' ? '加急曝光已生效' : '置顶推广已生效';
        },
        wxRequestPayment(payParams) {
            return new Promise((resolve, reject) => {
                uni.requestPayment({
                    ...payParams,
                    success: resolve,
                    fail: reject
                });
            });
        },
        /**
         * 仅以 is_active 为准认定「推广已生效」；is_paid 但未 active 视为处理中，避免把待支付误判为成功。
         */
        async pollPromotionPaid(orderId, maxTimes = 18) {
            for (let i = 0; i < maxTimes; i += 1) {
                try {
                    const st = await getPromotionOrderPayStatus(orderId);
                    if (st && st.is_active) {
                        return { ok: true, state: 'active', last: st };
                    }
                    if (st && st.is_paid && !st.is_active) {
                        return { ok: false, state: 'paid_not_active', last: st };
                    }
                } catch (_e) {
                    /* ignore */
                }
                await new Promise((r) => setTimeout(r, 800));
            }
            return { ok: false, state: 'timeout', last: null };
        },
        afterActivateNavigate() {
            const url =
                this.content_type === 'supply'
                    ? '/pages/my-supply/my-supply'
                    : '/pages/my-procurement/my-procurement';
            uni.showModal({
                title: '推广已生效',
                content: '是否前往「' + (this.content_type === 'supply' ? '我的供应' : '我的采购') + '」查看？',
                confirmText: '前往',
                cancelText: '留在本页',
                success: (r) => {
                    if (r.confirm) {
                        uni.navigateTo({ url, fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
                    }
                }
            });
        },
        async runWxPayForOrder(orderId, successPromoType) {
            const payPack = await createPromotionWxPayParams({ promotion_order_id: orderId });
            if (!payPack || !payPack.pay_params) {
                throw new Error('获取支付参数失败，请稍后重试');
            }
            try {
                await this.wxRequestPayment(payPack.pay_params);
            } catch (payErr) {
                const msg = (payErr && payErr.errMsg) || (payErr && payErr.message) || '';
                if (String(msg).includes('cancel')) {
                    uni.showToast({ title: '已取消支付，订单仍为待支付', icon: 'none' });
                    this.lastPendingOrderId = orderId;
                    return false;
                }
                throw payErr;
            }
            uni.showToast({ title: '支付已提交，正在确认…', icon: 'none', duration: 1500 });
            const poll = await this.pollPromotionPaid(orderId, 20);
            await this.loadMemberAndGifts();
            if (poll && poll.ok) {
                uni.showToast({ title: this.successMessage(successPromoType || this.promoKind), icon: 'success' });
                this.lastPendingOrderId = '';
                this.resumeOrderId = '';
                this.pendingPayBanner = false;
                this.afterActivateNavigate();
                return true;
            }
            this.lastPendingOrderId = orderId;
            if (poll && poll.state === 'paid_not_active') {
                uni.showModal({
                    title: '已收款，开通处理中',
                    content: '微信支付已成功，推广正在开通，请稍后下拉刷新「我的采购/供应」列表查看。',
                    showCancel: false
                });
            } else {
                uni.showModal({
                    title: '尚未检测到推广生效',
                    content:
                        '若微信已扣款，请等待几秒后重试本页「继续微信支付」；若未扣款则仍为待支付。请勿重复创建新推广单。',
                    showCancel: false
                });
            }
            return false;
        },
        async onPayTap() {
            if (!this.canSubmit) return;
            this.paying = true;
            try {
                if (this.pendingPayBanner && this.resumeOrderId) {
                    await this.runWxPayForOrder(this.resumeOrderId, this.promoKind);
                    return;
                }

                const useGift = !!(this.preferUseGift && this.canUseGiftForCurrentType);
                const data = await createPromotionOrder({
                    content_id: this.content_id,
                    content_type: this.content_type,
                    promotion_type: this.promoKind,
                    duration_days: this.durationDays,
                    use_gift_quota: useGift
                });
                const needPay = data.need_pay !== false && Number(data.amount || data.price || 0) > 0;
                const canDirect = data.can_activate_directly === true || !needPay;

                if (canDirect && data.order_id) {
                    await activatePromotionOrder(data.order_id);
                    uni.showToast({ title: this.successMessage(data.promotion_type || this.promoKind), icon: 'success' });
                    this.lastPendingOrderId = '';
                    this.resumeOrderId = '';
                    this.pendingPayBanner = false;
                    await this.loadMemberAndGifts();
                    this.afterActivateNavigate();
                    return;
                }

                this.lastPendingOrderId = data.order_id || '';
                if (needPay && data.order_id) {
                    await this.runWxPayForOrder(data.order_id, data.promotion_type || this.promoKind);
                    return;
                }

                if (needPay && !data.order_id) {
                    throw new Error('订单创建成功但缺少 order_id');
                }

                uni.showModal({
                    title: '订单已创建',
                    content: `订单号：${data.order_no}\n应付：¥${data.amount != null ? data.amount : data.price}\n正式链路：支付成功后自动生效`,
                    showCancel: false,
                    confirmText: '知道了'
                });
            } catch (e) {
                uni.showToast({ title: (e && e.message) || '创建失败', icon: 'none' });
            } finally {
                this.paying = false;
            }
        },
        goBack() {
            uni.navigateBack({ fail: () => uni.switchTab({ url: '/pages/profile/profile' }) });
        }
    }
};
</script>

<style scoped>
@import '../../common/member-buttons.css';

.page {
    min-height: 100vh;
    background: #f5f5f5;
    padding: 24rpx 24rpx 200rpx;
}
.card {
    background: #fff;
    border-radius: 20rpx;
    padding: 28rpx;
    margin-bottom: 24rpx;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.empty {
    text-align: center;
    padding: 48rpx 32rpx;
}
.empty-title {
    font-size: 34rpx;
    font-weight: bold;
    color: #111827;
    display: block;
    margin-bottom: 16rpx;
}
.empty-desc {
    font-size: 26rpx;
    color: #6b7280;
    line-height: 1.5;
    display: block;
}
.promo-page-btn {
    margin-top: 0;
}
.empty .promo-page-btn {
    margin-top: 32rpx;
}
.warn {
    font-size: 26rpx;
    color: #b45309;
    line-height: 1.5;
}
.info-card .title {
    font-size: 32rpx;
    font-weight: bold;
    color: #1f2937;
    display: block;
}
.meta {
    margin-top: 16rpx;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 16rpx;
}
.pill {
    background: #ecfdf5;
    color: #166534;
    font-size: 22rpx;
    padding: 6rpx 16rpx;
    border-radius: 8rpx;
}
.muted {
    font-size: 24rpx;
    color: #9ca3af;
}
.sec {
    font-size: 30rpx;
    font-weight: bold;
    color: #111827;
    display: block;
    margin-bottom: 20rpx;
}
.seg {
    display: flex;
    gap: 16rpx;
}
.seg-item {
    flex: 1;
    text-align: center;
    padding: 20rpx;
    border-radius: 12rpx;
    border: 2rpx solid #e5e7eb;
    font-size: 28rpx;
    color: #374151;
}
.seg-item.on {
    border-color: #16a34a;
    background: #f0fdf4;
    color: #166534;
    font-weight: bold;
}
.dur-row {
    display: flex;
    gap: 16rpx;
}
.dur {
    flex: 1;
    text-align: center;
    padding: 20rpx 0;
    border-radius: 12rpx;
    background: #f9fafb;
    font-size: 26rpx;
    color: #4b5563;
}
.dur-on {
    background: #16a34a;
    color: #fff;
}
.price-line {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 12rpx;
}
.price-line .label {
    font-size: 28rpx;
    color: #6b7280;
}
.amount {
    font-size: 44rpx;
    font-weight: bold;
    color: #dc2626;
}
.subprices {
    display: flex;
    flex-direction: column;
    gap: 6rpx;
    font-size: 22rpx;
    color: #9ca3af;
}
.hint {
    margin-top: 16rpx;
    font-size: 24rpx;
    color: #166534;
    display: block;
}
.txt {
    font-size: 26rpx;
    color: #4b5563;
    line-height: 1.5;
    display: block;
}
.txt.mt {
    margin-top: 12rpx;
}
.gift-card .gift-row {
    display: flex;
    justify-content: space-between;
    font-size: 26rpx;
    padding: 10rpx 0;
    border-bottom: 1rpx solid #f3f4f6;
}
.gift-card .gift-row .k {
    color: #6b7280;
}
.gift-card .gift-row .v {
    color: #166534;
    font-weight: 600;
}
.gift-switch {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 20rpx;
}
.sw-label {
    font-size: 26rpx;
    color: #374151;
    flex: 1;
    padding-right: 16rpx;
}
.gift-tip {
    margin-top: 16rpx;
    font-size: 24rpx;
    color: #15803d;
    display: block;
}
.muted-sm {
    color: #9ca3af !important;
}
.promo-main {
    padding-bottom: 8rpx;
}
.block-card {
    padding-top: 32rpx;
}
.block-label {
    display: block;
    font-size: 24rpx;
    font-weight: 700;
    color: #15803d;
    margin-bottom: 16rpx;
    letter-spacing: 1rpx;
}
.obj-title {
    font-size: 34rpx;
    font-weight: 800;
    color: #111827;
    line-height: 1.35;
    display: block;
}
.obj-meta {
    margin-top: 16rpx;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12rpx;
}
.meta-t {
    font-size: 26rpx;
    color: #6b7280;
}
.sum-line {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 14rpx 0;
    border-bottom: 1rpx solid #f3f4f6;
    font-size: 28rpx;
}
.sum-line .sk {
    color: #6b7280;
    flex-shrink: 0;
    padding-right: 16rpx;
}
.sum-line .sv {
    color: #111827;
    font-weight: 600;
    text-align: right;
    flex: 1;
}
.sum-line .sv.small {
    font-size: 24rpx;
    font-weight: 500;
    color: #4b5563;
    line-height: 1.4;
}
.sum-line .sk.strong {
    color: #111827;
    font-weight: 800;
}
.total-line {
    border-bottom: none;
    margin-top: 8rpx;
    padding-top: 20rpx;
}
.amount-lg {
    font-size: 40rpx !important;
    font-weight: 800 !important;
    color: #dc2626 !important;
}
.bottom {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 -4rpx 16rpx rgba(0, 0, 0, 0.05);
}
.resume-banner {
    border: 2rpx solid #fbbf24;
    background: linear-gradient(135deg, #fffbeb, #fef3c7);
}
.resume-banner-title {
    font-size: 30rpx;
    font-weight: 800;
    color: #92400e;
    display: block;
    margin-bottom: 12rpx;
}
.resume-banner-desc {
    font-size: 26rpx;
    color: #78350f;
    line-height: 1.45;
    display: block;
}
.resume-tip {
    border: 2rpx dashed #fcd34d;
    background: #fffbeb;
}
.resume-tip-txt {
    font-size: 26rpx;
    color: #92400e;
    display: block;
    margin-bottom: 16rpx;
}
.resume-mini-btn {
    margin-top: 0;
    background: #f59e0b;
    color: #fff;
    font-size: 28rpx;
    border-radius: 12rpx;
    border: none;
}
.resume-mini-btn::after {
    border: none;
}
</style>
