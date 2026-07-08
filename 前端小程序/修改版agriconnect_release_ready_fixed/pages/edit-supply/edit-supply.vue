<template>
    <view class="publish-info-page">
        <view class="pub-green-header" :style="{ paddingTop: statusBarHeight + 'px' }">
            <view class="pub-nav-row" :style="{ height: navRowHeightPx + 'px', paddingRight: headerRightInset + 'px' }">
                <view class="pub-nav-back" @tap="goBack" hover-class="pub-nav-back-hover" hover-stay-time="100">
                    <text class="pub-nav-back-icon">‹</text>
                </view>
                <text class="pub-nav-title">编辑供应</text>
            </view>
        </view>

        <scroll-view class="content-area" scroll-y>
            <view class="form-container">
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
                                <view class="image-item" v-for="(item, index) in supplyForm.images" :key="'img-' + index">
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

                <view class="action-buttons">
                    <button :class="'submit-btn ' + (isSubmitting ? 'disabled' : '')" @tap="submitUpdate" :disabled="isSubmitting">
                        {{ isSubmitting ? '提交中...' : '提交修改' }}
                    </button>
                    <button class="offline-btn" @tap="offlineSupply">下架此供应</button>
                </view>
            </view>
        </scroll-view>
    </view>
</template>

<script>
import { getSupplyDetail, updateSupply, updateSupplyStatus } from '../../utils/api.js';
import { PRODUCT_CATEGORIES } from '../../utils/constants.js';
import { validateSupplyForm as validateSupplyFormUtil } from '../../utils/validators.js';
import { showError } from '../../utils/util.js';

function isRemoteImage(p) {
    const s = String(p || '');
    return /^https?:\/\//i.test(s) || s.indexOf('cloud://') === 0;
}

