<template>
    <view class="procurement-detail-page">
        <view v-if="loading" class="detail-loading">
            <text class="detail-loading-text">加载中…</text>
        </view>
        <view v-else-if="item && item._pv" class="detail-body">
            <view class="detail-card">
                <view class="detail-title-row">
                    <text class="detail-title">{{ item._pv.title }}</text>
                </view>
                <view class="detail-tags">
                    <text v-for="(tg, ti) in statusTagsForCard(item)" :key="'dt-' + ti" :class="'tag ' + tg.cls">{{ tg.text }}</text>
                </view>
                <view class="detail-grid detail-grid-compact">
                    <view class="dg-cell">
                        <text class="dg-label">采购量</text>
                        <text class="dg-val dg-qty">{{ item._pv.quantityDisplay || '—' }}</text>
                    </view>
                    <view class="dg-cell">
                        <text class="dg-label">目标价</text>
                        <text class="dg-val dg-price">{{ item._pv.priceDisplay }}</text>
                    </view>
                    <view class="dg-cell">
                        <text class="dg-label">分类</text>
                        <text class="dg-val">{{ item.category_name || item.product_category || item.category || '—' }}</text>
                    </view>
                    <view class="dg-cell">
                        <text class="dg-label">产品名</text>
                        <text class="dg-val">{{ item.product_name || item.productName || item.product_variety || item.variety_name || '—' }}</text>
                    </view>
                    <view class="dg-cell dg-full">
                        <text class="dg-label">规格要求</text>
                        <text class="dg-val">{{ specDisplayText(item) }}</text>
                    </view>
                    <view v-if="item.settlement_type" class="dg-cell">
                        <text class="dg-label">结算方式</text>
                        <text class="dg-val">{{ item.settlement_type }}</text>
                    </view>
                    <view v-if="item.need_invoice" class="dg-cell">
                        <text class="dg-label">发票要求</text>
                        <text class="dg-val">{{ item.need_invoice }}</text>
                    </view>
                    <view class="dg-cell">
                        <text class="dg-label">是否急购</text>
                        <text class="dg-val">{{ item.is_urgent ? '是' : '否' }}</text>
                    </view>
                    <view class="dg-cell">
                        <text class="dg-label">是否长期采购</text>
                        <text class="dg-val">{{ item.is_long_term ? '是' : '否' }}</text>
                    </view>
                    <view v-if="item._pv.location" class="dg-cell dg-full">
                        <text class="dg-label">收货地</text>
                        <text class="dg-val">{{ item._pv.location }}</text>
                    </view>
                    <view class="dg-cell dg-full">
                        <text class="dg-label">截止时间</text>
                        <text class="dg-val">{{ formatDeadlineMeta(item) }}</text>
                    </view>
                    <view v-if="formatPublishRelative(item)" class="dg-cell dg-full">
                        <text class="dg-label">发布时间</text>
                        <text class="dg-val dg-muted">{{ formatPublishRelative(item) }}</text>
                    </view>
                    <view v-if="item.remarks" class="dg-cell dg-full">
                        <text class="dg-label">补充说明</text>
                        <text class="dg-val">{{ item.remarks }}</text>
                    </view>
                </view>
                <view class="detail-publisher">
                    <text class="dp-name">{{ item._pv.publisherName }}</text>
                    <text v-if="item._pv.publisherRole" class="dp-role">{{ item._pv.publisherRole }}</text>
                    <view class="dp-trust">
                        <auth-badges
                            :realname-verified="item._pv.isRealname"
                            :enterprise-verified="item._pv.isEnterprise"
                            compact
                            :show-pending-text="!item._pv.isRealname && !item._pv.isEnterprise"
                        />
                    </view>
                </view>
            </view>
            <view class="detail-footer">
                <button
                    class="detail-contact-btn"
                    :class="{ disabled: item._pv.isEnded }"
                    :disabled="item._pv.isEnded"
                    :data-user-id="item.user_id"
                    :data-publisher="item._pv.publisherName"
                    @tap="showContact"
                >
                    {{ item._pv.isEnded ? '已结束' : contactButtonText }}
                </button>
            </view>
        </view>
        <view v-else class="detail-empty">
            <text class="detail-empty-text">未找到该采购信息</text>
        </view>

        <view v-if="contactInfo" class="modal-overlay" @tap="closeContact">
            <view class="contact-modal" @tap.stop.prevent="">
                <view class="modal-icon">
                    <image class="modal-icon-img" src="/static/images/tabbar/phone.png" mode="aspectFit"></image>
                </view>
                <text class="modal-title">联系商家</text>
                <text class="modal-desc">即将拨打 {{ contactInfo.name }} 的电话</text>
                <view class="modal-actions">
                    <button class="modal-btn primary" @tap="makeCall">拨打 {{ contactInfo.phone }}</button>
                    <button class="modal-btn secondary" @tap="closeContact">取消</button>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
