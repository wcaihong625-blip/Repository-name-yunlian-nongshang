<template>
    <!-- pages/real-name-auth/real-name-auth.wxml -->
    <view class="auth-page">
        <!-- 已认证状态 -->
        <view v-if="authStatus === 'verified'" class="status-container verified">
            <view class="status-icon">✓</view>
            <text class="status-title">认证成功</text>
            <text class="status-desc">您已完成实名认证</text>
            <view class="verified-info">
                <view class="info-item">
                    <text class="info-label">真实姓名：</text>
                    <text class="info-value">{{ verifiedName || realName }}</text>
                </view>
                <view class="info-item">
                    <text class="info-label">身份证号：</text>
                    <text class="info-value">{{ idCard }}</text>
                </view>
            </view>
        </view>

        <!-- 审核中状态 -->
        <view v-else-if="authStatus === 'pending'" class="status-container pending">
            <view class="status-icon">⏳</view>
            <text class="status-title">审核中</text>
            <text class="status-desc">您的认证信息正在审核中，请耐心等待</text>
            <text class="status-tip">我们将在1-3个工作日内完成审核</text>
        </view>

        <!-- 认证失败状态 -->
        <view v-else-if="authStatus === 'rejected'" class="status-container rejected">
            <view class="status-icon">✗</view>
            <text class="status-title">认证失败</text>
            <view v-if="rejectReason" class="reject-reason">
                <text class="reason-label">驳回原因：</text>
                <text class="reason-text">{{ rejectReason }}</text>
            </view>
            <button class="resubmit-btn" @tap="resubmit">重新提交</button>
        </view>

        <!-- 未认证/认证失败后重新提交表单 -->
        <view v-else class="form-container">
            <view class="form-header">
                <text class="form-title">实名认证</text>
                <text class="form-subtitle">请填写真实信息，确保照片清晰完整</text>
            </view>

            <!-- 身份证正面 -->
            <view class="form-item">
                <text class="form-label">
                    身份证正面
                    <text class="required">*</text>
                </text>
                <text class="form-tip">请上传身份证人像面，确保照片清晰、四角齐全、无遮挡</text>
                <view class="upload-area">
                    <view v-if="!idCardFront" class="upload-btn" @tap="uploadIdCardFront">
                        <text class="upload-icon">📷</text>
                        <text class="upload-text">点击上传</text>
                    </view>
                    <view v-else class="upload-preview">
                        <image class="preview-image" :src="idCardFront" mode="aspectFit" :data-url="idCardFront" @tap="previewImage" />
                        <view class="delete-btn" @tap="deleteIdCardFront">×</view>
                    </view>
                </view>
            </view>

            <!-- 真实姓名 -->
            <view class="form-item">
                <text class="form-label">
                    真实姓名
                    <text class="required">*</text>
                </text>
                <input class="form-input" type="text" placeholder="上传身份证后可自动识别，也可手动输入" :value="realName" @input="onRealNameInput" maxlength="20" />
            </view>

            <!-- 身份证号码 -->
            <view class="form-item">
                <text class="form-label">
                    身份证号码
                    <text class="required">*</text>
                </text>
                <input class="form-input" type="text" placeholder="上传身份证后可自动识别，也可手动输入" :value="idCard" @input="onIdCardInput" maxlength="18" />
            </view>

            <!-- 用户协议 -->
            <view class="agreement-section">
                <view class="agreement-wrapper">
                    <checkbox-group class="agreement-checkbox-group" @change="onAgreementChange">
                        <checkbox class="agreement-checkbox" value="agree" :checked="agreed" color="#16a34a" />
                    </checkbox-group>
                    <view class="agreement-text">
                        <text>我已阅读并同意</text>
                        <text class="link-text" @tap="viewAgreement">《实名认证服务协议》</text>
                    </view>
                </view>
            </view>

            <!-- 提交按钮 -->
            <button
                :class="'submit-btn ' + (agreed && realName && idCard && idCardFront ? 'active' : '')"
                @tap="submitAuth"
                :disabled="submitting || !agreed || !realName || !idCard || !idCardFront"
            >
                {{ submitting ? '提交中...' : '提交认证' }}
            </button>

            <!-- 提示信息 -->
            <view class="tips-section">
                <text class="tips-title">温馨提示：</text>
                <text class="tips-item">1. 请确保身份证信息真实有效</text>
                <text class="tips-item">2. 照片需清晰可见，四角完整，无遮挡</text>
                <text class="tips-item">3. 审核时间通常为1-3个工作日</text>
                <text class="tips-item">4. 认证通过后，您的信息将受到保护</text>
            </view>
        </view>
    </view>
