<template>
    <view class="auth-page">
        <!-- 说明卡 -->
        <view class="intro-card">
            <text class="intro-title">企业认证说明</text>
            <text class="intro-line">· 完成企业认证后，可提升账号可信度</text>
            <text class="intro-line">· 企业认证用户将在个人主页、供求信息中展示「企业认证」标识</text>
            <text class="intro-line">· 请确保提交的信息真实有效</text>
        </view>

        <!-- 状态：已通过 -->
        <view v-if="entStatus === 'approved'" class="status-container verified">
            <view class="status-icon">✓</view>
            <text class="status-title">已通过企业认证</text>
            <text class="status-desc">您的企业认证已通过审核</text>
            <view class="verified-info">
                <view class="info-item">
                    <text class="info-label">企业名称：</text>
                    <text class="info-value">{{ enterprise_name }}</text>
                </view>
                <view class="info-item">
                    <text class="info-label">统一社会信用代码：</text>
                    <text class="info-value">{{ credit_code }}</text>
                </view>
            </view>
        </view>

        <!-- 状态：审核中 -->
        <view v-else-if="entStatus === 'pending'" class="status-block pending-block">
            <view class="status-icon small">⏳</view>
            <text class="status-title">平台审核中</text>
            <text class="status-desc">您的企业认证申请正在审核，请耐心等待</text>
        </view>

        <!-- 状态：已驳回 -->
        <view v-if="entStatus === 'rejected' && reject_reason" class="reject-banner">
            <text class="reason-label">驳回原因：</text>
            <text class="reason-text">{{ reject_reason }}</text>
        </view>

        <!-- 表单（未提交 / 已驳回可编辑；审核中只读） -->
        <view v-if="entStatus !== 'approved'" class="form-container">
            <view class="form-header">
                <text class="form-title">企业信息</text>
                <text class="form-subtitle">{{ entStatus === 'pending' ? '以下为已提交信息（只读）' : '请填写以下必填项' }}</text>
            </view>

            <view class="form-item">
                <text class="form-label">营业执照照片 <text class="required">*</text></text>
                <view class="upload-area">
                    <view v-if="!business_license_url" class="upload-btn" @tap="uploadLicense">
                        <text class="upload-icon">📷</text>
                        <text class="upload-text">点击上传</text>
                    </view>
                    <view v-else class="upload-preview">
                        <image class="preview-image" :src="business_license_url" mode="aspectFit" :data-url="business_license_url" @tap="previewImage" />
                        <view v-if="entStatus !== 'pending'" class="delete-btn" @tap="deleteLicense">×</view>
                    </view>
                </view>
            </view>

            <view class="form-item">
                <text class="form-label">企业名称 <text class="required">*</text></text>
                <input class="form-input" type="text" placeholder="请输入企业名称" :disabled="entStatus === 'pending'" :value="enterprise_name" @input="onInput('enterprise_name', $event)" />
            </view>

            <view class="form-item">
                <text class="form-label">统一社会信用代码 <text class="required">*</text></text>
                <input class="form-input" type="text" placeholder="请输入统一社会信用代码" maxlength="18" :disabled="entStatus === 'pending'" :value="credit_code" @input="onInput('credit_code', $event)" />
            </view>

            <view class="form-item">
                <text class="form-label">联系人姓名 <text class="required">*</text></text>
                <input class="form-input" type="text" placeholder="请输入联系人姓名" :disabled="entStatus === 'pending'" :value="contact_name" @input="onInput('contact_name', $event)" />
            </view>

            <view class="form-item">
                <text class="form-label">联系手机号 <text class="required">*</text></text>
                <input class="form-input" type="number" maxlength="11" placeholder="请输入联系手机号" :disabled="entStatus === 'pending'" :value="contact_mobile" @input="onInput('contact_mobile', $event)" />
            </view>

            <view class="form-item">
                <text class="form-label">企业所在地 <text class="required">*</text></text>
                <picker mode="region" :value="regionValue" :disabled="entStatus === 'pending'" @change="onRegionChange">
                    <view class="picker-display">{{ regionDisplayText || '请选择省 / 市 / 区' }}</view>
                </picker>
            </view>

            <view class="form-item">
                <text class="form-label">详细地址</text>
                <input class="form-input" type="text" placeholder="选填" :disabled="entStatus === 'pending'" :value="address" @input="onInput('address', $event)" />
            </view>

        </view>

        <!-- 底部按钮 -->
        <view class="footer-btns" v-if="entStatus !== 'approved'">
            <!-- 企业认证协议（仅未提交/驳回可提交时展示） -->
            <view v-if="entStatus === 'none' || entStatus === 'rejected'" class="agreement-section">
                <view class="agreement-wrapper">
                    <checkbox-group class="agreement-checkbox-group" @change="onAgreementChange">
                        <checkbox class="agreement-checkbox" value="agree" :checked="agreed" color="#16a34a" />
                    </checkbox-group>
                    <view class="agreement-text">
                        <text>我已阅读并同意</text>
                        <text class="link-text" @tap="viewAgreement">《企业认证服务协议》</text>
                    </view>
                </view>
            </view>
            <button
                v-if="entStatus === 'none' || entStatus === 'rejected'"
                class="submit-btn active"
                :disabled="submitting"
                @tap="submitForm"
            >
                {{ submitting ? '提交中...' : '提交认证申请' }}
            </button>
            <button v-else-if="entStatus === 'pending'" class="submit-btn disabled" disabled>审核中</button>
        </view>
        <view class="footer-btns" v-else>
            <button class="submit-btn disabled" disabled>已通过认证</button>
        </view>
    </view>
