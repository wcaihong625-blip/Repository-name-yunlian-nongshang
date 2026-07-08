<template>
    <view class="complete-page">
        <view class="header">
            <text class="title">完善资料</text>
            <text class="subtitle">设置头像和昵称，让更多人认识你</text>
        </view>

        <view class="form-section">
            <!-- 头像选择 -->
            <view class="form-item">
                <text class="label">头像</text>
                <view class="avatar-section">
                    <view class="avatar-wrapper" @tap="chooseAvatar">
                        <image 
                            class="avatar-preview" 
                            :src="avatarUrl || '/static/images/logo.png'" 
                            mode="aspectFill"
                        ></image>
                        <view class="avatar-mask">
                            <text class="avatar-edit-text">选择头像</text>
                        </view>
                    </view>
                </view>
            </view>

            <!-- 昵称输入 -->
            <view class="form-item">
                <text class="label">昵称</text>
                <input 
                    class="nickname-input"
                    type="nickname"
                    placeholder="请输入昵称"
                    :value="nickname"
                    @input="onNicknameInput"
                    maxlength="20"
                />
            </view>

            <!-- 提交按钮 -->
            <button 
                class="submit-button" 
                @tap="handleSubmit" 
                :disabled="loading || !nickname.trim()" 
                :loading="loading"
            >
                {{ loading ? '保存中...' : '保存' }}
            </button>
        </view>
    </view>
</template>

<script>
// pages/profile/complete.vue
const app = getApp();
import { uploadImage, updateUserInfo } from '../../utils/api.js';

export default {
    data() {
        return {
            avatarUrl: '',
            nickname: '',
            loading: false
        };
    },
    onLoad() {
        // 加载当前用户信息
        const userInfo = uni.getStorageSync('userInfo') || app.globalData.userInfo;
        if (userInfo) {
            this.setData({
                avatarUrl: userInfo.avatar || '',
                nickname: userInfo.nickname || userInfo.username || ''
            });
        }
    },
    methods: {
        // 昵称输入
        onNicknameInput(e) {
            this.setData({
                nickname: e.detail.value
            });
        },

        // 选择头像（使用微信小程序原生 chooseAvatar）
        chooseAvatar() {
            // #ifdef MP-WEIXIN
            // 微信小程序使用 button open-type="chooseAvatar"
            // 这里使用 chooseImage 作为备选方案
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFilePath = res.tempFilePaths[0];
                    this.uploadAvatar(tempFilePath);
                },
                fail: (err) => {
                    if (err.errMsg && !err.errMsg.includes('cancel')) {
                        uni.showToast({
                            title: '选择图片失败',
                            icon: 'none'
                        });
                    }
                }
            });
            // #endif

            // #ifndef MP-WEIXIN
            uni.chooseImage({
                count: 1,
                sizeType: ['compressed'],
                sourceType: ['album', 'camera'],
                success: (res) => {
                    const tempFilePath = res.tempFilePaths[0];
                    this.uploadAvatar(tempFilePath);
                },
                fail: (err) => {
                    if (err.errMsg && !err.errMsg.includes('cancel')) {
                        uni.showToast({
                            title: '选择图片失败',
                            icon: 'none'
                        });
                    }
                }
            });
            // #endif
        },

        // 上传头像
        async uploadAvatar(filePath) {
            uni.showLoading({
                title: '上传中...',
                mask: true
            });

            try {
                const res = await uploadImage(filePath);
                const avatarUrl = res.url || res.data?.url || res.fileID || res;
                
                this.setData({
                    avatarUrl: avatarUrl
                });
                
                uni.hideLoading();
            } catch (err) {
                uni.hideLoading();
                uni.showToast({
                    title: err.message || '上传失败',
                    icon: 'none'
                });
            }
        },

        // 提交
        async handleSubmit() {
            const { nickname, avatarUrl } = this;
            
            if (!nickname.trim()) {
                uni.showToast({
                    title: '请输入昵称',
                    icon: 'none'
                });
                return;
            }

            this.setData({
                loading: true
            });

            try {
                // 更新用户信息
                const updateData = {
                    nickname: nickname.trim()
                };
                
                if (avatarUrl) {
                    updateData.avatar = avatarUrl;
                }

                await updateUserInfo(updateData);

                // 更新本地存储
                const userInfo = uni.getStorageSync('userInfo') || {};
                userInfo.nickname = nickname.trim();
                userInfo.username = nickname.trim();
                if (avatarUrl) {
                    userInfo.avatar = avatarUrl;
                }
                uni.setStorageSync('userInfo', userInfo);

                // 更新全局状态
                if (app.globalData && app.globalData.userInfo) {
                    app.globalData.userInfo.nickname = nickname.trim();
                    app.globalData.userInfo.username = nickname.trim();
                    if (avatarUrl) {
                        app.globalData.userInfo.avatar = avatarUrl;
                    }
                }

                uni.showToast({
                    title: '保存成功',
                    icon: 'success'
                });

                // 延迟跳转
                setTimeout(() => {
                    uni.switchTab({
                        url: '/pages/profile/profile'
                    });
                }, 1000);

            } catch (err) {
                console.error('保存失败:', err);
                uni.showToast({
                    title: err.message || '保存失败',
                    icon: 'none'
                });
            } finally {
                this.setData({
                    loading: false
                });
            }
        }
    }
};
</script>
<style>
.complete-page {
    min-height: 100vh;
    background: #f5f5f5;
    padding: 40rpx 32rpx;
}

.header {
    text-align: center;
    margin-bottom: 60rpx;
}

.title {
    display: block;
    font-size: 48rpx;
    font-weight: bold;
    color: #111827;
    margin-bottom: 16rpx;
}

.subtitle {
    display: block;
    font-size: 28rpx;
    color: #6b7280;
}

.form-section {
    background: #ffffff;
    border-radius: 24rpx;
    padding: 48rpx 32rpx;
}

.form-item {
    margin-bottom: 48rpx;
}

.label {
    display: block;
    font-size: 28rpx;
    font-weight: bold;
    color: #4b5563;
    margin-bottom: 24rpx;
}

.avatar-section {
    display: flex;
    justify-content: center;
}

.avatar-wrapper {
    position: relative;
    width: 200rpx;
    height: 200rpx;
    border-radius: 50%;
    overflow: hidden;
    border: 4rpx solid #e5e7eb;
}

.avatar-preview {
    width: 100%;
    height: 100%;
}

.avatar-mask {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
}

.avatar-wrapper:active .avatar-mask {
    opacity: 1;
}

.avatar-edit-text {
    color: #ffffff;
    font-size: 24rpx;
}

.nickname-input {
    width: 100%;
    height: 88rpx;
    padding: 0 24rpx;
    border: 2rpx solid #e5e7eb;
    border-radius: 16rpx;
    font-size: 28rpx;
    background: #f9fafb;
    box-sizing: border-box;
}

.nickname-input:focus {
    background: #ffffff;
    border-color: #16a34a;
}

.submit-button {
    width: 100%;
    height: 88rpx;
    background: #16a34a;
    color: #ffffff;
    font-weight: bold;
    font-size: 32rpx;
    border-radius: 16rpx;
    margin-top: 48rpx;
    border: none;
}

.submit-button:active {
    transform: scale(0.98);
}

.submit-button[disabled] {
    opacity: 0.6;
}
</style>

