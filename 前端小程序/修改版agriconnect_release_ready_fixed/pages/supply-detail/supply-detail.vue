<template>
    <!-- pages/supply-detail/supply-detail.wxml -->
    <view v-if="loading" class="loading-container">
        <text class="loading-text">加载中...</text>
    </view>
    <view v-else-if="!item" class="empty-container">
        <text class="empty-icon">📦</text>
        <text class="empty-text">商品不存在</text>
    </view>
    <view v-else class="detail-page">
        <!-- 轮播图区域 -->
        <view class="swiper-section">
            <swiper
                v-if="imageList.length > 0"
                class="detail-swiper"
                :indicator-dots="true"
                indicator-color="rgba(255, 255, 255, 0.5)"
                indicator-active-color="#ffffff"
                :autoplay="true"
                :interval="5000"
                :duration="500"
                :circular="true"
                :current="swiperCurrent"
                @change="onSwiperChange"
            >
                <swiper-item v-for="(item, index) in imageList" :key="index">
                    <image class="swiper-image" :src="item" mode="aspectFill"></image>
                </swiper-item>
            </swiper>
            <view v-else class="swiper-placeholder">
                <text class="placeholder-icon">📷</text>
                <text class="placeholder-text">暂无图片</text>
            </view>
        </view>

        <!-- 商品核心信息区 -->
        <view class="core-info-card">
            <view class="info-header">
                <view class="category-tag">{{ item.category }}</view>
                <view class="meta-info">
                    <text class="meta-item">🕐 {{ item.updateTime || '刚刚' }}</text>
                    <text class="meta-item meta-view-strong">浏览量 {{ viewCountDisplay }}</text>
                </view>
            </view>
            <text class="item-title">{{ item.title }}</text>
            <view class="price-row">
                <view class="price-main">
                    <text class="price-symbol">¥</text>
                    <text class="price-value">{{ priceValue }}</text>
                    <text class="price-unit">/{{ priceUnit }}</text>
                </view>
            </view>
            <view class="location-row">
                <text class="location-icon">📍</text>
                <text class="location-text">{{ item.location }}</text>
            </view>
        </view>

        <!-- 规格参数 -->
        <view class="specs-section">
            <view class="section-title">
                <view class="title-indicator"></view>
                <text>参数规格</text>
            </view>
            <view class="specs-grid">
                <view class="spec-item">
                    <text class="spec-label">发货地</text>
                    <text class="spec-value">{{ item.location }}</text>
                </view>
                <view class="spec-item">
                    <text class="spec-label">品种</text>
                    <text class="spec-value">{{ item.category }}</text>
                </view>
                <view class="spec-item">
                    <text class="spec-label">规格</text>
                    <text class="spec-value">{{ item.specifications || '通货' }}</text>
                </view>
                <view class="spec-item">
                    <text class="spec-label">数量</text>
                    <text class="spec-value">{{ item.quantity }} {{ item.unit }}</text>
                </view>
            </view>
        </view>

            <view v-for="(section, si) in detailSections" :key="'sec-' + si" class="specs-section">
                <view class="section-title">
                    <view class="title-indicator"></view>
                    <text>{{ section.title }}</text>
                </view>
                <view class="specs-grid specs-grid-single">
                    <view v-for="(row, ri) in section.rows" :key="'row-' + si + '-' + ri" class="spec-item spec-item-full">
                        <text class="spec-label">{{ row.label }}</text>
                        <text class="spec-value">{{ row.value }}</text>
                    </view>
                </view>
            </view>

        <!-- 供应商信息 -->
        <view class="supplier-section">
            <view class="section-title">
                <view class="title-indicator"></view>
                <text>供应商信息</text>
            </view>
            <view class="supplier-card">
                <view class="supplier-header" :data-publisher="item.publisher" @tap="goToUserProfile">
                    <view class="supplier-avatar-wrapper">
                        <view class="supplier-avatar">{{ item.publisher[0] }}</view>
                    </view>
                    <view class="supplier-info">
                        <view class="supplier-name-row">
                            <text class="supplier-name">{{ item.publisher }}</text>
                        </view>
                        <auth-badges
                            class="supplier-auth-badges"
                            :realname-verified="item.isRealNameVerified || item.real_name_verified || item.is_verified"
                            :enterprise-verified="item.isEnterpriseVerified || item.enterprise_verified"
                            compact
                        />
                        <view class="supplier-tags" v-if="publisherTags.length">
                            <view class="tag-item" v-for="(tag, ti) in publisherTags" :key="'pt-' + ti">
                                <text class="tag-text">{{ tag }}</text>
                            </view>
                        </view>
                    </view>
                </view>
            </view>
        </view>

        <!-- 详细描述 -->
        <view class="description-section">
            <view class="section-title">
                <view class="title-indicator"></view>
                <text>详细描述</text>
            </view>
            <text v-if="item.description" class="description-text">{{ item.description }}</text>
            <text v-else class="description-text empty">暂无详细描述，请联系商家咨询详情。</text>

            <!-- 九宫格图片展示 -->
            <view v-if="descriptionImages.length > 0" class="image-grid">
                <view class="grid-item" :data-index="index" :data-urls="descriptionImages" @tap="previewImage" v-for="(item, index) in descriptionImages" :key="index">
                    <image class="grid-image" :src="item" mode="aspectFill"></image>
                </view>
            </view>
        </view>

        <!-- 底部操作栏 -->
        <view class="bottom-actions">
            <view class="action-left">
                <view class="action-btn" :data-publisher="item.publisher" @tap="goToUserProfile">
                    <text class="action-icon">👤</text>
                    <text class="action-text">个人中心</text>
                </view>
            </view>
            <view class="action-right">
                <button class="action-button chat-btn" @tap="startChat">💬 在线聊</button>
                <button class="action-button call-btn" @tap="makeCall">📞 打电话</button>
            </view>
        </view>
    </view>