</template>

<script>
import { getEnterpriseAuthDetail, submitEnterpriseAuth, uploadImage, getUserInfo, recognizeAuthOcr } from '../../utils/api.js';

const app = getApp();

function getStoredToken() {
    return (
        uni.getStorageSync('token') ||
        uni.getStorageSync('uni_id_token') ||
        uni.getStorageSync('uniIdToken') ||
        ''
    );
}

export default {
    data() {
        return {
            entStatus: 'none',
            enterprise_name: '',
            credit_code: '',
            legal_person: '',
            company_type: '',
            contact_name: '',
            contact_mobile: '',
            province: '',
            city: '',
            district: '',
            regionValue: [],
            address: '',
            establish_date: '',
            valid_period: '',
            business_scope: '',
            license_number: '',
            business_license_url: '',
            remark: '',
            reject_reason: '',
            submitting: false,
            agreed: false,
            regionDisplayText: '',
            ocrSnapshot: null
        };
    },
    onShow() {
        this.ensureEnterpriseMember().then((ok) => {
            if (ok) {
                this.loadDetail();
            }
        });
    },
    methods: {
        onAgreementChange(e) {
            const checked = e.detail.value.length > 0;
            this.setData({ agreed: checked });
        },
        viewAgreement() {
            uni.navigateTo({ url: '/pages/enterprise-agreement/enterprise-agreement' });
        },
        ensureEnterpriseMember() {
            const token = getStoredToken();
            if (!token) {
                return Promise.resolve(true);
            }
            const localUser = uni.getStorageSync('userInfo') || {};
            const uid = localUser.user_id || localUser._id || localUser.id || '';
            const applyCheck = (user) => {
                const u = user || localUser || {};
                const ok = u.member_type === 'enterprise' && u.is_member_active === true;
                if (!ok) {
                    uni.showToast({ title: '请开通企业会员', icon: 'none' });
                    setTimeout(() => {
                        uni.navigateBack({
                            fail: () => {
                                uni.switchTab({ url: '/pages/profile/profile' });
                            }
                        });
                    }, 1200);
                    return false;
                }
                return true;
            };
            if (!uid) {
                return Promise.resolve(applyCheck(localUser));
            }
            return getUserInfo(uid)
                .then((prof) => {
                    if (prof) {
                        const merged = { ...localUser, ...prof };
                        uni.setStorageSync('userInfo', merged);
                        if (app.globalData) {
                            app.globalData.userInfo = merged;
                        }
                        return applyCheck(merged);
                    }
                    return applyCheck(localUser);
                })
                .catch(() => applyCheck(localUser));
        },
        buildRegionDisplayText(province, city, district) {
            const p = [province, city, district].filter(Boolean);
            return p.length ? p.join(' ') : '';
        },
        parseRegionFromAddress(address) {
            const text = String(address || '').replace(/\s/g, '');
            if (!text) {
                return { province: '', city: '', district: '' };
            }
            let province = '';
            let city = '';
            let district = '';
            const provinceMatch = text.match(/^(.*?(?:省|自治区|特别行政区|北京市|天津市|上海市|重庆市))/);
            if (provinceMatch) {
                province = provinceMatch[1];
            }
            const restAfterProvince = province ? text.slice(province.length) : text;
            const cityMatch = restAfterProvince.match(/^(.*?(?:市|州|地区|盟))/);
            if (cityMatch) {
                city = cityMatch[1];
            }
            const restAfterCity = city ? restAfterProvince.slice(city.length) : restAfterProvince;
            const districtMatch = restAfterCity.match(/^(.*?(?:区|县|旗|市))/);
            if (districtMatch) {
                district = districtMatch[1];
            }
            return { province, city, district };
        },
        loadDetail() {
            const token = getStoredToken();
            if (!token) {
                uni.setStorageSync('redirectUrl', '/pages/enterprise-auth/enterprise-auth');
                uni.showToast({ title: '请先登录', icon: 'none' });
                setTimeout(() => {
                    uni.redirectTo({ url: '/pages/login/login' });
                }, 1200);
                return;
            }
            getEnterpriseAuthDetail()
                .then((res) => {
                    const data = res && (res.data !== undefined && res.data !== null ? res.data : res);
                    if (!data) {
                        this.setData({
                            entStatus: 'none',
                            regionDisplayText: ''
                        });
                        return;
                    }
                    const st = data.status === 'none' ? 'none' : data.status;
                    let cm = data.contact_mobile_full || '';
                    if (!cm && data.contact_mobile && String(data.contact_mobile).indexOf('*') === -1) {
                        cm = data.contact_mobile;
                    }
                    const province = data.province || '';
                    const city = data.city || '';
                    const district = data.district || '';
                    const regionValue =
                        province && city && district ? [province, city, district] : [];
                    this.setData({
                        entStatus: st,
                        enterprise_name: data.enterprise_name || '',
                        credit_code: data.credit_code || '',
                        legal_person: data.legal_person || '',
                        company_type: data.company_type || '',
                        contact_name: data.contact_name || '',
                        contact_mobile: cm,
                        province,
                        city,
                        district,
                        regionValue,
                        regionDisplayText: this.buildRegionDisplayText(province, city, district),
                        address: data.address || '',
                        establish_date: data.establish_date || '',
                        valid_period: data.valid_period || '',
                        business_scope: data.business_scope || '',
                        license_number: data.license_number || '',
                        business_license_url: data.business_license_url || '',
                        remark: data.remark || '',
                        reject_reason: data.reject_reason || ''
                    });
                })
                .catch((err) => {
                    console.error('getEnterpriseAuthDetail', err);
                });
        },
        onInput(field, e) {
            let v = e.detail.value;
            if (field === 'credit_code') {
                v = String(v).replace(/\s/g, '').toUpperCase().slice(0, 18);
            }
            if (field === 'contact_mobile') {
                v = String(v).replace(/\D/g, '').slice(0, 11);
            }
            const patch = {};
            patch[field] = v;
            this.setData(patch);
        },
        onRegionChange(e) {
            const val = e.detail.value || [];
            const province = val[0] || '';
            const city = val[1] || '';
            const district = val[2] || '';
            this.setData({
                regionValue: val,
                province,
                city,
                district,
                regionDisplayText: this.buildRegionDisplayText(province, city, district)
            });
        },
        uploadLicense() {
            if (this.entStatus === 'pending') return;
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const path = res.tempFilePaths[0];
                    uni.showLoading({ title: '上传中...', mask: true });
                    uploadImage(path)
                        .then((r) => {
                            uni.hideLoading();
                            const inner = r.data && r.data.url ? r.data.url : '';
                            const url = r.url || inner || r;
                            this.setData({ business_license_url: url });
                            this.handleLicenseOcr(url);
                        })
                        .catch(() => {
                            uni.hideLoading();
                            uni.showToast({ title: '上传失败', icon: 'none' });
                        });
                }
            });
        },
        deleteLicense() {
            this.setData({ business_license_url: '', ocrSnapshot: null });
        },
        async handleLicenseOcr(fileId) {
            uni.showLoading({ title: '识别中...', mask: true });
            try {
                const result = await recognizeAuthOcr({
                    scene: 'enterprise',
                    docType: 'business_license',
                    fileId
                });
                uni.hideLoading();
                const parsed = (result && result.parsed) || {};
                const addressText = parsed.address || this.address;
                const region = this.parseRegionFromAddress(addressText);
                this.setData({
                    enterprise_name: parsed.companyName || this.enterprise_name,
                    credit_code: parsed.creditCode || this.credit_code,
                    legal_person: parsed.legalPerson || this.legal_person,
                    company_type: parsed.companyType || this.company_type,
                    province: region.province || this.province,
                    city: region.city || this.city,
                    district: region.district || this.district,
                    regionValue:
                        region.province && region.city && region.district
                            ? [region.province, region.city, region.district]
                            : this.regionValue,
                    regionDisplayText:
                        region.province && region.city && region.district
                            ? this.buildRegionDisplayText(region.province, region.city, region.district)
                            : this.regionDisplayText,
                    address: addressText,
                    establish_date: parsed.establishDate || this.establish_date,
                    valid_period: parsed.validPeriod || this.valid_period,
                    business_scope: parsed.businessScope || this.business_scope,
                    license_number: parsed.licenseNumber || this.license_number,
                    ocrSnapshot: result
                });
                uni.showToast({ title: '已自动填充，请核对后提交', icon: 'none', duration: 2200 });
                const quality = result && result.quality;
                if (quality && Array.isArray(quality.messages) && quality.messages.length) {
                    setTimeout(() => {
                        uni.showToast({ title: quality.messages[0], icon: 'none', duration: 2500 });
                    }, 300);
                }
            } catch (err) {
                uni.hideLoading();
                uni.showToast({ title: err.message || '营业执照识别失败，请重新上传', icon: 'none', duration: 2500 });
            }
        },
        previewImage(e) {
            const url = e.currentTarget.dataset.url;
            if (url) uni.previewImage({ urls: [url], current: url });
        },
        validateForm() {
            if (!this.enterprise_name || !String(this.enterprise_name).trim()) {
                uni.showToast({ title: '请输入企业名称', icon: 'none' });
                return false;
            }
            if (!this.credit_code || !String(this.credit_code).trim()) {
                uni.showToast({ title: '请输入统一社会信用代码', icon: 'none' });
                return false;
            }
            if (!this.contact_name || !String(this.contact_name).trim()) {
                uni.showToast({ title: '请输入联系人姓名', icon: 'none' });
                return false;
            }
            if (!/^1\d{10}$/.test(String(this.contact_mobile).trim())) {
                uni.showToast({ title: '请输入正确的联系手机号', icon: 'none' });
                return false;
            }
            if (!this.province || !this.city || !this.district) {
                uni.showToast({ title: '请选择企业所在地', icon: 'none' });
                return false;
            }
            if (!this.business_license_url) {
                uni.showToast({ title: '请上传营业执照照片', icon: 'none' });
                return false;
            }
            return true;
        },
        submitForm() {
            if (this.submitting || this.entStatus === 'pending') return;
            if (!(this.agreed === true)) {
                uni.showToast({ title: '请先阅读并同意企业认证服务协议', icon: 'none' });
                return;
            }
            if (!this.validateForm()) return;
            this.setData({ submitting: true });
            uni.showLoading({ title: '提交中...', mask: true });
            submitEnterpriseAuth({
                enterprise_name: this.enterprise_name.trim(),
                credit_code: this.credit_code.trim(),
                contact_name: this.contact_name.trim(),
                contact_mobile: String(this.contact_mobile).trim(),
                province: this.province,
                city: this.city,
                district: this.district,
                address: this.address || '',
                business_license_url: this.business_license_url,
                remark: this.remark || '',
                legal_person: this.legal_person || '',
                company_type: this.company_type || '',
                establish_date: this.establish_date || '',
                valid_period: this.valid_period || '',
                business_scope: this.business_scope || '',
                license_number: this.license_number || '',
                ocr_provider: 'baidu',
                ocr_doc_type: 'business_license',
                ocr_snapshot: this.ocrSnapshot
            })
                .then(() => {
                    uni.hideLoading();
                    this.setData({
                        submitting: false,
                        entStatus: 'pending'
                    });
                    const u = uni.getStorageSync('userInfo') || {};
                    u.enterprise_auth_status = 'pending';
                    u.is_enterprise_verified = false;
                    u.isEnterpriseVerified = false;
                    uni.setStorageSync('userInfo', u);
                    if (app.globalData && app.globalData.userInfo) {
                        app.globalData.userInfo = u;
                    }
                    const uid = u.user_id || u._id;
                    if (uid) {
                        getUserInfo(uid)
                            .then((prof) => {
                                if (prof) {
                                    const merged = { ...u, ...prof };
                                    uni.setStorageSync('userInfo', merged);
                                }
                            })
                            .catch(() => {});
                    }
                    uni.showToast({ title: '提交成功', icon: 'success' });
                    setTimeout(() => this.loadDetail(), 500);
                })
                .catch((err) => {
                    uni.hideLoading();
                    this.setData({ submitting: false });
                    uni.showToast({ title: err.message || '提交失败', icon: 'none' });
                });
        }
    }
};
</script>

<style src="./enterprise-auth.css"></style>
