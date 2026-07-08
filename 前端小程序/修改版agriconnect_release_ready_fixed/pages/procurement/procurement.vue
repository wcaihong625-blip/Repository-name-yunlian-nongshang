<template>
    <view class="procurement-page">
        <view class="p-top-fixed" :style="{ paddingTop: statusBarHeight + 'px' }">
            <!-- 自定义绿色头部：左标题 + 底部搜索（右侧留空给微信胶囊） -->
            <view class="p-green-header">
                <view class="p-nav-row" :style="{ height: navRowHeightPx + 'px', paddingRight: headerRightInset + 'px' }">
                    <text class="p-nav-title">采购</text>
                </view>
                <view class="p-search-inner">
                    <image class="p-search-img" src="/static/images/tabbar/magnifier.png" mode="aspectFit"></image>
                    <input
                        class="p-search-input"
                        type="text"
                        confirm-type="search"
                        placeholder="搜索采购：产品 / 地区 / 数量"
                        placeholder-class="p-search-ph"
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

        <view class="p-top-placeholder" :style="{ height: dropdownOverlayTopPx + 'px' }"></view>

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
                <text class="section-count">共 {{ displayItems.length }} 条信息</text>
            </view>

            <view v-if="displayItems.length > 0" class="item-list">
                <view
                    v-for="(item, index) in displayItems"
                    :key="item.id || 'row-' + index"
                    class="procurement-card"
                    :class="{ 'is-ended': item._pv && item._pv.isEnded }"
                    :data-id="item.id"
                    @tap="goToProcurementDetail"
                >
                    <view v-if="item._pv && item._pv.isEnded" class="card-ended-badge">已结束</view>
                    <view
                        v-else-if="item._pv && (item._pv.promoBoostActive || item._pv.promoTopActive)"
                        class="card-corner-badges"
                        aria-hidden="true"
                    >
                        <text v-if="item._pv.promoBoostActive" class="corner-badge corner-badge-boost">加急</text>
                        <text v-if="item._pv.promoTopActive" class="corner-badge corner-badge-top">置顶</text>
                    </view>

                    <view
                        class="card-head"
                        :class="{
                            'has-corner-badges':
                                item._pv && !item._pv.isEnded && (item._pv.promoBoostActive || item._pv.promoTopActive)
                        }"
                    >
                        <text class="card-title-text">{{ item._pv.title }}</text>
                        <view v-if="statusTagsForCard(item).length" class="card-status-tags">
                            <view
                                v-for="(tg, ti) in statusTagsForCard(item)"
                                :key="'tg-' + ti"
                                :class="'tag ' + tg.cls"
                            >
                                <text v-if="tg.shield" class="tag-shield">🛡</text>
                                <text class="tag-txt">{{ tg.text }}</text>
                            </view>
                        </view>
                    </view>

                    <view class="card-core-grid">
                        <view class="core-col">
                            <text class="core-label">采购量</text>
                            <text class="core-value core-qty">{{ item._pv.quantityDisplay || '—' }}</text>
                        </view>
                        <view class="core-col core-col-divider">
                            <text class="core-label">目标价</text>
                            <text class="core-value core-price">{{ item._pv.priceDisplay }}</text>
                        </view>
                        <view class="core-col core-col-divider">
                            <text class="core-label">规格要求</text>
                            <text class="core-value core-spec">{{ specDisplayText(item) }}</text>
                        </view>
                    </view>

                    <view class="card-meta-3">
                        <view v-if="item._pv.location" class="meta-seg meta-seg-l">
                            <text class="meta-emoji">📍</text>
                            <text class="meta-line-txt ellipsis">{{ item._pv.location }}</text>
                        </view>
                        <view v-if="deadlineCardRow(item)" class="meta-seg meta-seg-m">
                            <text class="meta-emoji">🕐</text>
                            <text class="meta-line-txt ellipsis">{{ deadlineCardRow(item) }}</text>
                        </view>
                        <view class="meta-seg meta-seg-r">
                            <view class="meta-seg-r-inner">
                                <text v-if="formatPublishRelative(item)" class="meta-line-txt meta-time-only">{{ formatPublishRelative(item) }}</text>
                                <text class="meta-view-count">浏览量 {{ formatListViewCount(item) }}</text>
                            </view>
                        </view>
                    </view>

                    <view class="card-footer">
                        <view class="footer-left">
                            <image
                                v-if="getPublisherAvatar(item)"
                                class="publisher-avatar"
                                :src="getPublisherAvatar(item)"
                                :data-id="item.id"
                                @error="onAvatarError"
                                mode="aspectFill"
                            />
                            <view v-else class="publisher-avatar publisher-avatar-ph"></view>
                            <view class="publisher-body">
                                <view class="publisher-name-line">
                                    <text class="publisher-name">{{ item._pv.publisherName }}</text>
                                    <text class="publisher-role">{{ item._pv.publisherRole }}</text>
                                </view>
                                <auth-badges
                                    class="publisher-auth-badges"
                                    :realname-verified="item._pv.isRealname"
                                    :enterprise-verified="item._pv.isEnterprise"
                                    compact
                                />
                            </view>
                        </view>
                        <view class="footer-actions">
                            <view
                                :class="'favorite-btn-round ' + (item.isFavorite ? 'active' : '')"
                                :data-id="item.user_id"
                                @tap.stop.prevent="toggleFavorite"
                            >
                                <text class="fav-icon">{{ item.isFavorite ? '❤' : '♡' }}</text>
                            </view>
                            <button
                                class="contact-btn-main"
                                :class="{ disabled: item._pv.isEnded }"
                                :disabled="item._pv.isEnded"
                                :data-user-id="item.user_id"
                                :data-publisher="item._pv.publisherName"
                                @tap.stop.prevent="showContact"
                            >
                                <image class="contact-icon" src="/static/images/tabbar/phone.png" mode="aspectFit"></image>
                                <text>{{ item._pv.isEnded ? '已结束' : contactButtonText }}</text>
                            </button>
                        </view>
                    </view>
                </view>
            </view>

            <view v-else class="empty-state">
                <text class="empty-icon">📋</text>
                <text class="empty-text">暂无采购信息</text>
                <text class="empty-hint">去发布一条采购需求吧</text>
                <button class="empty-publish-btn" @tap="goPublishProcurement">立即发布</button>
                <button v-if="hasActiveFilters" class="clear-filter-btn" @tap="clearFilter">清除筛选条件</button>
            </view>

            <view v-if="displayItems.length > 0" class="load-complete">已加载全部信息</view>
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
import { PROCUREMENT_CATEGORIES, SUPPLY_REGIONS } from '../../utils/constants.js';
import { makePhoneCall } from '../../utils/util.js';
import { getProcurements, getProcurementContact } from '../../utils/api.js';
import { getFollowState, isFollowing, syncFollowStateFromServer, toggleFollowUser } from '../../utils/followState.js';
import AuthBadges from '../../components/auth-badges/auth-badges.vue';
import {
    normalizeProcurementItem,
    formatDeadlineCardRow,
    formatPublishRelative,
    isTodayPublishTag
} from '../../utils/procurementDisplay.js';
import { getViewCount as getViewCountFromItem, formatListViewCount as formatListViewCountFromItem } from '../../utils/viewCount.js';

