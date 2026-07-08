<template>
    <view class="open-shop-page">
        <!-- 整改：未登录用户也可浏览会员权益、价格、协议；下单时再提示登录 -->
        <view v-if="isLoadingData && hasLogin" class="status-page">
            <view class="status-content">
                <text class="status-message">数据加载中...</text>
            </view>
        </view>

        <view v-else class="member-center-wrap">
            <view v-if="isVip" class="vip-strip">
                <text class="vip-strip-title">您已是会员</text>
                <text class="vip-strip-sub">{{ memberStatusLine }}</text>
                <view class="vip-strip-btns">
                    <button class="strip-btn outline" @tap="goMyMember">我的会员</button>
                    <button class="strip-btn outline" @tap="goToOrders">会员订单</button>
                </view>
            </view>

            <view class="hero-banner">
                <text class="hero-title">会员中心</text>
                <text class="hero-desc">为农产品生意加速：联系采购方、排序优先、数据可见，推广享会员价。</text>
            </view>

            <view class="form-section">
                <view class="tab-row">
                    <view
                        :class="['tab-pill', memberTab === 'personal' ? 'tab-on' : '', !personalMemberEnabled ? 'tab-off' : '']"
                        @tap="setMemberTab('personal')"
                    >个人会员</view>
                    <view
                        :class="['tab-pill', memberTab === 'enterprise' ? 'tab-on' : '', !enterpriseMemberEnabled ? 'tab-off' : '']"
                        @tap="setMemberTab('enterprise')"
                    >企业会员</view>
                </view>

                <view class="form-card">
                    <view class="card-header">
                        <view class="step-number">1</view>
                        <text class="card-title">选择套餐</text>
                    </view>
                    <view class="plan-grid">
                        <view
                            v-for="p in planOptionsForGrid"
                            :key="p.key"
                            :class="['pkg-card', selectedPlanKey === p.key ? 'pkg-on' : '']"
                            @tap="selectPlan(p.key)"
                        >
                            <text class="pkg-name">{{ p.label }}</text>
                            <view class="pkg-price-row">
                                <text v-if="p.priceDisplay !== '—'" class="pkg-yen">¥</text>
                                <text class="pkg-num">{{ p.priceDisplay }}</text>
                            </view>
                            <text class="pkg-days">{{ p.sub }}</text>
                            <text v-if="planSaveLineForCard(p)" class="pkg-save">{{ planSaveLineForCard(p) }}</text>
                        </view>
                    </view>
                    <view class="plan-card active plan-detail-card">
                        <view class="plan-header">
                            <view class="plan-info">
                                <text class="plan-title">{{ currentPlanTitle }}</text>
                                <text class="plan-desc">{{ currentPlanDesc }}</text>
                            </view>
                            <view class="plan-price">
                                <text v-if="currentPlanDisplay.priceDisplay !== '—'" class="price-symbol">¥</text>
                                <text class="price-amount">{{ displayPay }}</text>
                                <text class="price-old">套餐价 {{ currentPlanDisplay.priceDisplay === '—' ? '—' : '¥' + currentPlanDisplay.priceDisplay }}</text>
                            </view>
                        </view>
                        <view v-if="currentPlanDisplay" class="plan-value-strip">
                            <view class="pv-block pv-equiv">
                                <text class="pv-label">赠送权益等值</text>
                                <text class="pv-num">{{ currentPlanDisplay.equivalentDisplay === '—' ? '—' : '¥' + currentPlanDisplay.equivalentDisplay }}</text>
                                <text class="pv-hint">按非会员单买价折算</text>
                            </view>
                            <view v-if="currentPlanDisplay.showSave" class="pv-block pv-save">
                                <text class="pv-label">相对月卡立省</text>
                                <text class="pv-num">¥{{ currentPlanDisplay.saveDisplay }}</text>
                                <text class="pv-hint">{{ currentPlanDisplay.saveLongLine }}</text>
                            </view>
                        </view>
                        <view class="plan-features">
                            <view v-for="(line, idx) in currentFeatureLines" :key="idx" class="feature-item">{{ line }}</view>
                        </view>
                    </view>
                </view>

                <view class="form-card rights-overview-card">
                    <view class="card-header rights-overview-head">
                        <view class="step-number">2</view>
                        <view class="rights-head-text">
                            <text class="card-title">权益概览</text>
                            <text class="rights-overview-sub">{{ rightsOverviewSubtitle }}</text>
                        </view>
                    </view>
                    <view class="rights-metrics">
                        <view class="rights-metric">
                            <text class="rm-label">当前套餐价</text>
                            <text class="rm-value rm-price">{{ rightsOverviewDisplay.priceDisplay === '—' ? '—' : '¥' + rightsOverviewDisplay.priceDisplay }}</text>
                        </view>
                        <view class="rights-metric">
                            <text class="rm-label">赠送置顶</text>
                            <text class="rm-value">{{ rightsOverviewDisplay.giftTop }} 天</text>
                        </view>
                        <view class="rights-metric">
                            <text class="rm-label">赠送加急</text>
                            <text class="rm-value">{{ rightsOverviewDisplay.giftBoost }} 天</text>
                        </view>
                        <view class="rights-metric">
                            <text class="rm-label">权益等值</text>
                            <text class="rm-value rm-equiv">{{ rightsOverviewDisplay.equivalentDisplay === '—' ? '—' : '¥' + rightsOverviewDisplay.equivalentDisplay }}</text>
                        </view>
                    </view>
                    <view class="rights-strip-mini">
                        <view class="rsm rsm-equiv">
                            <text class="rsm-label">赠送权益等值</text>
                            <text class="rsm-num">{{ rightsOverviewDisplay.equivalentDisplay === '—' ? '—' : '¥' + rightsOverviewDisplay.equivalentDisplay }}</text>
                        </view>
                        <view v-if="rightsOverviewDisplay.showSave" class="rsm rsm-save">
                            <text class="rsm-label">相对月卡立省</text>
                            <text class="rsm-num">¥{{ rightsOverviewDisplay.saveDisplay }}</text>
                        </view>
                    </view>
                    <view class="rights-bullets-wrap">
                        <text v-for="(b, i) in rightsBullets" :key="i" class="bullet-line">{{ b }}</text>
                    </view>
                </view>

                <view class="form-card member-gold-card">
                    <view class="card-header">
                        <view class="step-number">3</view>
                        <text class="card-title">免费 / 个人 / 企业 对比（按当前所选套餐周期）</text>
                    </view>
                    <view class="compare-table">
                        <view class="compare-row compare-head">
                            <text class="c-cell w1">权益</text>
                            <text class="c-cell">免费</text>
                            <text class="c-cell">个人</text>
                            <text class="c-cell">企业</text>
                        </view>
                        <view
                            v-for="(row, ri) in compareRows"
                            :key="ri"
                            :class="['compare-row', row.emphasis ? 'compare-row-emphasis' : '']"
                        >
                            <text class="c-cell w1 muted">{{ row.name }}</text>
                            <text class="c-cell small">{{ row.free }}</text>
                            <text class="c-cell small">{{ row.p }}</text>
                            <text class="c-cell small">{{ row.e }}</text>
                        </view>
                    </view>
                </view>

                <view class="form-card member-gold-card">
                    <view class="card-header">
                        <view class="step-number">4</view>
                        <text class="card-title">增值推广服务</text>
                    </view>
                    <text class="promo-intro">为单条采购/供应做曝光加权；单买仅 1/3/7 天三档，会员享专享价（见下表）。</text>
                    <view class="price-matrix">
                        <text class="matrix-title">单条置顶（元）</text>
                        <view class="matrix-row head"><text></text><text>1天</text><text>3天</text><text>7天</text></view>
                        <view class="matrix-row"><text>非会员</text><text>{{ promoPrice('top', 'free', '1') }}</text><text>{{ promoPrice('top', 'free', '3') }}</text><text>{{ promoPrice('top', 'free', '7') }}</text></view>
                        <view class="matrix-row"><text>个人会员</text><text>{{ promoPrice('top', 'personal', '1') }}</text><text>{{ promoPrice('top', 'personal', '3') }}</text><text>{{ promoPrice('top', 'personal', '7') }}</text></view>
                        <view class="matrix-row"><text>企业会员</text><text>{{ promoPrice('top', 'enterprise', '1') }}</text><text>{{ promoPrice('top', 'enterprise', '3') }}</text><text>{{ promoPrice('top', 'enterprise', '7') }}</text></view>
                    </view>
                    <view class="price-matrix mt">
                        <text class="matrix-title">加急曝光（元）</text>
                        <view class="matrix-row head"><text></text><text>1天</text><text>3天</text><text>7天</text></view>
                        <view class="matrix-row"><text>非会员</text><text>{{ promoPrice('boost', 'free', '1') }}</text><text>{{ promoPrice('boost', 'free', '3') }}</text><text>{{ promoPrice('boost', 'free', '7') }}</text></view>
                        <view class="matrix-row"><text>个人会员</text><text>{{ promoPrice('boost', 'personal', '1') }}</text><text>{{ promoPrice('boost', 'personal', '3') }}</text><text>{{ promoPrice('boost', 'personal', '7') }}</text></view>
                        <view class="matrix-row"><text>企业会员</text><text>{{ promoPrice('boost', 'enterprise', '1') }}</text><text>{{ promoPrice('boost', 'enterprise', '3') }}</text><text>{{ promoPrice('boost', 'enterprise', '7') }}</text></view>
                    </view>
                    <text class="promo-tip">开通会员后，在「我的供应/我的采购」中可对单条信息发起推广。</text>
                </view>

                <view class="form-card">
                    <view class="card-header">
                        <view class="step-number">5</view>
                        <text class="card-title">优惠码兑换</text>
                    </view>
                    <view class="redeem-header">
                        <text class="redeem-desc">输入活动码后点「校验」预览抵扣金额；创建订单不会核销，仅支付成功或 0 元落账后核销。</text>
                    </view>
                    <view class="redeem-body">
                        <input class="redeem-input" v-model="redeemCode" placeholder="请输入优惠码" @input="onCouponInput" />
                        <button class="redeem-btn" :disabled="redeemLoading" @tap="handleValidateCoupon">校验</button>
                    </view>
                    <view v-if="couponValidated" class="coupon-preview">
                        <text class="cp-line ok">已校验：扣减 ¥{{ couponValidated.discount_amount }}，实付 ¥{{ couponValidated.pay_amount }}</text>
                        <text v-if="couponValidated.is_zero_order" class="cp-line warn">本单为 0 元，提交订单后将直接开通（不拉起微信支付）</text>
                    </view>
                </view>

                <view class="form-card faq-card">
                    <view class="card-header">
                        <text class="card-title">常见问题</text>
                    </view>
                    <view class="faq-item">
                        <text class="faq-q">会员支付后多久生效？</text>
                        <text class="faq-a">支付成功（或 0 元订单落账）后立即生效，到期时间可在「我的会员」查看。</text>
                    </view>
                    <view class="faq-item">
                        <text class="faq-q">个人与企业会员区别？</text>
                        <text class="faq-a">主要差异在联系采购方次数、排序权重、赠送曝光天数及推广购买价，详见上表。</text>
                    </view>
                </view>

                <view class="submit-section inline-submit">
                    <view class="agreement-wrapper">
                        <checkbox-group class="agreement-checkbox-group" @change="onAgreementChange">
                            <checkbox class="agreement-checkbox" value="agreed" :checked="agreedToTerms" color="#16a34a" />
                        </checkbox-group>
                        <view class="agreement-text" @tap="openAgreement">
                            <text>点击即代表同意</text>
                            <text class="link-text">《云链农商会员服务协议》</text>
                        </view>
                    </view>
                </view>

                <view v-if="showPayResult" :class="['form-card', 'result-card', isPendingPayResult ? 'result-card-pending' : '']">
                    <view class="card-header">
                        <icon :type="isPendingPayResult ? 'info' : 'success'" size="24" :color="isPendingPayResult ? '#ca8a04' : '#16a34a'"></icon>
                        <text class="card-title" style="margin-left:10rpx;">{{ isPendingPayResult ? '订单已创建（待支付）' : '开通成功' }}</text>
                    </view>
                    <view class="result-body">
                        <view v-if="isPendingPayResult" class="result-hint">
                            <text>当前仅为待支付订单，会员尚未生效；微信支付成功后才会开通并计算提成。可在「会员订单」中继续支付。</text>
                        </view>
                        <view class="result-item">
                            <text class="result-label">订单类型：</text>
                            <text class="result-value">{{ orderTypeDisplay }}</text>
                        </view>
                        <view v-if="payResult.sales_name" class="result-item">
                            <text class="result-label">服务业务员：</text>
                            <text class="result-value">{{ payResult.sales_name }}</text>
                        </view>
                        <view v-if="!isPendingPayResult && (payResult.vip_expire_time_text || payResult.expire_time_after)" class="result-item">
                            <text class="result-label">到期时间：</text>
                            <text class="result-value">{{ payResult.vip_expire_time_text || payResult.expire_time_after }}</text>
                        </view>
                        <view v-if="payResult.order_no" class="result-item">
                            <text class="result-label">订单号：</text>
                            <text class="result-value">{{ payResult.order_no }}</text>
                        </view>
                        <view v-if="payResult.order_id" class="result-item">
                            <text class="result-label">订单ID：</text>
                            <text class="result-value mono-small">{{ payResult.order_id }}</text>
                        </view>
                    </view>
                    <button class="success-btn pay-result-confirm-btn" @tap="showPayResult = false">我知道了</button>
                </view>
            </view>

            <view class="bottom-placeholder"></view>
            <view class="bottom-bar">
                <button class="bottom-btn member-primary-btn-lg" @tap="handlePayVip">{{ submitBtnText }}</button>
            </view>
        </view>
    </view>