export default {
    data() {
        return {
            statusBarHeight: 20,
            navRowHeightPx: 44,
            headerRightInset: 12,
            supplyId: null,
            isSubmitting: false,
            categoryList: [...PRODUCT_CATEGORIES],
            supplyUnitList: ['斤', '吨', '箱', '件', '袋'],
            supplyShippingList: ['请选择', '自提', '物流', '整车', '冷链', '面议'],
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
        const id = options.id;
        if (id) {
            this.setData({ supplyId: id });
            this.loadSupplyDetail(id);
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
        async loadSupplyDetail(id) {
            uni.showLoading({ title: '加载中...' });
            try {
                const data = await getSupplyDetail(id);
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
            const unitIndex = this.supplyUnitList.findIndex((u) => u === data.unit);
            const rawPrice = data.price != null ? String(data.price).trim() : '';
            const priceNegotiable = data.price_negotiable === true || rawPrice === '面议' || (data.price_text || '').trim() === '面议';
            let price = '';
            if (!priceNegotiable && rawPrice && rawPrice !== '面议') {
                price = rawPrice;
            }
            let shippingMethodIndex = 0;
            if (data.shipping_method) {
                const si = this.supplyShippingList.findIndex((s) => s === data.shipping_method);
                if (si > 0) {
                    shippingMethodIndex = si;
                }
            }
            const images = [];
            const seen = {};
            const pushUrl = (u) => {
                const s = String(u || '').trim();
                if (!s || seen[s]) {
                    return;
                }
                seen[s] = 1;
                images.push(s);
            };
            if (data.cover) {
                pushUrl(data.cover);
            }
            if (Array.isArray(data.images)) {
                data.images.forEach(pushUrl);
            }
            if (images.length === 0 && data.image) {
                pushUrl(data.image);
            }
            this.setData({
                supplyForm: {
                    title: data.title || data.product_name || '',
                    categoryIndex: categoryIndex >= 0 ? categoryIndex : -1,
                    specifications: data.specifications || data.spec || '',
                    quantity: String(data.quantity != null ? data.quantity : ''),
                    unitIndex: unitIndex >= 0 ? unitIndex : -1,
                    price,
                    price_negotiable: priceNegotiable,
                    location: data.location || data.ship_from || data.origin || '',
                    is_in_stock: data.is_in_stock !== false && data.is_in_stock !== 0 && data.is_in_stock !== '0',
                    is_origin_direct: !!(data.is_origin_direct || data.origin_direct),
                    is_long_term_supply: !!(data.is_long_term_supply || data.long_term_supply),
                    min_order_quantity: data.min_order_quantity != null ? String(data.min_order_quantity) : '',
                    shippingMethodIndex,
                    images,
                    description: data.description || data.desc || ''
                }
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
                this.setData({ 'supplyForm.price': '' });
            }
        },
        setSupplyInStock(e) {
            const v = e.currentTarget.dataset.v === '1';
            this.setData({ 'supplyForm.is_in_stock': v });
        },
        setSupplyOriginDirect(e) {
            const v = e.currentTarget.dataset.v === '1';
            this.setData({ 'supplyForm.is_origin_direct': v });
        },
        setSupplyLongTermSupply(e) {
            const v = e.currentTarget.dataset.v === '1';
            this.setData({ 'supplyForm.is_long_term_supply': v });
        },
        onSupplyShippingChange(e) {
            this.setData({ 'supplyForm.shippingMethodIndex': Number(e.detail.value) });
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
                    uni.showToast({ title: '选择图片失败', icon: 'none' });
                }
            });
        },
        removeImage(e) {
            const index = e.currentTarget.dataset.index;
            const imgs = [...this.supplyForm.images];
            imgs.splice(index, 1);
            this.setData({ 'supplyForm.images': imgs });
        },
        uploadImagesToCloud(filePaths) {
            return Promise.all(
                filePaths.map(
                    (filePath) =>
                        new Promise((resolve, reject) => {
                            uniCloud.uploadFile({
                                filePath: filePath,
                                cloudPath: `supply-images/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.jpg`,
                                success: (res) => resolve(res.fileID),
                                fail: (err) => {
                                    console.error('图片上传失败:', err);
                                    reject(err);
                                }
                            });
                        })
                )
            );
        },
        async resolveImageListForSubmit(images) {
            const localIdx = [];
            const localPaths = [];
            images.forEach((p, i) => {
                if (!isRemoteImage(p)) {
                    localIdx.push(i);
                    localPaths.push(p);
                }
            });
            if (localPaths.length === 0) {
                return images.slice();
            }
            const uploaded = await this.uploadImagesToCloud(localPaths);
            const out = images.slice();
            localIdx.forEach((idx, j) => {
                out[idx] = uploaded[j];
            });
            return out;
        },
        validateSupplyForm() {
            const result = validateSupplyFormUtil(this.supplyForm);
            const supplyErrors = {
                category: '',
                quantity: '',
                images: '',
                title: '',
                specifications: '',
                price: '',
                location: '',
                description: '',
                ...result.errors
            };
            this.setData({ supplyErrors });
            return result.valid;
        },
        async submitUpdate() {
            if (this.isSubmitting) {
                return;
            }
            if (!this.validateSupplyForm()) {
                showError('请完善必填信息');
                return;
            }
            const { supplyForm, supplyId, categoryList, supplyUnitList, supplyShippingList } = this;
            if (supplyForm.categoryIndex < 0 || supplyForm.unitIndex < 0) {
                showError('请选择品类与单位');
                return;
            }
            this.setData({ isSubmitting: true });
            try {
                let imageUrls = [];
                if (supplyForm.images && supplyForm.images.length > 0) {
                    const needLocal = supplyForm.images.some((p) => !isRemoteImage(p));
                    if (needLocal) {
                        uni.showLoading({ title: '上传图片中...', mask: true });
                        try {
                            imageUrls = await this.resolveImageListForSubmit(supplyForm.images);
                        } finally {
                            uni.hideLoading();
                        }
                    } else {
                        imageUrls = supplyForm.images.slice();
                    }
                }
                const shippingMethod = supplyForm.shippingMethodIndex > 0 ? supplyShippingList[supplyForm.shippingMethodIndex] : '';
                const formData = {
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
                await updateSupply(supplyId, formData);
                uni.showToast({ title: '修改成功！', icon: 'success', duration: 2000 });
                setTimeout(() => uni.navigateBack(), 2000);
            } catch (err) {
                console.error('提交失败', err);
                showError(err.message || '修改失败，请重试');
            } finally {
                this.setData({ isSubmitting: false });
            }
        },
        offlineSupply() {
            uni.showModal({
                title: '确认下架',
                content: '确定要下架这条供应信息吗？下架后将不再对外展示。',
                success: (res) => {
                    if (res.confirm) {
                        updateSupplyStatus(this.supplyId, '已下架')
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
@import './edit-supply.css';
</style>
