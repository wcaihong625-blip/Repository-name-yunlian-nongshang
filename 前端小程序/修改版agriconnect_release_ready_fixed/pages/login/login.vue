<template>
    <view class="login-container">
        <!-- 背景装饰 -->
        <view class="bg-decoration bg-1"></view>

        <!-- 内容容器 -->
        <view class="content-wrapper">
            <!-- Logo和标题 -->
            <view class="logo-section">
                <view class="logo-box">
                    <image class="logo-icon" src="/static/images/logo.png" mode="aspectFit"></image>
                </view>
                <text class="app-title">云 链 农 商</text>
                <text class="app-subtitle">数字智慧农业，产销一键直达</text>
            </view>

            <!-- 登录表单 -->
            <view class="form-section">
                <!-- 错误提示 -->
                <view class="error-message" v-if="error">
                    <text>{{ error }}</text>
                </view>

                <!-- 微信一键登录按钮 (原本是 getPhoneNumber，现在我们改为普通按钮，点击后弹窗) -->
                <button 
                    class="wx-login-button" 
                    @tap="openAuthModal"
                    :disabled="loading" 
                    :loading="loading"
                >
                    <text class="wx-icon">🔰</text>
                    <text>{{ loading ? '登录中...' : '微信一键登录' }}</text>
                </button>
            </view>

            <!-- 用户协议 -->
            <view class="agreement-section">
                <view class="agreement-wrapper">
                    <checkbox-group class="agreement-checkbox-group" @change="onAgreementChange">
                        <checkbox class="agreement-checkbox" value="agree" :checked="agreementChecked" color="#16a34a" />
                    </checkbox-group>
                    <view class="agreement-text">
                        <text>我已阅读并同意</text>
                        <text class="link-text" @tap="goToAgreement">《用户协议》</text>
                        <text>和</text>
                        <text class="link-text" @tap="goToPrivacy">《隐私政策》</text>
                    </view>
                </view>
            </view>
        </view>

        <!-- 授权弹层 Modal -->
        <view class="auth-modal" v-if="showAuthModal">
            <view class="auth-modal-mask" @tap="closeAuthModal"></view>
            <view class="auth-modal-content">
                <view class="auth-modal-header">
                    <!-- 复用登录页的 logo --->
                    <image class="modal-logo" src="/static/images/logo.png" mode="aspectFit"></image>
                    <text class="modal-title">请完善微信资料后登录</text>
                </view>
                
                <view class="auth-modal-body">
                    <view class="avatar-section">
                        <button class="avatar-btn" open-type="chooseAvatar" @tap="lockChooseAvatar" @chooseavatar="onChooseAvatar" :disabled="isUploadingAvatar || isChoosingAvatar">
                            <image class="avatar-image" :src="avatarUrl || '/static/images/logo.png'" mode="aspectFill"></image>
                            <view class="avatar-edit-icon">照</view>
                        </button>
                        <text class="avatar-tips">{{ isUploadingAvatar ? '上传头像中...' : (isChoosingAvatar ? '正在选择头像...' : '点击上方设置微信头像') }}</text>
                    </view>

                    <view class="nickname-section">
                        <text class="input-label">昵称</text>
                        <input 
                            type="nickname" 
                            class="nickname-input" 
                            placeholder="请输入微信昵称" 
                            maxlength="16" 
                            :value="nickName"
                            @blur="onNicknameBlur"
                            @input="onNicknameInput"
                        />
                    </view>
                </view>
                
                <view class="auth-modal-footer">
                    <button class="cancel-btn" @tap="closeAuthModal">取消</button>
                    <!-- 拦截没填完情况，条件满足才是真实的手机号授权按钮 -->
                    <button 
                        v-if="avatarUrl && nickName"
                        class="confirm-btn" 
                        open-type="getPhoneNumber" 
                        @getphonenumber="onGetPhoneNumber"
                        :disabled="loading || isUploadingAvatar"
                    >授权手机并登录</button>
                    <button 
                        v-else
                        class="confirm-btn" 
                        @tap="checkAuthBeforeLogin"
                        :disabled="loading || isUploadingAvatar"
                    >授权手机并登录</button>
                </view>
            </view>
        </view>
    </view>
