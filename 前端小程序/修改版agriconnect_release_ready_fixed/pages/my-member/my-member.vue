<template>
    <view class="page">
        <view v-if="!hasLogin" class="card center">
            <text class="muted">请先登录</text>
            <button class="btn primary" @tap="goLogin">去登录</button>
        </view>
        <view v-else-if="loading" class="card center"><text class="muted">加载中…</text></view>
        <view v-else>
            <view class="card status-card">
                <text class="tag">{{ memberTypeLabel }}</text>
                <text class="line big">{{ isMemberActive ? '会员已生效' : '当前非会员' }}</text>
                <text v-if="memberExpireTimeText" class="line">到期时间：{{ memberExpireTimeText }}</text>
                <text v-else-if="isMemberActive" class="line muted">到期时间以服务端为准</text>
            </view>

            <view class="card rights-overview-card">
                <view class="rights-overview-topband">
                    <view class="rights-overview-title-row">
                        <text class="rights-overview-h1">本月权益摘要</text>
                    </view>
                    <text class="rights-overview-sub">联系次数按月统计；赠送置顶 / 加急曝光为「天数」额度，以运营配置与当前套餐为准。</text>
                </view>
                <text class="hint rights-overview-hint">总额度来自运营配置；已使用与剩余由服务端根据账号统计。</text>

                <text class="sub-sec">联系采购方</text>
                <view class="row"><text class="k">总额度</text><text class="v">{{ contact_quota_total }} 次/月</text></view>
                <view class="row"><text class="k">已使用</text><text class="v">{{ contact_quota_used }} 次</text></view>
                <view class="row"><text class="k">剩余</text><text class="v">{{ contact_quota_left }} 次</text></view>

                <text class="sub-sec mt">赠送置顶</text>
                <view class="row"><text class="k">总天数</text><text class="v">{{ gift_top_total }} 天（当前套餐）</text></view>
                <view class="row"><text class="k">已使用</text><text class="v">{{ gift_top_used }} 天</text></view>
                <view class="row"><text class="k">剩余</text><text class="v">{{ gift_top_left }} 天</text></view>

                <text class="sub-sec mt">赠送加急曝光</text>
                <view class="row"><text class="k">总天数</text><text class="v">{{ gift_boost_total }} 天（当前套餐）</text></view>
                <view class="row"><text class="k">已使用</text><text class="v">{{ gift_boost_used }} 天</text></view>
                <view class="row"><text class="k">剩余</text><text class="v">{{ gift_boost_left }} 天</text></view>
                <view class="rights-gold-accent" aria-hidden="true"></view>
            </view>

            <view class="card benefit-card">
                <text class="sec-title">当前权益说明</text>
                <text class="para">{{ benefitText }}</text>
            </view>

            <view class="card compare-card">
                <view class="compare-inner">
                    <view class="compare-head-band">
                        <text class="compare-title-main">会员权益对比</text>
                        <text class="compare-title-sub">个人会员 vs 企业会员</text>
                        <text v-if="compareTablePlanLabel" class="compare-plan-hint">对比口径：同档位（{{ compareTablePlanLabel }}）套餐；「立省」为相对月卡连买；「等值」为赠送置顶/加急按非会员单买价折算（以配置为准）。</text>
                        <view v-if="member_type === 'enterprise'" class="compare-lead">
                            <text class="compare-lead-txt">当前身份：</text>
                            <text class="compare-lead-hi">企业会员</text>
                            <text class="compare-lead-txt">。上表仅对比「立省」与「等值」两项，其余权益请见「本月权益摘要」与「当前权益说明」。</text>
                        </view>
                        <view v-else class="compare-lead">
                            <text class="compare-lead-txt">当前身份：</text>
                            <text class="compare-lead-hi">{{ memberTypeLabel }}</text>
                            <text class="compare-lead-txt">。上表仅对比「立省」与「等值」两项；升级企业可前往底部操作区。</text>
                        </view>
                    </view>
                    <text class="rule-hint">
                        升级说明：「升级企业会员」按剩余时间折算应付金额，到期日不变，仅变更会员类型与权益。「升级季卡/年卡」按目标套餐标价支付，在现到期日上顺延完整季/年天数，剩余时长保留。
                    </text>
                    <view class="mp-table-wrap">
                        <view class="mp-table">
                            <view class="mp-tr mp-tr-head">
                                <view class="mp-th mp-th-label">权益</view>
                                <view class="mp-th mp-th-per" :class="{ 'is-current': member_type === 'personal' }">
                                    <text class="mp-th-title">个人会员</text>
                                </view>
                                <view class="mp-th mp-th-ent" :class="{ 'is-current': member_type === 'enterprise' }">
                                    <text class="mp-th-title">企业会员</text>
                                    <view class="mp-th-badge">推荐</view>
                                </view>
                            </view>
                            <view v-for="(row, idx) in memberCompareRows" :key="idx" class="mp-tr" :class="{ 'mp-tr-alt': idx % 2 === 1 }">
                                <view class="mp-td mp-td-label">{{ row.label }}</view>
                                <view class="mp-td mp-td-per" :class="{ 'is-current': member_type === 'personal' }">
                                    <text class="mp-td-val">{{ row.personal }}</text>
                                </view>
                                <view class="mp-td mp-td-ent" :class="{ 'is-current': member_type === 'enterprise' }">
                                    <text class="mp-td-val mp-td-val-strong">{{ row.enterprise }}</text>
                                </view>
                            </view>
                        </view>
                    </view>
                </view>
                <view class="compare-gold-rail" aria-hidden="true"></view>
            </view>
        </view>

        <view v-if="hasLogin && !loading && isMemberActive" class="bottom-sheet">
            <!-- 个人 · 月卡 -->
            <template v-if="member_type === 'personal' && member_plan_key === 'month'">
                <view class="btn-row2">
                    <button class="member-outline-btn-lg half" @tap="goRenewPersonal">续费个人会员</button>
                    <button class="member-outline-btn-lg half" @tap="onPeriodUpgrade('quarter')">升级个人季卡</button>
                </view>
                <button class="member-outline-btn-lg full-row" @tap="onPeriodUpgrade('year')">升级个人年卡</button>
                <button class="member-primary-btn-lg full-row" @tap="onUpgradeEnterprise">升级企业会员</button>
            </template>
            <!-- 企业 · 月卡 -->
            <template v-else-if="member_type === 'enterprise' && member_plan_key === 'month'">
                <view class="btn-row2">
                    <button class="member-outline-btn-lg half" @tap="goRenewEnterprise">续费企业会员</button>
                    <button class="member-outline-btn-lg half" @tap="onPeriodUpgrade('quarter')">升级企业季卡</button>
                </view>
                <button class="member-outline-btn-lg full-row" @tap="onPeriodUpgrade('year')">升级企业年卡</button>
            </template>
            <!-- 个人 · 季卡 -->
            <template v-else-if="member_type === 'personal' && member_plan_key === 'quarter'">
                <view class="btn-row2">
                    <button class="member-outline-btn-lg half" @tap="goRenewPersonal">续费个人会员</button>
                    <button class="member-outline-btn-lg half" @tap="onPeriodUpgrade('year')">升级个人年卡</button>
                </view>
                <button class="member-primary-btn-lg full-row" @tap="onUpgradeEnterprise">升级企业会员</button>
            </template>
            <!-- 企业 · 季卡 -->
            <template v-else-if="member_type === 'enterprise' && member_plan_key === 'quarter'">
                <view class="btn-row2">
                    <button class="member-outline-btn-lg half" @tap="goRenewEnterprise">续费企业会员</button>
                    <button class="member-outline-btn-lg half" @tap="onPeriodUpgrade('year')">升级企业年卡</button>
                </view>
            </template>
            <!-- 个人 · 年卡：仅续费 + 类型升级 -->
            <template v-else-if="member_type === 'personal' && member_plan_key === 'year'">
                <button class="member-outline-btn-lg full-row" @tap="goRenewPersonal">续费个人会员</button>
                <button class="member-primary-btn-lg full-row" @tap="onUpgradeEnterprise">升级企业会员</button>
            </template>
            <!-- 企业 · 年卡 -->
            <template v-else-if="member_type === 'enterprise' && member_plan_key === 'year'">
                <button class="member-primary-btn-lg full-row" @tap="goRenewEnterprise">续费企业会员</button>
            </template>
            <!-- 无法识别当前周期：续费 +（个人）企业类型升级 -->
            <template v-else>
                <button v-if="member_type === 'personal'" class="member-outline-btn-lg full-row" @tap="goRenewPersonal">续费个人会员</button>
                <button v-if="member_type === 'enterprise'" class="member-outline-btn-lg full-row" @tap="goRenewEnterprise">续费企业会员</button>
                <button v-if="member_type === 'personal'" class="member-primary-btn-lg full-row" @tap="onUpgradeEnterprise">升级企业会员</button>
            </template>
        </view>
    </view>