</template>

<script>
import { showError, showLoading, hideLoading } from '../../utils/util.js';
import {
    getUserInfo,
    createMemberOrderAndGetPayParams,
    getMemberOrderPayStatus,
    validateMemberCouponCode,
    saveSalesSourceToStorage,
    getSalesSourceFromStorage,
    getMembershipPromotionConfig
} from '../../utils/api.js';
import { membershipPromotionDefaults } from '../../utils/membershipPromotionDefaults.js';
import { mergeRightsForTierPlan } from '../../utils/memberConfigRights.js';
import { hasToken, requireLoginAction, getStoredToken as authGetStoredToken } from '../../utils/authGuard.js';
import {
    buildMemberPlanDisplayData,
    memberPlanSecondaryLines,
    packageSaveShortCardLine,
    equivalentGiftValueYuan,
    packageVsMonthlySaveYuan,
    formatPromotionPriceCell,
    getPlanPrice,
    resolveMembershipConfigForDisplay
} from '../../utils/memberPricingMarketing.js';

export default {
    data() {
        return {
            hasLogin: false,
            isLoadingData: true,
            isVip: false,
            vipExpireTimeText: '',
            memberTab: 'personal',
            selectedPlanKey: 'year',
            redeemCode: '',
            redeemLoading: false,
            couponValidated: null,
            agreedToTerms: false,
            salesSourceInfo: { sales_id: '', channel_id: '', invite_code: '' },
            sales_id: '',
            channel_id: '',
            invite_code: '',
            payResult: {},
            showPayResult: false,
            mpConfig: null,
            /** 从「我的会员」续费入口进入，底部主按钮展示续费文案 */
            renewalEntry: false
        };
    },
    computed: {
        mpCfg() {
            return resolveMembershipConfigForDisplay(
                this.mpConfig && typeof this.mpConfig === 'object' ? this.mpConfig : membershipPromotionDefaults
            );
        },
        personalMemberEnabled() {
            return this.mpCfg.feature_switches && this.mpCfg.feature_switches.personal_member_enabled !== false;
        },
        enterpriseMemberEnabled() {
            return this.mpCfg.feature_switches && this.mpCfg.feature_switches.enterprise_member_enabled !== false;
        },
        memberStatusLine() {
            const t = this.vipExpireTimeText ? `到期时间：${this.vipExpireTimeText}` : '会员权益生效中';
            return t;
        },
        planOptionsForGrid() {
            const tier = this.memberTab === 'enterprise' ? 'enterprise' : 'personal';
            const plans = (this.mpCfg.member_plans && this.mpCfg.member_plans[tier]) || {};
            const defs = [
                { key: 'month', label: '月卡', sub: '30天', days: 30 },
                { key: 'quarter', label: '季卡', sub: '90天', days: 90 },
                { key: 'year', label: '年卡', sub: '365天', days: 365 }
            ];
            const out = [];
            defs.forEach((d) => {
                const cell = plans[d.key];
                if (cell && cell.enabled !== false) {
                    const pr = getPlanPrice(this.mpCfg, tier, d.key);
                    out.push({
                        ...d,
                        price: pr.ok && pr.price != null ? pr.price : 0,
                        priceDisplay: pr.ok && pr.price != null ? String(pr.price) : '—',
                        priceOk: pr.ok
                    });
                }
            });
            if (out.length) return out;
            const fb = defs[2];
            const pr = getPlanPrice(this.mpCfg, tier, 'year');
            return [
                {
                    ...fb,
                    price: pr.ok && pr.price != null ? pr.price : 0,
                    priceDisplay: pr.ok && pr.price != null ? String(pr.price) : '—',
                    priceOk: pr.ok
                }
            ];
        },
        currentPlanMeta() {
            const list = this.planOptionsForGrid;
            const p = list.find((x) => x.key === this.selectedPlanKey) || list[list.length - 1] || { key: 'year', days: 365, price: 0, priceOk: false, priceDisplay: '—' };
            return p;
        },
        currentPlanDisplay() {
            const tier = this.memberTab === 'enterprise' ? 'enterprise' : 'personal';
            const pk = (this.currentPlanMeta && this.currentPlanMeta.key) || this.selectedPlanKey;
            return buildMemberPlanDisplayData(this.mpCfg, tier, pk);
        },
        rightsOverviewDisplay() {
            return this.currentPlanDisplay;
        },
        rightsOverviewSubtitle() {
            const ent = this.memberTab === 'enterprise';
            const name = ent ? '企业会员' : '个人会员';
            const lab = this.currentPlanDisplay.planLabel || '';
            return `${name} · ${lab}（与下方所选套餐一致）`;
        },
        pricePay() {
            const m = this.currentPlanMeta;
            return m && m.priceOk ? Number(m.price) || 0 : 0;
        },
        priceOriginal() {
            const m = this.currentPlanMeta;
            return m && m.priceOk ? Number(m.price) || 0 : 0;
        },
        currentPlanTitle() {
            const ent = this.memberTab === 'enterprise';
            const name = ent ? '企业会员' : '个人会员';
            return `${name} · ${this.currentPlanMeta.label}`;
        },
        currentPlanDesc() {
            return this.memberTab === 'enterprise' ? '适合企业主体，更高曝光与联系额度。' : '适合个体农户与经纪人，解锁采购方联系与数据。';
        },
        currentFeatureLines() {
            const tier = this.memberTab === 'enterprise' ? 'enterprise' : 'personal';
            const pk = (this.currentPlanMeta && this.currentPlanMeta.key) || this.selectedPlanKey;
            return memberPlanSecondaryLines(this.mpCfg, tier, pk);
        },
        rightsBullets() {
            return this.currentFeatureLines;
        },
        compareRows() {
            const pk = this.selectedPlanKey;
            const p = mergeRightsForTierPlan(this.mpCfg, 'personal', pk, membershipPromotionDefaults);
            const e = mergeRightsForTierPlan(this.mpCfg, 'enterprise', pk, membershipPromotionDefaults);
            const pContact = p.contact_purchase_quota != null ? `${p.contact_purchase_quota}次/月` : '—';
            const eContact = e.contact_purchase_quota != null ? `${e.contact_purchase_quota}次/月` : '—';
            const pGt = p.gift_top_days != null ? p.gift_top_days : p.gift_top_count || 0;
            const pGb = p.gift_boost_days != null ? p.gift_boost_days : p.gift_boost_count || 0;
            const eGt = e.gift_top_days != null ? e.gift_top_days : e.gift_top_count || 0;
            const eGb = e.gift_boost_days != null ? e.gift_boost_days : e.gift_boost_count || 0;
            const pGift = `置顶${pGt}天+加急${pGb}天`;
            const eGift = `置顶${eGt}天+加急${eGb}天`;
            const pSort = p.priority_display ? '优先' : '普通';
            const eSort = e.priority_display ? '更高权重' : '普通';
            const pData = p.full_data_access ? '可查' : '基础';
            const eData = e.full_data_access ? '完整' : '基础';
            const saveP = packageVsMonthlySaveYuan(this.mpCfg, 'personal', pk);
            const saveE = packageVsMonthlySaveYuan(this.mpCfg, 'enterprise', pk);
            const saveTxt = (n) => (n > 0 ? `¥${n}` : '—');
            const eqP = equivalentGiftValueYuan(this.mpCfg, 'personal', pk);
            const eqE = equivalentGiftValueYuan(this.mpCfg, 'enterprise', pk);
            const eqTxt = (v) => (v != null && Number.isFinite(v) ? `¥${v}` : '—');
            return [
                { name: '联系采购方', free: '不可', p: pContact, e: eContact, emphasis: false },
                { name: '信息排序', free: '普通', p: pSort, e: eSort, emphasis: false },
                { name: '浏览/收藏/被联系', free: '基础', p: pData, e: eData, emphasis: false },
                { name: '推广单买档位', free: '仅1/3/7天', p: '会员专享价', e: '企业专享价', emphasis: false },
                { name: '赠送置顶+加急', free: '无', p: pGift, e: eGift, emphasis: false },
                { name: '相对月卡立省', free: '—', p: saveTxt(saveP), e: saveTxt(saveE), emphasis: true },
                { name: '赠送权益等值', free: '—', p: eqTxt(eqP), e: eqTxt(eqE), emphasis: true }
            ];
        },
        submitBtnText() {
            if (this.memberTab === 'enterprise' && !this.enterpriseMemberEnabled) return '企业会员暂不可开通';
            if (this.memberTab === 'personal' && !this.personalMemberEnabled) return '个人会员暂不可开通';
            if (this.renewalEntry) {
                return this.memberTab === 'enterprise' ? '续费企业会员' : '续费个人会员';
            }
            return this.memberTab === 'enterprise' ? '立即开通企业会员' : '立即开通个人会员';
        },
        isPendingPayResult() {
            const p = this.payResult;
            if (!p || typeof p !== 'object') return false;
            if (p.pay_status === 0 || p.pay_status === '0') return true;
            return false;
        },
        /** 与产品规则对齐：3=企业类型升级（到期不变）；4=周期档位升级（原到期+目标整段天数） */
        orderTypeDisplay() {
            const t = this.payResult && this.payResult.order_type;
            if (t === 1 || t === '1') return '首开';
            if (t === 2 || t === '2') return '续费';
            if (t === 3 || t === '3') return '企业类型升级';
            if (t === 4 || t === '4') return '周期档位升级';
            return this.payResult.order_type_text || '会员订单';
        },
        displayOriginal() {
            if (this.couponValidated && this.couponValidated.original_amount != null) {
                return this.couponValidated.original_amount;
            }
            return this.priceOriginal;
        },
        displayPay() {
            if (this.couponValidated && this.couponValidated.pay_amount != null) {
                return this.couponValidated.pay_amount;
            }
            return this.pricePay;
        }
    },
    onLoad(options) {
        this.parseSalesSource(options);
        this.parseRenewEntry(options);
        this.loadMpConfig();
        this.checkLoginAndLoadStatus();
    },
    onShow() {
        uni.pageScrollTo({ scrollTop: 0, duration: 0 });
        this.loadMpConfig();
        const cachedSource = getSalesSourceFromStorage();
        if (cachedSource) {
            this.applySalesSourceToPage({
                sales_id: cachedSource.sales_id || '',
                channel_id: cachedSource.channel_id || '',
                invite_code: cachedSource.invite_code || ''
            });
        }
        this.checkLoginAndLoadStatus();
    },
    methods: {
        parseRenewEntry(options) {
            if (!options) return;
            const renew = options.renew;
            if (renew === '1' || renew === 'true' || renew === true) {
                this.renewalEntry = true;
            }
            const tab = options.tab ? String(options.tab).toLowerCase() : '';
            if (tab === 'enterprise' || tab === 'personal') {
                this.memberTab = tab;
            }
            const pk = options.plan_key ? String(options.plan_key) : '';
            if (['month', 'quarter', 'year'].includes(pk)) {
                this.selectedPlanKey = pk;
            }
        },
        setMemberTab(tab) {
            if (tab === 'personal' && !this.personalMemberEnabled) {
                uni.showToast({ title: '个人会员暂未开放', icon: 'none' });
                return;
            }
            if (tab === 'enterprise' && !this.enterpriseMemberEnabled) {
                uni.showToast({ title: '企业会员暂未开放', icon: 'none' });
                return;
            }
            this.memberTab = tab;
            this.couponValidated = null;
            this.$nextTick(() => {
                this.ensureSelectedPlan();
                this.revalidateCouponIfNeeded();
            });
        },
        ensureSelectedPlan() {
            const keys = this.planOptionsForGrid.map((x) => x.key);
            if (!keys.includes(this.selectedPlanKey)) {
                this.selectedPlanKey = keys[0] || 'year';
            }
        },
        selectPlan(key) {
            this.selectedPlanKey = key;
            this.couponValidated = null;
            this.revalidateCouponIfNeeded();
        },
        planSaveLineForCard(p) {
            const tier = this.memberTab === 'enterprise' ? 'enterprise' : 'personal';
            return packageSaveShortCardLine(this.mpCfg, tier, p.key);
        },
        promoPrice(promoType, tier, dayKey) {
            const pt = promoType === 'boost' ? 'boost' : 'top';
            const t = tier === 'enterprise' || tier === 'personal' ? tier : 'free';
            return formatPromotionPriceCell(this.mpCfg, pt, t, String(dayKey));
        },
        async loadMpConfig() {
            try {
                const c = await getMembershipPromotionConfig();
                this.mpConfig = c && typeof c === 'object' ? c : membershipPromotionDefaults;
            } catch (e) {
                console.warn('loadMpConfig', e);
                this.mpConfig = membershipPromotionDefaults;
            }
            this.ensureSelectedPlan();
        },
        goMyMember() {
            // 整改：未登录给出可取消的登录提示
            requireLoginAction('我的会员', () => {
                uni.navigateTo({ url: '/pages/my-member/my-member' });
            });
        },
        checkLoginAndLoadStatus() {
            // 整改：未登录的游客也允许浏览会员权益与价格；
            // 仅当用户主动点击「立即开通 / 续费 / 优惠码 / 我的会员」时再提示登录。
            const token = authGetStoredToken();
            const userInfo = uni.getStorageSync('userInfo');
            if (!token || !userInfo) {
                this.hasLogin = false;
                this.isLoadingData = false;
                this.isVip = false;
                this.vipExpireTimeText = '';
                return;
            }
            this.hasLogin = true;
            this.loadVipStatus();
        },
        async loadVipStatus() {
            this.isLoadingData = true;
            try {
                const userInfo = uni.getStorageSync('userInfo') || {};
                const userId = userInfo._id || userInfo.user_id || uni.getStorageSync('user_id');
                if (!userId) {
                    this.hasLogin = false;
                    this.isLoadingData = false;
                    return;
                }
                const res = await getUserInfo(userId);
                if (res) {
                    this.isVip = res.is_vip || false;
                    this.vipExpireTimeText = res.vip_expire_time_text || '';
                    const localUserInfo = uni.getStorageSync('userInfo') || {};
                    localUserInfo.is_vip = this.isVip;
                    localUserInfo.vip_expire_time = res.vip_expire_time;
                    localUserInfo.vip_expire_time_text = res.vip_expire_time_text;
                    if (res.member_type) localUserInfo.member_type = res.member_type;
                    if (res.member_plan_key != null && res.member_plan_key !== '') {
                        localUserInfo.member_plan_key = res.member_plan_key;
                    }
                    uni.setStorageSync('userInfo', localUserInfo);
                }
            } catch (err) {
                console.error('获取会员状态失败:', err);
                const localUserInfo = uni.getStorageSync('userInfo') || {};
                const now = Date.now();
                if (localUserInfo.is_vip && localUserInfo.vip_expire_time && localUserInfo.vip_expire_time > now) {
                    this.isVip = true;
                    this.vipExpireTimeText = localUserInfo.vip_expire_time_text || '';
                } else {
                    this.isVip = false;
                }
            } finally {
                this.isLoadingData = false;
            }
        },
        onCouponInput() {
            this.couponValidated = null;
        },
        async revalidateCouponIfNeeded() {
            if (!(this.redeemCode || '').trim()) return;
            try {
                await this.handleValidateCoupon({ silent: true });
            } catch (e) {
                // handleValidateCoupon 已处理提示
            }
        },
        async handleValidateCoupon() {
            if (this.redeemLoading) return;
            const silent = arguments[0] && arguments[0].silent === true;
            const code = (this.redeemCode || '').trim().toUpperCase();
            if (!code) {
                if (!silent) uni.showToast({ title: '请输入优惠码', icon: 'none' });
                return;
            }
            // 整改：优惠码校验依赖登录身份，未登录仅提示，不发起请求（静默模式不弹窗）
            if (!hasToken()) {
                if (!silent) requireLoginAction('校验优惠码');
                return;
            }
            this.redeemLoading = true;
            if (!silent) showLoading('校验中...');
            try {
                const isRenew = this.renewalEntry || this.isVip;
                const data = await validateMemberCouponCode({
                    code,
                    order_type_context: isRenew ? 'renewal' : 'first_open',
                    original_amount: this.priceOriginal,
                    member_tier: this.memberTab === 'enterprise' ? 'enterprise' : 'personal',
                    plan_key: this.selectedPlanKey,
                    member_days: this.currentPlanMeta.days
                });
                if (!silent) hideLoading();
                this.couponValidated = data;
                if (!silent) uni.showToast({ title: '优惠码可用', icon: 'success' });
            } catch (err) {
                if (!silent) hideLoading();
                this.couponValidated = null;
                uni.showToast({ title: (err && err.message) || '不可用，请检查码或有效期', icon: 'none' });
                throw err;
            } finally {
                this.redeemLoading = false;
            }
        },
        async handlePayVip() {
            // 整改：会员支付为关键操作，未登录用户给出可取消的登录提示
            if (!hasToken()) {
                requireLoginAction('开通会员');
                return;
            }
            if (!this.agreedToTerms) {
                showError('请先阅读并勾选会员服务协议');
                return;
            }
            if (this.memberTab === 'personal' && !this.personalMemberEnabled) {
                showError('个人会员暂未开放');
                return;
            }
            if (this.memberTab === 'enterprise' && !this.enterpriseMemberEnabled) {
                showError('企业会员暂未开放');
                return;
            }
            await this.submitPendingMemberOrder();
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
        async pollOrderPaid(orderId, maxTimes = 8) {
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
        async submitPendingMemberOrder() {
            showLoading('正在创建支付订单...');
            try {
                const src = this.getCurrentSalesSource();
                const isRenew = this.renewalEntry || this.isVip;
                const scene = isRenew ? 'renew' : 'new';
                const memberType = this.memberTab === 'enterprise' ? 'enterprise' : 'personal';
                const couponCode = (this.redeemCode || '').trim().toUpperCase();
                if (couponCode && !this.couponValidated) {
                    await this.handleValidateCoupon({ silent: true });
                }
                const res = await createMemberOrderAndGetPayParams({
                    scene,
                    member_type: memberType,
                    plan_type: this.selectedPlanKey,
                    to_plan_type: this.selectedPlanKey,
                    sales_id: src.sales_id || '',
                    channel_id: src.channel_id || '',
                    invite_code: src.invite_code || '',
                    coupon_code: couponCode
                });
                hideLoading();
                if (res && res.zero_pay === true) {
                    await this.loadVipStatus();
                    this.payResult = {
                        order_id: res.order_id,
                        order_no: res.order_no,
                        pay_status: 1
                    };
                    this.showPayResult = true;
                    this.couponValidated = null;
                    this.redeemCode = '';
                    uni.showToast({ title: '开通成功', icon: 'success', duration: 2200 });
                    return;
                }
                if (!res || !res.pay_params || !res.order_id) {
                    throw new Error('支付参数异常，请稍后重试');
                }

                await this.requestPayment(res.pay_params);
                uni.showToast({ title: '支付已受理，正在确认结果', icon: 'none', duration: 2200 });

                const paid = await this.pollOrderPaid(res.order_id, 10);
                await this.loadVipStatus();
                if (paid) {
                    this.payResult = {
                        order_id: res.order_id,
                        order_no: res.order_no,
                        pay_status: 1
                    };
                    this.showPayResult = true;
                    uni.showToast({ title: '开通成功', icon: 'success', duration: 2200 });
                } else {
                    this.payResult = {
                        order_id: res.order_id,
                        order_no: res.order_no,
                        pay_status: 0
                    };
                    this.showPayResult = true;
                    uni.showModal({
                        title: '支付处理中',
                        content: '支付结果正在同步，请稍后进入“我的会员”刷新查看。',
                        showCancel: false
                    });
                }
            } catch (err) {
                hideLoading();
                const msg = (err && err.errMsg) || (err && err.message) || '网络繁忙，请稍后重试';
                if (String(msg).includes('cancel')) {
                    uni.showToast({ title: '已取消支付', icon: 'none' });
                    return;
                }
                uni.showToast({ title: msg, icon: 'none', duration: 2500 });
            }
        },
        applySalesSourceToPage(source) {
            const s = {
                sales_id: (source && source.sales_id) || '',
                channel_id: (source && source.channel_id) || '',
                invite_code: (source && source.invite_code) || ''
            };
            this.salesSourceInfo = { ...s };
            this.sales_id = s.sales_id;
            this.channel_id = s.channel_id;
            this.invite_code = s.invite_code;
        },
        parseSalesSource(options) {
            if (!options) return;
            const decodeParam = (v) => {
                if (v == null || v === '') return '';
                const str = String(v);
                try {
                    return decodeURIComponent(str);
                } catch (e) {
                    return str;
                }
            };
            const source = {
                sales_id: decodeParam(options.sales_id),
                channel_id: decodeParam(options.channel_id),
                invite_code: decodeParam(options.invite_code)
            };
            if (source.sales_id || source.channel_id || source.invite_code) {
                this.applySalesSourceToPage(source);
                saveSalesSourceToStorage(source);
            }
        },
        getCurrentSalesSource() {
            if (this.salesSourceInfo.sales_id || this.salesSourceInfo.channel_id || this.salesSourceInfo.invite_code) {
                return { ...this.salesSourceInfo };
            }
            if (this.sales_id || this.channel_id || this.invite_code) {
                return { sales_id: this.sales_id, channel_id: this.channel_id, invite_code: this.invite_code };
            }
            const cached = getSalesSourceFromStorage();
            return cached || { sales_id: '', channel_id: '', invite_code: '' };
        },
        onAgreementChange(e) {
            this.agreedToTerms = e.detail.value.includes('agreed');
        },
        openAgreement() {
            uni.navigateTo({ url: '/pages/merchant-agreement/merchant-agreement' });
        },
        goToHome() {
            uni.switchTab({ url: '/pages/profile/profile' });
        },
        goToOrders() {
            // 整改：未登录给出可取消的登录提示
            requireLoginAction('会员订单', () => {
                uni.navigateTo({ url: '/pages/member-orders/member-orders' });
            });
        },
        goToLogin() {
            // 整改：使用 navigateTo，不使用 reLaunch，避免清空页面栈，
            // 用户取消登录后仍能返回原页面继续浏览
            uni.navigateTo({
                url: '/pages/login/login',
                fail: () => {
                    uni.redirectTo({ url: '/pages/login/login' });
                }
            });
        }
    }
};
</script>

<style scoped>
@import './open-shop.css';
@import '../../common/member-buttons.css';

.member-center-wrap {
    min-height: 100vh;
    background: #f5f5f5;
    padding-bottom: 200rpx;
}

.vip-strip {
    background: #ecfdf5;
    border-bottom: 1rpx solid #bbf7d0;
    padding: 24rpx 32rpx 28rpx;
}
.vip-strip-title {
    font-size: 30rpx;
    font-weight: bold;
    color: #166534;
    display: block;
}
.vip-strip-sub {
    font-size: 24rpx;
    color: #15803d;
    margin-top: 8rpx;
    display: block;
}
.vip-strip-btns {
    display: flex;
    gap: 20rpx;
    margin-top: 20rpx;
}
.strip-btn {
    flex: 1;
    height: 64rpx;
    line-height: 64rpx;
    font-size: 26rpx;
    border-radius: 32rpx;
    margin: 0;
    padding: 0;
}
.strip-btn.outline {
    background: #fff;
    color: #16a34a;
    border: 2rpx solid #16a34a;
}

.hero-banner {
    background: linear-gradient(135deg, #16a34a, #15803d);
    color: #fff;
    padding: 40rpx 36rpx 48rpx;
}
.hero-title {
    font-size: 44rpx;
    font-weight: bold;
    display: block;
}
.hero-desc {
    font-size: 26rpx;
    color: rgba(255, 255, 255, 0.92);
    margin-top: 16rpx;
    line-height: 1.5;
    display: block;
}

.tab-row {
    display: flex;
    gap: 20rpx;
    margin-bottom: 24rpx;
}
.tab-pill {
    flex: 1;
    text-align: center;
    padding: 20rpx;
    border-radius: 16rpx;
    background: #fff;
    color: #374151;
    font-size: 28rpx;
    border: 2rpx solid #e5e7eb;
}
.tab-pill.tab-on {
    background: #dcfce7;
    color: #166534;
    border-color: #16a34a;
    font-weight: bold;
}
.tab-pill.tab-off {
    opacity: 0.45;
}

.plan-grid {
    display: flex;
    gap: 16rpx;
    margin-bottom: 24rpx;
}
.pkg-card {
    flex: 1;
    background: #f9fafb;
    border-radius: 16rpx;
    padding: 20rpx 12rpx;
    text-align: center;
    border: 2rpx solid #e5e7eb;
}
.pkg-card.pkg-on {
    background: #f0fdf4;
    border-color: #16a34a;
}
.pkg-name {
    font-size: 26rpx;
    color: #374151;
    font-weight: 600;
    display: block;
}
.pkg-price-row {
    margin-top: 8rpx;
    color: #dc2626;
    font-weight: bold;
}
.pkg-yen {
    font-size: 24rpx;
}
.pkg-num {
    font-size: 36rpx;
}
.pkg-days {
    font-size: 22rpx;
    color: #6b7280;
    margin-top: 6rpx;
    display: block;
}
.pkg-save {
    font-size: 22rpx;
    color: #15803d;
    font-weight: 600;
    margin-top: 8rpx;
    display: block;
    line-height: 1.35;
}
.plan-save-line {
    font-size: 26rpx;
    color: #15803d;
    font-weight: 600;
    margin-top: 12rpx;
    display: block;
}

.plan-detail-card {
    border-color: #16a34a !important;
    background: #fff !important;
}
.plan-detail-card .plan-features {
    background: #f0fdf4;
}

/* 套餐详情：立省 / 权益等值强调块 */
.plan-value-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
    margin: 20rpx 0 8rpx;
}
.pv-block {
    flex: 1;
    min-width: 280rpx;
    border-radius: 16rpx;
    padding: 20rpx 22rpx;
    box-sizing: border-box;
}
.pv-equiv {
    background: #fff7ed;
    border: 1rpx solid #fed7aa;
}
.pv-save {
    background: #ecfdf5;
    border: 1rpx solid #bbf7d0;
}
.pv-label {
    display: block;
    font-size: 24rpx;
    font-weight: 600;
    color: #57534e;
    margin-bottom: 8rpx;
}
.pv-equiv .pv-label {
    color: #9a3412;
}
.pv-save .pv-label {
    color: #166534;
}
.pv-num {
    display: block;
    font-size: 44rpx;
    font-weight: 800;
    letter-spacing: -0.5rpx;
    line-height: 1.15;
}
.pv-equiv .pv-num {
    color: #c2410c;
}
.pv-save .pv-num {
    color: #15803d;
}
.pv-hint {
    display: block;
    font-size: 22rpx;
    color: #78716c;
    margin-top: 8rpx;
    line-height: 1.35;
}
.pv-save .pv-hint {
    color: #4d7c0f;
}

/* 权益概览模块 */
.rights-overview-card {
    border: 1rpx solid #e5e7eb;
    overflow: hidden;
}
.rights-overview-head {
    margin: 0 -40rpx 0;
    padding: 0 40rpx 24rpx;
    background: #f8faf8;
    border-bottom: 1rpx solid #e7efe8;
    border-left: 8rpx solid #16a34a;
    padding-left: 32rpx;
}
.rights-head-text {
    flex: 1;
    min-width: 0;
}
.rights-overview-sub {
    display: block;
    margin-top: 8rpx;
    font-size: 24rpx;
    color: #6b7280;
    line-height: 1.4;
}
.rights-metrics {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
    margin-top: 28rpx;
}
.rights-metric {
    flex: 1;
    min-width: 150rpx;
    background: #fafafa;
    border-radius: 14rpx;
    padding: 18rpx 16rpx;
    border: 1rpx solid #f3f4f6;
}
.rm-label {
    display: block;
    font-size: 22rpx;
    color: #6b7280;
    margin-bottom: 8rpx;
}
.rm-value {
    display: block;
    font-size: 30rpx;
    font-weight: 700;
    color: #1f2937;
}
.rm-price {
    font-size: 34rpx;
    color: #b45309;
}
.rm-equiv {
    font-size: 32rpx;
    color: #c2410c;
}
.rights-strip-mini {
    display: flex;
    flex-wrap: wrap;
    gap: 16rpx;
    margin-top: 24rpx;
}
.rsm {
    flex: 1;
    min-width: 260rpx;
    border-radius: 14rpx;
    padding: 16rpx 20rpx;
}
.rsm-equiv {
    background: #fffbeb;
    border: 1rpx solid #fde68a;
}
.rsm-save {
    background: #f0fdf4;
    border: 1rpx solid #bbf7d0;
}
.rsm-label {
    display: block;
    font-size: 22rpx;
    color: #57534e;
    margin-bottom: 6rpx;
}
.rsm-equiv .rsm-label {
    color: #9a3412;
}
.rsm-save .rsm-label {
    color: #166534;
}
.rsm-num {
    font-size: 36rpx;
    font-weight: 800;
    color: #c2410c;
}
.rsm-save .rsm-num {
    color: #15803d;
}
.rights-bullets-wrap {
    margin-top: 24rpx;
    padding-top: 20rpx;
    border-top: 1rpx solid #f3f4f6;
    display: flex;
    flex-direction: column;
    gap: 12rpx;
}
.rights-bullets-wrap .bullet-line {
    font-size: 26rpx;
    color: #4b5563;
    line-height: 1.45;
}

.bullets {
    display: flex;
    flex-direction: column;
    gap: 12rpx;
}
.bullet-line {
    font-size: 26rpx;
    color: #374151;
    line-height: 1.45;
}

.compare-row-emphasis .c-cell {
    font-weight: 700;
    font-size: 24rpx;
    padding-top: 18rpx;
    padding-bottom: 18rpx;
}
.compare-row-emphasis .c-cell.small {
    font-size: 24rpx;
}
.compare-row-emphasis .c-cell.w1 {
    color: #44403c;
}
.compare-row-emphasis .c-cell:not(.w1) {
    color: #1c1917;
}

.compare-table {
    border: 1rpx solid #e5e7eb;
    border-radius: 12rpx;
    overflow: hidden;
}
.compare-row {
    display: flex;
    border-bottom: 1rpx solid #f3f4f6;
}
.compare-row:last-child {
    border-bottom: none;
}
.compare-head {
    background: #f9fafb;
    font-weight: 600;
}
.c-cell {
    flex: 1;
    padding: 16rpx 8rpx;
    font-size: 22rpx;
    text-align: center;
    word-break: break-all;
}
.c-cell.w1 {
    flex: 1.15;
    text-align: left;
    padding-left: 16rpx;
}
.c-cell.muted {
    color: #6b7280;
}
.c-cell.small {
    font-size: 20rpx;
}

.promo-intro {
    font-size: 26rpx;
    color: #4b5563;
    margin-bottom: 16rpx;
    display: block;
}
.price-matrix {
    background: #fafafa;
    border-radius: 12rpx;
    padding: 16rpx;
}
.price-matrix.mt {
    margin-top: 20rpx;
}
.matrix-title {
    font-size: 26rpx;
    font-weight: bold;
    color: #111827;
    display: block;
    margin-bottom: 12rpx;
}
.matrix-row {
    display: flex;
    border-top: 1rpx solid #eee;
}
.matrix-row.head {
    border-top: none;
    font-weight: 600;
    color: #374151;
}
.matrix-row text {
    flex: 1;
    text-align: center;
    font-size: 22rpx;
    padding: 10rpx 4rpx;
}
.matrix-row text:first-child {
    flex: 1.2;
    text-align: left;
}
.promo-tip {
    font-size: 22rpx;
    color: #6b7280;
    margin-top: 16rpx;
    display: block;
    line-height: 1.4;
}

/* 步骤 3、4：重点提示区 — 柔和纯色浅黄，无渐变 */
.form-card.member-gold-card .compare-table {
    background: #fdf8eb;
    border: 1rpx solid #e8dcc4;
}
.form-card.member-gold-card .compare-head {
    background: #f5edd8;
    color: #57534e;
}
.form-card.member-gold-card .compare-row-emphasis {
    background: #faf6ee;
}
.form-card.member-gold-card .compare-row {
    border-bottom-color: #ebe5d8;
}
.form-card.member-gold-card .c-cell.muted {
    color: #57534e;
}
.form-card.member-gold-card .c-cell.small {
    color: #44403c;
}
.form-card.member-gold-card .price-matrix {
    background: #fdf8eb;
    border: 1rpx solid #e8dcc4;
    padding: 20rpx;
}
.form-card.member-gold-card .matrix-title {
    color: #57534e;
    margin-bottom: 14rpx;
}
.form-card.member-gold-card .matrix-row {
    border-top-color: #ebe5d8;
}
.form-card.member-gold-card .matrix-row.head {
    color: #57534e;
}
.form-card.member-gold-card .matrix-row text {
    color: #44403c;
    padding-top: 14rpx;
    padding-bottom: 14rpx;
}
.form-card.member-gold-card .promo-intro,
.form-card.member-gold-card .promo-tip {
    color: #57534e;
}

.faq-item {
    margin-bottom: 24rpx;
}
.faq-q {
    font-size: 28rpx;
    font-weight: 600;
    color: #1f2937;
    display: block;
    margin-bottom: 8rpx;
}
.faq-a {
    font-size: 24rpx;
    color: #6b7280;
    line-height: 1.5;
    display: block;
}

.bottom-placeholder {
    height: 140rpx;
}
.bottom-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.96);
    box-shadow: 0 -4rpx 20rpx rgba(0, 0, 0, 0.06);
    z-index: 50;
}
.inline-submit {
    margin-top: 8rpx;
}