</template>

<script>
const app = getApp();
import { showError, showLoading, hideLoading, showSuccess } from '../../utils/util.js';
import { uploadImage } from '../../utils/api.js';

function getStoredToken() {
    return (
        uni.getStorageSync('token') ||
        uni.getStorageSync('uni_id_token') ||
        uni.getStorageSync('uniIdToken') ||
        ''
    );
}

function getFriendlyLoginErrorMessage(message) {
    const rawMessage = String(message || '');

    if (
        rawMessage.includes('[nxt-auth] 微信小程序配置缺失') ||
        rawMessage.includes('common/uni-config-center/wechat-login/config.json') ||
        rawMessage.includes('登录配置缺失') ||
        rawMessage.includes('登录配置异常')
    ) {
        return '登录配置异常，请联系管理员';
    }

    return rawMessage;
}

export default {
    data() {
        return {
            error: '',
            loading: false,
            agreementChecked: false,
            
            // 弹层相关
            showAuthModal: false,
            avatarUrl: '', 
            nickName: '',
            isUploadingAvatar: false,
            isChoosingAvatar: false
        };
    },
    onLoad(options) {
        if (app.globalData.isLoggedIn || getStoredToken()) {
            uni.switchTab({
                url: '/pages/procurement/procurement'
            });
            return;
        }

        const pages = getCurrentPages();
        if (pages.length > 1) {
            const prevPage = pages[pages.length - 2];
            if (prevPage && prevPage.route !== 'pages/login/login') {
                this.redirectUrl = '/' + prevPage.route;
            }
        }
    },
    methods: {
        onAgreementChange(e) {
            const checked = e.detail.value.length > 0;
            this.agreementChecked = checked;
        },

        goToAgreement() {
            uni.navigateTo({ url: '/pages/agreement/agreement' });
        },

        goToPrivacy() {
            uni.navigateTo({ url: '/pages/privacy/privacy' });
        },

        // 拦截并打开弹窗
        openAuthModal() {
            if (!this.agreementChecked) {
                uni.showToast({
                    title: '请先阅读并勾选协议',
                    icon: 'none'
                });
                return;
            }
            this.showAuthModal = true;
        },

        closeAuthModal() {
            this.showAuthModal = false;
            this.isChoosingAvatar = false;
        },

        lockChooseAvatar() {
            if (this.isChoosingAvatar || this.isUploadingAvatar) {
                uni.showToast({
                    title: '正在处理头像，请稍候',
                    icon: 'none'
                });
                return;
            }
            this.isChoosingAvatar = true;

            // 兜底释放，避免极端情况下状态卡住
            setTimeout(() => {
                if (!this.isUploadingAvatar) {
                    this.isChoosingAvatar = false;
                }
            }, 8000);
        },

        // 获取微信头像处理
        async onChooseAvatar(e) {
            const tempFilePath = e.detail.avatarUrl;
            if (!tempFilePath) {
                this.isChoosingAvatar = false;
                return;
            }
            
            this.isUploadingAvatar = true;
            this.isChoosingAvatar = false;
            this.avatarUrl = tempFilePath; // 预览
            
            try {
                const res = await uploadImage(tempFilePath);
                this.avatarUrl = res.url || res.fileID || res.data?.url || res;
                uni.showToast({ title: '头像设置成功', icon: 'success' });
            } catch (err) {
                console.error('头像上传失败', err);
                showError('头像上传失败，请重试');
                this.avatarUrl = ''; // 恢复为空
            } finally {
                this.isUploadingAvatar = false;
                this.isChoosingAvatar = false;
            }
        },

        // 获取和限制昵称输入
        onNicknameInput(e) {
            this.nickName = e.detail.value.trim();
        },
        onNicknameBlur(e) {
            this.nickName = e.detail.value.trim();
        },

        // 若前置资料未填好，拦截手机号弹窗并提示
        checkAuthBeforeLogin() {
            if (!this.avatarUrl) {
                showError('请先获取或设置微信头像');
                return;
            }
            if (!this.nickName) {
                showError('请先获取或填写微信昵称');
                return;
            }
        },

        // 真正的登录提交流程
        async onGetPhoneNumber(e) {
            if (!this.avatarUrl || !this.nickName) {
                this.checkAuthBeforeLogin();
                return;
            }

            this.loading = true;
            this.error = '';

            try {
                // 1. 获取微信登录 code
                const loginRes = await new Promise((resolve, reject) => {
                    uni.login({
                        provider: 'weixin',
                        success: resolve,
                        fail: reject
                    });
                });

                if (!loginRes.code) {
                    throw new Error('获取微信登录凭证失败');
                }
                
                // 【前端日志】获取当前运行的 AppID 和 loginCode 信息
                const accountInfo = uni.getAccountInfoSync();
                console.log('【前端日志】当前运行的小程序 AppID:', accountInfo.miniProgram.appId);
                console.log('【前端日志】wx.login 凭证:', loginRes.code ? `存在, 长度:${loginRes.code.length}, 前4位:${loginRes.code.substring(0,4)}` : '不存在');

                // 2. 检查手机号授权
                let phoneCode = null;
                let encryptedData = null;
                let iv = null;

                if (e.detail.errMsg === 'getPhoneNumber:ok') {
                    if (e.detail.code) {
                        phoneCode = e.detail.code;
                    } else if (e.detail.encryptedData && e.detail.iv) {
                        encryptedData = e.detail.encryptedData;
                        iv = e.detail.iv;
                    }
                } else {
                    console.log('用户拒绝手机号授权，我们将以无手机号状态登录');
                }

                // 3. 调用 wechatLogin
                console.log('【前端日志】调用 wechatLogin 传参:', {
                    loginCode: loginRes.code ? `${loginRes.code.substring(0,4)}...(长度${loginRes.code.length})` : '',
                    phoneCode: phoneCode ? `${phoneCode.substring(0,4)}...(长度${phoneCode.length})` : '',
                    avatarUrl: this.avatarUrl ? `${this.avatarUrl.substring(0,10)}...` : '',
                    nickName: this.nickName
                });
                const res = await uniCloud.callFunction({
                    name: 'wechatLogin',
                    data: {
                        loginCode: loginRes.code,
                        phoneCode: phoneCode,
                        encryptedData: encryptedData,
                        iv: iv,
                        avatarUrl: this.avatarUrl,
                        nickName: this.nickName
                    }
                });

                if (res.result && res.result.code === 200) {
                    const { token, uid, userInfo } = res.result.data;
                    
                    const localUserInfo = {
                        user_id: uid,
                        nickname: userInfo.nickName || this.nickName || '微信用户',
                        avatar: userInfo.avatarUrl || this.avatarUrl || '',
                        username: userInfo.nickName || this.nickName || '微信用户',
                        mobile: userInfo.phone || '',
                        role: Array.isArray(userInfo.role) ? userInfo.role : []
                    };
                    uni.setStorageSync('token', token);
                    uni.setStorageSync('uni_id_token', token);
                    uni.setStorageSync('uniIdToken', token);
                    uni.removeStorageSync('uni_id_token_expired');
                    uni.setStorageSync('userInfo', localUserInfo);

                    app.globalData.login(localUserInfo, token);

                    this.showAuthModal = false; // 关闭弹层
                    showSuccess('登录成功');
                    
                    setTimeout(() => {
                        const redirectUrl = uni.getStorageSync('redirectUrl') || this.redirectUrl;
                        uni.removeStorageSync('redirectUrl');
                        
                        if (redirectUrl) {
                            const tabBarPages = [
                                '/pages/procurement/procurement',
                                '/pages/supply/supply',
                                '/pages/market-trends/market-trends',
                                '/pages/profile/profile'
                            ];
                            if (tabBarPages.includes(redirectUrl)) {
                                uni.switchTab({ url: redirectUrl });
                            } else {
                                uni.redirectTo({ url: redirectUrl });
                            }
                        } else {
                            uni.switchTab({ url: '/pages/procurement/procurement' });
                        }
                    }, 1000);
                } else {
                    console.error('[微信登录] 后端返回业务错误:', res.result);
                    const errorMsg = getFriendlyLoginErrorMessage(res.result?.message || '登录失败');
                    this.error = errorMsg;
                    showError(errorMsg);
                }
            } catch (err) {
                console.error('[微信登录] 错误:', err);
                let errorMessage = '微信登录失败，请稍后重试';
                const errMsg = err.message || err.errMsg || String(err);
                console.error('[微信登录] 原始错误信息:', errMsg);
                
                if (errMsg.includes('code2Session') || errMsg.includes('code 无效')) {
                    errorMessage = '登录凭证已过期，请重试';
                } else if (errMsg.includes('network') || errMsg.includes('网络')) {
                    errorMessage = '当前网络信号差，请检查连接';
                } else if (errMsg) {
                    errorMessage = getFriendlyLoginErrorMessage(errMsg);
                }
                
                this.error = errorMessage;
                showError(errorMessage);
            } finally {
                this.loading = false;
            }
        }
    }
};
</script>