</template>

<script>
import {
    getUserInfo,
    getMembershipPromotionConfig,
    previewUpgradeEnterpriseMember,
    previewUpgradePlanPeriod,
    createMemberOrderAndGetPayParams,
    getMemberOrderPayStatus,
    getSalesSourceFromStorage
} from '../../utils/api.js';
import { membershipPromotionDefaults } from '../../utils/membershipPromotionDefaults.js';
import { mergeRightsForTierPlan } from '../../utils/memberConfigRights.js';
import { equivalentGiftValueYuan, packageVsMonthlySaveYuan, resolveMembershipConfigForDisplay } from '../../utils/memberPricingMarketing.js';
import { showLoading, hideLoading } from '../../utils/util.js';

export default {
    data() {
        return {
            hasLogin: false,
            loading: true,
            mpConfig: null,
            member_type: 'free',
            is_member_active: false,
            member_expire_time_text: '',
            member_plan_key: '',
            contact_quota_total: 0,
            contact_quota_used: 0,
            contact_quota_left: 0,
            gift_top_total: 0,
            gift_top_used: 0,
            gift_top_left: 0,
            gift_boost_total: 0,
            gift_boost_used: 0,
            gift_boost_left: 0
        };
    },
    computed: {
        mpCfg() {
            return resolveMembershipConfigForDisplay(
                this.mpConfig && typeof this.mpConfig === 'object' ? this.mpConfig : membershipPromotionDefaults
            );
        },
        isMemberActive() {
            return this.is_member_active === true;
        },
        memberExpireTimeText() {
            return this.member_expire_time_text || '';
        },
        memberTypeLabel() {
            const m = {
                free: '免费用户',
                personal: '个人会员',
                enterprise: '企业会员'
            };
            return m[this.member_type] || '免费用户';
        },
        rightsForCurrent() {
            if (this.member_type !== 'personal' && this.member_type !== 'enterprise') return null;
            const pk = this.compareTablePlanKey;
            return mergeRightsForTierPlan(this.mpCfg, this.member_type, pk, membershipPromotionDefaults);
        },
        /** 与当前会员套餐周期一致，供对比表与同档位「立省/等值」口径 */
        compareTablePlanKey() {
            return ['month', 'quarter', 'year'].includes(this.member_plan_key) ? this.member_plan_key : 'month';
        },
        compareTablePlanLabel() {
            const m = { month: '月卡', quarter: '季卡', year: '年卡' };
            return m[this.compareTablePlanKey] || '月卡';
        },
        benefitText() {
            const sw = this.mpCfg.feature_switches || {};
            const onlyMem = sw.purchase_contact_member_only !== false;
            if (this.member_type === 'enterprise' && this.rightsForCurrent) {
                const r = this.rightsForCurrent;
                const gt = r.gift_top_days != null ? r.gift_top_days : r.gift_top_count || 0;
                const gb = r.gift_boost_days != null ? r.gift_boost_days : r.gift_boost_count || 0;
                return `企业会员（当前套餐）：联系采购方 ${r.contact_purchase_quota} 次/月；本套餐赠送置顶 ${gt} 天、加急曝光 ${gb} 天；优先展示：${r.priority_display ? '是' : '否'}；完整数据：${r.full_data_access ? '是' : '否'}；企业标识：${r.enterprise_badge ? '展示' : '不展示'}。推广价格以会员中心为准。`;
            }
            if (this.member_type === 'personal' && this.rightsForCurrent) {
                const r = this.rightsForCurrent;
                const gt = r.gift_top_days != null ? r.gift_top_days : r.gift_top_count || 0;
                const gb = r.gift_boost_days != null ? r.gift_boost_days : r.gift_boost_count || 0;
                return `个人会员（当前套餐）：联系采购方 ${r.contact_purchase_quota} 次/月；本套餐赠送置顶 ${gt} 天、加急曝光 ${gb} 天；优先展示：${r.priority_display ? '是' : '否'}；经营数据：${r.full_data_access ? '完整' : '基础'}。`;
            }
            return `免费用户：可浏览与发布采购/供应。${onlyMem ? '联系采购方需开通会员（当前平台规则）。' : '联系采购方规则以平台为准。'}`;
        },
        /** 同档位只展示「立省 + 等值」两行（与 open-shop 口径一致） */
        memberCompareRows() {
            const pk = this.compareTablePlanKey;
            const saveP = packageVsMonthlySaveYuan(this.mpCfg, 'personal', pk);
            const saveE = packageVsMonthlySaveYuan(this.mpCfg, 'enterprise', pk);
            const saveTxt = (n) => (n > 0 ? `省${n}元` : '—');
            const eqP = equivalentGiftValueYuan(this.mpCfg, 'personal', pk);
            const eqE = equivalentGiftValueYuan(this.mpCfg, 'enterprise', pk);
            const eqCell = (v) => (v != null && Number.isFinite(v) ? `${v}元` : '—');
            return [
                { label: '相对月卡立省', personal: saveTxt(saveP), enterprise: saveTxt(saveE) },
                { label: '赠送权益等值', personal: eqCell(eqP), enterprise: eqCell(eqE) }
            ];
        }
    },
    onShow() {
        this.refresh();
    },
    methods: {
        async refresh() {
            const token = uni.getStorageSync('token');
            const u = uni.getStorageSync('userInfo');
            if (!token || !u) {
                this.hasLogin = false;
                this.loading = false;
                return;
            }
            this.hasLogin = true;
            this.loading = true;
            const userId = u._id || u.user_id || u.id;
            try {
                const [cfg, res] = await Promise.all([
                    getMembershipPromotionConfig().catch(() => membershipPromotionDefaults),
                    getUserInfo(userId).catch(() => null)
                ]);
                this.mpConfig = cfg;
                if (res) {
                    this.applyStatus(res);
                } else {
                    await this.applyStatusFromLocal();
                }
            } catch (e) {
                console.warn('refresh my-member', e);
                this.mpConfig = membershipPromotionDefaults;
                await this.applyStatusFromLocal();
            } finally {
                this.loading = false;
                if (this.hasLogin && !this.isMemberActive) {
                    uni.redirectTo({ url: '/pages/open-shop/open-shop' });
                }
            }
        },
        applyStatus(res) {
            if (!res) {
                this.applyStatusFromLocal();
                return;
            }
            this.member_type = res.member_type || 'free';
            this.is_member_active = res.is_member_active === true || res.is_vip === true;
            this.member_expire_time_text = res.member_expire_time_text || res.vip_expire_time_text || '';
            this.member_plan_key = res.member_plan_key || '';
            const rights = this.rightsForCurrent;
            const pickTotal = (a, b, fallback) => {
                if (a != null && a !== '' && !Number.isNaN(Number(a))) return Number(a);
                if (b != null && b !== '' && !Number.isNaN(Number(b))) return Number(b);
                return Number(fallback) || 0;
            };
            const cqTotal = pickTotal(res.contact_quota_total, null, rights ? rights.contact_purchase_quota : 0);
            const gtFb = rights ? (rights.gift_top_days != null ? rights.gift_top_days : rights.gift_top_count) : 0;
            const gbFb = rights ? (rights.gift_boost_days != null ? rights.gift_boost_days : rights.gift_boost_count) : 0;
            const gtTotal = pickTotal(res.gift_top_days_total, res.gift_top_total, gtFb);
            const gbTotal = pickTotal(res.gift_boost_days_total, res.gift_boost_total, gbFb);
            const cqUsed = Number(res.contact_quota_used) || 0;
            const gtUsed = Number(res.gift_top_used) || 0;
            const gbUsed = Number(res.gift_boost_used) || 0;
            this.contact_quota_total = cqTotal;
            this.contact_quota_used = cqUsed;
            this.contact_quota_left = Math.max(0, cqTotal - cqUsed);
            this.gift_top_total = gtTotal;
            this.gift_top_used = gtUsed;
            this.gift_top_left = Math.max(0, gtTotal - gtUsed);
            this.gift_boost_total = gbTotal;
            this.gift_boost_used = gbUsed;
            this.gift_boost_left = Math.max(0, gbTotal - gbUsed);

            const local = uni.getStorageSync('userInfo') || {};
            const merged = { ...local, ...res };
            uni.setStorageSync('userInfo', merged);
        },
        async applyStatusFromLocal() {
            const u = uni.getStorageSync('userInfo') || {};
            const now = Date.now();
            let expTs = 0;
            const vx = u.vip_expire_time;
            if (vx instanceof Date) expTs = vx.getTime();
            else if (vx) {
                const t = new Date(vx).getTime();
                expTs = Number.isNaN(t) ? 0 : t;
            }
            const active = !!(u.is_vip && expTs > now);
            let mt = u.member_type || 'free';
            if (!active) mt = 'free';
            else if (mt !== 'enterprise' && mt !== 'personal') mt = 'personal';
            this.member_type = mt;
            this.is_member_active = active;
            this.member_expire_time_text = u.vip_expire_time_text || '';
            this.member_plan_key = u.member_plan_key || '';
            const r = this.rightsForCurrent;
            const cq = r ? r.contact_purchase_quota : 0;
            this.contact_quota_total = cq;
            this.contact_quota_used = Number(u.contact_quota_used) || 0;
            this.contact_quota_left = Math.max(0, cq - this.contact_quota_used);
            const gt = r ? (r.gift_top_days != null ? r.gift_top_days : r.gift_top_count || 0) : 0;
            this.gift_top_total = gt;
            this.gift_top_used = Number(u.gift_top_used) || 0;
            this.gift_top_left = Math.max(0, gt - this.gift_top_used);
            const gb = r ? (r.gift_boost_days != null ? r.gift_boost_days : r.gift_boost_count || 0) : 0;
            this.gift_boost_total = gb;
            this.gift_boost_used = Number(u.gift_boost_used) || 0;
            this.gift_boost_left = Math.max(0, gb - this.gift_boost_used);
        },
        goLogin() {
            uni.reLaunch({ url: '/pages/login/login' });
        },
        buildRenewUrl(tab) {
            let url = `/pages/open-shop/open-shop?renew=1&tab=${tab}`;
            const pk = this.member_plan_key || '';
            if (['month', 'quarter', 'year'].includes(pk)) {
                url += `&plan_key=${encodeURIComponent(pk)}`;
            }
            return url;
        },
        goRenewPersonal() {
            uni.navigateTo({ url: this.buildRenewUrl('personal') });
        },
        goRenewEnterprise() {
            uni.navigateTo({ url: this.buildRenewUrl('enterprise') });
        },
        async onUpgradeEnterprise() {
            if (this.member_type !== 'personal') return;
            showLoading('正在计算升级金额…');
            let preview;
            try {
                const src = getSalesSourceFromStorage() || {};
                preview = await previewUpgradeEnterpriseMember({
                    sales_id: src.sales_id || '',
                    channel_id: src.channel_id || '',
                    invite_code: src.invite_code || ''
                });
            } catch (err) {
                hideLoading();
                uni.showToast({ title: (err && err.message) || '预览失败', icon: 'none' });
                return;
            }
            hideLoading();
            if (!preview || preview.upgrade_pay == null) {
                uni.showToast({ title: '无法计算升级金额', icon: 'none' });
                return;
            }
            const planLabel =
                preview.plan_key === 'month' ? '月卡' : preview.plan_key === 'quarter' ? '季卡' : preview.plan_key === 'year' ? '年卡' : '—';
            const lines = [
                '【个人会员 → 企业会员】',
                `当前到期时间：${preview.vip_expire_time_text || '见会员中心'}`,
                `计价参考档位（个人）：${planLabel}（与服务端一致）`,
                `个人剩余价值（折算）：¥${preview.remaining_value}`,
                `企业同档套餐标价：¥${preview.enterprise_price}`,
                `本次升级应付金额：¥${preview.upgrade_pay}`,
                '',
                '支付成功后：会员类型变更为「企业会员」，权益按企业会员执行；到期时间不变，不延长当前到期日。',
                '（本升级非「周期顺延」：不按目标套餐在到期日上叠加整段季/年天数。）'
            ].join('\n');
            uni.showModal({
                title: '企业类型升级',
                content: lines,
                confirmText: '去支付',
                cancelText: '取消',
                success: async (modalRes) => {
                    if (!modalRes.confirm) return;
                    await this.submitUpgradeOrder();
                }
            });
        },
        async onPeriodUpgrade(targetPlanKey) {
            if (!['quarter', 'year'].includes(targetPlanKey)) return;
            showLoading('正在加载周期升级说明…');
            let preview;
            try {
                const src = getSalesSourceFromStorage() || {};
                preview = await previewUpgradePlanPeriod({
                    target_plan_key: targetPlanKey,
                    sales_id: src.sales_id || '',
                    channel_id: src.channel_id || '',
                    invite_code: src.invite_code || ''
                });
            } catch (err) {
                hideLoading();
                uni.showToast({ title: (err && err.message) || '预览失败', icon: 'none' });
                return;
            }
            hideLoading();
            if (!preview || preview.pay_amount == null) {
                uni.showToast({ title: '无法预览周期升级', icon: 'none' });
                return;
            }
            const currentPkg = `${preview.member_tier_label}会员${preview.current_plan_label}`;
            const targetPkg = `${preview.member_tier_label}会员${preview.target_plan_label}`;
            const extendHint =
                preview.target_plan_key === 'quarter'
                    ? '月卡→季卡：在原到期日基础上顺延 90 天。'
                    : preview.current_plan_key === 'month'
                      ? '月卡→年卡：在原到期日基础上顺延 365 天。'
                      : '季卡→年卡：在原到期日基础上顺延 365 天。';
            const tierShort = preview.member_tier_label || '';
            const tgtShort = preview.target_plan_label || '';
            const payLine =
                tierShort && tgtShort ? `升级${tierShort}${tgtShort}：支付 ${preview.pay_amount} 元` : `本次支付金额：${preview.pay_amount} 元`;
            const lines = [
                '【会员周期升级】',
                `当前套餐：${currentPkg}`,
                `当前到期时间：${preview.vip_expire_time_text || '—'}`,
                `升级后套餐：${targetPkg}`,
                payLine,
                '（金额为当前目标套餐标价，不按剩余时长抵扣。）',
                '',
                extendHint,
                `升级成功后：新到期时间 = 当前到期时间 + ${preview.target_days} 天（完整目标周期）。`,
                '当前剩余会员时间保留，不会清零；不从今日重新起算完整周期。'
            ].join('\n');
            uni.showModal({
                title: '周期档位升级',
                content: lines,
                confirmText: '去支付',
                cancelText: '取消',
                success: async (modalRes) => {
                    if (!modalRes.confirm) return;
                    await this.submitPeriodUpgradePay(targetPlanKey);
                }
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
                    if (status && status.is_paid) return true;
                } catch (_e) {}
                await new Promise((r) => setTimeout(r, 1200));
            }
            return false;
        },
        async submitPeriodUpgradePay(targetPlanKey) {
            showLoading('正在创建支付订单…');
            try {
                const src = getSalesSourceFromStorage() || {};
                const res = await createMemberOrderAndGetPayParams({
                    scene: 'upgrade_plan',
                    member_type: this.member_type === 'enterprise' ? 'enterprise' : 'personal',
                    plan_type: targetPlanKey,
                    from_plan_type: this.member_plan_key || '',
                    to_plan_type: targetPlanKey,
                    sales_id: src.sales_id || '',
                    channel_id: src.channel_id || '',
                    invite_code: src.invite_code || ''
                });
                hideLoading();
                if (!res || !res.order_id || !res.pay_params) {
                    throw new Error('支付参数异常，请稍后重试');
                }
                await this.requestPayment(res.pay_params);
                uni.showToast({ title: '支付已受理，正在确认结果', icon: 'none' });
                const paid = await this.pollOrderPaid(res.order_id, 10);
                await this.refresh();
                if (paid) {
                    uni.showToast({ title: '周期升级已生效', icon: 'success' });
                } else {
                    uni.showModal({
                        title: '支付处理中',
                        content: '请到会员订单页查看并可继续支付。',
                        showCancel: false
                    });
                    return;
                }
            } catch (err) {
                hideLoading();
                const msg = (err && err.errMsg) || (err && err.message) || '发起支付失败';
                if (String(msg).includes('cancel')) {
                    uni.showToast({ title: '已取消支付', icon: 'none' });
                    return;
                }
                uni.showToast({ title: msg, icon: 'none' });
            }
        },
        async submitUpgradeOrder() {
            showLoading('正在创建支付订单…');
            try {
                const src = getSalesSourceFromStorage() || {};
                const res = await createMemberOrderAndGetPayParams({
                    scene: 'upgrade_member_type',
                    member_type: 'enterprise',
                    plan_type: this.member_plan_key || 'month',
                    from_plan_type: this.member_plan_key || '',
                    to_plan_type: this.member_plan_key || 'month',
                    sales_id: src.sales_id || '',
                    channel_id: src.channel_id || '',
                    invite_code: src.invite_code || ''
                });
                hideLoading();
                if (!res || !res.order_id || !res.pay_params) {
                    throw new Error('支付参数异常，请稍后重试');
                }
                await this.requestPayment(res.pay_params);
                uni.showToast({ title: '支付已受理，正在确认结果', icon: 'none' });
                const paid = await this.pollOrderPaid(res.order_id, 10);
                await this.refresh();
                if (paid) {
                    uni.showToast({ title: '企业类型升级已生效', icon: 'success' });
                } else {
                    uni.showModal({
                        title: '支付处理中',
                        content: '请到会员订单页查看并可继续支付。',
                        showCancel: false
                    });
                }
            } catch (err) {
                hideLoading();
                const msg = (err && err.errMsg) || (err && err.message) || '发起支付失败';
                if (String(msg).includes('cancel')) {
                    uni.showToast({ title: '已取消支付', icon: 'none' });
                    return;
                }
                uni.showToast({ title: msg, icon: 'none' });
            }
        }
    }
};
</script>

