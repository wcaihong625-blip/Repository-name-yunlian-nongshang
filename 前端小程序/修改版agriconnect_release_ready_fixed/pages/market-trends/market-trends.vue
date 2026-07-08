<template>
    <view class="market-page" :style="pageRootStyle">
        <!-- 顶栏标题：与采购页 p-nav 一致 -->
        <view class="mt-title-header p-green-header" :style="{ paddingTop: statusBarHeight + 'px' }">
            <view class="p-nav-row" :style="{ height: navRowHeightPx + 'px', paddingRight: headerRightInset + 'px' }">
                <text class="p-nav-title">今日行情</text>
            </view>
            <!-- 搜索栏 -->
            <view class="search-section">
                <view class="search-wrapper">
                    <image class="search-icon" src="/static/images/tabbar/magnifier.png" mode="aspectFit"></image>
                    <input 
                        class="search-input" 
                        type="text" 
                        placeholder="搜索农产品..." 
                        v-model="searchKeyword"
                        @input="onSearchInput"
                        @confirm="onSearchConfirm"
                    />
                    <view v-if="searchKeyword" class="clear-btn" @tap="clearSearch">×</view>
                </view>
            </view>
        </view>

        <!-- 主导航栏：产地行情、批发市场行情、行情预测 -->
        <view class="main-nav-section" :style="{ top: layoutMainNavTopPx + 'px' }">
            <view 
                class="main-nav-item" 
                :class="{ active: activeMainNav === 'origin' }"
                @tap="switchMainNav('origin')"
            >
                产地行情
            </view>
            <view 
                class="main-nav-item" 
                :class="{ active: activeMainNav === 'wholesale' }"
                @tap="switchMainNav('wholesale')"
            >
                批发市场行情
            </view>
            <view 
                class="main-nav-item" 
                :class="{ active: activeMainNav === 'forecast' }"
                @tap="switchMainNav('forecast')"
            >
                行情分析
            </view>
        </view>

        <!-- 分类导航 -->
        <view class="category-nav-section" :style="{ top: layoutCategoryNavTopPx + 'px' }">
            <view 
                class="category-nav-item" 
                :class="{ active: selectedCategory === item, expanded: selectedCategory === item && showSubCategoryMenu, 'all-item': item === '全部' }"
                v-for="(item, index) in categories"
                :key="index"
                @tap="toggleCategoryMenu(item)"
            >
                <text>{{ getCategoryDisplayName(item) }}</text>
                <text v-if="selectedCategory === item" class="arrow-icon" :class="{ expanded: showSubCategoryMenu }">▼</text>
            </view>
        </view>

        <!-- 二级菜单 - 微信小程序风格 -->
        <view
            class="sub-category-section"
            v-if="showSubCategoryMenu && currentSubCategories.length > 0"
            :style="{ top: layoutSubCategoryTopPx + 'px' }"
        >
            <view class="sub-category-container">
                <view 
                    class="sub-category-item" 
                    :class="{ active: isSubCategoryActive(item) }"
                    v-for="(item, index) in currentSubCategories"
                    :key="index"
                    @tap="selectSubCategory(item)"
                >
                    {{ item }}
                </view>
            </view>
        </view>

        <!-- 产品信息和更新时间：产地 / 批发 / 行情分析 三 Tab 常驻「品种或全部 + 更新时间」 -->
        <view
            class="product-header"
            :class="{
                'wholesale-product-header': activeMainNav === 'wholesale',
                'origin-product-header': activeMainNav === 'origin' || activeMainNav === 'forecast',
                'product-header-fixed': true
            }"
            :style="{ top: layoutProductHeaderTopPx + 'px' }"
            v-if="activeMainNav === 'wholesale' || activeMainNav === 'origin' || activeMainNav === 'forecast'"
        >
            <view class="product-header-top">
                <view class="product-info">
                    <text
                        class="product-name"
                        :class="{ 'all-product-name': marketHeaderTitle === '全国' }"
                    >{{ marketHeaderTitle }}</text>
                </view>
                <view class="update-time-text" v-if="meta.updateTime">
                    {{ activeMainNav === 'wholesale' ? meta.updateTime : formatUpdateTime(meta.updateTime) }} 更新
                </view>
            </view>
        </view>

        <!-- 行情分析解读：只在 行情分析 Tab 显示 -->
        <view v-if="activeMainNav === 'forecast'" class="forecast-content-with-fixed-header">
            <!-- 选择"全部"时：每条分析单独一张卡片展示 -->
            <view v-if="selectedCategory === '全部' || !selectedSubCategory">
                <!-- 空态显示 -->
                <view v-if="analysisCardList.length === 0" class="empty-state">
                    <text>今日暂无数据</text>
                </view>
                <!-- 数据列表：只显示有内容的分析 -->
                <view
                    v-for="(item, index) in analysisCardsVisible"
                    :key="item._id || item.id || item.name || index"
                    class="analysis-section"
                >
                    <view class="section-title">
                        <text class="product-name-title">{{ item.name || item.productName || '行情分析' }}</text>
                    </view>

                    <view class="analysis-content">
                        <text>{{ cleanAnalysisText(item.display_text || item.raw_line) }}</text>
                    </view>
                </view>
                <view
                    v-if="analysisCardList.length > 0 && analysisCardsVisible.length < analysisCardList.length"
                    class="market-load-more-hint"
                >
                    <text>上拉加载更多</text>
                </view>
            </view>

            <!-- 选择具体品种时：保持单条展示 -->
            <view v-else-if="analysisItem && analysisItem.display_text" class="analysis-section">
                <view class="section-title">
                    <text class="product-name-title">{{ analysisItem.name || '行情分析' }}</text>
                </view>

                <view class="analysis-content">
                    <text>{{ cleanAnalysisText(analysisItem.display_text) }}</text>
                </view>
            </view>

            <!-- 选择具体品种但无数据 -->
            <view v-else class="empty-state">
                <text>今日暂无数据</text>
            </view>
        </view>

        <!-- 各地农产品价格：非行情分析模式才显示 -->
        <view class="region-price-section" :class="{ 'wholesale-card': activeMainNav === 'wholesale', 'with-fixed-product-header': activeMainNav !== 'forecast' }" v-if="activeMainNav !== 'forecast'">
            <view class="section-title" :class="{ 'wholesale-section-title': activeMainNav === 'wholesale', 'origin-section-title': activeMainNav === 'origin' }">
                <view class="section-title-left">
                    各地行情价格
                </view>
                <text class="update-time-small" v-if="meta.updateDate || meta.updateTime">
                    {{ meta.updateDate || formatUpdateTime(meta.updateTime) }} 更新
                </text>
            </view>
            <!-- 空态显示 -->
            <view v-if="regionPriceList.length === 0" class="empty-state">
                <text>今日暂无数据</text>
            </view>
            <!-- 数据列表 -->
            <view class="region-price-list" v-else>
                <view class="market-table-header origin-table-header" v-if="activeMainNav === 'origin'">
                    <text class="col-left">地区</text>
                    <text class="col-mid">品类</text>
                    <text class="col-right">价格(元/斤)</text>
                </view>
                <view class="market-table-header wholesale-table-header" v-else-if="activeMainNav === 'wholesale'">
                    <text class="col-left market-col">市场</text>
                    <text class="col-mid spec-col">规格</text>
                    <text class="col-right price-col">本周均价（元/斤）</text>
                </view>
                <view 
                    class="region-price-item" 
                    v-for="(item, index) in regionPricesVisible" 
                    :key="index"
                >
                    <view class="region-info" v-if="activeMainNav === 'origin'">
                        <text class="region-name col-left">{{ item.location || '-' }}</text>
                        <text class="region-name col-mid">{{ item.category || '-' }}</text>
                        <text class="region-price-value col-right">{{ item.price || '-' }}</text>
                    </view>
                    <view class="region-info wholesale-row" v-else-if="activeMainNav === 'wholesale'">
                        <text class="region-name col-left market-col">{{ item.market || item.marketName || '-' }}</text>
                        <text class="region-name col-mid spec-col">{{ item.spec || '通货' }}</text>
                        <text class="region-price-value col-right price-col wholesale-price">{{ item.price || '-' }}</text>
                    </view>
                </view>
            </view>
            <view
                v-if="regionPriceList.length > 0 && regionPricesVisible.length < regionPriceList.length"
                class="market-load-more-hint"
            >
                <text>上拉加载更多</text>
            </view>
        </view>
    </view>
</template>

<script>
import { saveSalesSourceToStorage } from '@/utils/api.js';
import {
  STORAGE_ACTIVE,
  STORAGE_BACKUP,
  copyActiveToBackup,
  extractBundleProducts,
  validateBundleProducts,
  getPointerVersionKey,
  buildUrlsFromPointer,
  inferDataDate,
  readActivePayload,
  readBackupPayload,
  hasValidMarketPayload,
  getLocalCacheState,
  readMeta,
  writeMeta,
  writeStorageJson,
  perfLog,
  POINTER_CHECK_MIN_INTERVAL_MS
} from '@/utils/marketCacheV2.js';

// ====== ✅ 固定入口：永远从云函数拿“最新指针 URL” ======
// 这个地址永远不变：你以后不需要在小程序里手动改任何 CDN 链接
const YMT_ENTRY_GET_POINTER = 'https://fc-mp-ab506838-a8d9-4b39-b973-ccf131ef8a18.next.bspapp.com/get-latest-pointer';
const DEBUG_MARKET = true;
const MARKET_REQUEST_TIMEOUT_MS = 20000;

/** 计算属性里不要每次 return []，否则 watch 会认为引用一直变，触发死循环卡死页面 */
const MT_EMPTY_SUB_CATEGORIES = [];

/** 默认全部页：热门高频农产品优先展示。越靠前权重越高；未命中则保持原数据相对顺序。 */
const HOT_MARKET_PRODUCTS = [
  '土豆', '白菜', '萝卜', '胡萝卜', '西红柿', '黄瓜', '茄子', '辣椒',
  '大葱', '大蒜', '生姜', '洋葱', '芹菜', '菠菜', '油菜', '豆角',
  '苹果', '香蕉', '梨', '西瓜', '葡萄', '草莓', '樱桃', '桃',
  '柑桔', '橙子', '柚子', '芒果'
];
const HOT_MARKET_PRODUCT_RANK = HOT_MARKET_PRODUCTS.reduce((acc, name, index) => {
  acc[name] = index;
  return acc;
}, {});

