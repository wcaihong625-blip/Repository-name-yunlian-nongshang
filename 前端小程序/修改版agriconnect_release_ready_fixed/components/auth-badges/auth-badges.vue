<template>
    <view v-if="badgeList.length" :class="'auth-badges ' + (compact ? 'compact' : 'normal')">
        <view v-for="badge in badgeList" :key="badge.key" :class="'auth-badge auth-badge-' + badge.type">
            <text class="auth-badge-icon">{{ badge.icon }}</text>
            <text class="auth-badge-text">{{ badge.text }}</text>
        </view>
    </view>
</template>

<script>
export default {
    props: {
        realnameVerified: {
            type: Boolean,
            default: false
        },
        enterpriseVerified: {
            type: Boolean,
            default: false
        },
        compact: {
            type: Boolean,
            default: false
        },
        showPendingText: {
            type: Boolean,
            default: false
        }
    },
    computed: {
        badgeList() {
            const list = [];
            if (this.realnameVerified) {
                list.push({
                    key: 'realname',
                    type: 'realname',
                    icon: '✓',
                    text: '已实名认证'
                });
            }
            if (this.enterpriseVerified) {
                list.push({
                    key: 'enterprise',
                    type: 'enterprise',
                    icon: '✓',
                    text: '已企业认证'
                });
            }
            if (!list.length && this.showPendingText) {
                list.push({
                    key: 'pending',
                    type: 'pending',
                    icon: '·',
                    text: '认证信息待完善'
                });
            }
            return list;
        }
    }
};
</script>

<style>
.auth-badges {
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: 10rpx;
}

.auth-badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6rpx;
    border-radius: 9999rpx;
    border: 1rpx solid transparent;
    box-sizing: border-box;
    white-space: nowrap;
}

.auth-badge-icon {
    font-weight: 700;
    line-height: 1;
}

.auth-badge-text {
    font-weight: 600;
    line-height: 1.2;
}

.normal .auth-badge {
    min-height: 40rpx;
    padding: 0 16rpx;
}

.normal .auth-badge-icon {
    font-size: 22rpx;
}

.normal .auth-badge-text {
    font-size: 22rpx;
}

.compact .auth-badge {
    min-height: 30rpx;
    padding: 0 10rpx;
}

.compact .auth-badge-icon {
    font-size: 16rpx;
}

.compact .auth-badge-text {
    font-size: 18rpx;
}

.auth-badge-realname {
    background: #fff8eb;
    border-color: #f6d48b;
}

.auth-badge-realname .auth-badge-icon,
.auth-badge-realname .auth-badge-text {
    color: #b7791f;
}

.auth-badge-enterprise {
    background: #fff4d6;
    border-color: #f2c66d;
}

.auth-badge-enterprise .auth-badge-icon,
.auth-badge-enterprise .auth-badge-text {
    color: #a16207;
}

.auth-badge-pending {
    background: #f5f7fa;
    border-color: #d7dde5;
}

.auth-badge-pending .auth-badge-icon,
.auth-badge-pending .auth-badge-text {
    color: #94a3b8;
}
</style>
