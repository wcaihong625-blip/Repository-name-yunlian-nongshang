<template>
    <view class="settings-page">
        <view class="settings-header">
            <text class="settings-title">系统设置</text>
            <text class="settings-subtitle">配置您的账号和应用偏好</text>
        </view>

        <view class="settings-section">
            <view class="settings-item settings-item-role">
                <view class="settings-item-content">
                    <view class="settings-item-info">
                        <text class="settings-item-label">当前账号角色</text>
                        <text class="settings-item-desc">
                            {{ roleText }}（{{ isAdmin ? '管理员' : '普通用户' }}）
                        </text>
                    </view>
                    <text :class="'role-badge ' + (isAdmin ? 'role-badge-admin' : 'role-badge-user')">
                        {{ isAdmin ? 'ADMIN' : 'USER' }}
                    </text>
                </view>
            </view>
            <view class="settings-item">
                <view class="settings-item-content">
                    <view class="settings-item-info">
                        <text class="settings-item-label">消息通知</text>
                        <text class="settings-item-desc">管理系统和交易提醒</text>
                    </view>
                    <switch class="settings-switch" :checked="messageNotificationEnabled" @change="onMessageNotificationChange" color="#16a34a" />
                </view>
            </view>
            <view v-if="isAdmin" class="settings-item settings-item-link" @tap="goRebuildSearchIndex">
                <view class="settings-item-content">
                    <view class="settings-item-info">
                        <text class="settings-item-label">搜索索引维护工具</text>
                        <text class="settings-item-desc">仅管理员可见：Dry Run / 重建采购 / 重建供应</text>
                    </view>
                    <text class="settings-link-arrow">></text>
                </view>
            </view>
        </view>

        <view class="settings-footer">
            <text class="settings-footer-text">更多设置功能即将上线</text>
        </view>
    </view>
</template>

<script>
export default {
    data() {
        return {
            messageNotificationEnabled: true, // 消息通知开关状态
            isAdmin: false,
            roleText: '未设置'
        };
    },
    onLoad() {
        this.loadSettings();
    },
    methods: {
        // 加载设置
        loadSettings() {
            // 从本地存储读取消息通知设置
            const messageNotification = uni.getStorageSync('messageNotificationEnabled');
            if (messageNotification !== '') {
                this.setData({
                    messageNotificationEnabled: messageNotification
                });
            } else {
                // 默认开启
                this.setData({
                    messageNotificationEnabled: true
                });
                uni.setStorageSync('messageNotificationEnabled', true);
            }

            const userInfo = uni.getStorageSync('userInfo') || {};
            const role = userInfo.role;
            const isAdmin = Array.isArray(role)
                ? role.includes('admin')
                : typeof role === 'string'
                ? role.indexOf('admin') >= 0
                : false;
            const roleText = Array.isArray(role)
                ? role.join(', ')
                : typeof role === 'string' && role
                ? role
                : '未设置';
            this.setData({
                isAdmin,
                roleText
            });
        },

        // 消息通知开关变化
        onMessageNotificationChange(e) {
            const enabled = e.detail.value;
            this.setData({
                messageNotificationEnabled: enabled
            });

            // 保存到本地存储
            uni.setStorageSync('messageNotificationEnabled', enabled);

            // 提示用户
            uni.showToast({
                title: enabled ? '已开启消息通知' : '已关闭消息通知',
                icon: 'success',
                duration: 1500
            });
        },
        goRebuildSearchIndex() {
            uni.navigateTo({
                url: '/pages/rebuild-search-index/rebuild-search-index'
            });
        }
    }
};
</script>
<style>
@import './system-settings.css';
</style>
