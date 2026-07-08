<template>
    <view class="publish-info-page">
        <view class="pub-green-header" :style="{ paddingTop: statusBarHeight + 'px' }">
            <view class="pub-nav-row" :style="{ height: navRowHeightPx + 'px', paddingRight: headerRightInset + 'px' }">
                <view class="pub-nav-back" @tap="goBack" hover-class="pub-nav-back-hover" hover-stay-time="100">
                    <text class="pub-nav-back-icon">‹</text>
                </view>
                <text class="pub-nav-title">发布信息</text>
            </view>
        </view>

        <view class="tab-bar">
            <view :class="'tab-item ' + (activeTab === 'procurement' ? 'active' : '')" @tap="switchTab" data-tab="procurement">
                <text class="tab-text">发布采购</text>
            </view>
            <view :class="'tab-item ' + (activeTab === 'supply' ? 'active' : '')" @tap="switchTab" data-tab="supply">
                <text class="tab-text">发布供应</text>
            </view>
        </view>

        <scroll-view class="content-area" scroll-y>
            <view class="form-container" v-if="activeTab === 'procurement'">
                <view class="form-card">
                    <text class="form-section-title">基础信息</text>

                    <view class="form-item">
                        <text class="form-label">
                            采购标题
                            <text class="required">*</text>
                        </text>
                        <input
                            class="form-input"
                            type="text"
                            placeholder="例如：急需采购100吨优质土豆"
                            :value="procurementForm.title"
                            data-field="title"
                            @input="onProcurementInput"
                        />
                        <text class="field-hint">标题写清产品、数量、需求特点，更容易被快速匹配</text>
                        <text class="error-text" v-if="procurementErrors.title">{{ procurementErrors.title }}</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            产品品类
                            <text class="required">*</text>
                        </text>
                        <picker mode="selector" :range="categoryList" :value="procurementCategoryPickerValue" @change="onProcurementCategoryChange">
                            <view class="picker-view">
                                <text :class="procurementForm.categoryIndex >= 0 ? 'picker-text' : 'picker-placeholder'">
                                    {{ procurementForm.categoryIndex >= 0 ? categoryList[procurementForm.categoryIndex] : '请选择产品品类' }}
                                </text>
                                <text class="picker-arrow">›</text>
                            </view>
                        </picker>
                        <text class="field-hint">请选择最接近的品类，方便精准推荐给供应商</text>
                        <text class="error-text" v-if="procurementErrors.category">{{ procurementErrors.category }}</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            详细规格
                            <text class="required">*</text>
                        </text>
                        <textarea
                            class="form-textarea"
                            placeholder="例如：80#以上、一级果、通货、净菜、无破损"
                            :value="procurementForm.specifications"
                            data-field="specifications"
                            @input="onProcurementInput"
                            maxlength="500"
                            auto-height
                        />
                        <text class="field-hint">填写规格要求可减少无效咨询，提高匹配效率</text>
                        <text class="error-text" v-if="procurementErrors.specifications">{{ procurementErrors.specifications }}</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            采购数量
                            <text class="required">*</text>
                        </text>
                        <view class="input-with-unit">
                            <input
                                class="form-input flex-1"
                                type="digit"
                                placeholder="请输入数量"
                                :value="procurementForm.quantity"
                                data-field="quantity"
                                @input="onProcurementInput"
                            />
                            <picker mode="selector" :range="procurementUnitList" :value="procurementUnitPickerValue" @change="onProcurementUnitChange">
                                <view class="unit-picker">
                                    <text>{{ procurementForm.unitIndex >= 0 ? procurementUnitList[procurementForm.unitIndex] : '单位' }}</text>
                                    <text class="picker-arrow">›</text>
                                </view>
                            </picker>
                        </view>
                        <text class="field-hint">请填写计划采购量，支持整数或小数</text>
                        <text class="error-text" v-if="procurementErrors.quantity">{{ procurementErrors.quantity }}</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            期望单价
                            <text v-if="!procurementForm.price_negotiable" class="required">*</text>
                        </text>
                        <view class="input-with-unit">
                            <input
                                class="form-input flex-1"
                                :class="{ 'is-disabled': procurementForm.price_negotiable }"
                                type="digit"
                                placeholder="请输入期望单价"
                                :value="procurementForm.price"
                                data-field="price"
                                :disabled="procurementForm.price_negotiable"
                                @input="onProcurementInput"
                            />
                            <view class="unit-picker unit-picker-static">
                                <text>元/{{ procurementForm.unitIndex >= 0 ? procurementUnitList[procurementForm.unitIndex] : '单位' }}</text>
                            </view>
                        </view>
                        <view class="negotiable-row" @tap="togglePriceNegotiable">
                            <view :class="'check-box ' + (procurementForm.price_negotiable ? 'checked' : '')">
                                <text v-if="procurementForm.price_negotiable" class="check-tick">✓</text>
                            </view>
                            <text class="negotiable-label">价格面议</text>
                        </view>
                        <text class="field-hint">填写价格更容易获得精准报价，也可勾选价格面议</text>
                        <text class="error-text" v-if="procurementErrors.price">{{ procurementErrors.price }}</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            收货地址
                            <text class="required">*</text>
                        </text>
                        <input
                            class="form-input"
                            type="text"
                            placeholder="请输入收货地区及详细地址"
                            :value="procurementForm.address"
                            data-field="address"
                            @input="onProcurementInput"
                        />
                        <text class="field-hint">填写准确收货地有助于附近供应商快速联系你</text>
                        <text class="error-text" v-if="procurementErrors.address">{{ procurementErrors.address }}</text>
                    </view>

                    <text class="form-section-title form-section-title-spaced">交易要求</text>

                    <view class="form-item">
                        <text class="form-label">是否急购</text>
                        <view class="radio-row">
                            <view
                                :class="'radio-pill ' + (!procurementForm.is_urgent ? 'active' : '')"
                                data-v="0"
                                @tap="setProcurementUrgent"
                            >
                                否
                            </view>
                            <view
                                :class="'radio-pill ' + (procurementForm.is_urgent ? 'active' : '')"
                                data-v="1"
                                @tap="setProcurementUrgent"
                            >
                                是
                            </view>
                        </view>
                        <text v-if="procurementForm.is_urgent" class="field-hint field-hint-warn">急购信息建议填写截止时间</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">是否长期采购</text>
                        <view class="radio-row">
                            <view
                                :class="'radio-pill ' + (!procurementForm.is_long_term ? 'active' : '')"
                                data-v="0"
                                @tap="setProcurementLongTerm"
                            >
                                否
                            </view>
                            <view
                                :class="'radio-pill ' + (procurementForm.is_long_term ? 'active' : '')"
                                data-v="1"
                                @tap="setProcurementLongTerm"
                            >
                                是
                            </view>
                        </view>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            截止时间
                        </text>
                        <picker mode="date" :value="procurementForm.deadline || deadlinePickerDefault" :start="deadlinePickerStart" @change="onProcurementDeadlineChange">
                            <view class="picker-view">
                                <text :class="procurementForm.deadline ? 'picker-text' : 'picker-placeholder'">
                                    {{ procurementForm.deadline ? procurementForm.deadline : '请选择截止时间' }}
                                </text>
                                <text class="picker-arrow">›</text>
                            </view>
                        </picker>
                        <text class="field-hint">设置截止时间，更容易形成采购时效感</text>
                        <text class="error-text" v-if="procurementErrors.deadline">{{ procurementErrors.deadline }}</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">结算方式（可选）</text>
                        <picker mode="selector" :range="settlementList" :value="procurementForm.settlementIndex" @change="onSettlementChange">
                            <view class="picker-view">
                                <text :class="procurementForm.settlementIndex > 0 ? 'picker-text' : 'picker-placeholder'">
                                    {{ procurementForm.settlementIndex > 0 ? settlementList[procurementForm.settlementIndex] : '请选择结算方式' }}
                                </text>
                                <text class="picker-arrow">›</text>
                            </view>
                        </picker>
                    </view>

                    <view class="form-item">
                        <text class="form-label">是否需要发票（可选）</text>
                        <picker mode="selector" :range="invoiceList" :value="procurementForm.needInvoiceIndex" @change="onNeedInvoiceChange">
                            <view class="picker-view">
                                <text :class="procurementForm.needInvoiceIndex > 0 ? 'picker-text' : 'picker-placeholder'">
                                    {{ procurementForm.needInvoiceIndex > 0 ? invoiceList[procurementForm.needInvoiceIndex] : '请选择' }}
                                </text>
                                <text class="picker-arrow">›</text>
                            </view>
                        </picker>
                    </view>

                    <view class="form-item form-item-supplement">
                        <text class="form-label">补充说明（选填）</text>
                        <textarea
                            class="form-textarea"
                            placeholder="可填写到货时间、包装要求、验货标准等（选填）"
                            :value="procurementForm.remarks"
                            data-field="remarks"
                            @input="onProcurementInput"
                            maxlength="500"
                            auto-height
                        />
                        <text class="field-hint">补充越清楚，越能减少来回沟通</text>
                    </view>
                </view>

                <button :class="'submit-btn ' + (isSubmitting ? 'disabled' : '')" @tap="submitProcurement" :disabled="isSubmitting">
                    {{ isSubmitting ? '提交中...' : '发布采购信息' }}
                </button>
            </view>

            <view class="form-container" v-if="activeTab === 'supply'">
                <view class="form-card">
                    <text class="form-section-title">基础信息</text>

                    <view class="form-item">
                        <text class="form-label">
                            供应标题
                            <text class="required">*</text>
                        </text>
                        <input
                            class="form-input"
                            type="text"
                            placeholder="例如：长期供应一级红富士苹果"
                            :value="supplyForm.title"
                            data-field="title"
                            @input="onSupplyInput"
                        />
                        <text class="field-hint">标题写清产品、货量、货源优势，更容易获得采购咨询</text>
                        <text class="error-text" v-if="supplyErrors.title">{{ supplyErrors.title }}</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            产品品类
                            <text class="required">*</text>
                        </text>
                        <picker mode="selector" :range="categoryList" :value="supplyCategoryPickerValue" @change="onSupplyCategoryChange">
                            <view class="picker-view">
                                <text :class="supplyForm.categoryIndex >= 0 ? 'picker-text' : 'picker-placeholder'">
                                    {{ supplyForm.categoryIndex >= 0 ? categoryList[supplyForm.categoryIndex] : '请选择产品品类' }}
                                </text>
                                <text class="picker-arrow">›</text>
                            </view>
                        </picker>
                        <text class="field-hint">请选择准确品类，方便采购方快速筛选</text>
                        <text class="error-text" v-if="supplyErrors.category">{{ supplyErrors.category }}</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            产品规格
                            <text class="required">*</text>
                        </text>
                        <textarea
                            class="form-textarea"
                            placeholder="例如：80#以上、一级果、通货、精品货、硬粉"
                            :value="supplyForm.specifications"
                            data-field="specifications"
                            @input="onSupplyInput"
                            maxlength="500"
                            auto-height
                        />
                        <text class="field-hint">规格越清楚，越容易匹配精准采购方</text>
                        <text class="error-text" v-if="supplyErrors.specifications">{{ supplyErrors.specifications }}</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            供应数量
                            <text class="required">*</text>
                        </text>
                        <view class="input-with-unit">
                            <input class="form-input flex-1" type="digit" placeholder="请输入数量" :value="supplyForm.quantity" data-field="quantity" @input="onSupplyInput" />
                            <picker mode="selector" :range="supplyUnitList" :value="supplyUnitPickerValue" @change="onSupplyUnitChange">
                                <view class="unit-picker">
                                    <text>{{ supplyForm.unitIndex >= 0 ? supplyUnitList[supplyForm.unitIndex] : '单位' }}</text>
                                    <text class="picker-arrow">›</text>
                                </view>
                            </picker>
                        </view>
                        <text class="field-hint">请填写当前可供应数量，支持整数或小数</text>
                        <text class="error-text" v-if="supplyErrors.quantity">{{ supplyErrors.quantity }}</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            单价
                            <text v-if="!supplyForm.price_negotiable" class="required">*</text>
                        </text>
                        <view class="input-with-unit">
                            <input
                                class="form-input flex-1"
                                :class="{ 'is-disabled': supplyForm.price_negotiable }"
                                type="digit"
                                placeholder="请输入单价"
                                :value="supplyForm.price"
                                data-field="price"
                                :disabled="supplyForm.price_negotiable"
                                @input="onSupplyInput"
                            />
                            <view class="unit-picker unit-picker-static">
                                <text>元/{{ supplyForm.unitIndex >= 0 ? supplyUnitList[supplyForm.unitIndex] : '单位' }}</text>
                            </view>
                        </view>
                        <view class="negotiable-row" @tap="toggleSupplyPriceNegotiable">
                            <view :class="'check-box ' + (supplyForm.price_negotiable ? 'checked' : '')">
                                <text v-if="supplyForm.price_negotiable" class="check-tick">✓</text>
                            </view>
                            <text class="negotiable-label">价格面议</text>
                        </view>
                        <text class="field-hint">写清价格更容易被精准联系，也可选择面议</text>
                        <text class="error-text" v-if="supplyErrors.price">{{ supplyErrors.price }}</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            所在地 / 发货地
                            <text class="required">*</text>
                        </text>
                        <input
                            class="form-input"
                            type="text"
                            placeholder="请输入货源所在地或发货地区"
                            :value="supplyForm.location"
                            data-field="location"
                            @input="onSupplyInput"
                        />
                        <text class="field-hint">填写准确货源地，更容易匹配附近采购方</text>
                        <text class="error-text" v-if="supplyErrors.location">{{ supplyErrors.location }}</text>
                    </view>

                    <text class="form-section-title form-section-title-spaced">货源属性</text>

                    <view class="form-item">
                        <text class="form-label">是否现货</text>
                        <view class="radio-row">
                            <view :class="'radio-pill ' + (supplyForm.is_in_stock ? 'active' : '')" data-v="1" @tap="setSupplyInStock">是</view>
                            <view :class="'radio-pill ' + (!supplyForm.is_in_stock ? 'active' : '')" data-v="0" @tap="setSupplyInStock">否</view>
                        </view>
                    </view>

                    <view class="form-item">
                        <text class="form-label">是否产地直发</text>
                        <view class="radio-row">
                            <view :class="'radio-pill ' + (supplyForm.is_origin_direct ? 'active' : '')" data-v="1" @tap="setSupplyOriginDirect">是</view>
                            <view :class="'radio-pill ' + (!supplyForm.is_origin_direct ? 'active' : '')" data-v="0" @tap="setSupplyOriginDirect">否</view>
                        </view>
                    </view>

                    <view class="form-item">
                        <text class="form-label">是否可长期供货</text>
                        <view class="radio-row">
                            <view :class="'radio-pill ' + (supplyForm.is_long_term_supply ? 'active' : '')" data-v="1" @tap="setSupplyLongTermSupply">是</view>
                            <view :class="'radio-pill ' + (!supplyForm.is_long_term_supply ? 'active' : '')" data-v="0" @tap="setSupplyLongTermSupply">否</view>
                        </view>
                    </view>

                    <view class="form-item">
                        <text class="form-label">起订量（可选）</text>
                        <input
                            class="form-input"
                            type="text"
                            placeholder="例如：1吨起订"
                            :value="supplyForm.min_order_quantity"
                            data-field="min_order_quantity"
                            @input="onSupplyInput"
                        />
                        <text class="field-hint">有起订要求可填写，减少无效询价</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">发货方式（可选）</text>
                        <picker mode="selector" :range="supplyShippingList" :value="supplyForm.shippingMethodIndex" @change="onSupplyShippingChange">
                            <view class="picker-view">
                                <text :class="supplyForm.shippingMethodIndex > 0 ? 'picker-text' : 'picker-placeholder'">
                                    {{
                                        supplyForm.shippingMethodIndex > 0
                                            ? supplyShippingList[supplyForm.shippingMethodIndex]
                                            : '请选择发货方式'
                                    }}
                                </text>
                                <text class="picker-arrow">›</text>
                            </view>
                        </picker>
                    </view>

                    <text class="form-section-title form-section-title-spaced">图片与描述</text>

                    <view class="form-item">
                        <text class="form-label">
                            产品图片
                            <text class="required">*</text>
                        </text>
                        <view class="image-upload-section">
                            <view class="image-list">
                                <view class="image-item" v-for="(item, index) in supplyForm.images" :key="index">
                                    <image class="uploaded-image" :src="item" mode="aspectFill"></image>
                                    <view v-if="index === 0" class="cover-badge">封面</view>
                                    <view class="image-delete" @tap="removeImage" :data-index="index">✕</view>
                                </view>
                                <view class="image-upload-btn" v-if="supplyForm.images.length < 9" @tap="chooseImage">
                                    <text class="upload-icon">📷</text>
                                    <text class="upload-text">添加图片</text>
                                </view>
                            </view>
                        </view>
                        <text class="field-hint">上传实拍图更容易获得采购方信任；第一张图将作为列表封面展示</text>
                        <text class="error-text" v-if="supplyErrors.images">{{ supplyErrors.images }}</text>
                        <text class="form-hint">最多可上传 9 张</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            详细描述
                            <text class="required">*</text>
                        </text>
                        <textarea
                            class="form-textarea large"
                            placeholder="请详细描述产品特点、货源优势、发货情况等"
                            :value="supplyForm.description"
                            data-field="description"
                            @input="onSupplyInput"
                            maxlength="1000"
                            auto-height
                        />
                        <text class="field-hint">可填写品质特点、包装方式、供货周期、发货能力等信息</text>
                        <text class="error-text" v-if="supplyErrors.description">{{ supplyErrors.description }}</text>
                    </view>
                </view>

                <button :class="'submit-btn ' + (isSubmitting ? 'disabled' : '')" @tap="submitSupply" :disabled="isSubmitting">
                    {{ isSubmitting ? '提交中...' : '发布供应信息' }}
                </button>
            </view>
        </scroll-view>
    </view>