<style scoped>
@import '../../common/member-buttons.css';

.page {
    min-height: 100vh;
    background: #f5f5f5;
    padding: 24rpx 24rpx 560rpx;
}
.card {
    background: #fff;
    border-radius: 20rpx;
    padding: 28rpx;
    margin-bottom: 24rpx;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.status-card {
    background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);
}
.center {
    text-align: center;
}
.status-card .tag {
    display: inline-block;
    background: rgba(255, 255, 255, 0.18);
    color: #ffffff;
    font-size: 24rpx;
    padding: 8rpx 20rpx;
    border-radius: 999rpx;
    margin-bottom: 16rpx;
}
.line {
    display: block;
    font-size: 28rpx;
    color: #374151;
    margin-top: 8rpx;
}
.status-card .line {
    color: rgba(255, 255, 255, 0.88);
}
.line.big {
    font-size: 32rpx;
    font-weight: bold;
    color: #111827;
}
.status-card .line.big {
    color: #ffffff;
}
.sec-title {
    font-size: 30rpx;
    font-weight: bold;
    color: #1f2937;
    display: block;
    margin-bottom: 16rpx;
}
.benefit-card {
    background: #fff7d6;
}
.benefit-card .sec-title {
    color: #92400e;
}
.benefit-card .para {
    font-weight: 600;
    color: #7c5a12;
}
.hint {
    font-size: 22rpx;
    color: #9ca3af;
    display: block;
    margin-bottom: 12rpx;
}
.row {
    display: flex;
    justify-content: space-between;
    font-size: 26rpx;
    padding: 12rpx 0;
    border-bottom: 1rpx solid #f3f4f6;
}
.row:last-child {
    border-bottom: none;
}
.k {
    color: #6b7280;
}
.v {
    color: #111827;
    font-weight: 500;
    text-align: right;
    max-width: 62%;
}
.sub-sec {
    display: block;
    font-size: 26rpx;
    font-weight: bold;
    color: #374151;
    margin-top: 8rpx;
    margin-bottom: 4rpx;
}
.sub-sec.mt {
    margin-top: 20rpx;
}
.para {
    font-size: 26rpx;
    color: #4b5563;
    line-height: 1.55;
}
.rights-overview-card {
    position: relative;
    overflow: hidden;
    border: 1rpx solid #e8ebe8;
    padding-top: 0;
    box-shadow: 0 4rpx 22rpx rgba(22, 101, 52, 0.06);
}
.rights-overview-topband {
    margin: 0 -28rpx 20rpx;
    padding: 24rpx 28rpx 22rpx;
    background: linear-gradient(118deg, #ecfdf5 0%, #ffffff 42%, #fffdf7 100%);
    border-bottom: 2rpx solid rgba(239, 212, 138, 0.45);
    border-radius: 20rpx 20rpx 0 0;
}
.rights-overview-title-row {
    display: flex;
    align-items: center;
    gap: 16rpx;
    margin-bottom: 10rpx;
}
.rights-num {
    width: 44rpx;
    height: 44rpx;
    border-radius: 999rpx;
    flex-shrink: 0;
    font-size: 22rpx;
    font-weight: bold;
    color: #166534;
    background: linear-gradient(160deg, #fffbeb, #f3e3a1);
    border: 2rpx solid rgba(22, 163, 74, 0.35);
    box-sizing: border-box;
    display: flex;
    align-items: center;
    justify-content: center;
}
.rights-overview-h1 {
    flex: 1;
    font-size: 32rpx;
    font-weight: bold;
    color: #14532d;
    letter-spacing: 0.5rpx;
}
.rights-overview-sub {
    display: block;
    font-size: 24rpx;
    color: #4b5563;
    line-height: 1.5;
    margin-top: 4rpx;
}
.rights-overview-hint {
    margin-bottom: 16rpx;
}
.rights-gold-accent {
    height: 8rpx;
    margin: 24rpx -28rpx 0;
    background: linear-gradient(90deg, rgba(245, 231, 178, 0.15), rgba(239, 212, 138, 0.65), rgba(243, 227, 161, 0.25));
    border-radius: 0 0 4rpx 4rpx;
}

.compare-card {
    border: 1rpx solid #dfe6e0;
    padding: 0;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 6rpx 28rpx rgba(15, 23, 42, 0.06);
}
.compare-inner {
    padding: 0 28rpx 24rpx;
}
.compare-head-band {
    margin: 0 -28rpx 20rpx;
    padding: 28rpx 28rpx 24rpx;
    background: linear-gradient(125deg, #f0fdf4 0%, #ffffff 55%, #fffef8 100%);
    border-bottom: 1rpx solid rgba(22, 163, 74, 0.12);
}
.compare-title-main {
    display: block;
    font-size: 26rpx;
    font-weight: 600;
    color: #15803d;
    letter-spacing: 1rpx;
}
.compare-title-sub {
    display: block;
    margin-top: 8rpx;
    font-size: 34rpx;
    font-weight: bold;
    color: #111827;
    line-height: 1.35;
}
.compare-plan-hint {
    display: block;
    margin-top: 14rpx;
    font-size: 22rpx;
    color: #6b7280;
    line-height: 1.5;
}
.compare-lead {
    margin-top: 18rpx;
    padding: 16rpx 18rpx;
    background: rgba(255, 255, 255, 0.88);
    border-radius: 14rpx;
    border: 1rpx solid #e5e7eb;
    line-height: 1.55;
}
.compare-lead-txt {
    font-size: 24rpx;
    color: #6b7280;
}
.compare-lead-hi {
    font-size: 24rpx;
    font-weight: bold;
    color: #166534;
}
.rule-hint {
    font-size: 22rpx;
    color: #6b7280;
    line-height: 1.55;
    display: block;
    margin-bottom: 20rpx;
    padding: 14rpx 18rpx;
    background: #f9fafb;
    border-radius: 12rpx;
    border: 1rpx solid #eef0f2;
}
.mp-table-wrap {
    border-radius: 16rpx;
    overflow: hidden;
    border: 1rpx solid #e5e7eb;
    box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.04);
}
.mp-table {
    width: 100%;
    background: #fff;
}
.mp-tr {
    display: flex;
    align-items: stretch;
    border-bottom: 1rpx solid #eef0f2;
}
.mp-tr:last-child {
    border-bottom: none;
}
.mp-tr-alt {
    background: #fafbfc;
}
.mp-tr-head {
    background: linear-gradient(180deg, #f8faf9 0%, #f3f4f6 100%);
    border-bottom: 2rpx solid #e5e7eb;
}
.mp-th,
.mp-td {
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 24rpx 12rpx;
}
.mp-th-label,
.mp-td-label {
    flex: 1.05;
    min-width: 0;
    align-items: flex-start;
    text-align: left;
    padding-left: 18rpx;
    padding-right: 12rpx;
}
.mp-th-per,
.mp-td-per {
    flex: 1;
    min-width: 0;
    background: #fbfdfc;
    border-left: 1rpx solid #eef0f2;
}
.mp-th-ent,
.mp-td-ent {
    flex: 1.08;
    min-width: 0;
    background: linear-gradient(180deg, #fffef9 0%, #faf6ea 100%);
    border-left: 1rpx solid rgba(212, 196, 160, 0.45);
}
.mp-th-label {
    font-size: 24rpx;
    font-weight: bold;
    color: #6b7280;
    justify-content: center;
}
.mp-th-title {
    font-size: 26rpx;
    font-weight: bold;
    color: #374151;
}
.mp-th-per .mp-th-title {
    color: #166534;
}
.mp-th-ent .mp-th-title {
    color: #854d0e;
}
.mp-th-badge {
    margin-top: 8rpx;
    padding: 4rpx 14rpx;
    font-size: 20rpx;
    font-weight: 600;
    color: #fff;
    background: linear-gradient(135deg, #16a34a, #15803d);
    border-radius: 999rpx;
    line-height: 1.2;
}
.mp-th-per.is-current {
    background: #ecfdf5;
    box-shadow: inset 0 0 0 2rpx rgba(22, 163, 74, 0.25);
}
.mp-th-ent.is-current {
    background: linear-gradient(180deg, #fff9e8 0%, #f5edd2 100%);
    box-shadow: inset 0 0 0 2rpx rgba(202, 138, 4, 0.28);
}
.mp-td-label {
    font-size: 24rpx;
    font-weight: 600;
    color: #4b5563;
    line-height: 1.45;
    align-items: flex-start;
    justify-content: center;
}
.mp-td-val {
    font-size: 26rpx;
    color: #374151;
    line-height: 1.45;
    font-weight: 500;
    word-break: break-all;
}
.mp-td-val-strong {
    font-weight: 700;
    color: #713f12;
}
.mp-td-per {
    background: #fbfcfb;
}
.mp-td-per.is-current {
    background: #ecfdf5;
    box-shadow: inset 3rpx 0 0 #16a34a;
}
.mp-td-ent {
    background: linear-gradient(180deg, #fffdf8 0%, #f8f4e8 100%);
}
.mp-td-ent.is-current {
    background: linear-gradient(180deg, #fff6da 0%, #f3e9c8 100%);
    box-shadow: inset 3rpx 0 0 rgba(180, 134, 11, 0.55);
}
.compare-gold-rail {
    height: 12rpx;
    margin: 0;
    background: linear-gradient(90deg, #f5f0dc, #e8d49a 50%, #f5e7b2);
    opacity: 0.88;
    border-radius: 0 0 20rpx 20rpx;
}
.muted {
    color: #9ca3af;
    font-size: 28rpx;
}
.btn.primary {
    background: #16a34a;
    color: #fff;
    border-radius: 44rpx;
    margin-top: 24rpx;
    height: 88rpx;
    line-height: 88rpx;
    font-size: 32rpx;
    font-weight: bold;
}
.btn.primary::after {
    border: none;
}
.btn.full {
    width: 100%;
}
.bottom-sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 70vh;
    overflow-y: auto;
    padding: 16rpx 32rpx calc(16rpx + env(safe-area-inset-bottom));
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 -8rpx 24rpx rgba(0, 0, 0, 0.08);
    border-top: 1rpx solid #e5e7eb;
    display: flex;
    flex-direction: column;
    gap: 16rpx;
}
.btn-row2 {
    display: flex;
    gap: 20rpx;
    margin-bottom: 0;
}
.full-row {
    width: 100%;
    margin-bottom: 0;
    margin-top: 0;
}
.full-row:last-child {
    margin-bottom: 0;
}
</style>