</template>

<script>
// pages/supply-detail/supply-detail.js
import { makePhoneCall } from '../../utils/util.js';
import { getSupplyDetail, getUserInfo } from '../../utils/api.js';
import { formatListViewCount } from '../../utils/viewCount.js';
import AuthBadges from '../../components/auth-badges/auth-badges.vue';
const app = getApp();
export default {
    components: {
        AuthBadges
    },
    data() {
        return {
            item: null,
            isFavorite: false,
            priceValue: '',
            priceUnit: '斤',
            swiperCurrent: 0,
            imageList: [],
            descriptionImages: [],
            loading: true
        };
    },
    computed: {
        publisherTags() {
            if (!this.item) return [];
            const tags = [];
            if (this.item.is_origin_direct) tags.push('产地直发');
            if (this.item.is_in_stock) tags.push('现货');
            if (this.item.is_long_term_supply) tags.push('可长期供货');
            return tags;
        },
        detailSections() {
            const item = this.item || {};
            const productName = item.product_name || item.productName || item.product_variety || item.variety_name || '';
            const categoryName = item.category_name || item.product_category || item.category || '';
            const specText = item.specifications || item.specification || item.spec || '';
            const placeText = item.ship_from || item.origin || item.location || '';
            const basic = this.compactRows([
                { label: '标题', value: item.title },
                { label: '分类', value: categoryName },
                { label: '产品名 / 品种名', value: productName }
            ]);
            const tradeRows = this.compactRows([
                { label: '价格', value: item.price_negotiable ? '面议' : (item.price || '') },
                { label: '发货方式', value: item.shipping_method }
            ]);
            const areaRows = this.compactRows([
                { label: '发货地 / 产地 / 地址', value: placeText },
                { label: '发布时间', value: item.updateTime || item.time || '' }
            ]);
            const publisherRows = this.compactRows([{ label: '发布者', value: item.publisher }]);
            return [
                { title: '基本信息', rows: basic },
                { title: '交易信息', rows: tradeRows },
                { title: '地区与时间', rows: areaRows },
                { title: '发布者信息', rows: publisherRows }
            ].filter((sec) => sec.rows.length > 0);
        },
        viewCountDisplay() {
            return formatListViewCount(this.item);
        }
    },
    async onLoad(options) {
        const id = options.id;
        if (!id) {
            uni.showToast({
                title: '商品ID不能为空',
                icon: 'none'
            });
            setTimeout(() => {
                uni.navigateBack();
            }, 1500);
            return;
        }

        uni.showLoading({
            title: '加载中...'
        });

        try {
            // 从 API 获取供应详情
            const item = await getSupplyDetail(id);
            
            if (item) {
                // 检查收藏状态
                const favorites = uni.getStorageSync('favorites') || [];
                const isFavorite = favorites.some((f) => f.id === id && f.type === 'supply');

                // 处理价格数据：分离数值和单位
                const priceValue = item.price ? item.price.replace(/[^0-9.]/g, '') : '';
                const priceUnit = item.unit || (item.price ? item.price.replace(/[0-9.]/g, '') || '斤' : '斤');

                // 处理轮播图数据：使用实际的图片数组
                const imageList = item.images && item.images.length > 0 ? item.images : [item.imageUrl || '/static/images/logo.png'];

                // 处理详细描述中的图片（使用轮播图中的图片）
                const descriptionImages = item.images && item.images.length > 0 ? item.images : [];
                
                this.setData({
                    item: item,
                    isFavorite: isFavorite,
                    priceValue: priceValue,
                    priceUnit: priceUnit,
                    imageList: imageList,
                    descriptionImages: descriptionImages,
                    loading: false
                });
            } else {
                uni.showToast({
                    title: '商品不存在',
                    icon: 'none'
                });
                setTimeout(() => {
                    uni.navigateBack();
                }, 1500);
            }
        } catch (error) {
            console.error('获取商品详情失败:', error);
            uni.showToast({
                title: '加载失败，请重试',
                icon: 'none'
            });
            setTimeout(() => {
                uni.navigateBack();
            }, 1500);
        } finally {
            uni.hideLoading();
        }
    },
    onShow() {
        // 刷新收藏状态
        if (this.item) {
            const favorites = uni.getStorageSync('favorites') || [];
            const isFavorite = favorites.some((f) => f.id === this.item.id && f.type === 'supply');
            this.setData({
                isFavorite
            });
        }
    },
    // 分享
    onShareAppMessage() {
        const { item } = this;
        return {
            title: item ? item.title : '云链农商商品',
            path: `/pages/supply-detail/supply-detail?id=${item.id}`
        };
    },
    methods: {
        compactRows(rows) {
            return (rows || []).filter((row) => String(row.value == null ? '' : row.value).trim() !== '');
        },

        // 轮播图切换事件
        onSwiperChange(e) {
            this.setData({
                swiperCurrent: e.detail.current
            });
        },

        // 预览图片
        previewImage(e) {
            const index = e.currentTarget.dataset.index;
            const urls = e.currentTarget.dataset.urls;
            uni.previewImage({
                current: urls[index],
                urls: urls
            });
        },

        // 切换收藏
        toggleFavorite() {
            const { item, isFavorite } = this;
            let favorites = uni.getStorageSync('favorites') || [];
            if (isFavorite) {
                // 取消收藏
                favorites = favorites.filter((f) => !(f.id === item.id && f.type === 'supply'));
                this.setData({
                    isFavorite: false
                });
                uni.showToast({
                    title: '已取消收藏',
                    icon: 'success'
                });
            } else {
                // 添加收藏
                favorites.push({
                    ...item,
                    type: 'supply'
                });
                this.setData({
                    isFavorite: true
                });
                uni.showToast({
                    title: '收藏成功',
                    icon: 'success'
                });
            }
            uni.setStorageSync('favorites', favorites);
        },

        // 拨打电话
        async makeCall() {
            if (!this.item || !this.item.user_id) {
                uni.showToast({
                    title: '用户信息不存在',
                    icon: 'none'
                });
                return;
            }
            const currentUser = uni.getStorageSync('userInfo') || {};
            const currentUserId = currentUser.user_id || currentUser._id || currentUser.id || '';
            if (currentUserId && String(currentUserId) === String(this.item.user_id)) {
                uni.showToast({
                    title: '这是你自己发布的信息',
                    icon: 'none'
                });
                return;
            }

            try {
                // 从API获取用户信息（包括电话）
                const userInfo = await getUserInfo(this.item.user_id);
                
                if (userInfo && userInfo.mobile) {
                    makePhoneCall(userInfo.mobile);
                } else {
                    uni.showToast({
                        title: '商家暂未设置联系电话',
                        icon: 'none'
                    });
                }
            } catch (error) {
                console.error('获取用户信息失败:', error);
                uni.showToast({
                    title: '获取用户信息失败',
                    icon: 'none'
                });
            }
        },

        // 在线聊天
        startChat() {
            uni.showToast({
                title: '在线聊天功能开发中',
                icon: 'none'
            });
        },

        // 跳转到用户个人主页
        goToUserProfile(e) {
            const userId = this.item?.user_id || e.currentTarget.dataset.publisher;
            if (!userId) {
                return;
            }

            uni.navigateTo({
                url: `/pages/user-profile/user-profile?userId=${userId}`
            });
        }
    }
};
</script>
<style>
@import './supply-detail.css';
</style>
