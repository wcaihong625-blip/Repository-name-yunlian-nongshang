<template>
    <view class="supply-page">
        <view class="s-top-fixed" :style="{ paddingTop: statusBarHeight + 'px' }">
            <view class="s-green-header">
                <view class="s-nav-row" :style="{ height: navRowHeightPx + 'px', paddingRight: headerRightInset + 'px' }">
                    <text class="s-nav-title">供应</text>
                </view>
                <view class="s-search-inner">
                    <image class="s-search-img" src="/static/images/tabbar/magnifier.png" mode="aspectFit"></image>
                    <input
                        class="s-search-input"
                        type="text"
                        confirm-type="search"
                        placeholder="搜索供应：产品 / 产地 / 规格"
                        placeholder-class="s-search-ph"
                        :value="searchInputValue"
                        @input="onSearchInput"
                        @confirm="onSearchConfirm"
                    />
                </view>
            </view>

            <view class="s-filter-wrap">
                <view class="filter-bar">
                <view :class="'filter-item ' + (activeDropdown === 'category' ? 'active' : '')" data-type="category" @tap="toggleDropdown">
                    <text class="filter-item-text">{{ filterCategory === '全部' ? '全部分类' : filterCategory }}</text>
                    <text class="filter-caret">{{ activeDropdown === 'category' ? '▲' : '▼' }}</text>
                </view>
                <view class="divider"></view>
                <view :class="'filter-item ' + (activeDropdown === 'region' ? 'active' : '')" data-type="region" @tap="toggleDropdown">
                    <text class="filter-item-text">{{ filterRegionLabel }}</text>
                    <text class="filter-caret">{{ activeDropdown === 'region' ? '▲' : '▼' }}</text>
                </view>
                <view class="divider"></view>
                <view :class="'filter-item ' + (activeDropdown === 'sort' ? 'active' : '')" data-type="sort" @tap="toggleDropdown">
                    <text class="filter-item-text">{{ sortType === 'default' ? '智能排序' : sortTypeText }}</text>
                    <text class="filter-caret">{{ activeDropdown === 'sort' ? '▲' : '▼' }}</text>
                </view>
                </view>
            </view>
        </view>

        <view class="s-top-placeholder" :style="{ height: dropdownOverlayTopPx + 'px' }"></view>

        <view
            v-if="activeDropdown"
            class="dropdown-overlay"
            :style="{ top: dropdownOverlayTopPx + 'px' }"
            @tap="closeDropdown"
        >
            <view class="dropdown-menu" @tap.stop.prevent="">
                <view v-if="activeDropdown === 'category'" class="dropdown-content">
                    <view
                        :class="'dropdown-item ' + (filterCategory === item ? 'selected' : '')"
                        :data-category="item"
                        @tap="selectCategory"
                        v-for="(item, index) in categories"
                        :key="'c-' + index"
                    >
                        {{ item }}
                    </view>
                </view>

                <view v-if="activeDropdown === 'region'" class="dropdown-content grid">
                    <view
                        :class="'dropdown-item ' + (filterRegion === item ? 'selected' : '')"
                        :data-region="item"
                        @tap="selectRegion"
                        v-for="(item, index) in regions"
                        :key="'r-' + index"
                    >
                        {{ item }}
                    </view>
                </view>

                <view v-if="activeDropdown === 'sort'" class="dropdown-content list">
                    <view
                        :class="'dropdown-item list-item ' + (sortType === item.value ? 'selected' : '')"
                        :data-sort="item.value"
                        @tap="selectSort"
                        v-for="(item, index) in sortOptions"
                        :key="'s-' + index"
                    >
                        {{ item.label }}
                    </view>
                </view>
            </view>
        </view>

        <view class="content-section">
            <view class="section-header">
                <text class="section-title">{{ sectionTitleText }}</text>
                <text class="section-count">共 {{ filteredItems.length }} 条信息</text>
            </view>

            <view v-if="filteredItems.length > 0" class="supply-grid">
                <view
                    class="supply-card"
                    :class="{ 'is-weak': item._sv && item._sv.isEnded }"
                    :data-id="item.id"
                    @tap="goToDetail"
                    v-for="(item, index) in filteredItems"
                    :key="item.id || 's-' + index"
                >
                    <view v-if="item._sv && item._sv.isEnded" class="card-ended-badge">{{ item._sv.endedLabel }}</view>
                    <view
                        v-else-if="item._sv && !item._sv.isEnded && (item._sv.promoBoostActive || item._sv.promoTopActive)"
                        class="card-corner-badges"
                        aria-hidden="true"
                    >
                        <text v-if="item._sv.promoBoostActive" class="corner-badge corner-badge-boost">加急</text>
                        <text v-if="item._sv.promoTopActive" class="corner-badge corner-badge-top">置顶</text>
                    </view>

                    <view class="card-body">
                        <view class="card-section card-section-head">
                            <view class="card-head">
                                <text class="card-title-line">{{ item._sv.title }}</text>
                            </view>
                        </view>
                        <view v-if="item._sv.descriptionText" class="card-section card-section-desc">
                            <text class="card-desc-line">{{ item._sv.descriptionText }}</text>
                        </view>

                        <view class="card-section card-section-trade">
                            <view class="trade-row">
                                <text v-if="item._sv.productName" class="trade-name">{{ item._sv.productName }}</text>
                                <text v-if="item._sv.productVariety" class="trade-name sub">{{ item._sv.productVariety }}</text>
                                <text v-if="item._sv.categoryName" class="trade-cate">{{ item._sv.categoryName }}</text>
                            </view>
                            <view class="price-row">
                                <text class="card-price">{{ item._sv.priceDisplay }}</text>
                                <text v-if="item._sv.stockDisplay" class="stock-strong">{{ item._sv.stockDisplay }}</text>
                            </view>
                            <view class="card-info-row" v-if="item._sv.specification || item._sv.specLine || item._sv.tagsLimited.length">
                                <text v-if="item._sv.specification" class="meta-chip">规格 {{ item._sv.specification }}</text>
                                <text
                                    v-if="
                                        item._sv.specLine &&
                                        (
                                            !item._sv.specification ||
                                            String(item._sv.specLine).replace(/^规格[:：]?\s*/, '').trim() !==
                                                String(item._sv.specification).trim()
                                        )
                                    "
                                    class="meta-chip"
                                >
                                    {{ item._sv.specLine }}
                                </text>
                                <view v-for="(tg, ti) in item._sv.tagsLimited" :key="'tg-' + ti" :class="'mini-tag ' + tg.cls">
                                    <text class="mini-tag-txt">{{ tg.text }}</text>
                                </view>
                            </view>
                        </view>

                        <view class="card-section card-section-meta">
                            <view class="card-stock-ship">
                                <text v-if="item._sv.shipDisplay" class="meta-line ellipsis">{{ item._sv.shipDisplay }}</text>
                                <text v-else-if="item._sv.originName" class="meta-line ellipsis">产地：{{ item._sv.originName }}</text>
                                <text v-if="item._sv.publishText || item._sv.updateText" class="meta-line ellipsis">
                                    {{ item._sv.publishText || item._sv.updateText }}
                                </text>
                                <text v-if="item._sv.supplyMode" class="meta-line">供应方式：{{ item._sv.supplyMode }}</text>
                                <text v-if="item._sv.transportMode" class="meta-line">配送方式：{{ item._sv.transportMode }}</text>
                            </view>
                            <view class="card-publisher-row">
                                <view class="publisher-main">
                                    <text
                                        class="pub-name ellipsis pub-name-tap"
                                        :data-user-id="item.user_id"
                                        :data-publisher="item._sv.publisherName"
                                        @tap.stop="goToUserProfile"
                                    >
                                        {{ item._sv.publisherName }}
                                    </text>
                                    <auth-badges
                                        class="publisher-auth-badges"
                                        :realname-verified="item._sv.realnameVerified"
                                        :enterprise-verified="item._sv.enterpriseVerified"
                                        compact
                                    />
                                </view>
                                <view class="publisher-actions">
                                    <text class="card-browse-inline">浏览量 {{ formatListViewCount(item) }}</text>
                                    <view class="publisher-action-row">
                                        <view
                                            :class="'fav-round ' + (item.isFavorite ? 'active' : '')"
                                            :data-id="item.user_id"
                                            @tap.stop.prevent="toggleFavorite"
                                        >
                                            <text class="fav-ico">{{ item.isFavorite ? '❤' : '♡' }}</text>
                                        </view>
                                        <button
                                            class="card-contact card-contact-inline"
                                            :class="{ disabled: item._sv.isEnded }"
                                            :disabled="item._sv.isEnded"
                                            :data-user-id="item.user_id"
                                            :data-publisher="item._sv.publisherName"
                                            @tap.stop.prevent="showContact"
                                        >
                                            <image class="contact-icon" src="/static/images/tabbar/phone.png" mode="aspectFit"></image>
                                            <text>{{ item._sv.isEnded ? '已下架' : '联系他' }}</text>
                                        </button>
                                    </view>
                                </view>
                            </view>
                        </view>
                    </view>

                    <view v-if="item._sv.imageList && item._sv.imageList.length" class="card-image-grid-wrap">
                        <view class="card-image-grid">
                            <view
                                class="grid-image-item"
                                v-for="(img, imgIndex) in item._sv.imageList.slice(0, 6)"
                                :key="(item.id || index) + '-img-' + imgIndex"
                                @tap.stop.prevent="previewSupplyImage(item, imgIndex)"
                            >
                                <image class="grid-image" :src="img" mode="aspectFill"></image>
                                <view v-if="imgIndex === 5 && item._sv.imageList.length > 6" class="grid-image-more-mask">
                                    +{{ item._sv.imageList.length - 6 }}
                                </view>
                            </view>
                        </view>
                    </view>
                </view>
            </view>

            <view v-else class="empty-state">
                <text class="empty-icon">📦</text>
                <text class="empty-text">暂无供应信息</text>
                <text class="empty-hint">去发布一条供应信息吧</text>
                <button class="empty-publish-btn" @tap="goPublishSupply">立即发布</button>
                <button v-if="hasActiveFilters" class="clear-filter-btn" @tap="clearFilter">清除筛选条件</button>
            </view>

            <view v-if="filteredItems.length > 0" class="load-complete">已加载全部信息</view>
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
import { SUPPLY_CATEGORIES, SUPPLY_REGIONS } from '../../utils/constants.js';
import { makePhoneCall } from '../../utils/util.js';
import { getSupplies, getUserInfo } from '../../utils/api.js';
import { getFollowState, isFollowing, syncFollowStateFromServer, toggleFollowUser } from '../../utils/followState.js';
import AuthBadges from '../../components/auth-badges/auth-badges.vue';
import { normalizeSupplyItem } from '../../utils/supplyDisplay.js';
import { getViewCount as getViewCountFromItem, formatListViewCount as formatListViewCountFromItem } from '../../utils/viewCount.js';