function _parseRangeToNumber(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  // 可能是 "0.95-1.2" 或 "1"
  const parts = s.split('-').map(x => parseFloat(x)).filter(x => !Number.isNaN(x));
  if (!parts.length) return null;
  if (parts.length === 1) return parts[0];
  return (parts[0] + parts[parts.length - 1]) / 2;
}

export default {
  data() {
    return {
      bundleProducts: [],
      bundleMeta: {},
      // 云端数据（列表）
      products: [],
      meta: {},

      // 主导航：产地行情、批发市场行情、行情分析
      activeMainNav: 'origin',

      // 分类导航
      categories: ['全部', '蔬菜', '水果'],
      selectedCategory: '全部',
      selectedSubCategory: '',
      selectedRegion: '',
      showSubCategoryMenu: false,

      // 子分类数据（完整品种清单）
      categoryData: {
        '蔬菜': [
          // 热门/常用蔬菜优先
          '土豆', '白菜', '萝卜', '胡萝卜', '西红柿', '黄瓜', '茄子', '辣椒', 
          '大葱', '大蒜', '生姜', '洋葱', '芹菜', '菠菜', '油菜', '豆角', 
          '南瓜', '冬瓜', '西葫芦', '西兰花', '菜花', '蒜苗', '韭菜', '香菜', 
          '山药', '红薯', '娃娃菜', '莴笋', '莲藕', '丝瓜', '苦瓜', 
          // 其他蔬菜
          '百合', '荸荠', '扁豆', '冰草', '菜苔', '春笋', '慈姑', '冬笋', 
          '豆芽', '甘蓝', '花生芽', '槐花', '茴香', '荠菜', '茭白', '芥蓝', 
          '蕨菜', '莲雾', '菱角', '毛豆', '魔芋', '枇杷', '青梗菜', '秋葵', 
          '山姜', '山野菜', '生菜', '圣女果', '释迦', '四季豆', '蒜苔', 
          '茼蒿', '豌豆', '乌塌菜', '西梅', '鲜枣', '香椿芽', '小葱', 
          '叶用甜菜', '鱼腥草', '芋头', '芸豆', '榨菜', '竹笋'
        ],
        '水果': [
          // 热门/常用水果优先
          '苹果', '香蕉', '梨', '西瓜', '葡萄', '草莓', '樱桃', '桃', 
          '柑桔', '橙子', '柚子', '芒果', '菠萝', '火龙果', '哈密瓜',
          // 其他水果
          '百香果', '菠萝蜜', '灯笼果', '番石榴', '甘蔗', '橄榄', '蓝莓', 
          '李子', '荔枝', '榴莲', '龙眼', '猕猴桃', '木瓜', '柠檬', '牛油果', 
          '山楂', '石榴', '柿子', '甜瓜', '乌梅', '无花果', '杏', '杨梅', 
          '杨桃', '椰子'
        ]
      },
      regionData: [
        '全国',
        '北京', '天津', '河北', '山西', '内蒙古', '辽宁', '吉林', '黑龙江',
        '上海', '江苏', '浙江', '安徽', '福建', '江西', '山东', '河南',
        '湖北', '湖南', '广东', '广西', '海南', '重庆', '四川', '贵州',
        '云南', '西藏', '陕西', '甘肃', '青海', '宁夏', '新疆'
      ],

      // 搜索
      searchKeyword: '',
      _searchTimer: null,
      // 请求标记，用于防止异步竞态条件（快速切换 Tab/输入搜索时）
      _requestId: 0,

      // 行情分析内容（前端生成）
      analysisItem: null,
      // 行情分析列表（analysis_only.json 里的 data）
      analysisList: [],
      rawAnalysisList: [],

      // 各地价格列表（从 products 汇总）
      regionPriceList: [],
      rawRegionPriceList: [],

      /** 列表分页：首屏各 10 条，上拉累加 */
      listPageSize: 10,
      regionDisplayLimit: 10,
      analysisDisplayLimit: 10,

      // 自定义顶栏（与采购页一致，用于下移固定搜索/导航）
      statusBarHeight: 20,
      navRowHeightPx: 44,
      headerRightInset: 12,
      layoutSearchTopPx: 0,
      layoutMainNavTopPx: 0,
      layoutCategoryNavTopPx: 0,
      layoutSubCategoryTopPx: 0,
      layoutContentPaddingTopPx: 0,
      /** 二级分类条实际高度（px），用于把吸顶「产品+时间」接到最后一栏下方 */
      subCategorySectionHeightPx: 0,

      /** 行情缓存 v2：pointer 检查 / 全量拉取 in-flight 复用 */
      _pointerCheckInFlight: null,
      _fullFetchInFlight: null,
      loading: false,
      error: null
    };
  },

  computed: {
    currentProductName() {
      return this.selectedSubCategory || '';
    },

    currentSubCategories() {
      if (this.selectedCategory === '全部') return this.regionData || MT_EMPTY_SUB_CATEGORIES;
      const list = this.categoryData[this.selectedCategory];
      return Array.isArray(list) ? list : MT_EMPTY_SUB_CATEGORIES;
    },
    // 行情分析：点击“全部”时，按品种去重（保留最新一条），用于渲染多卡片
    analysisCardList() {
      // 仅在“行情分析”页展示卡片
      if (this.activeMainNav !== 'forecast') return [];

      const list = Array.isArray(this.analysisList) ? this.analysisList : [];
      const keyword = (this.searchKeyword || '').trim().toLowerCase();

      return list
        .map(p => {
          const name = this.cleanProductName(p.name || p.productName || '');
          const rawText = p.analysis_text || p.analysis || p.display_text || '';
          const display_text = this.cleanAnalysisText(rawText);
          return { name, display_text };
        })
        .filter(p => p.display_text && p.display_text.trim().length > 0)
        .filter(p => {
          if (!keyword) return true;
          return (p.name || '').toLowerCase().includes(keyword) || (p.display_text || '').toLowerCase().includes(keyword);
        });
    },

    analysisCardsVisible() {
      const full = this.analysisCardList || [];
      const n = Math.max(1, Number(this.analysisDisplayLimit) || this.listPageSize);
      return full.slice(0, n);
    },

    regionPricesVisible() {
      const full = this.regionPriceList || [];
      const n = Math.max(1, Number(this.regionDisplayLimit) || this.listPageSize);
      return full.slice(0, n);
    },


    currentProduct() {
      const list = this.bundleProducts || [];
      const name = (this.currentProductName || '').trim();
      if (!name) {
        return list[0] || null;
      }
      const found = list.find(p => {
        if (!p || typeof p !== 'object') return false;
        const raw = String(p.name || p.productName || '').trim();
        if (!raw) return false;
        if (raw === name) return true;
        const core = this.cleanProductName(raw);
        // 只做严格匹配，避免 “萝卜” 误命中 “胡萝卜”
        return core === name;
      });
      return found || list[0] || null;
    },

    selectedProduct() {
      // “全部”模式下不展示单品标题位，避免回退到第一个产品（如白菜）造成误显示
      if (this.selectedCategory === '全部' && !this.selectedSubCategory) return null;
      return this.currentProduct;
    },

    marketHeaderTitle() {
      return (this.selectedProduct && this.selectedProduct.name) ||
        this.selectedSubCategory ||
        this.getCategoryDisplayName(this.selectedCategory || '全部') ||
        '全国';
    },

    /** 与模板二级菜单 v-if 一致 */
    subCategoryOverlayVisible() {
      return (
        this.showSubCategoryMenu &&
        (this.currentSubCategories || []).length > 0
      );
    },

    /** 吸顶「产品+时间」接在最后一栏（二级菜单）下，避免与二级栏同 top 被盖住 */
    layoutProductHeaderTopPx() {
      const base = Number(this.layoutSubCategoryTopPx) || 0;
      const subH = this.subCategoryOverlayVisible ? Number(this.subCategorySectionHeightPx) || 0 : 0;
      return base + subH;
    },

    /** 与 --mt-sticky-product-to-card(120rpx) 同语义：吸顶产品栏 + 与首张卡片的间距 */
    _mtStickyReservePx() {
      const upx = typeof uni.upx2px === 'function' ? uni.upx2px.bind(uni) : (r) => r * 0.5;
      return upx(120);
    },

    /** 滚动区首张卡片上边距：二级条高度（展开时）+ 吸顶产品栏占位 */
    layoutCardBlockMarginTopPx() {
      const subH = this.subCategoryOverlayVisible ? Number(this.subCategorySectionHeightPx) || 0 : 0;
      return subH + this._mtStickyReservePx;
    },

    pageRootStyle() {
      return {
        paddingTop: `${this.layoutContentPaddingTopPx}px`,
        '--mt-card-block-margin-top': `${this.layoutCardBlockMarginTopPx}px`
      };
    }
  },

  watch: {
    subCategoryOverlayVisible() {
      this.measureSubCategoryBar();
    },
    /** 切换大类时二级列表与高度会变；勿直接 watch currentSubCategories（曾用 return [] 导致引用每帧都变、卡死） */
    selectedCategory() {
      this.measureSubCategoryBar();
    }
  },

  created() {
    this.initNavLayout();
  },

  mounted() {
    this.measureSubCategoryBar();
  },

  onLoad(options) {
    // 销售推广分享落地：与会员页一致写入 invite_code，便于后续跳转会员中心时归属不丢
    this.applySalesSourceFromQuery(options);
    // 首屏数据统一在 onShow 拉取，避免与 onShow 重复触发整套请求（onLoad 后必有一次 onShow）
  },
  onShow() {
    this.hydrateFromLocalCache();
    this.runMarketBackgroundCheck({ source: 'show', forcePointer: false });
    this.$nextTick(() => {
      this.measureSubCategoryBar();
    });
  },
  async onPullDownRefresh() {
    try {
      await this.runMarketBackgroundCheck({ source: 'pull', forcePointer: true });
    } finally {
      uni.stopPullDownRefresh();
    }
  },

  onReachBottom() {
    const step = Math.max(1, Number(this.listPageSize) || 10);
    if (this.activeMainNav === 'forecast') {
      if (this.selectedCategory === '全部' || !this.selectedSubCategory) {
        this.analysisDisplayLimit = (Number(this.analysisDisplayLimit) || step) + step;
      }
      return;
    }
    this.regionDisplayLimit = (Number(this.regionDisplayLimit) || step) + step;
  },

  methods: {
    applySalesSourceFromQuery(options) {
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
        saveSalesSourceToStorage(source);
      }
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
      // 顶栏底部 = 状态栏 + nav 行高度；不要额外 +12，否则主菜单会下移出现空隙
      const titleBarBottom = sb + navH;
      const searchH = upx(112);
      const mainNavH = upx(86);
      const catNavH = upx(86);
      this.statusBarHeight = sb;
      this.navRowHeightPx = navH;
      this.headerRightInset = inset;
      this.layoutSearchTopPx = titleBarBottom;
      this.layoutMainNavTopPx = titleBarBottom + searchH;
      this.layoutCategoryNavTopPx = titleBarBottom + searchH + mainNavH;
      this.layoutSubCategoryTopPx = titleBarBottom + searchH + mainNavH + catNavH;
      this.layoutContentPaddingTopPx = this.layoutSubCategoryTopPx;
      this.measureSubCategoryBar();
    },

    measureSubCategoryBar() {
      if (!this.subCategoryOverlayVisible) {
        this.subCategorySectionHeightPx = 0;
        return;
      }
      this.$nextTick(() => {
        this.$nextTick(() => {
          try {
            const q = uni.createSelectorQuery().in(this);
            q.select('.sub-category-section')
              .boundingClientRect((rect) => {
                if (rect && rect.height) {
                  this.subCategorySectionHeightPx = Math.round(rect.height);
                } else {
                  this.subCategorySectionHeightPx = 0;
                }
              })
              .exec();
          } catch (e) {
            /* ignore */
          }
        });
      });
    },
    // =========================
    // 0) 日期工具函数
    // =========================
    
    /**
     * 将输入解析并输出 YYYY-MM-DD 格式
     * 兼容：YYYY-MM-DD、YYYY-MM-DD HH:mm:ss、时间戳（毫秒/秒）
     * @param {string|number} input - 日期字符串或时间戳
     * @returns {string} YYYY-MM-DD 格式的日期字符串，解析失败返回空字符串
     */
    formatToYMD(input) {
      if (!input && input !== 0) return '';
      
      // 如果是数字（时间戳）
      if (typeof input === 'number') {
        // 判断是秒级还是毫秒级时间戳（通常大于 1e12 的是毫秒级）
        const timestamp = input > 1e12 ? input : input * 1000;
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      
      // 如果是字符串
      if (typeof input === 'string') {
        const trimmed = input.trim();
        if (!trimmed) return '';
        
        // 如果已经是 YYYY-MM-DD 格式，直接返回
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
          return trimmed;
        }
        
        // 如果是 YYYY-MM-DD HH:mm:ss 格式，提取日期部分
        const dateMatch = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
        if (dateMatch) {
          return dateMatch[1];
        }
        
        // 尝试用 Date 解析
        const date = new Date(trimmed);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
      }
      
      return '';
    },
    
    /**
     * 判断某条数据是否为今天（使用本地时区）
     * @param {string|number} dateStrOrTs - 日期字符串或时间戳
     * @returns {boolean} 是否为今天
     * 
     * 验收用例（可在控制台测试）：
     * - isToday('2025-12-19') → 如果今天是 2025-12-19，返回 true，否则 false
     * - isToday('2025-12-18') → 如果今天是 2025-12-19，返回 false
     * - isToday('2025-12-19 00:01:00') → 如果今天是 2025-12-19，返回 true
     * - isToday(1734566400000) → 毫秒时间戳（今天）→ 返回 true
     * - isToday(1734566400) → 秒时间戳（今天）→ 返回 true
     * - isToday('') → 返回 false
     * - isToday(null) → 返回 false
     */
    isToday(dateStrOrTs) {
      const dateStr = this.formatToYMD(dateStrOrTs);
      if (!dateStr) return false;
      
      // 使用本地时区获取今天的日期
      const today = new Date();
      const todayYear = today.getFullYear();
      const todayMonth = String(today.getMonth() + 1).padStart(2, '0');
      const todayDay = String(today.getDate()).padStart(2, '0');
      const todayStr = `${todayYear}-${todayMonth}-${todayDay}`;
      
      return dateStr === todayStr;
    },

    /**
     * 获取今天的日期字符串（YYYY-MM-DD 格式，按本地时区计算）
     * 使用 new Date() 获取本地时间，适用于 Asia/Shanghai 时区
     * @returns {string} YYYY-MM-DD 格式的今天日期
     */
    getTodayCN() {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, '0');
      const day = String(today.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    },
    normalizeDateKey(input) {
      if (input == null || input === '') return '';
      if (typeof input === 'number') {
        const ms = input > 1e12 ? input : input * 1000;
        const d = new Date(ms);
        if (isNaN(d.getTime())) return '';
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
      const raw = String(input).trim();
      if (!raw) return '';
      if (/^\d{10,13}$/.test(raw)) {
        const n = Number(raw);
        if (!Number.isNaN(n)) return this.normalizeDateKey(n);
      }
      const simple = raw.replace(/\//g, '-');
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(simple)) {
        const [y, m, d] = simple.split('-');
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
      const m = simple.match(/^(\d{4}-\d{1,2}-\d{1,2})/);
      if (m && m[1]) {
        return this.normalizeDateKey(m[1]);
      }
      const d = new Date(raw);
      if (isNaN(d.getTime())) return '';
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${mo}-${day}`;
    },
    toDateTs(dateKey) {
      if (!dateKey) return 0;
      const d = new Date(`${dateKey}T00:00:00`);
      const t = d.getTime();
      return Number.isFinite(t) ? t : 0;
    },
    findDateValue(row, fallback = null) {
      const keys = ['date', 'day', 'trade_date', 'publish_date', 'updated_at', 'created_at', 'timestamp', 'time'];
      for (const k of keys) {
        if (row && row[k] != null && row[k] !== '') return row[k];
      }
      if (!fallback) return '';
      for (const k of keys) {
        if (fallback[k] != null && fallback[k] !== '') return fallback[k];
      }
      return '';
    },
    pickPreferredDate(entries) {
      if (!Array.isArray(entries) || entries.length === 0) {
        return { preferredDate: '', filtered: [] };
      }
      const today = this.getTodayCN();
      const dated = entries
        .map((x) => {
          const dateKey = this.normalizeDateKey(x.__date);
          return { ...x, __dateKey: dateKey, __dateTs: this.toDateTs(dateKey) };
        })
        .filter((x) => !!x.__dateKey);
      if (!dated.length) {
        return { preferredDate: '', filtered: entries };
      }
      const hasToday = dated.some((x) => x.__dateKey === today);
      let preferredDate = today;
      if (!hasToday) {
        preferredDate = dated.reduce((best, cur) => (cur.__dateTs > best.__dateTs ? cur : best), dated[0]).__dateKey;
      }
      return {
        preferredDate,
        filtered: dated.filter((x) => x.__dateKey === preferredDate)
      };
    },
    dateKeyToDisplay(dateKey) {
      if (!dateKey) return '';
      const [y, m, d] = String(dateKey).split('-');
      if (!y || !m || !d) return '';
      return `${y}/${m}/${d}`;
    },

    // =========================
    // 1) UI 交互：导航/分类/搜索
    // =========================

    onSearchInput(e) {
      const value = e.detail ? e.detail.value : (e.target && e.target.value);
      this.searchKeyword = value || '';
      if (this._searchTimer) clearTimeout(this._searchTimer);
      this._searchTimer = setTimeout(() => {
        this.updateProductData();
      }, 300);
    },

    onSearchConfirm() {
      const keyword = (this.searchKeyword || '').trim();
      if (!keyword) {
        this.clearSearch();
        return;
      }

      // 1. 尝试匹配具体产品：如果搜索词匹配某个二级分类（如“土豆”），直接进入单品详情页
      let match = null;
      
      // 遍历分类数据查找匹配
      for (const cat in this.categoryData) {
        const list = this.categoryData[cat];
        // 1.1 精确匹配
        if (list.includes(keyword)) {
          match = { category: cat, subCategory: keyword };
          break;
        }
        // 1.2 搜索词包含品种名（如“河南土豆”包含“土豆”）
        if (!match) {
          const found = list.find(item => keyword.includes(item));
          if (found) {
            match = { category: cat, subCategory: found };
          }
        }
        // 1.3 品种名包含搜索词（如搜索“娃娃”，匹配“娃娃菜”） - 优先级较低，作为兜底
        if (!match) {
           const found = list.find(item => item.includes(keyword));
           if (found) {
             match = { category: cat, subCategory: found };
           }
        }
        
        if (match) break;
      }

      if (match) {
        // 命中具体产品 -> 进入单品页面
        this.selectedCategory = match.category;
        this.selectedSubCategory = match.subCategory;
        this.showSubCategoryMenu = false;
        // 如果当前是行情分析模式，仍然留在行情分析，但会显示该产品的分析
        // 否则留在当前模式（产地/批发）
      } else {
        // 未命中具体产品 -> 全局搜索列表（显示"全部"分类下匹配的结果）
        this.selectedCategory = '全部';
        this.selectedSubCategory = '';
        this.selectedRegion = '';
        this.showSubCategoryMenu = false;
      }

      this.updateProductData();
    },

    clearSearch() {
      this.searchKeyword = '';
      // 清除搜索时，如果当前是"全部"分类，保持"全部"；如果是单品，也就是留在单品页但去掉搜索过滤？
      // 并没有"过滤"单品页的逻辑（单品页显示该产品所有地区）。
      // 搜索通常用于找产品。清除搜索后，是否要重置回"全部"？
      // 用户习惯：点X，清空当前搜索结果，显示默认列表。
      // 所以重置为"全部"比较合理，或者保持现状但清空keyword。
      // 为简单起见，这里重置筛选
      if (this.selectedCategory === '全部') {
         this.updateProductData();
      } else {
         // 如果在单品页清除搜索，就显示该单品的全部数据（不过滤）
         this.updateProductData();
      }
    },

    // 搜索过滤辅助函数
    _filterByKeyword(list) {
      if (!list) return [];
      const k = (this.searchKeyword || '').trim().toLowerCase();
      if (!k) return list;
      return list.filter(item => {
        const text = (
          item.region ||
          item.location ||
          item.market ||
          item.category ||
          item.spec ||
          item.name ||
          ''
        ).toLowerCase();
        return text.includes(k);
      });
    },
    isCleanOriginPriceRow(item) {
      const location = String((item && item.location) || '').trim();
      const category = String((item && item.category) || '').trim();
      const price = String((item && item.price) || '').trim();
      // 产地数据源里有些行缺少 category，但 location+price 仍是有效行情，不能整行丢弃
      if (!location || !price) return false;
      const merged = `${location} ${category} ${price}`;
      if (/(https?:\/\/|img\.|!\[|\]\(|<img|data:image)/i.test(merged)) return false;
      if (/(大量上市|大量供应|现货供应|基地直发|装车|代办|联系电话|微信|扫一扫|点击查看|详情)/.test(merged)) return false;
      return true;
    },
    filterCleanOriginRows(list) {
      return Array.isArray(list) ? list.filter((item) => this.isCleanOriginPriceRow(item)) : [];
    },
    filterBySelectedRegion(list) {
      if (!Array.isArray(list)) return [];
      const region = String(this.selectedRegion || '').trim();
      if (!region) return list;
      return list.filter((item) => {
        const text = [
          item.location,
          item.region,
          item.market,
          item.origin,
          item.address
        ].filter(Boolean).join(' ');
        return String(text).includes(region);
      });
    },
    getHotProductRank(name) {
      const raw = this.cleanProductName(name || '');
      if (!raw) return 9999;
      if (HOT_MARKET_PRODUCT_RANK[raw] != null) return HOT_MARKET_PRODUCT_RANK[raw];
      const matched = HOT_MARKET_PRODUCTS.find((hot) => raw.includes(hot) || hot.includes(raw));
      return matched ? HOT_MARKET_PRODUCT_RANK[matched] : 9999;
    },
    sortByHotProduct(list) {
      if (!Array.isArray(list)) return [];
      return list
        .map((item, index) => ({ item, index }))
        .sort((a, b) => {
          const an = a.item.__productName || a.item.productName || a.item.name || a.item.category || a.item.itemName || '';
          const bn = b.item.__productName || b.item.productName || b.item.name || b.item.category || b.item.itemName || '';
          const ar = this.getHotProductRank(an);
          const br = this.getHotProductRank(bn);
          if (ar !== br) return ar - br;
          return a.index - b.index;
        })
        .map(({ item }) => item);
    },
    normalizeMarketProduct(product) {
      const isDirtyOriginText = (value) => {
        const text = String(value || '').trim();
        if (!text) return false;
        if (/(https?:\/\/|img\.|!\[|\]\(|<img|data:image)/i.test(text)) return true;
        if (/(大量上市|大量供应|现货供应|基地直发|装车|代办|联系电话|微信|扫一扫|点击查看|详情)/.test(text)) return true;
        // 地区列不应出现完整价格句子，出现这类内容基本是源站描述文案串列了。
        if (text.length > 28 && /(元\/斤|元\/公斤|\/斤|\/公斤|\d+(\.\d+)?元)/.test(text)) return true;
        return false;
      };
      const sanitizeOriginLocation = (value) => {
        const text = String(value || '').trim();
        if (!text || isDirtyOriginText(text)) return '';
        return text.replace(/\s+/g, '');
      };
      const sanitizeOriginCategory = (value, fallback) => {
        const text = String(value || '').trim();
        if (!text || isDirtyOriginText(text) || /(元\/斤|元\/公斤|\/斤|\/公斤)/.test(text)) {
          return fallback || '';
        }
        return text;
      };
      const formatOriginPrice = (item) => {
        const raw = item.price_yuan_per_jin != null
          ? `${item.price_yuan_per_jin}元/斤`
          : (item.price || item.price_range || '');
        const text = String(raw || '').trim();
        if (!text || isDirtyOriginText(text)) return '';
        if (/(https?:\/\/|!\[|\]\()/i.test(text)) return '';
        return text;
      };
      const sanitizeWholesaleSpec = (value) => {
        const raw = String(value || '').trim();
        if (!raw) return '通货';
        const parts = raw.split(/[|｜/,\s，、]+/).map((x) => x.trim()).filter(Boolean);
        const cleaned = parts.filter((part) => {
          if (!part) return false;
          if (/^\d+(\.\d+)?(-\d+(\.\d+)?)?$/.test(part)) return false;
          if (/元\/?(斤|公斤)|\/斤|\/公斤/.test(part)) return false;
          if (/^(新疆|北京|山东|河南|河北|山西|陕西|甘肃|青海|宁夏|内蒙古|辽宁|吉林|黑龙江|江苏|浙江|安徽|福建|江西|湖北|湖南|广东|广西|海南|四川|重庆|贵州|云南|西藏|天津|上海|香港|澳门|台湾).{0,4}产$/.test(part)) return false;
          return true;
        });
        const preferred = cleaned.find((part) => /(通货|特级|一级|二级|三级|精品|优质|普通|\d+两以上|\d+两|大果|中果|小果)/.test(part));
        return preferred || cleaned[0] || '通货';
      };
      const formatWholesaleMarket = (item) => {
        return String(
          item.marketName ||
          item.market ||
          item.market_name ||
          item['市场名称'] ||
          item.name ||
          ''
        ).trim();
      };
      const formatWholesalePrice = (item) => {
        const priceRaw = item.price_range || item.priceRange || item.avgPrice || item.price || '';
        const priceText = String(priceRaw || '').trim();
        if (!priceText) return '';
        if (/元\/?(斤|公斤)|\/斤|\/公斤/.test(priceText)) return priceText;
        const unit = String(item.unit || '元/斤').trim() || '元/斤';
        return `${priceText}${unit}`;
      };
      const originRaw =
        product.origin_prices ||
        product.origin_markets ||
        product.originMarkets ||
        [];

      const wholesaleRaw =
        product.wholesale_prices ||
        product.wholesale_markets ||
        product.wholesaleMarkets ||
        [];

      const originMarkets = originRaw.map(item => {
        const productName = product.name || product.productName || '';
        return {
          location: sanitizeOriginLocation(item.location || item.area || item.address || ''),
          category: sanitizeOriginCategory(item.variety || item.category || item.item || '', productName),
          price: formatOriginPrice(item),
          change: item.change_yuan_per_jin,
          remark: item.remark || ''
        };
      }).filter(item => item.location && item.price);

      const wholesaleMarkets = wholesaleRaw.map(item => ({
        market: formatWholesaleMarket(item),
        spec: sanitizeWholesaleSpec(item.spec || item.grade || item.level || item['规格'] || ''),
        price: formatWholesalePrice(item),
        itemName: item.item || product.name || '',
        origin: item.origin || '',
        weekPrice: item.week_price_range || '',
        raw: item.raw || ''
      })).filter(item => item.market || item.spec || item.price);

      console.log('[行情数据检查]', product.name, {
        origin_prices_len: (product.origin_prices || []).length,
        wholesale_prices_len: (product.wholesale_prices || []).length,
        originMarkets_len: originMarkets.length,
        wholesaleMarkets_len: wholesaleMarkets.length,
        first_origin: originMarkets[0],
        first_wholesale: wholesaleMarkets[0]
      });

      return {
        ...product,
        originMarkets,
        wholesaleMarkets
      };
    },

    switchMainNav(nav) {
      if (this.activeMainNav === nav) return;
      this.activeMainNav = nav;
      // 不重新拉取 bundle，直接用本地 bundleProducts 重算展示数据
      this.regionPriceList = [];
      this.analysisItem = null;
      const step = Math.max(1, Number(this.listPageSize) || 10);
      this.regionDisplayLimit = step;
      this.analysisDisplayLimit = step;
      this.updateProductData();
    },

    getMainNavLabel(nav) {
      const labels = {
        origin: '产地行情',
        wholesale: '批发市场行情',
        forecast: '行情分析'
      };
      return labels[nav] || '产地行情';
    },

    getCategoryDisplayName(category) {
      if (category === '全部') return this.selectedRegion || '全国';
      if (this.selectedCategory === category && this.selectedSubCategory) return this.selectedSubCategory;
      return category;
    },
    isSubCategoryActive(item) {
      if (this.selectedCategory === '全部') {
        return item === (this.selectedRegion || '全国');
      }
      return this.selectedSubCategory === item;
    },

    toggleCategoryMenu(category) {
      if (category === '全部') {
        const shouldOpen = this.selectedCategory !== '全部' || !this.showSubCategoryMenu;
        this.selectedCategory = '全部';
        this.selectedSubCategory = '';
        this.showSubCategoryMenu = shouldOpen;
        if (this.selectedRegion) {
          this.updateProductData();
        }
        return;
      }

      if (this.selectedCategory === category) {
        this.showSubCategoryMenu = !this.showSubCategoryMenu;
        return;
      }

      this.selectedCategory = category;
      this.selectedSubCategory = '';
      this.selectedRegion = '';
      this.showSubCategoryMenu = true;
    },

    selectSubCategory(subCategory) {
      if (this.selectedCategory === '全部') {
        this.selectedRegion = subCategory === '全国' ? '' : subCategory;
        this.selectedSubCategory = '';
        this.showSubCategoryMenu = false;
        this.updateProductData();
        return;
      }
      this.selectedSubCategory = subCategory;
      this.selectedRegion = '';
      this.showSubCategoryMenu = false;
      this.updateProductData();
    },

    // =========================
    // 2) 数据获取：pointer 轻量检查 + 按需全量（缓存 v2）
    // =========================

    _withNoCache(u) {
      return `${u}${String(u).includes('?') ? '&' : '?'}t=${Date.now()}`;
    },

    marketDebug(...args) {
      if (DEBUG_MARKET) {
        console.log('[market-debug]', ...args);
      }
    },

    _previewResponseBody(body) {
      if (body == null) return '';
      if (typeof body === 'string') return body.slice(0, 200);
      try {
        return JSON.stringify(body).slice(0, 200);
      } catch (e) {
        return String(body).slice(0, 200);
      }
    },

    _makeMarketRequestError(stage, url, err, extra = {}) {
      const errText = (err && (err.errMsg || err.message)) || err || 'unknown';
      const message = `[行情请求失败] stage=${stage} url=${url} err=${errText}`;
      const error = new Error(message);
      error.stage = stage;
      error.url = url;
      error.statusCode = extra.statusCode;
      error.responsePreview = extra.responsePreview || '';
      return error;
    },

    _requestJson(u, stage = 'unknown') {
      return new Promise((resolve, reject) => {
        const requestUrl = this._withNoCache(u);
        this.marketDebug('request:start', {
          stage,
          rawUrl: u,
          requestUrl
        });
        uni.request({
          url: requestUrl,
          method: 'GET',
          timeout: MARKET_REQUEST_TIMEOUT_MS,
          header: {
            'cache-control': 'no-cache',
            pragma: 'no-cache'
          },
          success: (res) => {
            const responsePreview = this._previewResponseBody(res && res.data);
            if (res.statusCode < 200 || res.statusCode >= 300) {
              const error = this._makeMarketRequestError(stage, u, `HTTP ${res.statusCode}`, {
                statusCode: res.statusCode,
                responsePreview
              });
              console.error(error.message, {
                stage,
                url: u,
                requestUrl,
                errMsg: error.message,
                statusCode: res.statusCode,
                responsePreview
              });
              reject(error);
              return;
            }
            let body = res.data;
            if (typeof body === 'string') {
              const text = body.trim();
              if (!text) {
                const error = this._makeMarketRequestError(stage, u, 'empty response', {
                  statusCode: res.statusCode,
                  responsePreview
                });
                console.error(error.message, {
                  stage,
                  url: u,
                  requestUrl,
                  errMsg: 'empty response',
                  statusCode: res.statusCode,
                  responsePreview
                });
                reject(error);
                return;
              }
              if (/^<!doctype html/i.test(text) || /^<html/i.test(text) || /^</.test(text)) {
                const error = this._makeMarketRequestError(stage, u, 'html response', {
                  statusCode: res.statusCode,
                  responsePreview
                });
                console.error(error.message, {
                  stage,
                  url: u,
                  requestUrl,
                  errMsg: 'html response',
                  statusCode: res.statusCode,
                  responsePreview
                });
                reject(error);
                return;
              }
              try {
                body = JSON.parse(body);
              } catch (e) {
                const error = this._makeMarketRequestError(stage, u, `invalid json: ${e && e.message}`, {
                  statusCode: res.statusCode,
                  responsePreview
                });
                console.error(error.message, {
                  stage,
                  url: u,
                  requestUrl,
                  errMsg: e && e.message,
                  statusCode: res.statusCode,
                  responsePreview
                });
                reject(error);
                return;
              }
            }
            if (body == null || (typeof body !== 'object' && !Array.isArray(body))) {
              const error = this._makeMarketRequestError(stage, u, 'non-json body', {
                statusCode: res.statusCode,
                responsePreview
              });
              console.error(error.message, {
                stage,
                url: u,
                requestUrl,
                errMsg: 'non-json body',
                statusCode: res.statusCode,
                responsePreview
              });
              reject(error);
              return;
            }
            resolve(body);
          },
          fail: (err) => {
            const error = this._makeMarketRequestError(stage, u, err);
            console.error(error.message, {
              stage,
              url: u,
              requestUrl,
              errMsg: err && err.errMsg,
              statusCode: err && err.statusCode,
              responsePreview: ''
            });
            reject(error);
          }
        });
      });
    },
    hydrateFromPayload(data, source) {
      if (!hasValidMarketPayload(data)) return false;
      const normalizedProducts = (data.bundleProducts || [])
        .map((p) => this.normalizeMarketProduct(p))
        .filter((p) => {
          const hasName = !!String(p.name || p.productName || '').trim();
          const hasOrigin = Array.isArray(p.originMarkets) && p.originMarkets.length > 0;
          const hasWholesale = Array.isArray(p.wholesaleMarkets) && p.wholesaleMarkets.length > 0;
          return hasName || hasOrigin || hasWholesale;
        });
      if (!validateBundleProducts(normalizedProducts)) return false;

      this.bundleProducts = normalizedProducts;
      this.rawAnalysisList = data.rawAnalysisList || [];
      this.analysisList = data.analysisList || [];
      this.meta = data.meta || {};
      const appliedPrepared = this.applyPreparedDefaultsFromCache(data.prepared);
      if (!appliedPrepared) {
        this.$nextTick(() => {
          this.updateProductData();
        });
      }
      perfLog(source || '灌入行情 payload', { updatedAt: data.updatedAt, appliedPrepared });
      this.$nextTick(() => {
        this.marketDebug('render:after-hydrate', {
          source,
          bundleProductsLen: this.bundleProducts.length,
          regionPriceListLen: this.regionPriceList.length,
          analysisListLen: this.analysisList.length
        });
      });
      return true;
    },

    applyCachePayload(data, label) {
      return this.hydrateFromPayload(data, label);
    },

    /**
     * 进入页面：同步读取主缓存并灌入 state，优先秒开。
     * @returns {boolean} 是否命中主缓存
     */
    hydrateFromLocalCache() {
      const data = readActivePayload();
      const activeValid = hasValidMarketPayload(data);
      this.marketDebug('cache:active', { valid: activeValid, bundleProductsLen: data && data.bundleProducts ? data.bundleProducts.length : 0 });
      if (activeValid && this.hydrateFromPayload(data, '命中 active 缓存')) return true;
      const backup = readBackupPayload();
      const backupValid = hasValidMarketPayload(backup);
      this.marketDebug('cache:backup', { valid: backupValid, bundleProductsLen: backup && backup.bundleProducts ? backup.bundleProducts.length : 0 });
      if (backupValid && this.hydrateFromPayload(backup, 'active 无效，命中 backup 缓存')) {
        writeStorageJson(STORAGE_ACTIVE, backup);
        uni.showToast({ title: '已显示最近一次缓存行情', icon: 'none' });
        return true;
      }
      perfLog('无有效本地缓存');
      return false;
    },

    /**
     * 使用缓存中的「默认全部 + 无搜索」预整理结果，避免冷启动整套重算。
     * @returns {boolean} 是否已用预整理快照填充当前默认视图
     */
    applyPreparedDefaultsFromCache(prepared) {
      if (!prepared || typeof prepared !== 'object') return false;
      const kw = (this.searchKeyword || '').trim();
      if (kw) return false;
      if (this.selectedCategory !== '全部' || this.selectedSubCategory) return false;
      if (this.selectedRegion) return false;

      if (this.activeMainNav === 'origin' && prepared.origin_all) {
        const preparedOrigin = prepared.origin_all.regionPriceList || [];
        const cleanedOrigin = this.sortByHotProduct(this.filterCleanOriginRows(preparedOrigin));
        // 缓存命中但被新规则清洗为空时，回退实时重算，避免“刷新后无数据”
        if (preparedOrigin.length > 0 && cleanedOrigin.length === 0) return false;
        this.regionPriceList = cleanedOrigin;
        this.rawRegionPriceList = this.filterCleanOriginRows(prepared.origin_all.rawRegionPriceList || []);
        this.analysisItem = null;
        return true;
      }
      if (this.activeMainNav === 'wholesale' && prepared.wholesale_all) {
        const preparedList = prepared.wholesale_all.regionPriceList || [];
        const hasProductKey = preparedList.some((item) => item && (item.__productName || item.productName || item.name || item.itemName));
        if (!hasProductKey && preparedList.length) return false;
        const sortedWholesale = this.sortByHotProduct(preparedList);
        if (preparedList.length > 0 && sortedWholesale.length === 0) return false;
        this.regionPriceList = sortedWholesale;
        this.rawRegionPriceList = prepared.wholesale_all.rawRegionPriceList || [];
        this.analysisItem = null;
        return true;
      }
      if (this.activeMainNav === 'forecast' && prepared.forecast_all) {
        this.regionPriceList = [];
        const preparedAnalysis = prepared.forecast_all.analysisList || [];
        const sortedAnalysis = this.sortByHotProduct(preparedAnalysis);
        if (preparedAnalysis.length > 0 && sortedAnalysis.length === 0) return false;
        this.analysisList = sortedAnalysis;
        this.analysisItem = null;
        return true;
      }
      return false;
    },

    /**
     * 构建「产地/批发/行情分析 × 全部 × 无搜索」下的预整理快照，写入主缓存。
     */
    buildPreparedDefaultsSnapshot() {
      const keyword = '';
      const _toTs = (obj) => {
        if (!obj || typeof obj !== 'object') return 0;
        const cand =
          obj.date ||
          obj.update_date ||
          obj.updated_at ||
          obj.generated_at ||
          obj.timestamp ||
          obj.time ||
          obj.fetch_time ||
          obj.fetch_date;
        if (!cand) return 0;
        const d = new Date(cand);
        const t = d.getTime();
        return Number.isFinite(t) ? t : 0;
      };
      let origin_all = { regionPriceList: [], rawRegionPriceList: [] };
      let wholesale_all = { regionPriceList: [], rawRegionPriceList: [] };
      let forecast_all = { analysisList: [] };

      const allPricesOrigin = [];
      (this.bundleProducts || []).forEach((product) => {
        const list = Array.isArray(product.originMarkets) ? product.originMarkets : [];
        const items = keyword ? list : list;
        items.forEach((x) => {
          allPricesOrigin.push({
            location: x.location || '',
            category: x.category || '',
            price: x.price || '',
            name: product.name || product.productName || x.category || '',
            productName: product.name || product.productName || x.category || '',
            __productName: product.name || product.productName || x.category || '',
            date: this.findDateValue(x, product),
            __date: this.findDateValue(x, product)
          });
        });
      });
      const rawO = this.filterCleanOriginRows(allPricesOrigin);
      const pickedO = this.pickPreferredDate(rawO);
      origin_all = {
        regionPriceList: this.sortByHotProduct(pickedO.filtered),
        rawRegionPriceList: rawO
      };

      const allPricesWs = [];
      (this.bundleProducts || []).forEach((product) => {
        const list = Array.isArray(product.wholesaleMarkets) ? product.wholesaleMarkets : [];
        const items = keyword ? list : list;
        items.forEach((x) => {
          allPricesWs.push({
            market: x.market || '',
            spec: x.spec || '',
            price: x.price || '',
            name: product.name || product.productName || x.itemName || '',
            productName: product.name || product.productName || x.itemName || '',
            __productName: product.name || product.productName || x.itemName || '',
            date: this.findDateValue(x, product),
            __date: this.findDateValue(x, product)
          });
        });
      });
      const rawW = allPricesWs.filter((x) => x.market || x.spec || x.price);
      const pickedW = this.pickPreferredDate(rawW);
      wholesale_all = {
        regionPriceList: this.sortByHotProduct(pickedW.filtered),
        rawRegionPriceList: rawW
      };

      const normalizedAnalysis = (this.rawAnalysisList || []).map((x) => {
        const d = this.findDateValue(x);
        return { ...x, __date: d };
      });
      const pickedA = this.pickPreferredDate(normalizedAnalysis);
      forecast_all = {
        analysisList: this.sortByHotProduct(pickedA.filtered.length ? pickedA.filtered : normalizedAnalysis)
      };

      return { origin_all, wholesale_all, forecast_all };
    },

    /**
     * 页面进入 / 下拉：先 hydrate（onShow 已做），再后台 pointer；按需全量。
     */
    runMarketBackgroundCheck(options = {}) {
      const source = options.source || 'show';
      const forcePointer = !!options.forcePointer;
      const { hasValidLocalCache } = getLocalCacheState();
      const meta = readMeta();
      const now = Date.now();

      if (!forcePointer && hasValidLocalCache && meta && meta.lastPointerCheckAt) {
        const age = now - meta.lastPointerCheckAt;
        if (age >= 0 && age < POINTER_CHECK_MIN_INTERVAL_MS) {
          perfLog('pointer 检查跳过（10 分钟内已检查过）', { ageMs: age });
          return Promise.resolve();
        }
      }

      if (this._pointerCheckInFlight) {
        perfLog('复用 pointer 检查 in-flight', { source });
        return this._pointerCheckInFlight;
      }

      this._pointerCheckInFlight = this._executePointerPipeline({ source, forcePointer }).finally(() => {
        this._pointerCheckInFlight = null;
      });
      return this._pointerCheckInFlight;
    },

    hasRenderedMarketData() {
      return (
        (Array.isArray(this.bundleProducts) && this.bundleProducts.length > 0) ||
        (Array.isArray(this.regionPriceList) && this.regionPriceList.length > 0) ||
        (Array.isArray(this.analysisList) && this.analysisList.length > 0)
      );
    },

    async _callLatestPointerFunction() {
      this.marketDebug('entry:callFunction:start', { name: 'get-latest-pointer' });
      return new Promise((resolve, reject) => {
        uniCloud.callFunction({
          name: 'get-latest-pointer',
          data: {},
          success: (res) => {
            const result = (res && res.result) || {};
            const data = result.data && typeof result.data === 'object' ? result.data : {};
            const pointerUrl = result.pointer_url || data.pointer_url || '';
            const isOk = result.code == null || result.code === 200;
            this.marketDebug('entry:callFunction:success', {
              code: result.code,
              pointer_url: pointerUrl
            });
            if (isOk && pointerUrl) {
              resolve({ ...data, ...result, pointer_url: pointerUrl });
              return;
            }
            reject(this._makeMarketRequestError('entry', 'uniCloud.callFunction:get-latest-pointer', result.message || result.errMsg || 'missing pointer_url'));
          },
          fail: (err) => {
            const error = this._makeMarketRequestError('entry', 'uniCloud.callFunction:get-latest-pointer', err);
            console.error(error.message, {
              stage: 'entry',
              url: 'uniCloud.callFunction:get-latest-pointer',
              errMsg: err && err.errMsg,
              statusCode: err && err.statusCode,
              responsePreview: ''
            });
            reject(error);
          }
        });
      });
    },

    async _getEntryPointer() {
      try {
        return await this._requestJson(YMT_ENTRY_GET_POINTER, 'entry');
      } catch (entryErr) {
        const msg = String((entryErr && entryErr.message) || (entryErr && entryErr.errMsg) || '');
        if (/timeout/i.test(msg)) {
          perfLog('HTTP 入口 timeout，尝试 uniCloud.callFunction 兜底', entryErr);
          return this._callLatestPointerFunction();
        }
        throw entryErr;
      }
    },

    async _executePointerPipeline({ source, forcePointer }) {
      const {
        hasValidLocalCache,
        activeValid,
        backupValid,
        activeLen,
        backupLen
      } = getLocalCacheState();
      perfLog('本地缓存状态', { hasValidLocalCache, activeValid, backupValid, activeLen, backupLen });

      const hadCacheOnEntry = hasValidLocalCache;
      const blocking = !hadCacheOnEntry;
      perfLog('pointer 检查开始', { source, forcePointer, hadCacheOnEntry });
      if (blocking) {
        this.loading = true;
        uni.showLoading({ title: '加载中...' });
      }

      let pointerUrl = '';
      let pointer = null;
      try {
        const entry = await this._getEntryPointer();
        pointerUrl = entry && entry.pointer_url;
        if (!pointerUrl) throw new Error('入口返回缺少 pointer_url');
        this.marketDebug('entry:pointer_url', { pointer_url: pointerUrl });

        pointer = await this._requestJson(pointerUrl, 'pointer');
        const pointerUrls = buildUrlsFromPointer(pointer);
        this.marketDebug('pointer:fields', {
          fileID: pointer && pointer.fileID,
          fileId: pointer && pointer.fileId,
          publicUrl: pointer && pointer.publicUrl,
          public_url: pointer && pointer.public_url,
          bundle_url: pointer && pointer.bundle_url,
          rawBundleUrl: pointer && pointer.bundleUrl,
          analysis_publicUrl: pointer && pointer.analysis_publicUrl,
          analysis_url: pointer && pointer.analysis_url,
          bundleUrl: pointerUrls.bundleUrl,
          analysisUrl: pointerUrls.analysisUrl
        });
        const vkNew = getPointerVersionKey(pointer);
        const meta = readMeta();
        const vkOld = meta && meta.versionKey != null ? String(meta.versionKey) : '';
        const pointerUnchanged = !!(vkNew && vkOld && vkNew === vkOld);
        const pointerChanged = !pointerUnchanged;
        const shouldFetchFullBundle =
          !!forcePointer || !hasValidLocalCache || pointerChanged;

        perfLog('pointer 判断结果', {
          pointerChanged,
          forcePointer: !!forcePointer,
          hasValidLocalCache,
          shouldFetchFullBundle
        });

        if (!shouldFetchFullBundle) {
          writeMeta({ lastPointerCheckAt: Date.now() });
          perfLog('pointer 未变化且本地缓存有效，跳过全量拉取');
          perfLog('pointer 检查结束', { source, skippedFullFetch: true });
          return;
        }

        if (!hasValidLocalCache && pointerUnchanged) {
          perfLog('本地无有效缓存，pointer 即使未变化也执行全量拉取');
        } else if (pointerChanged) {
          perfLog('pointer 有变化，开始拉全量', { source });
        } else if (forcePointer) {
          perfLog('forcePointer 刷新，开始拉全量', { source });
        }

        await this._fetchFullAndPersist({
          source,
          pointer,
          pointerUrl
        });
        perfLog('pointer 检查结束', { source, fetchedFullBundle: true });
      } catch (e) {
        perfLog('发生失败已回退旧缓存', e);
        const showedCache = this.hasRenderedMarketData() || this.hydrateFromLocalCache();
        if (showedCache) {
          uni.showToast({ title: '已显示最近一次缓存行情', icon: 'none' });
        } else if (!hadCacheOnEntry) {
          this.error = '数据加载失败，请稍后重试';
          uni.showToast({ title: this.error, icon: 'none' });
        }
      } finally {
        if (blocking) {
          this.loading = false;
          uni.hideLoading();
        }
      }
    },

    _extractAnalysisList(analysis, fallbackProducts = []) {
      let analysisList = [];
      if (analysis) {
        analysisList =
          (Array.isArray(analysis.data) && analysis.data) ||
          (Array.isArray(analysis.items) && analysis.items) ||
          (Array.isArray(analysis.products) && analysis.products) ||
          (Array.isArray(analysis) ? analysis : []);
      }
      if (!analysisList.length) {
        analysisList = (fallbackProducts || []).map((p) => ({ name: p.name || p.productName, analysis_text: p.analysis_text }));
      }
      return analysisList;
    },

    _buildMarketCachePayload() {
      const prepared = this.buildPreparedDefaultsSnapshot();
      return {
        bundleProducts: this.bundleProducts,
        rawAnalysisList: this.rawAnalysisList,
        analysisList: this.analysisList,
        meta: this.meta,
        prepared,
        updatedAt: Date.now()
      };
    },

    _persistValidMarketPayload(payload) {
      if (!hasValidMarketPayload(payload)) {
        perfLog('跳过写缓存：payload 无有效 bundleProducts');
        return false;
      }
      copyActiveToBackup();
      writeStorageJson(STORAGE_ACTIVE, payload);
      writeStorageJson(STORAGE_BACKUP, payload);
      return true;
    },

    async _fetchFullAndPersist({ source, pointer, pointerUrl }) {
      if (this._fullFetchInFlight) {
        perfLog('复用全量拉取 in-flight', { source });
        return this._fullFetchInFlight;
      }

      const { bundleUrl, analysisUrl } = buildUrlsFromPointer(pointer);
      this.marketDebug('fetch:urls', { pointerUrl, bundleUrl, analysisUrl });
      if (!bundleUrl) {
        perfLog('pointer 中没有可用 bundle 地址');
        throw new Error('pointer 中没有可用 bundle 地址');
      }

      const run = async () => {
        perfLog('bundle 拉取开始', { bundleUrl });
        const bundle = await this._requestJson(bundleUrl, 'bundle');

        const arr = extractBundleProducts(bundle);
        this.marketDebug('bundle:loaded', { bundleProductsLen: arr.length });
        if (!validateBundleProducts(arr)) {
          perfLog('bundle 数据校验失败，已回退旧缓存');
          throw new Error('bundle invalid');
        }

        const fallbackAnalysisList = this._extractAnalysisList(null, arr);
        perfLog('bundle 拉取成功', {
          productsLen: arr.length,
          analysisLen: fallbackAnalysisList.length
        });

        this.bundleProducts = arr.map((p) => this.normalizeMarketProduct(p));
        this.rawAnalysisList = fallbackAnalysisList;
        this.analysisList = fallbackAnalysisList;

        const gen =
          (bundle && (bundle.generated_at || bundle.updated_at)) || (pointer && pointer.updated_at) || '';

        let updateDate = '';
        let updateTime = '';
        try {
          if (gen) {
            const d = new Date(gen);
            updateDate = d.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
            updateTime = d.toLocaleTimeString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
          }
        } catch (e) {
          /* ignore */
        }

        this.meta = {
          updateDate,
          updateTime,
          generated_at: gen,
          total: (bundle && bundle.total) || (pointer && pointer.total) || arr.length
        };

        await this.updateProductData();
        this.marketDebug('render:after-bundle', {
          bundleProductsLen: this.bundleProducts.length,
          regionPriceListLen: this.regionPriceList.length,
          analysisListLen: this.analysisList.length
        });

        const payload = this._buildMarketCachePayload();
        if (!this._persistValidMarketPayload(payload)) {
          throw new Error('payload invalid');
        }
        perfLog('active 缓存写入成功', { productsLen: this.bundleProducts.length });

        writeMeta({
          latestPointerUrl: pointerUrl,
          bundleUrl,
          analysisUrl: analysisUrl || '',
          dataDate: inferDataDate(bundle, pointer),
          updatedAt: Date.now(),
          lastPointerCheckAt: Date.now(),
          versionKey: getPointerVersionKey(pointer)
        });

        perfLog('bundle 更新成功，analysis 单独补充', { source });

        if (analysisUrl) {
          try {
            const analysis = await this._requestJson(analysisUrl, 'analysis');
            const analysisList = this._extractAnalysisList(analysis, arr);
            this.rawAnalysisList = analysisList;
            this.analysisList = analysisList;
            await this.updateProductData();
            const nextPayload = this._buildMarketCachePayload();
            this._persistValidMarketPayload(nextPayload);
            writeMeta({
              analysisUrl,
              updatedAt: Date.now(),
              lastPointerCheckAt: Date.now()
            });
            this.marketDebug('render:after-analysis', {
              regionPriceListLen: this.regionPriceList.length,
              analysisListLen: this.analysisList.length
            });
            perfLog('analysis 更新成功', { source });
          } catch (analysisErr) {
            perfLog('analysis 请求失败，分析模块将降级', analysisErr);
          }
        }
      };

      this._fullFetchInFlight = run()
        .catch((err) => {
          perfLog('全量更新失败，继续显示旧缓存', err);
          throw err;
        })
        .finally(() => {
          this._fullFetchInFlight = null;
        });

      await this._fullFetchInFlight;
    },

    _buildQueryParams() {
      // getMarketTrends：name 是"精确匹配"，location 是正则
      // 所以：优先用 selectedSubCategory 作为 name
      // searchKeyword：如果刚好等于某个品种名，就当 name；否则当 location 关键词
      const allNames = [
        ...(this.categoryData['蔬菜'] || []),
        ...(this.categoryData['水果'] || [])
      ];
      const keyword = (this.searchKeyword || '').trim();

      let name = '';
      let location = '';

      // 如果选择了"全部"分类，必须 name = ''，只传 location（如果有搜索词）
      if (this.selectedCategory === '全部') {
        name = '';
        // 如果用户输入了搜索词，当 location 正则筛；没输入就全量
        location = keyword || '';
        return { name, location };
      }

      // 非"全部"时，使用 selectedSubCategory 作为 name
      name = this.selectedSubCategory || '';

      // 处理搜索关键词
      if (!name && keyword) {
        // 如果搜索词是品种名，当 name；否则当 location
        if (allNames.includes(keyword)) {
          name = keyword;
        } else {
          location = keyword;
        }
      } else if (name && keyword) {
        // 已选品种时，keyword 用作地点过滤
        location = keyword;
      }

      // 不再默认"土豆":CDN数据的name是地区/市场名,不是品种名

      return { name, location };
    },

    // 清理地区文本的辅助函数（统一使用）
    cleanLocationText(text) {
      if (!text) return '';
      // 移除URL链接（https://...）
      text = text.replace(/https?:\/\/[^\s]+/g, '');
      // 移除图片标记 ![]
      text = text.replace(/!\[\]/g, '');
      // 移除额外的价格信息（如 "1.75元/斤 0.0元/斤"）
      text = text.replace(/\d+\.?\d*元\/[斤公]?\s*/g, '');
      // 移除多余的空格
      text = text.replace(/\s+/g, ' ').trim();
      return text;
    },

    // 清理产品名称，提取核心产品名（如"荷兰十五土豆" -> "土豆"）
    cleanProductName(text) {
      if (!text) return '';
      
      // 先用通用清理函数处理
      text = this.cleanLocationText(text);
      
      // 定义核心产品名称列表（包含所有蔬菜和水果）
      const coreProducts = [
        // 蔬菜
        '白菜', '百合', '荸荠', '扁豆', '冰草', '菠菜', '菜花', '菜苔',
        '春笋', '慈姑', '大葱', '大蒜', '冬瓜', '冬笋', '豆角', '豆芽',
        '甘蓝', '红薯', '胡萝卜', '花生芽', '槐花', '黄瓜', '茴香', '荠菜',
        '茄子', '茭白', '芥蓝', '韭菜', '蕨菜', '苦瓜', '辣椒', '莲藕',
        '莲雾', '菱角', '萝卜', '毛豆', '魔芋', '南瓜', '枇杷', '芹菜',
        '青梗菜', '秋葵', '山姜', '山药', '山野菜', '生菜', '生姜', '圣女果',
        '释迦', '丝瓜', '四季豆', '蒜苗', '蒜苔', '茼蒿', '土豆', '娃娃菜',
        '豌豆', '莴笋', '乌塌菜', '西红柿', '西葫芦', '西兰花', '西梅', '鲜枣',
        '香菜', '香椿芽', '小葱', '洋葱', '叶用甜菜', '油菜', '鱼腥草', '芋头',
        '芸豆', '榨菜', '竹笋',
        // 水果
        '百香果', '菠萝', '菠萝蜜', '草莓', '橙子', '灯笼果', '番石榴', '甘蔗',
        '柑桔', '橄榄', '哈密瓜', '火龙果', '蓝莓', '梨', '李子', '荔枝',
        '榴莲', '龙眼', '芒果', '猕猴桃', '木瓜', '柠檬', '牛油果', '苹果',
        '葡萄', '山楂', '石榴', '柿子', '桃', '甜瓜', '乌梅', '无花果',
        '西瓜', '香蕉', '杏', '杨梅', '杨桃', '椰子', '樱桃', '柚子'
      ];
      
      // 在文本中查找核心产品名称
      for (const product of coreProducts) {
        if (text.includes(product)) {
          return product;
        }
      }
      
      // 如果没有匹配到核心产品名，移除常见的品种描述词
      text = text.replace(/^(荷兰|早大白|红皮|黄心|青|红|白|黑|紫|绿|黄|小|大|长|圆|尖|甜|苦)\s*/g, '');
      text = text.replace(/\d+(两|斤|公斤|kg|克|g|个|只|头|根|条|片|块)\s*(以上|以下|左右)?\s*/g, '');
      text = text.replace(/(特级|一级|二级|三级|上等|中等|下等|精品|优质|普通|通货)\s*/g, '');
      
      return text.trim();
    },

    async updateProductData() {
      // ✅ 现在不再请求后端接口，直接用 bundleProducts 渲染
      try {
        const pageSize = Math.max(1, Number(this.listPageSize) || 10);
        this.regionDisplayLimit = pageSize;
        this.analysisDisplayLimit = pageSize;

        // 移除内部定义的 cleanLocationText 和 cleanProductName
        
        // 检查是否选择了"全部"分类
        const isShowingAll = this.selectedCategory === '全部' || !this.selectedSubCategory;
        
        if (isShowingAll) {
          // 显示所有产品的汇总数据（每个产品只显示一条）
          this.analysisItem = null;
          
          // 根据 tab 汇总所有产品的价格数据
          const keyword = (this.searchKeyword || '').trim();

          if (this.activeMainNav === 'origin') {
            const allPrices = [];
            (this.bundleProducts || []).forEach(product => {
              const list = Array.isArray(product.originMarkets) ? product.originMarkets : [];
              const items = keyword ? list : list;
              
              items.forEach(x => {
                allPrices.push({
                  location: x.location || '',
                  category: x.category || '',
                  price: x.price || '',
                  name: product.name || product.productName || x.category || '',
                  productName: product.name || product.productName || x.category || '',
                  __productName: product.name || product.productName || x.category || '',
                  date: this.findDateValue(x, product),
                  __date: this.findDateValue(x, product)
                });
              });
            });
            this.rawRegionPriceList = this.filterCleanOriginRows(allPrices);
            const picked = this.pickPreferredDate(this.rawRegionPriceList);
            this.regionPriceList = this.sortByHotProduct(this.filterBySelectedRegion(this._filterByKeyword(picked.filtered)));
          } else if (this.activeMainNav === 'wholesale') {
            const allPrices = [];
            (this.bundleProducts || []).forEach(product => {
              const list = Array.isArray(product.wholesaleMarkets) ? product.wholesaleMarkets : [];
              const items = keyword ? list : list;

              items.forEach(x => {
                allPrices.push({
                  market: x.market || '',
                  spec: x.spec || '',
                  price: x.price || '',
                  name: product.name || product.productName || x.itemName || '',
                  productName: product.name || product.productName || x.itemName || '',
                  __productName: product.name || product.productName || x.itemName || '',
                  date: this.findDateValue(x, product),
                  __date: this.findDateValue(x, product)
                });
              });
            });
            this.rawRegionPriceList = allPrices.filter(x => x.market || x.spec || x.price);
            const picked = this.pickPreferredDate(this.rawRegionPriceList);
            this.regionPriceList = this.sortByHotProduct(this.filterBySelectedRegion(this._filterByKeyword(picked.filtered)));
          } else if (this.activeMainNav === 'forecast') {
            // 行情分析："全部"时不显示单个分析，用 analysisCardList 展示多个
            this.regionPriceList = [];
            const normalizedAnalysis = (this.rawAnalysisList || []).map((x) => {
              const d = this.findDateValue(x);
              return { ...x, __date: d };
            });
            const picked = this.pickPreferredDate(normalizedAnalysis);
            this.analysisList = this.sortByHotProduct(picked.filtered.length ? picked.filtered : normalizedAnalysis);
          }
        } else {
          // 显示单个产品的数据
          const p = this.currentProduct;
          // 给'行情分析'卡片用（模板里用的是 analysisItem）
          const productName = this.cleanProductName(p?.name || '');
          const match = (Array.isArray(this.analysisList) ? this.analysisList : []).find(x => {
            const n = this.cleanProductName((x && (x.name || x.productName)) || '');
            return n && productName && n === productName;
          });
          const rawText = (match && (match.analysis_text || match.analysis || match.display_text)) || (p?.analysis_text || '');
          this.analysisItem = {
            name: productName,
            display_text: this.cleanAnalysisText(rawText)
          };
          if (!p) {
            this.regionPriceList = [];
            return;
          }

          // 根据 tab 组装展示数据
          if (this.activeMainNav === 'origin') {
            const list = Array.isArray(p.originMarkets) ? p.originMarkets : [];
            this.rawRegionPriceList = list
              .slice(0, 80)
              .map(x => {
                return {
                  location: x.location || '',
                  category: x.category || '',
                  price: x.price || '',
                  date: this.findDateValue(x, p),
                  __date: this.findDateValue(x, p)
                };
              })
              .filter(x => this.isCleanOriginPriceRow(x));
            const picked = this.pickPreferredDate(this.rawRegionPriceList);
            this.regionPriceList = this.filterBySelectedRegion(this._filterByKeyword(picked.filtered));
          } else if (this.activeMainNav === 'wholesale') {
            const list = Array.isArray(p.wholesaleMarkets) ? p.wholesaleMarkets : [];
            this.rawRegionPriceList = list
              .slice(0, 120)
              .map(x => {
                return {
                  market: x.market || '',
                  spec: x.spec || '',
                  price: x.price || '',
                  date: this.findDateValue(x, p),
                  __date: this.findDateValue(x, p)
                };
              })
              .filter(x => x.market || x.spec || x.price);
            const picked = this.pickPreferredDate(this.rawRegionPriceList);
            this.regionPriceList = this.filterBySelectedRegion(this._filterByKeyword(picked.filtered));
          } else if (this.activeMainNav === 'forecast') {
            // 行情分析：直接展示 analysis_text（模板里用 analysisItem / analysisCardList）
            this.regionPriceList = [];
            const normalizedAnalysis = (this.rawAnalysisList || []).map((x) => {
              const d = this.findDateValue(x, p);
              return { ...x, __date: d };
            });
            const picked = this.pickPreferredDate(normalizedAnalysis);
            this.analysisList = picked.filtered.length ? picked.filtered : normalizedAnalysis;
          }
        }

      } catch (error) {
        console.error('更新产品数据失败', error);
        // 不清空已有列表，避免白屏；静默失败
      }
    },

    // _buildAnalysisFromList 已弃用：行情分析改为展示云端存储的长文案

    // =========================
    // 3) 展示/格式化逻辑
    // =========================

    updateRegionPriceList() {
      const currentTypeProducts = this.products || [];
      
      // 如果选择了"全部"，显示所有产品的数据
      if (this.selectedCategory === '全部') {
        const regionMap = new Map();
        // 只处理当前类型的数据（此时 products 已经过滤过，只包含今天的数据）
        currentTypeProducts.forEach(item => {
          const region = item.region || item.marketName || item.location || '未知';
          const productName = item.name || '未知产品';
          // 使用 地区+产品名 作为 key，避免不同产品同一地区的数据被覆盖
          const key = `${region}_${productName}`;
          if (!regionMap.has(key)) {
            const price = parseFloat(item.price || 0);
            const prevPrice = price * (0.95 + Math.random() * 0.1);
            const change = parseFloat((price - prevPrice).toFixed(2));
            // 保留日期信息
            const dateValue = item.date || item.updateTime || item.timestamp;
            
            // 处理重复标题:如果region和productName相同,只保留一个
            const displayName = this.formatRegionName(region, productName);
            
            regionMap.set(key, { 
              region: displayName, 
              price, 
              change,
              date: dateValue
            });
          }
        });
        
        let resultList = Array.from(regionMap.values());
        
        // 问题2:批发市场去重(按name去重,只保留第一条)
        if (this.activeMainNav === 'wholesale') {
          const nameMap = new Map();
          resultList.forEach(item => {
            // 提取市场名(去掉可能的产品名后缀)
            const marketName = item.region.split(' - ')[0];
            if (!nameMap.has(marketName)) {
              nameMap.set(marketName, item);
            }
          });
          resultList = Array.from(nameMap.values());
        }
        
        this.regionPriceList = resultList;
        return;
      }

      // 如果选择了具体产品，只显示该产品的不同地区价格
      if (!this.selectedProduct) {
        this.regionPriceList = [];
        return;
      }

      const productName = (this.selectedProduct.name || '').toLowerCase();

      // 再过滤出相同产品名称的数据（此时 products 已经过滤过，只包含今天的数据）
      const sameProducts = currentTypeProducts.filter(p => {
        const name = (p.name || '').toLowerCase();
        return name === productName || name.includes(productName);
      });

      const regionMap = new Map();
      sameProducts.forEach(item => {
        const region = item.region || item.marketName || item.location || '未知';
        if (!regionMap.has(region)) {
          const price = parseFloat(item.price || 0);
          const prevPrice = price * (0.95 + Math.random() * 0.1);
          const change = parseFloat((price - prevPrice).toFixed(2));
          // 保留日期信息
          const dateValue = item.date || item.updateTime || item.timestamp;
          regionMap.set(region, { region, price, change, date: dateValue });
        }
      });

      let regionList = Array.from(regionMap.values());

      this.regionPriceList = regionList;
    },

    viewMoreRegions() {
      uni.showToast({ title: '查看更多地区', icon: 'none' });
    },

    formatPrice(price) {
      if (!price && price !== 0) return '-';
      const num = parseFloat(price);
      if (isNaN(num)) return '-';
      return num.toFixed(2);
    },

    getChangeClass(change) {
      if (change === undefined || change === null) return 'stable';
      const num = parseFloat(change);
      if (isNaN(num)) return 'stable';
      if (num > 0) return 'up';
      if (num < 0) return 'down';
      return 'stable';
    },

    formatChartDate(dateStr) {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${month}-${day}`;
    },

    cleanAnalysisText(text) {
      if (!text) return '';

      let t = String(text);

      // 1) 去掉常见“导航/面包屑”前缀：例如
      //    当前位置： 全国行情 > 芋头价格行情 截至2月6日，...
      //    当前位置: 全国行情 > 白菜价格行情 ...
      // 只删到“价格行情”结束为止，后面的“截至/今日/目前/…正文”全部保留
      t = t.replace(/^\s*当前位置[：:]\s*[\s\S]*?价格行情\s*/i, '');

      // 2) 兼容没有“当前位置”的情况：直接以“全国行情 > XXX价格行情”开头
      t = t.replace(/^\s*全国行情\s*[>＞]\s*[^\s]+?价格行情\s*/i, '');

      // 3) 删除尾部“点击查看更多”
      t = t.replace(/\s*点击查看更多[>＞»]*\s*$/g, '');

      // 4) 收尾空白
      t = t.replace(/\s+/g, ' ').trim();

      return t;
    },

    formatUpdateTime(timeStr) {
      if (!timeStr) return '';
      if (typeof timeStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(timeStr)) {
        const [year, month, day] = timeStr.split('-');
        return `${year}/${month}/${day}`;
      }
      const date = new Date(timeStr);
      if (isNaN(date.getTime())) return String(timeStr);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}/${month}/${day}`;
    },

    getTrendIcon(change) {
      if (change === undefined || change === null) return '→';
      const num = parseFloat(change);
      if (num > 0) return '↑';
      if (num < 0) return '↓';
      return '→';
    },

    getTrendText(change) {
      if (change === undefined || change === null) return '平稳';
      const num = parseFloat(change);
      if (num > 0) return '上涨';
      if (num < 0) return '下跌';
      return '平稳';
    },

    getTrendClass(change) {
      if (change === undefined || change === null) return 'stable';
      const num = parseFloat(change);
      if (num > 0) return 'up';
      if (num < 0) return 'down';
      return 'stable';
    },

    getChangeIcon(change) {
      if (change === undefined || change === null) return '';
      const num = parseFloat(change);
      if (num > 0) return '↑';
      if (num < 0) return '↓';
      return '';
    },

    formatChangeText(change) {
      if (change === undefined || change === null) return '平稳';
      const num = parseFloat(change);
      if (isNaN(num)) return '平稳';
      if (num > 0) return `+${num.toFixed(2)}`;
      if (num < 0) return num.toFixed(2);
      return '平稳';
    },
    
    // 格式化地区名称,避免重复显示(问题1)
    formatRegionName(place, name) {
      if (!place || !name) return place || name || '未知';
      // 去掉空格后比较
      const placeTrimmed = place.trim();
      const nameTrimmed = name.trim();
      if (placeTrimmed === nameTrimmed) {
        return nameTrimmed; // 相同则只显示一个
      }
      return `${placeTrimmed} - ${nameTrimmed}`; // 不同则拼接
    }
  }
};
</script>

<!-- 微信小程序端更稳定的样式引入方式（避免 @import 偶发失效导致“未应用样式”） -->
<style src="./market-trends.css"></style>
