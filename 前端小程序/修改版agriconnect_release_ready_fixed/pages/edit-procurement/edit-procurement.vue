<template>
    <view class="publish-info-page">
        <view class="pub-green-header" :style="{ paddingTop: statusBarHeight + 'px' }">
            <view class="pub-nav-row" :style="{ height: navRowHeightPx + 'px', paddingRight: headerRightInset + 'px' }">
                <view class="pub-nav-back" @tap="goBack" hover-class="pub-nav-back-hover" hover-stay-time="100">
                    <text class="pub-nav-back-icon">‹</text>
                </view>
                <text class="pub-nav-title">编辑采购</text>
            </view>
        </view>

        <scroll-view class="content-area" scroll-y>
            <view class="form-container">
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
                            <view :class="'radio-pill ' + (!procurementForm.is_urgent ? 'active' : '')" data-v="0" @tap="setProcurementUrgent">否</view>
                            <view :class="'radio-pill ' + (procurementForm.is_urgent ? 'active' : '')" data-v="1" @tap="setProcurementUrgent">是</view>
                        </view>
                        <text v-if="procurementForm.is_urgent" class="field-hint field-hint-warn">急购信息建议填写截止时间</text>
                    </view>

                    <view class="form-item">
                        <text class="form-label">是否长期采购</text>
                        <view class="radio-row">
                            <view :class="'radio-pill ' + (!procurementForm.is_long_term ? 'active' : '')" data-v="0" @tap="setProcurementLongTerm">否</view>
                            <view :class="'radio-pill ' + (procurementForm.is_long_term ? 'active' : '')" data-v="1" @tap="setProcurementLongTerm">是</view>
                        </view>
                    </view>

                    <view class="form-item">
                        <text class="form-label">
                            截止时间
                            <text class="required">*</text>
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

                <view class="action-buttons">
                    <button :class="'submit-btn ' + (isSubmitting ? 'disabled' : '')" @tap="submitUpdate" :disabled="isSubmitting">
                        {{ isSubmitting ? '提交中...' : '提交修改' }}
                    </button>
                    <button class="offline-btn" @tap="offlineProcurement">下架此采购</button>
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script>
import { getProcurementDetail, updateProcurement, updateProcurementStatus } from '../../utils/api.js';
import { PRODUCT_CATEGORIES } from '../../utils/constants.js';
import { validateProcurementForm as validateProcurementFormUtil } from '../../utils/validators.js';
import { showError } from '../../utils/util.js';

function todayStr() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function normalizeDeadlineValue(d) {
    if (d == null || d === '') {
        return '';
    }
    const s = String(d).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) {
        return m[1];
    }
    const t = Date.parse(s.replace(/-/g, '/'));
    if (!isNaN(t)) {
        const dt = new Date(t);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    }
    return '';
}