import { getProcurementDetail, getProcurementContact } from '../../utils/api.js';
import { makePhoneCall } from '../../utils/util.js';
import AuthBadges from '../../components/auth-badges/auth-badges.vue';
import {
    normalizeProcurementItem,
    formatDeadlineMeta,
    formatPublishRelative,
    isTodayPublishTag
} from '../../utils/procurementDisplay.js';

export default {
    components: {
        AuthBadges
    },
    data() {
        return {
            loading: true,
            item: null,
            contactInfo: null,
            isContactPurchaseMember: false
        };
    },
    onLoad(options) {
        const id = options.id ? decodeURIComponent(options.id) : '';
        this.syncContactMemberState();
        this.loadDetail(id);
    },
    computed: {
        contactButtonText() {
            return this.isContactPurchaseMember ? '联系采购方' : '会员可联系';
        }
    },
    methods: {
        syncContactMemberState() {
            const userInfo = uni.getStorageSync('userInfo') || {};
            this.setData({
                isContactPurchaseMember: !!userInfo.is_member_active
            });
        },
        formatPublishRelative,
        specDisplayText(item) {
            const s = (item._pv && item._pv.spec) || '';
            return s ? s : '不限';
        },
        formatDeadlineMeta,
        statusTagsForCard(item) {
            const pv = item._pv;
            if (!pv || pv.isEnded) {
                return [];
            }
            const tags = [];
            if (pv.isUrgent) {
                tags.push({ text: '急购', cls: 'tag-urgent' });
            }
            if (pv.isLongTerm) {
                tags.push({ text: '长期采购', cls: 'tag-long' });
            }
            if (isTodayPublishTag(item)) {
                tags.push({ text: '今日发布', cls: 'tag-today' });
            }
            return tags;
        },
        async loadDetail(id) {
            if (!id) {
                this.setData({ loading: false, item: null });
                return;
            }
            this.setData({ loading: true });
            try {
                const row = await getProcurementDetail(id);
                this.setData({
                    item: row ? normalizeProcurementItem(row) : null,
                    loading: false
                });
            } catch (e) {
                console.error(e);
                this.setData({ item: null, loading: false });
                uni.showToast({
                    title: '加载失败',
                    icon: 'none'
                });
            }
        },
        async showContact(e) {
            const userId = e.currentTarget.dataset.userId;
            const publisher = e.currentTarget.dataset.publisher;
            if (!userId) {
                uni.showToast({
                    title: '用户信息不存在',
                    icon: 'none'
                });
                return;
            }
            try {
                const userInfo = await getProcurementContact(userId);
                if (userInfo && userInfo.mobile) {
                    this.setData({
                        contactInfo: {
                            name: userInfo.nickname || userInfo.username || publisher,
                            phone: userInfo.mobile
                        }
                    });
                } else {
                    uni.showToast({
                        title: '该用户未设置电话',
                        icon: 'none'
                    });
                }
            } catch (err) {
                uni.showToast({
                    title: '获取用户信息失败',
                    icon: 'none'
                });
            }
        },
        closeContact() {
            this.setData({ contactInfo: null });
        },
        makeCall() {
            if (this.contactInfo) {
                makePhoneCall(this.contactInfo.phone);
            }
        }
    }
};
</script>

<style>
@import './procurement-detail.css';
</style>