<style>
@import './login.css';

/* 授权弹层样式 */
.auth-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 999;
}

.auth-modal-mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.6);
}

.auth-modal-content {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: #fff;
    border-radius: 32rpx 32rpx 0 0;
    padding: 40rpx 40rpx 60rpx;
    transform: translateY(0);
    transition: transform 0.3s ease;
}

.auth-modal-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 40rpx;
}

.modal-logo {
    width: 100rpx;
    height: 100rpx;
    border-radius: 20rpx;
    margin-bottom: 20rpx;
}

.modal-title {
    font-size: 34rpx;
    color: #333;
    font-weight: bold;
}

.auth-modal-body {
    margin-bottom: 50rpx;
}

.avatar-section {
    display: flex;
    flex-direction: column;
    align-items: center;
    margin-bottom: 40rpx;
}

.avatar-btn {
    width: 140rpx;
    height: 140rpx;
    padding: 0;
    margin: 0;
    border-radius: 70rpx;
    background-color: #f3f4f6;
    border: none;
    position: relative;
    box-shadow: 0 4rpx 16rpx rgba(0,0,0,0.06);
    overflow: hidden;
}

.avatar-btn::after {
    border: none;
}

.avatar-image {
    width: 140rpx;
    height: 140rpx;
    border-radius: 70rpx;
}