</template>

<script>
// pages/real-name-auth/real-name-auth.js
import { getAuthStatus, submitAuthInfo, uploadImage, recognizeAuthOcr } from '../../utils/api.js';
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
            // 认证状态：unverified（未认证）、pending（审核中）、verified（已认证）、rejected（认证失败）
            authStatus: 'unverified',

            // 认证信息
            realName: '',

            idCard: '',
            gender: '',
            nation: '',
            birthday: '',
            address: '',
            issueAuthority: '',
            validDate: '',
            validFrom: '',
            validTo: '',

            // 身份证照片
            idCardFront: '',

            // 正面
            idCardBack: '',

            // 反面
            // 协议勾选
            agreed: false,

            // 驳回原因（认证失败时显示）
            rejectReason: '',

            // 已认证的姓名（脱敏显示）
            verifiedName: '',

            // 加载状态
            submitting: false,
            ocrSnapshot: {
                idcard_front: null,
                idcard_back: null
            },

            type: ''
        };
    },
    onLoad(options) {
        // 从options中获取状态（如果是从"我的"页面跳转过来的）
        if (options.status) {
            this.setData({
                authStatus: options.status
            });
        }
        this.loadAuthStatus();
    },
    methods: {
        // 加载认证状态
        loadAuthStatus() {
            // 检查是否已登录（有 token）
            const token = getStoredToken();
            if (!token) {
                console.log('用户未登录，跳转到登录页面');
                uni.setStorageSync('redirectUrl', '/pages/real-name-auth/real-name-auth');
                uni.showToast({
                    title: '请先登录',
                    icon: 'none'
                });
                setTimeout(() => {
                    uni.redirectTo({
                        url: '/pages/login/login'
                    });
                }, 1500);
                return;
            }
            
            getAuthStatus()
                .then((res) => {
                    if (res && res.success !== false) {
                        const data = res.data || res;
                        this.setData({
                            authStatus: data.status || 'unverified',
                            realName: data.realName || '',
                            idCard: data.idCard ? this.maskIdCard(data.idCard) : '',
                            idCardFront: data.idCardFront || '',
                            idCardBack: data.idCardBack || '',
                            gender: data.gender || '',
                            nation: data.nation || '',
                            birthday: data.birthday || '',
                            address: data.address || '',
                            issueAuthority: data.issueAuthority || '',
                            validDate: data.validDate || '',
                            validFrom: data.validFrom || '',
                            validTo: data.validTo || '',
                            rejectReason: data.rejectReason || '',
                            verifiedName: data.verifiedName || data.realName || ''
                        });
                        
                        // 同步到本地存储
                        uni.setStorageSync('authInfo', data);
                    } else {
                        // 从本地存储加载
                        const authInfo = uni.getStorageSync('authInfo');
                        if (authInfo) {
                            this.setData({
                                authStatus: authInfo.status || 'unverified',
                                realName: authInfo.realName || '',
                                idCard: authInfo.idCard ? this.maskIdCard(authInfo.idCard) : '',
                                rejectReason: authInfo.rejectReason || '',
                                verifiedName: authInfo.verifiedName || authInfo.realName || ''
                            });
                        }
                    }
                })
                .catch((err) => {
                    console.error('加载认证状态失败', err);
                    // 从本地存储加载
                    const authInfo = uni.getStorageSync('authInfo');
                    if (authInfo) {
                        this.setData({
                            authStatus: authInfo.status || 'unverified',
                            realName: authInfo.realName || '',
                            idCard: authInfo.idCard ? this.maskIdCard(authInfo.idCard) : '',
                            rejectReason: authInfo.rejectReason || '',
                            verifiedName: authInfo.verifiedName || authInfo.realName || ''
                        });
                    }
                });
        },

        // 身份证号脱敏
        maskIdCard(idCard) {
            if (!idCard || idCard.length < 8) {
                return idCard;
            }
            return idCard.substring(0, 4) + '********' + idCard.substring(idCard.length - 4);
        },

        // 输入真实姓名
        onRealNameInput(e) {
            this.setData({
                realName: e.detail.value.trim()
            });
        },

        // 输入身份证号
        onIdCardInput(e) {
            let value = e.detail.value.replace(/\s/g, ''); // 移除空格
            // 只允许数字和X
            value = value.replace(/[^0-9Xx]/g, '');
            // 限制长度
            if (value.length > 18) {
                value = value.substring(0, 18);
            }
            this.setData({
                idCard: value
            });
        },

        onFieldInput(field, e) {
            const patch = {};
            patch[field] = (e.detail.value || '').trim();
            this.setData(patch);
        },

        // 上传身份证正面
        uploadIdCardFront() {
            this.chooseImage('idCardFront');
        },

        // 上传身份证反面
        uploadIdCardBack() {
            this.chooseImage('idCardBack');
        },

        // 选择图片
        chooseImage(type) {
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['camera', 'album'],
                success: (res) => {
                    const tempFilePath = res.tempFilePaths[0];
                    this.uploadImageFile(tempFilePath, type);
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

        // 上传图片文件
        uploadImageFile(filePath, type) {
            uni.showLoading({
                title: '上传中...',
                mask: true
            });
            uploadImage(filePath)
                .then((res) => {
                    uni.hideLoading();
                    const imageUrl = res.url || res.data?.url || res;
                    this.setData({
                        [type]: imageUrl
                    });
                    this.handleOcrAfterUpload(type, imageUrl);
                })
                .catch((err) => {
                    uni.hideLoading();
                    console.error('上传失败', err);
                    uni.showToast({
                        title: '上传失败，请重试',
                        icon: 'none'
                    });
                });
        },

        // 删除身份证正面
        deleteIdCardFront() {
            this.setData({
                idCardFront: '',
                ocrSnapshot: {
                    ...this.ocrSnapshot,
                    idcard_front: null
                }
            });
        },

        // 删除身份证反面
        deleteIdCardBack() {
            this.setData({
                idCardBack: '',
                ocrSnapshot: {
                    ...this.ocrSnapshot,
                    idcard_back: null
                }
            });
        },

        async handleOcrAfterUpload(type, fileId) {
            const docType = type === 'idCardBack' ? 'idcard_back' : 'idcard_front';
            const sideLabel = type === 'idCardBack' ? '身份证反面' : '身份证正面';
            uni.showLoading({
                title: '识别中...',
                mask: true
            });
            try {
                const result = await recognizeAuthOcr({
                    scene: 'realname',
                    docType,
                    fileId
                });
                uni.hideLoading();
                const parsed = (result && result.parsed) || {};
                const quality = result && result.quality;
                const patch = {
                    ocrSnapshot: {
                        ...this.ocrSnapshot,
                        [docType]: result
                    }
                };
                if (docType === 'idcard_front') {
                    patch.realName = parsed.name || this.realName;
                    patch.idCard = parsed.idCardNumber || this.idCard;
                    patch.gender = parsed.gender || this.gender;
                    patch.nation = parsed.nation || this.nation;
                    patch.birthday = parsed.birthday || this.birthday;
                    patch.address = parsed.address || this.address;
                } else {
                    patch.issueAuthority = parsed.issueAuthority || this.issueAuthority;
                    patch.validDate = parsed.validDate || this.validDate;
                    patch.validFrom = parsed.validFrom || this.validFrom;
                    patch.validTo = parsed.validTo || this.validTo;
                }
                this.setData(patch);
                uni.showToast({
                    title: '已自动填充，请核对后提交',
                    icon: 'none',
                    duration: 2200
                });
                if (quality && Array.isArray(quality.messages) && quality.messages.length) {
                    setTimeout(() => {
                        uni.showToast({
                            title: quality.messages[0],
                            icon: 'none',
                            duration: 2500
                        });
                    }, 300);
                }
            } catch (err) {
                uni.hideLoading();
                uni.showToast({
                    title: err.message || `${sideLabel}识别失败，请重新上传`,
                    icon: 'none',
                    duration: 2500
                });
            }
        },

        // 预览图片
        previewImage(e) {
            const url = e.currentTarget.dataset.url;
            if (!url) {
                return;
            }
            uni.previewImage({
                current: url,
                urls: [url]
            });
        },

        // 协议勾选变化
        onAgreementChange(e) {
            const checked = e.detail.value.length > 0;
            this.setData({
                agreed: checked
            });
        },

        // 查看协议
        viewAgreement() {
            uni.navigateTo({
                url: '/pages/realname-agreement/realname-agreement'
            });
        },

        // 验证表单
        validateForm() {
            const { realName, idCard, idCardFront, idCardBack, agreed } = this;
            if (!realName || realName.trim().length < 2) {
                uni.showToast({
                    title: '请输入真实姓名',
                    icon: 'none'
                });
                return false;
            }
            if (!idCard || idCard.length !== 18) {
                uni.showToast({
                    title: '请输入18位身份证号码',
                    icon: 'none'
                });
                return false;
            }

            // 简单的身份证号验证
            const idCardRegex = /^[1-9]\d{5}(18|19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]$/;
            if (!idCardRegex.test(idCard)) {
                uni.showToast({
                    title: '身份证号码格式不正确',
                    icon: 'none'
                });
                return false;
            }
            if (!idCardFront) {
                uni.showToast({
                    title: '请上传身份证正面照片',
                    icon: 'none'
                });
                return false;
            }
            if (!agreed) {
                uni.showToast({
                    title: '请先阅读并同意实名认证服务协议',
                    icon: 'none'
                });
                return false;
            }
            return true;
        },

        // 提交认证
        submitAuth() {
            if (this.submitting) {
                return;
            }
            if (!this.validateForm()) {
                return;
            }
            uni.showModal({
                title: '确认提交',
                content: '提交后将进入审核流程，审核期间无法修改信息，确认提交吗？',
                success: (res) => {
                    if (res.confirm) {
                        this.doSubmit();
                    }
                }
            });
        },

        // 执行提交
        doSubmit() {
            this.setData({
                submitting: true
            });
            uni.showLoading({
                title: '提交中...',
                mask: true
            });
            const { realName, idCard, idCardFront, idCardBack } = this;
            submitAuthInfo({
                realName: realName.trim(),
                idCard: idCard.toUpperCase(),
                idCardFront,
                idCardBack: '',
                gender: this.gender,
                nation: this.nation,
                birthday: this.birthday,
                address: this.address,
                issueAuthority: this.issueAuthority,
                validDate: this.validDate,
                validFrom: this.validFrom,
                validTo: this.validTo,
                ocr_provider: 'baidu',
                ocr_doc_type: 'idcard',
                ocr_snapshot: this.ocrSnapshot
            })
                .then((res) => {
                    uni.hideLoading();
                    this.setData({
                        submitting: false
                    });

                    // 保存到本地存储
                    const authInfo = {
                        status: 'pending',
                        realName: realName.trim(),
                        idCard: idCard.toUpperCase(),
                        idCardFront,
                        idCardBack,
                        submitTime: Date.now()
                    };
                    uni.setStorageSync('authInfo', authInfo);

                    // 更新全局状态
                    if (app.globalData) {
                        app.globalData.authStatus = 'pending';
                    }
                    uni.showModal({
                        title: '提交成功',
                        content: '您的认证信息已提交，我们将在1-3个工作日内完成审核，请耐心等待。',
                        showCancel: false,
                        success: () => {
                            // 返回上一页并刷新
                            const pages = getCurrentPages();
                            if (pages.length > 1) {
                                const prevPage = pages[pages.length - 2];
                                if (prevPage && typeof prevPage.loadAuthStatus === 'function') {
                                    prevPage.loadAuthStatus();
                                }
                            }
                            uni.navigateBack();
                        }
                    });
                })
                .catch((err) => {
                    uni.hideLoading();
                    this.setData({
                        submitting: false
                    });
                    console.error('提交失败', err);
                    uni.showToast({
                        title: err.message || '提交失败，请重试',
                        icon: 'none',
                        duration: 2000
                    });
                });
        },

        // 重新提交（认证失败后）
        resubmit() {
            this.setData({
                authStatus: 'unverified',
                rejectReason: ''
            });
        }
    }
};
</script>
<style>
@import './real-name-auth.css';
</style>