.status-page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 100rpx 40rpx;
    background: #fff;
    min-height: 60vh;
}
.status-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
}
.status-message {
    font-size: 34rpx;
    color: #333;
    margin-top: 40rpx;
    margin-bottom: 20rpx;
    font-weight: bold;
}
.success-btn {
    width: 80%;
    height: 88rpx;
    line-height: 88rpx;
    background-color: #16a34a;
    color: #fff;
    border-radius: 44rpx;
    font-size: 32rpx;
    font-weight: bold;
    border: none;
}
.success-btn::after {
    border: none;
}
.pay-result-confirm-btn {
    margin-top: 20rpx;
    height: 70rpx;
    line-height: normal;
    padding: 0;
    font-size: 28rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}
.redeem-header {
    margin-top: 10rpx;
}
.redeem-desc {
    font-size: 24rpx;
    color: #666;
    display: block;
}
.redeem-body {
    display: flex;
    align-items: center;
    margin-top: 16rpx;
}
.redeem-input {
    flex: 1;
    height: 72rpx;
    background-color: #f5f5f5;
    border-radius: 8rpx;
    padding: 0 20rpx;
    font-size: 28rpx;
    margin-right: 20rpx;
    border: 1px solid #e5e7eb;
}
.redeem-btn {
    width: 200rpx;
    height: 72rpx;
    line-height: 72rpx;
    background-color: #16a34a;
    color: #fff;
    font-size: 28rpx;
    border-radius: 8rpx;
    margin: 0;
    padding: 0;
    text-align: center;
}
.redeem-btn[disabled] {
    background-color: #9ca3af;
}
.result-card {
    border: 2rpx solid #16a34a;
    background-color: #f0fdf4;
}
.result-card-pending {
    border-color: #ca8a04;
    background-color: #fffbeb;
}
.result-hint {
    font-size: 26rpx;
    color: #854d0e;
    line-height: 1.55;
    margin-bottom: 16rpx;
}
.mono-small {
    font-size: 22rpx;
    font-family: monospace;
    word-break: break-all;
}
.result-body {
    padding: 20rpx 0;
}
.result-item {
    display: flex;
    justify-content: space-between;
    margin-bottom: 16rpx;
    font-size: 28rpx;
}
.result-label {
    color: #666;
}
.result-value {
    color: #333;
    font-weight: bold;
}
.coupon-preview {
    margin-top: 16rpx;
    padding: 16rpx 20rpx;
    background: #f0fdf4;
    border-radius: 12rpx;
    border: 1rpx solid #bbf7d0;
}
.coupon-preview .cp-line {
    display: block;
    font-size: 24rpx;
    line-height: 1.5;
    color: #166534;
}
.coupon-preview .cp-line.warn {
    color: #a16207;
    margin-top: 8rpx;
}
</style>