const app = getApp();

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
            filterCategory: '全部',
            filterRegion: '全国',
            sortType: 'default',
            activeDropdown: null,
            categories: PROCUREMENT_CATEGORIES,
            regions: SUPPLY_REGIONS,
            sortOptions: [
                { label: '智能排序', value: 'default' },
                { label: '最新发布', value: 'timeDesc' },
                { label: '离我最近', value: 'nearest' },
                { label: '目标价从低到高', value: 'priceAsc' },
                { label: '采购量优先', value: 'qtyDesc' }
            ],
            sortTypeText: '智能排序',
            searchQuery: '',
            rawList: [],
            displayItems: [],
            contactInfo: null,
            isContactPurchaseMember: false,
            followingList: [],
            avatarFallbackMap: {},
            defaultAvatarUrl: '/static/images/default-avatar.png',
            /** 性能：列表拉取节流（毫秒），避免 onLoad 与 onShow 连续请求 */
            _procurementListThrottleMs: 35000,
            _lastProcurementListFetchAt: 0,
            _procurementListFetchPromise: null,
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
            return '最新采购';
        },
        hasActiveFilters() {
            return !!(
                this.searchQuery ||
                this.filterCategory !== '全部' ||
                this.filterRegion !== '全国' ||
                this.sortType !== 'default'
            );
        },
        contactButtonText() {
            return this.isContactPurchaseMember ? '联系他' : '会员可联系';
        }
    },
    onLoad() {
        this.initNavLayout();
        if (!app.globalData.isLoggedIn) {
            uni.redirectTo({
                url: '/pages/login/login'
            });
            return;
        }
        void (async () => {
            await this.loadFollowState();
            this.syncContactMemberState();
            await this.fetchProcurements({ reason: 'load' });
        })();
    },
    onShow() {
        uni.pageScrollTo({
            scrollTop: 0,
            duration: 0
        });
        void (async () => {
            await this.loadFollowState();
            this.syncContactMemberState();
            await this.fetchProcurements({ reason: 'show' });
        })();
    },
    async onPullDownRefresh() {
        try {
            await this.loadFollowState();
            this.syncContactMemberState();
            await this.fetchProcurements({ reason: 'pull', force: true });
        } catch (_e) {
            /* 静默失败，不打断原生下拉动画 */
        } finally {
            uni.stopPullDownRefresh();
        }
    },
    methods: {
        syncContactMemberState() {
            const userInfo = uni.getStorageSync('userInfo') || {};
            this.setData({
                isContactPurchaseMember: !!userInfo.is_member_active
            });
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
                /* 非微信或 API 失败 */
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
        formatPublishRelative,
        getViewCount(item) {
            return getViewCountFromItem(item);
        },
        formatListViewCount(item) {
            return formatListViewCountFromItem(item);
        },
        deadlineCardRow(item) {
            return formatDeadlineCardRow(item);
        },
        specDisplayText(item) {
            const s = (item._pv && item._pv.spec) || '';
            return s ? s : '不限';
        },
        statusTagsForCard(item) {
            const pv = item._pv;
            if (!pv || pv.isEnded) {
                return [];
            }
            const tags = [];
            if (pv.isUrgent) {
                tags.push({ text: '急购', cls: 'tag-urgent', shield: false });
            }
            if (pv.isLongTerm) {
                tags.push({ text: '长期采购', cls: 'tag-long', shield: false });
            }
            if (isTodayPublishTag(item)) {
                tags.push({ text: '今日发布', cls: 'tag-today', shield: false });
            }
            return tags;
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
        closeDropdown() {
            this.setData({ activeDropdown: null });
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
            if (sortType === 'priceAsc') return 'priceAsc';
            if (sortType === 'priceDesc') return 'priceDesc';
            if (sortType === 'qtyDesc') return 'qtyDesc';
            return 'timeDesc';
        },
        applyProcurementClientSort(items, sortType) {
            const list = items.map((x) => x);
            const pv = (it) => it._pv || {};
            const topRank = (it) => (pv(it).promoTopActive ? 1 : 0);
            const boostRank = (it) => (pv(it).promoBoostActive ? 1 : 0);
            const wrapTop = (cmp) => (a, b) => {
                const tr = topRank(b) - topRank(a);
                if (tr !== 0) return tr;
                const br = boostRank(b) - boostRank(a);
                if (br !== 0) return br;
                return cmp(a, b);
            };
            switch (sortType) {
                case 'qtyDesc':
                    list.sort(wrapTop((a, b) => (pv(b).qtySortValue || 0) - (pv(a).qtySortValue || 0)));
                    break;
                case 'nearest': {
                    const hasDist = list.some((it) => pv(it).distanceSortValue != null && !isNaN(pv(it).distanceSortValue));
                    if (hasDist) {
                        list.sort(
                            wrapTop((a, b) => {
                                const da = pv(a).distanceSortValue;
                                const db = pv(b).distanceSortValue;
                                if (da == null) return 1;
                                if (db == null) return -1;
                                return da - db;
                            })
                        );
                    }
                    break;
                }
                case 'priceAsc':
                    list.sort(wrapTop((a, b) => (pv(a).priceSortValue || 0) - (pv(b).priceSortValue || 0)));
                    break;
                case 'timeDesc':
                    list.sort(wrapTop((a, b) => (pv(b).timeSortValue || 0) - (pv(a).timeSortValue || 0)));
                    break;
                case 'default':
                    list.sort(
                        wrapTop((a, b) => {
                            const qb = pv(b).qtySortValue || 0;
                            const qa = pv(a).qtySortValue || 0;
                            if (qb !== qa) return qb - qa;
                            return (pv(b).timeSortValue || 0) - (pv(a).timeSortValue || 0);
                        })
                    );
                    break;
                default:
                    break;
            }
            return list;
        },
        refreshDisplayFromRaw() {
            const list = (this.rawList || []).map((x) => ({ ...x }));
            const sorted = this.applyProcurementClientSort(list, this.sortType);
            this.setData({ displayItems: sorted });
        },

        /** 节流返回时仅刷新关注标记，不重拉列表 */
        remapProcurementFavoriteOnly() {
            const followingList = this.followingList || [];
            const rawList = (this.rawList || []).map((item) => {
                const targetUserId = item.user_id || item.publisher_id || item.owner_user_id || '';
                const isFavorite =
                    !!targetUserId &&
                    (followingList.includes(String(targetUserId)) || isFollowing(targetUserId));
                return { ...item, isFavorite };
            });
            this.setData({ rawList });
            this.refreshDisplayFromRaw();
        },
        getPublisherAvatar(item) {
            const id = item && item.id ? String(item.id) : '';
            if (id && this.avatarFallbackMap[id]) {
                return this.defaultAvatarUrl;
            }
            const pv = item && item._pv ? item._pv : {};
            return (
                pv.avatarUrl ||
                item.publisher_avatar ||
                item.avatar_url ||
                item.avatarUrl ||
                item.avatar ||
                item.avatar_file ||
                this.defaultAvatarUrl
            );
        },
        onAvatarError(e) {
            const id = e && e.currentTarget && e.currentTarget.dataset ? String(e.currentTarget.dataset.id || '') : '';
            if (!id) return;
            this.setData({
                avatarFallbackMap: {
                    ...(this.avatarFallbackMap || {}),
                    [id]: true
                }
            });
        },
        async fetchProcurements(opts = {}) {
            const reason = opts.reason || 'show';
            const force = opts.force === true;
            const now = Date.now();
            const throttleMs = this._procurementListThrottleMs || 35000;

            if (this._procurementListFetchPromise) {
                // #region 性能验收日志（可删）
                console.log('[perf][procurement] coalesce in-flight', { reason });
                // #endregion
                return this._procurementListFetchPromise;
            }

            const shouldThrottleNetwork =
                !force &&
                reason === 'show' &&
                this._lastProcurementListFetchAt &&
                now - this._lastProcurementListFetchAt < throttleMs &&
                Array.isArray(this.rawList) &&
                this.rawList.length > 0;

            if (shouldThrottleNetwork) {
                // #region 性能验收日志（可删）
                console.log('[perf][procurement] skip list fetch (throttle)', {
                    reason,
                    ageMs: now - this._lastProcurementListFetchAt,
                    throttleMs
                });
                // #endregion
                this.remapProcurementFavoriteOnly();
                return;
            }

            const t0 = Date.now();
            // #region 性能验收日志（可删）
            console.log('[perf][procurement] list fetch start', { reason, force });
            // #endregion

            const run = async () => {
                try {
                    const { filterCategory, filterRegion, searchQuery, sortType } = this;
                    const sortParam = this.mapApiSort(sortType);
                    const regionParam =
                        !filterRegion || filterRegion === '全国' || filterRegion === '附近' ? undefined : filterRegion;
                    const pageSize = Math.max(10, Number(this.listPageSize) || 30);
                    const result = await getProcurements({
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
                        const item = normalizeProcurementItem(row);
                        const targetUserId = row.user_id || row.publisher_id || row.owner_user_id || '';
                        item.isFavorite =
                            !!targetUserId &&
                            (followingList.includes(String(targetUserId)) || isFollowing(targetUserId));
                        return item;
                    });
                    items = this.applyProcurementClientSort(items, sortType);
                    this._lastProcurementListFetchAt = Date.now();
                    this.setData({ rawList: items, displayItems: items });

                    // #region 性能验收日志（可删）
                    console.log('[perf][procurement] list fetch done', {
                        reason,
                        totalMs: Date.now() - t0,
                        count: items.length,
                        pageSize
                    });
                    // #endregion
                } catch (error) {
                    console.error('获取采购列表失败:', error);
                    const fallback = [];
                    this.setData({ rawList: fallback, displayItems: fallback });
                    uni.showToast({
                        title: '加载失败，请重试',
                        icon: 'none'
                    });
                }
            };

            this._procurementListFetchPromise = run().finally(() => {
                this._procurementListFetchPromise = null;
            });
            return this._procurementListFetchPromise;
        },

        async filterItems() {
            return this.fetchProcurements({ reason: 'user', force: true });
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
                    void this.fetchProcurements({ reason: 'user', force: true });
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
        clearFilter() {
            this.setData({
                filterCategory: '全部',
                filterRegion: '全国',
                sortType: 'default',
                sortTypeText: '智能排序',
                searchQuery: '',
                searchInputValue: '',
                activeDropdown: null
            });
            this.filterItems();
        },
        goPublishProcurement() {
            uni.navigateTo({
                url: '/pages/publish-info/publish-info?tab=procurement'
            });
        },
        goToProcurementDetail(e) {
            const id = e.currentTarget.dataset.id;
            if (!id) {
                return;
            }
            uni.navigateTo({
                url: `/pages/procurement-detail/procurement-detail?id=${encodeURIComponent(id)}`
            });
        }
    }
};
</script>
<style>
@import './procurement.css';
</style>