.avatar-edit-icon {
    position: absolute;
    bottom: 0;
    right: 0;
    left: 0;
    height: 40rpx;
    background: rgba(0,0,0,0.5);
    color: #fff;
    font-size: 20rpx;
    display: flex;
    align-items: center;
    justify-content: center;
}

.avatar-tips {
    font-size: 24rpx;
    color: #9ca3af;
    margin-top: 16rpx;
}

.nickname-section {
    display: flex;
    align-items: center;
    background-color: #f9fafb;
    border-radius: 16rpx;
    padding: 24rpx 32rpx;
    border: 1px solid #e5e7eb;
}

.input-label {
    font-size: 30rpx;
    color: #374151;
    margin-right: 32rpx;
    font-weight: bold;
    white-space: nowrap;
}

.nickname-input {
    flex: 1;
    font-size: 30rpx;
    height: 48rpx;
    color: #111827;
}

.auth-modal-footer {
    display: flex;
    gap: 30rpx;
}

.cancel-btn {
    flex: 1;
    height: 88rpx;
    line-height: 88rpx;
    background-color: #f3f4f6;
    color: #4b5563;
    font-size: 32rpx;
    border-radius: 44rpx;
    margin: 0;
}

.cancel-btn::after {
    border: none;
}

.confirm-btn {
    flex: 2;
    height: 88rpx;
    line-height: 88rpx;
    background-color: #16a34a;
    color: #fff;
    font-size: 32rpx;
    border-radius: 44rpx;
    margin: 0;
}

.confirm-btn::after {
    border: none;
}

.confirm-btn[disabled] {
    opacity: 0.6;
}
</style>