export default {
    data() {
        return {
            statusBarHeight: 20,
            navRowHeightPx: 44,
            headerRightInset: 12,
            procurementId: null,
            isSubmitting: false,
            categoryList: [...PRODUCT_CATEGORIES],
            procurementUnitList: ['斤', '吨', '箱', '件', '袋'],
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
        }
    },
    onLoad(options) {
        this.initNavLayout();
        const id = options.id;
        if (id) {
            this.setData({ procurementId: id });
            this.loadProcurementDetail(id);
        } else {
            uni.showToast({ title: '参数错误', icon: 'none' });
            setTimeout(() => uni.navigateBack(), 1500);
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
                    uni.switchTab({ url: '/pages/profile/profile' });
                }
            });
        },
        async loadProcurementDetail(id) {
            uni.showLoading({ title: '加载中...' });
            try {
                const data = await getProcurementDetail(id);
                this.fillForm(data);
            } catch (err) {
                console.error('加载失败', err);
                uni.showToast({ title: err.message || '加载失败', icon: 'none' });
                setTimeout(() => uni.navigateBack(), 1500);
            } finally {
                uni.hideLoading();
            }
        },
        fillForm(data) {
            const categoryIndex = this.categoryList.findIndex((c) => c === data.category);
            const unitIndex = this.procurementUnitList.findIndex((u) => u === data.unit);
            const rawPrice = data.price != null ? String(data.price).trim() : '';
            const priceText = (data.price_text || '').trim();
            const priceNegotiable =
                data.price_negotiable === true || rawPrice === '面议' || priceText === '面议';
            let price = '';
            if (!priceNegotiable && rawPrice && rawPrice !== '面议') {
                price = rawPrice;
            }
            let settlementIndex = 0;
            if (data.settlement_type) {
                const si = this.settlementList.findIndex((s) => s === data.settlement_type);
                if (si > 0) {
                    settlementIndex = si;
                }
            }
            let needInvoiceIndex = 0;
            const inv = data.need_invoice || data.needInvoice;
            if (inv) {
                const ni = this.invoiceList.findIndex((s) => s === inv);
                if (ni > 0) {
                    needInvoiceIndex = ni;
                }
            }
            this.setData({
                procurementForm: {
                    title: data.title || '',
                    categoryIndex: categoryIndex >= 0 ? categoryIndex : -1,
                    specifications: data.specifications || data.spec || '',
                    quantity: String(data.quantity != null ? data.quantity : ''),
                    unitIndex: unitIndex >= 0 ? unitIndex : -1,
                    price,
                    price_negotiable: priceNegotiable,
                    address: data.address || '',
                    is_urgent: !!(data.is_urgent || data.urgency === 'Urgent' || data.urgency === 'urgent'),
                    is_long_term: !!(data.is_long_term || data.long_term),
                    deadline: normalizeDeadlineValue(data.deadline),
                    settlementIndex,
                    needInvoiceIndex,
                    remarks: data.remarks || data.remark || data.description || ''
                }
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
            this.setData({
                'procurementForm.categoryIndex': Number(e.detail.value),
                'procurementErrors.category': ''
            });
        },
        onProcurementUnitChange(e) {
            this.setData({
                'procurementForm.unitIndex': Number(e.detail.value),
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
                this.setData({ 'procurementForm.price': '' });
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
            this.setData({ 'procurementForm.is_long_term': v });
        },
        onProcurementDeadlineChange(e) {
            this.setData({
                'procurementForm.deadline': e.detail.value,
                'procurementErrors.deadline': ''
            });
        },
        onSettlementChange(e) {
            this.setData({ 'procurementForm.settlementIndex': Number(e.detail.value) });
        },
        onNeedInvoiceChange(e) {
            this.setData({ 'procurementForm.needInvoiceIndex': Number(e.detail.value) });
        },
        validateProcurementForm() {
            const result = validateProcurementFormUtil(this.procurementForm);
            const procurementErrors = {
                category: '',
                quantity: '',
                title: '',
                specifications: '',
                price: '',
                address: '',
                deadline: '',
                ...result.errors
            };
            this.setData({ procurementErrors });
            return result.valid;
        },
        submitUpdate() {
            if (this.isSubmitting) {
                return;
            }
            if (!this.validateProcurementForm()) {
                showError('请完善必填信息');
                return;
            }
            const { procurementForm, procurementId, categoryList, procurementUnitList, settlementList, invoiceList } = this;
            if (procurementForm.categoryIndex < 0 || procurementForm.unitIndex < 0) {
                showError('请选择品类与单位');
                return;
            }
            this.setData({ isSubmitting: true });
            const formData = {
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
                deadline: (procurementForm.deadline || '').trim(),
                price_negotiable: procurementForm.price_negotiable,
                settlement_type: procurementForm.settlementIndex > 0 ? settlementList[procurementForm.settlementIndex] : '',
                need_invoice: procurementForm.needInvoiceIndex > 0 ? invoiceList[procurementForm.needInvoiceIndex] : '',
                urgency: procurementForm.is_urgent ? 'Urgent' : 'Normal'
            };
            updateProcurement(procurementId, formData)
                .then(() => {
                    this.setData({ isSubmitting: false });
                    uni.showToast({ title: '修改成功！', icon: 'success', duration: 2000 });
                    setTimeout(() => uni.navigateBack(), 2000);
                })
                .catch((err) => {
                    console.error('提交失败', err);
                    this.setData({ isSubmitting: false });
                    uni.showToast({ title: '修改失败，请重试', icon: 'none' });
                });
        },
        offlineProcurement() {
            uni.showModal({
                title: '确认下架',
                content: '确定要下架这条采购信息吗？下架后将不再对外展示。',
                success: (res) => {
                    if (res.confirm) {
                        updateProcurementStatus(this.procurementId, '已下架')
                            .then(() => {
                                uni.showToast({ title: '下架成功', icon: 'success' });
                                setTimeout(() => uni.navigateBack(), 1500);
                            })
                            .catch(() => {
                                uni.showToast({ title: '下架失败', icon: 'none' });
                            });
                    }
                }
            });
        }
    }
};
</script>
<style>
@import '../publish-info/publish-info.css';
@import './edit-procurement.css';
</style>