</template>

<script>
import { publishSupply, publishProcurement } from '../../utils/api.js';
import { PRODUCT_CATEGORIES } from '../../utils/constants.js';

function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export default {
    data() {
        return {
            statusBarHeight: 20,
            navRowHeightPx: 44,
            headerRightInset: 12,
            activeTab: 'procurement',
            isSubmitting: false,
            categoryList: [...PRODUCT_CATEGORIES],
            procurementUnitList: ['斤', '吨', '箱', '件', '袋'],
            supplyUnitList: ['斤', '吨', '箱', '件', '袋'],
            supplyShippingList: ['请选择', '自提', '物流', '整车', '冷链', '面议'],
            settlementList: ['请选择', '现款现货', '账期', '定金', '面议'],
            invoiceList: ['请选择', '需要', '不需要', '面议'],
            procurementForm: {
                title: '',
                categoryIndex: -1,
                specifications: '',
                quantity: '',
                unitIndex: -1,
                price: '',
                price_negotiable: false,
                address: '',
                is_urgent: false,
                is_long_term: false,
                deadline: '',
                settlementIndex: 0,
                needInvoiceIndex: 0,
                remarks: ''
            },
            procurementErrors: {
                category: '',
                quantity: '',
                title: '',
                specifications: '',
                price: '',
                address: '',
                deadline: ''
            },
            supplyForm: {
                title: '',
                categoryIndex: -1,
                specifications: '',
                quantity: '',
                unitIndex: -1,
                price: '',
                price_negotiable: false,
                location: '',
                is_in_stock: true,
                is_origin_direct: false,
                is_long_term_supply: false,
                min_order_quantity: '',
                shippingMethodIndex: 0,
                images: [],
                description: ''
            },
            supplyErrors: {
                category: '',
                quantity: '',
                images: '',
                title: '',
                specifications: '',
                price: '',
                location: '',
                description: ''
            }
        };
    },
    computed: {
        deadlinePickerDefault() {
            return this.procurementForm.deadline || todayStr();
        },
        deadlinePickerStart() {
            return todayStr();
        },
        procurementCategoryPickerValue() {
            const i = this.procurementForm.categoryIndex;
            return i >= 0 ? i : 0;
        },
        procurementUnitPickerValue() {
            const i = this.procurementForm.unitIndex;
            return i >= 0 ? i : 0;
        },
        supplyCategoryPickerValue() {
            const i = this.supplyForm.categoryIndex;
            return i >= 0 ? i : 0;
        },
        supplyUnitPickerValue() {
            const i = this.supplyForm.unitIndex;
            return i >= 0 ? i : 0;
        }
    },
    onLoad(options) {
        this.initNavLayout();
        if (options.tab === 'supply') {
            this.setData({
                activeTab: 'supply'
            });
        }
    },
    methods: {
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
            this.setData({
                statusBarHeight: sb,
                navRowHeightPx: navH,
                headerRightInset: inset
            });
        },
        goBack() {
            uni.navigateBack({
                fail: () => {
                    uni.switchTab({
                        url: '/pages/profile/profile'
                    });
                }
            });
        },
        switchTab(e) {
            const tab = e.currentTarget.dataset.tab;
            this.setData({
                activeTab: tab,
                procurementErrors: {
                    category: '',
                    quantity: '',
                    title: '',
                    specifications: '',
                    price: '',
                    address: '',
                    deadline: ''
                },
                supplyErrors: {}
            });
        },
        onProcurementInput(e) {
            const field = e.currentTarget.dataset.field;
            const value = e.detail.value;
            this.setData({
                [`procurementForm.${field}`]: value,
                [`procurementErrors.${field}`]: ''
            });
        },
        onProcurementCategoryChange(e) {
            const idx = Number(e.detail.value);
            this.setData({
                'procurementForm.categoryIndex': idx,
                'procurementErrors.category': ''
            });
        },
        onProcurementUnitChange(e) {
            const idx = Number(e.detail.value);
            this.setData({
                'procurementForm.unitIndex': idx,
                'procurementErrors.quantity': ''
            });
        },
        togglePriceNegotiable() {
            const next = !this.procurementForm.price_negotiable;
            this.setData({
                'procurementForm.price_negotiable': next,
                'procurementErrors.price': ''
            });
            if (next) {
                this.setData({
                    'procurementForm.price': ''
                });
            }
        },
        setProcurementUrgent(e) {
            const v = e.currentTarget.dataset.v === '1';
            this.setData({
                'procurementForm.is_urgent': v,
                'procurementErrors.deadline': ''
            });
        },
        setProcurementLongTerm(e) {
            const v = e.currentTarget.dataset.v === '1';
            this.setData({
                'procurementForm.is_long_term': v
            });
        },
        onProcurementDeadlineChange(e) {
            this.setData({
                'procurementForm.deadline': e.detail.value,
                'procurementErrors.deadline': ''
            });
        },
        onSettlementChange(e) {
            this.setData({
                'procurementForm.settlementIndex': Number(e.detail.value)
            });
        },
        onNeedInvoiceChange(e) {
            this.setData({
                'procurementForm.needInvoiceIndex': Number(e.detail.value)
            });
        },
        onSupplyInput(e) {
            const field = e.currentTarget.dataset.field;
            const value = e.detail.value;
            this.setData({
                [`supplyForm.${field}`]: value,
                [`supplyErrors.${field}`]: ''
            });
        },
        onSupplyCategoryChange(e) {
            this.setData({
                'supplyForm.categoryIndex': Number(e.detail.value),
                'supplyErrors.category': ''
            });
        },
        onSupplyUnitChange(e) {
            this.setData({
                'supplyForm.unitIndex': Number(e.detail.value),
                'supplyErrors.quantity': ''
            });
        },
        toggleSupplyPriceNegotiable() {
            const next = !this.supplyForm.price_negotiable;
            this.setData({
                'supplyForm.price_negotiable': next,
                'supplyErrors.price': ''
            });
            if (next) {
                this.setData({
                    'supplyForm.price': ''
                });
            }
        },
        setSupplyInStock(e) {
            const v = e.currentTarget.dataset.v === '1';
            this.setData({
                'supplyForm.is_in_stock': v
            });
        },
        setSupplyOriginDirect(e) {
            const v = e.currentTarget.dataset.v === '1';
            this.setData({
                'supplyForm.is_origin_direct': v
            });
        },
        setSupplyLongTermSupply(e) {
            const v = e.currentTarget.dataset.v === '1';
            this.setData({
                'supplyForm.is_long_term_supply': v
            });
        },
        onSupplyShippingChange(e) {
            this.setData({
                'supplyForm.shippingMethodIndex': Number(e.detail.value)
            });
        },
        chooseImage() {
            const { images } = this.supplyForm;
            const remaining = 9 - images.length;
            uni.chooseImage({
                count: remaining,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFilePaths = res.tempFilePaths;
                    this.setData({
                        'supplyForm.images': [...images, ...tempFilePaths],
                        'supplyErrors.images': ''
                    });
                },
                fail: (err) => {
                    console.error('选择图片失败', err);
                    uni.showToast({
                        title: '选择图片失败',
                        icon: 'none'
                    });
                }
            });
        },
        removeImage(e) {
            const index = e.currentTarget.dataset.index;
            const images = [...this.supplyForm.images];
            images.splice(index, 1);
            this.setData({
                'supplyForm.images': images
            });
        },
        validateProcurementForm() {
            const { procurementForm, procurementUnitList } = this;
            const errors = {};
            const titleT = procurementForm.title.trim();
            if (!titleT) {
                errors.title = '请输入采购标题';
            } else if (titleT.length < 4) {
                errors.title = '标题请写清产品、数量等关键信息（至少4个字）';
            }
            if (procurementForm.categoryIndex < 0) {
                errors.category = '请选择产品品类';
            }
            const specT = procurementForm.specifications.trim();
            if (!specT) {
                errors.specifications = '请输入详细规格';
            } else if (specT.length < 4) {
                errors.specifications = '请补充规格要求（至少4个字），减少无效咨询';
            }
            if (!procurementForm.quantity.trim()) {
                errors.quantity = '请填写采购数量';
            } else if (isNaN(procurementForm.quantity) || parseFloat(procurementForm.quantity) <= 0) {
                errors.quantity = '请输入有效的数量';
            }
            if (procurementForm.unitIndex < 0) {
                errors.quantity = errors.quantity || '请选择单位';
            }
            if (!procurementForm.price_negotiable) {
                if (!procurementForm.price.trim()) {
                    errors.price = '请填写期望单价或勾选价格面议';
                } else if (isNaN(procurementForm.price) || parseFloat(procurementForm.price) <= 0) {
                    errors.price = '请输入有效的单价';
                }
            }
            if (!procurementForm.address.trim()) {
                errors.address = '请输入收货地址';
            }
            this.setData({
                procurementErrors: errors
            });
            return Object.keys(errors).length === 0;
        },
        validateSupplyForm() {
            const { supplyForm } = this;
            const errors = {};
            const titleT = supplyForm.title.trim();
            if (!titleT) {
                errors.title = '请输入供应标题';
            } else if (titleT.length < 4) {
                errors.title = '标题请写清产品、货量或优势（至少4个字）';
            }
            if (supplyForm.categoryIndex < 0) {
                errors.category = '请选择产品品类';
            }
            const specT = supplyForm.specifications.trim();
            if (!specT) {
                errors.specifications = '请填写产品规格';
            } else if (specT.length < 4) {
                errors.specifications = '请补充规格（至少4个字），便于精准匹配';
            }
            if (!supplyForm.quantity.trim()) {
                errors.quantity = '请填写供应数量';
            } else if (isNaN(supplyForm.quantity) || parseFloat(supplyForm.quantity) <= 0) {
                errors.quantity = '请输入有效的数量';
            }
            if (supplyForm.unitIndex < 0) {
                errors.quantity = errors.quantity || '请选择单位';
            }
            if (!supplyForm.price_negotiable) {
                if (!supplyForm.price.trim()) {
                    errors.price = '请填写单价或勾选价格面议';
                } else if (isNaN(supplyForm.price) || parseFloat(supplyForm.price) <= 0) {
                    errors.price = '请输入有效的单价';
                }
            }
            if (!supplyForm.location.trim()) {
                errors.location = '请输入所在地 / 发货地';
            }
            if (supplyForm.images.length === 0) {
                errors.images = '请上传至少一张产品图片';
            }
            if (!supplyForm.description.trim()) {
                errors.description = '请填写详细描述';
            } else if (supplyForm.description.trim().length < 15) {
                errors.description = '描述建议不少于15字，补充货源优势与发货说明';
            }
            this.setData({
                supplyErrors: errors
            });
            return Object.keys(errors).length === 0;
        },
        emptySupplyForm() {
            return {
                title: '',
                categoryIndex: -1,
                specifications: '',
                quantity: '',
                unitIndex: -1,
                price: '',
                price_negotiable: false,
                location: '',
                is_in_stock: true,
                is_origin_direct: false,
                is_long_term_supply: false,
                min_order_quantity: '',
                shippingMethodIndex: 0,
                images: [],
                description: ''
            };
        },
        emptyProcurementForm() {
            return {
                title: '',
                categoryIndex: -1,
                specifications: '',
                quantity: '',
                unitIndex: -1,
                price: '',
                price_negotiable: false,
                address: '',
                is_urgent: false,
                is_long_term: false,
                deadline: '',
                settlementIndex: 0,
                needInvoiceIndex: 0,
                remarks: ''
            };
        },
        async submitProcurement() {
            if (this.isSubmitting) {
                return;
            }
            if (!this.validateProcurementForm()) {
                uni.showToast({
                    title: '请完善必填信息',
                    icon: 'none'
                });
                return;
            }
            this.setData({
                isSubmitting: true
            });

            try {
                const { procurementForm, categoryList, procurementUnitList, settlementList, invoiceList } = this;

                const publishData = {
                    title: procurementForm.title.trim(),
                    category: categoryList[procurementForm.categoryIndex],
                    specifications: procurementForm.specifications.trim(),
                    quantity: procurementForm.quantity.trim(),
                    unit: procurementUnitList[procurementForm.unitIndex],
                    price: procurementForm.price_negotiable ? '面议' : procurementForm.price.trim(),
                    address: procurementForm.address.trim(),
                    remarks: procurementForm.remarks ? procurementForm.remarks.trim() : '',
                    is_urgent: procurementForm.is_urgent,
                    is_long_term: procurementForm.is_long_term,
                    deadline: procurementForm.deadline.trim(),
                    price_negotiable: procurementForm.price_negotiable,
                    settlement_type:
                        procurementForm.settlementIndex > 0 ? settlementList[procurementForm.settlementIndex] : '',
                    need_invoice:
                        procurementForm.needInvoiceIndex > 0 ? invoiceList[procurementForm.needInvoiceIndex] : '',
                    urgency: procurementForm.is_urgent ? 'Urgent' : 'Normal'
                };

                await publishProcurement(publishData);

                uni.showToast({
                    title: '发布成功！',
                    icon: 'success',
                    duration: 2000
                });

                this.setData({
                    procurementForm: this.emptyProcurementForm(),
                    procurementErrors: {
                        category: '',
                        quantity: '',
                        title: '',
                        specifications: '',
                        price: '',
                        address: '',
                        deadline: ''
                    }
                });

                setTimeout(() => {
                    uni.navigateBack();
                }, 2000);
            } catch (error) {
                console.error('发布失败:', error);
                uni.showToast({
                    title: error.message || '发布失败，请重试',
                    icon: 'none',
                    duration: 2000
                });
            } finally {
                this.setData({
                    isSubmitting: false
                });
            }
        },
        async uploadImagesToCloud(filePaths) {
            const uploadPromises = filePaths.map((filePath) => {
                return new Promise((resolve, reject) => {
                    uniCloud.uploadFile({
                        filePath: filePath,
                        cloudPath: `supply-images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`,
                        success: (res) => {
                            resolve(res.fileID);
                        },
                        fail: (err) => {
                            console.error('图片上传失败:', err);
                            reject(err);
                        }
                    });
                });
            });

            try {
                const fileIDs = await Promise.all(uploadPromises);
                return fileIDs;
            } catch (error) {
                throw new Error('图片上传失败，请重试');
            }
        },
        async submitSupply() {
            if (this.isSubmitting) {
                return;
            }
            if (!this.validateSupplyForm()) {
                uni.showToast({
                    title: '请完善必填信息',
                    icon: 'none'
                });
                return;
            }
            this.setData({
                isSubmitting: true
            });

            try {
                const { supplyForm, categoryList, supplyUnitList, supplyShippingList } = this;

                let imageUrls = [];
                if (supplyForm.images && supplyForm.images.length > 0) {
                    uni.showLoading({
                        title: '上传图片中...',
                        mask: true
                    });

                    try {
                        imageUrls = await this.uploadImagesToCloud(supplyForm.images);
                    } catch (error) {
                        uni.hideLoading();
                        throw error;
                    }

                    uni.hideLoading();
                }

                const shippingMethod =
                    supplyForm.shippingMethodIndex > 0 ? supplyShippingList[supplyForm.shippingMethodIndex] : '';

                const publishData = {
                    title: supplyForm.title.trim(),
                    category: categoryList[supplyForm.categoryIndex],
                    specifications: supplyForm.specifications.trim(),
                    quantity: supplyForm.quantity.trim(),
                    unit: supplyUnitList[supplyForm.unitIndex],
                    price: supplyForm.price_negotiable ? '面议' : supplyForm.price.trim(),
                    price_negotiable: supplyForm.price_negotiable,
                    location: supplyForm.location.trim(),
                    images: imageUrls,
                    description: supplyForm.description.trim(),
                    is_in_stock: supplyForm.is_in_stock,
                    is_origin_direct: supplyForm.is_origin_direct,
                    is_long_term_supply: supplyForm.is_long_term_supply,
                    min_order_quantity: supplyForm.min_order_quantity ? supplyForm.min_order_quantity.trim() : '',
                    shipping_method: shippingMethod
                };

                await publishSupply(publishData);

                uni.showToast({
                    title: '发布成功！',
                    icon: 'success',
                    duration: 2000
                });

                this.setData({
                    supplyForm: this.emptySupplyForm(),
                    supplyErrors: {}
                });

                setTimeout(() => {
                    uni.navigateBack();
                }, 2000);
            } catch (error) {
                console.error('发布失败:', error);
                uni.showToast({
                    title: error.message || '发布失败，请重试',
                    icon: 'none',
                    duration: 2000
                });
            } finally {
                this.setData({
                    isSubmitting: false
                });
            }
        }
    }
};
</script>
<style>
@import './publish-info.css';
</style>