export default {
    components: {
        AuthBadges
    },
    data() {
        return {
            statusBarHeight: 20,
            navRowHeightPx: 44,
            headerRightInset: 12,
            dropdownOverlayTopPx: 200,
            searchInputValue: '',
            searchQuery: '',
            filterCategory: '全部',
            filterRegion: '全国',
            sortType: 'default',
            activeDropdown: null,
            filteredItems: [],
            categories: SUPPLY_CATEGORIES,
            regions: SUPPLY_REGIONS,
            sortOptions: [
                { label: '智能排序', value: 'default' },
                { label: '最新发布', value: 'timeDesc' },
                { label: '离我最近', value: 'nearest' },
                { label: '价格优先', value: 'priceAsc' },
                { label: '库存最多', value: 'stockDesc' }
            ],
            sortTypeText: '智能排序',
            contactInfo: null,
            followingList: [],
            /** 性能：列表全量拉取节流（毫秒），避免 onLoad 与 onShow 连续打两次接口 */
            _supplyListThrottleMs: 35000,
            _lastSupplyListFetchAt: 0,
            _supplyListFetchPromise: null,
            /** 首屏单次请求条数（原 100 过大） */
            listPageSize: 30
        };
    },
    computed: {
        filterRegionLabel() {
            return this.filterRegion === '全国' ? '全国' : this.filterRegion;
        },
        sectionTitleText() {
            if (this.searchQuery) {
                return '搜索结果';
            }
            if (this.filterCategory !== '全部' || (this.filterRegion !== '全国' && this.filterRegion !== '附近')) {
                return '筛选结果';
            }
            return '推荐供应';
        },
        hasActiveFilters() {
            return !!(
                this.searchQuery ||
                this.filterCategory !== '全部' ||
                this.filterRegion !== '全国'
            );
        }
    },
    onLoad() {
        this.initNavLayout();
        void (async () => {
            await this.loadFollowState();
            await this.fetchSupplies({ reason: 'load' });
        })();
    },
    onShow() {
        uni.pageScrollTo({
            scrollTop: 0,
            duration: 0
        });
        void (async () => {
            await this.loadFollowState();
            await this.fetchSupplies({ reason: 'show' });
        })();
    },
    async onPullDownRefresh() {
        try {
            await this.loadFollowState();
            await this.fetchSupplies({ reason: 'pull', force: true });
        } catch (_e) {
            /* 静默 */
        } finally {
            uni.stopPullDownRefresh();
        }
    },
    methods: {
        getViewCount(item) {
            return getViewCountFromItem(item);
        },
        formatListViewCount(item) {
            return formatListViewCountFromItem(item);
        },
        initNavLayout() {
            const sys = uni.getSystemInfoSync();
            const sb = sys.statusBarHeight || 20;
            let inset = 16;
            let navH = 44;
            // #ifdef MP-WEIXIN
            try {
                const mb = uni.getMenuButtonBoundingClientRect();
                if (mb && mb.top != null && mb.height != null) {
                    navH = (mb.top - sb) * 2 + mb.height;
                    inset = Math.max(12, sys.windowWidth - mb.left + 8);
                }
            } catch (e) {
                /* ignore */
            }
            // #endif
            const upx = typeof uni.upx2px === 'function' ? uni.upx2px.bind(uni) : (r) => r * 0.5;
            const greenBlock = navH + upx(12 + 80 + 20);
            const filterBar = upx(88);
            const headerBlock = greenBlock + filterBar;
            const dropdownTop = sb + headerBlock;
            this.setData({
                statusBarHeight: sb,
                navRowHeightPx: navH,
                headerRightInset: inset,
                dropdownOverlayTopPx: dropdownTop
            });
        },
        async loadFollowState(force = false) {
            try {
                const state = force ? await syncFollowStateFromServer(true) : getFollowState();
                this.setData({
                    followingList: state.followingList || []
                });
            } catch (error) {
                const state = getFollowState();
                this.setData({
                    followingList: state.followingList || []
                });
            }
        },
        onSearchInput(e) {
            const v = (e.detail && e.detail.value) || '';
            this.setData({ searchInputValue: v });
        },
        onSearchConfirm() {
            const query = (this.searchInputValue || '').trim();
            this.setData({ searchQuery: query });
            this.filterItems();
        },
        toggleDropdown(e) {
            const type = e.currentTarget.dataset.type;
            const current = this.activeDropdown;
            this.setData({
                activeDropdown: current === type ? null : type
            });
        },
        selectCategory(e) {
            const category = e.currentTarget.dataset.category;
            this.setData({
                filterCategory: category,
                activeDropdown: null
            });
            this.filterItems();
        },
        selectRegion(e) {
            const region = e.currentTarget.dataset.region;
            this.setData({
                filterRegion: region,
                activeDropdown: null
            });
            this.filterItems();
        },
        selectSort(e) {
            const sortType = e.currentTarget.dataset.sort;
            const sortOption = this.sortOptions.find((opt) => opt.value === sortType);
            this.setData({
                sortType: sortType,
                sortTypeText: sortOption ? sortOption.label : '智能排序',
                activeDropdown: null
            });
            this.filterItems();
        },
        mapApiSort(sortType) {
            if (sortType === 'priceAsc') {
                return 'priceAsc';
            }
            if (sortType === 'priceDesc') {
                return 'priceDesc';
            }
            return 'timeDesc';
        },
        applyClientSort(items, sortType) {
            const list = items.map((x) => x);
            const sv = (it) => (it._sv || {});
            /** 客户端二次排序时保持：置顶优先、再加急优先，避免刷新后二次排序把推广位挤下去 */
            const topRank = (it) => (sv(it).promoTopActive ? 1 : 0);
            const boostRank = (it) => (sv(it).promoBoostActive ? 1 : 0);
            const wrapTop = (cmp) => (a, b) => {
                const tr = topRank(b) - topRank(a);
                if (tr !== 0) return tr;
                const br = boostRank(b) - boostRank(a);
                if (br !== 0) return br;
                return cmp(a, b);
            };
            switch (sortType) {
                case 'stockDesc':
                    list.sort(
                        wrapTop((a, b) => (sv(b).stockSortValue || 0) - (sv(a).stockSortValue || 0))
                    );
                    break;
                case 'nearest': {
                    const hasDist = list.some((it) => sv(it).distanceSortValue != null && !isNaN(sv(it).distanceSortValue));
                    if (hasDist) {
                        list.sort(
                            wrapTop((a, b) => {
                                const da = sv(a).distanceSortValue;
                                const db = sv(b).distanceSortValue;
                                if (da == null) return 1;
                                if (db == null) return -1;
                                return da - db;
                            })
                        );
                    }
                    break;
                }
                case 'priceAsc':
                    list.sort(wrapTop((a, b) => (sv(a).priceSortValue || 0) - (sv(b).priceSortValue || 0)));
                    break;
                case 'timeDesc':
                    list.sort(wrapTop((a, b) => (sv(b).timeSortValue || 0) - (sv(a).timeSortValue || 0)));
                    break;
                case 'default':
                    list.sort(
                        wrapTop((a, b) => {
                            const sb = sv(b).stockSortValue || 0;
                            const sa = sv(a).stockSortValue || 0;
                            if (sb !== sa) {
                                return sb - sa;
                            }
                            return (sv(b).timeSortValue || 0) - (sv(a).timeSortValue || 0);
                        })
                    );
                    break;
                default:
                    break;
            }
            return list;
        },
        /** 仅同步关注状态到当前列表，不打列表接口 */
        applySupplyFavoriteOnly() {
            const followingList = this.followingList || [];
            const items = (this.filteredItems || []).map((item) => {
                const targetUserId = item.user_id || item.publisher_id || item.owner_user_id || '';
                const isFavorite =
                    !!targetUserId &&
                    (followingList.includes(String(targetUserId)) || isFollowing(targetUserId));
                return { ...item, isFavorite };
            });
            this.setData({ filteredItems: items });
        },

        /**
         * 拉取供应列表。reason: load/show/pull/user
         * show 在节流窗口内且已有数据时只同步关注，不重复请求。
         */
        async fetchSupplies(opts = {}) {
            const reason = opts.reason || 'show';
            const force = opts.force === true;
            const now = Date.now();
            const throttleMs = this._supplyListThrottleMs || 35000;

            if (this._supplyListFetchPromise) {
                // #region 性能验收日志（可删）
                console.log('[perf][supply] coalesce in-flight', { reason });
                // #endregion
                return this._supplyListFetchPromise;
            }

            const shouldThrottleNetwork =
                !force &&
                reason === 'show' &&
                this._lastSupplyListFetchAt &&
                now - this._lastSupplyListFetchAt < throttleMs &&
                Array.isArray(this.filteredItems) &&
                this.filteredItems.length > 0;

            if (shouldThrottleNetwork) {
                // #region 性能验收日志（可删）
                console.log('[perf][supply] skip list fetch (throttle)', {
                    reason,
                    ageMs: now - this._lastSupplyListFetchAt,
                    throttleMs
                });
                // #endregion
                this.applySupplyFavoriteOnly();
                return;
            }

            const t0 = Date.now();
            // #region 性能验收日志（可删）
            console.log('[perf][supply] list fetch start', { reason, force });
            // #endregion

            const run = async () => {
                try {
                    const { searchQuery, filterCategory, filterRegion, sortType } = this;
                    const sortParam = this.mapApiSort(sortType);
                    const regionParam =
                        !filterRegion || filterRegion === '全国' || filterRegion === '附近' ? undefined : filterRegion;
                    const pageSize = Math.max(10, Number(this.listPageSize) || 30);

                    const result = await getSupplies({
                        category: filterCategory === '全部' ? undefined : filterCategory,
                        region: regionParam,
                        search: searchQuery || undefined,
                        sort: sortParam,
                        page: 1,
                        pageSize
                    });

                    let items = result?.list || [];

                    const followingList = this.followingList || [];
                    items = items.map((row) => {
                        const item = normalizeSupplyItem(row);
                        const targetUserId = row.user_id || row.publisher_id || row.owner_user_id || '';
                        item.isFavorite =
                            !!targetUserId &&
                            (followingList.includes(String(targetUserId)) || isFollowing(targetUserId));
                        return item;
                    });

                    items = this.applyClientSort(items, sortType);

                    this._lastSupplyListFetchAt = Date.now();
                    this.setData({
                        filteredItems: items
                    });

                    // #region 性能验收日志（可删）
                    console.log('[perf][supply] list fetch done', {
                        reason,
                        totalMs: Date.now() - t0,
                        count: items.length,
                        pageSize
                    });
                    // #endregion
                } catch (error) {
                    console.error('获取供应列表失败:', error);
                    this.setData({
                        filteredItems: []
                    });
                    uni.showToast({
                        title: '加载失败，请重试',
                        icon: 'none'
                    });
                }
            };

            this._supplyListFetchPromise = run().finally(() => {
                this._supplyListFetchPromise = null;
            });
            return this._supplyListFetchPromise;
        },

        async filterItems() {
            return this.fetchSupplies({ reason: 'user', force: true });
        },
        clearFilter() {
            this.setData({
                filterCategory: '全部',
                filterRegion: '全国',
                searchQuery: '',
                searchInputValue: '',
                sortType: 'default',
                sortTypeText: '智能排序'
            });
            this.filterItems();
        },
        goPublishSupply() {
            uni.navigateTo({
                url: '/pages/publish-info/publish-info?tab=supply'
            });
        },
        toggleFavorite(e) {
            const targetUserId = e.currentTarget.dataset.id;
            if (!targetUserId) return;
            const currentUser = uni.getStorageSync('userInfo') || {};
            const currentUserId = currentUser.user_id || currentUser._id || currentUser.id || '';
            if (currentUserId && String(currentUserId) === String(targetUserId)) {
                uni.showToast({ title: '不能关注自己', icon: 'none' });
                return;
            }
            toggleFollowUser(targetUserId)
                .then((ret) => {
                    this.setData({
                        followingList: ret.state.followingList || []
                    });
                    void this.fetchSupplies({ reason: 'user', force: true });
                    uni.showToast({
                        title: ret.isFollowing ? '关注成功' : '已取消关注',
                        icon: 'success'
                    });
                })
                .catch((error) => {
                    uni.showToast({
                        title: error.message || '操作失败',
                        icon: 'none'
                    });
                });
        },
        goToDetail(e) {
            const id = e.currentTarget.dataset.id;
            uni.navigateTo({
                url: `/pages/supply-detail/supply-detail?id=${id}`
            });
        },
        goToUserProfile(e) {
            const userId = e.currentTarget.dataset.userId || e.currentTarget.dataset.publisher;
            if (!userId) {
                return;
            }
            uni.navigateTo({
                url: `/pages/user-profile/user-profile?userId=${userId}`
            });
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
            const currentUser = uni.getStorageSync('userInfo') || {};
            const currentUserId = currentUser.user_id || currentUser._id || currentUser.id || '';
            if (currentUserId && String(currentUserId) === String(userId)) {
                uni.showToast({
                    title: '这是你自己发布的信息',
                    icon: 'none'
                });
                return;
            }
            try {
                const userInfo = await getUserInfo(userId);
                if (userInfo && userInfo.mobile) {
                    this.setData({
                        contactInfo: {
                            name: userInfo.nickname || userInfo.username || publisher,
                            phone: userInfo.mobile
                        }
                    });
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
        closeContact() {
            this.setData({
                contactInfo: null
            });
        },
        makeCall() {
            const { contactInfo } = this;
            if (contactInfo) {
                makePhoneCall(contactInfo.phone);
            }
        },
        closeDropdown() {
            this.setData({
                activeDropdown: null
            });
        },
        previewSupplyImage(item, currentIndex) {
            const imgs = item && item._sv && Array.isArray(item._sv.imageList) ? item._sv.imageList.filter(Boolean) : [];
            if (!imgs.length) {
                return;
            }
            uni.previewImage({
                current: imgs[currentIndex] || imgs[0],
                urls: imgs.slice(0, 6)
            });
        }
    }
};
</script>
<style>
@import './supply.css';
</style>
