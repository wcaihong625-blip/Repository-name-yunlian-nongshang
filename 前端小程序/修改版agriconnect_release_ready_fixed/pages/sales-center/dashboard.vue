<template>
	<view class="container">
		<!-- Header / Salesperson Info -->
		<view class="header-card">
			<view class="user-info">
				<image class="avatar" :src="userInfo.avatar || '/static/images/logo.png'" mode="aspectFill"></image>
				<view class="info-content">
					<view class="name-row">
						<text class="name">{{ staffInfo.name || userInfo.nickname || '销售员' }}</text>
						<text class="tag">销售专员</text>
					</view>
					<view class="invite-row" @tap="copyInviteCode">
						<text class="invite-label">邀请码：</text>
						<text class="invite-code">{{ staffInfo.invite_code || '---' }}</text>
						<text class="copy-btn">复制</text>
					</view>
				</view>
			</view>
		</view>

		<!-- Statistics Summary -->
		<view class="stats-section">
			<view class="section-title">经营数据</view>
			<view class="stats-grid">
				<view class="stat-card large" @tap="goToCustomers">
					<text class="stat-label">我的客户数</text>
					<text class="stat-value">{{ dashboard.customerCount || 0 }}</text>
					<text class="stat-unit">位</text>
				</view>
				<view class="stat-card" @tap="goToCommission">
					<text class="stat-label">本月预估提成</text>
					<view class="price-row">
						<text class="symbol">￥</text>
						<text class="stat-value highlight">{{ dashboard.monthEstimatedCommission || '0.00' }}</text>
					</view>
				</view>
				<view class="stat-card" @tap="goToCommission">
					<text class="stat-label">本月已结提成</text>
					<view class="price-row">
						<text class="symbol">￥</text>
						<text class="stat-value">{{ dashboard.monthSettledCommission || '0.00' }}</text>
					</view>
				</view>
				<view class="stat-card full" @tap="goToCommission">
					<view class="total-row">
						<text class="stat-label">累计总提成</text>
						<view class="price-row">
							<text class="symbol">￥</text>
							<text class="stat-value">{{ dashboard.totalCommission || '0.00' }}</text>
						</view>
					</view>
				</view>
			</view>
		</view>

		<!-- Quick Links -->
		<view class="menu-section">
			<view class="menu-list">
				<view class="menu-item" @tap="goToPromotion">
					<view class="menu-icon promote">📣</view>
					<view class="menu-body">
						<text class="title">我的推广</text>
						<text class="desc">分享专属链接，锁定客户归属</text>
					</view>
					<text class="arrow">›</text>
				</view>
				<view class="menu-item" @tap="goToCustomers">
					<view class="menu-icon customers">👥</view>
					<view class="menu-body">
						<text class="title">我的客户</text>
						<text class="desc">查看名下客户活跃状态</text>
					</view>
					<text class="arrow">›</text>
				</view>
				<view class="menu-item" @tap="goToCommission">
					<view class="menu-icon money">💰</view>
					<view class="menu-body">
						<text class="title">我的提成</text>
						<text class="desc">明细清晰，实时对账</text>
					</view>
					<text class="arrow">›</text>
				</view>
			</view>
		</view>

		<!-- Notice -->
		<view class="footer-tip">
			数据实时更新，如有异议请联系管理员
		</view>
	</view>
</template>

<script>
import { getSalesCenterDashboard } from '@/utils/api.js';

export default {
	data() {
		return {
			userInfo: {},
			staffInfo: {},
			dashboard: {
				customerCount: 0,
				monthEstimatedCommission: '0.00',
				monthSettledCommission: '0.00',
				totalCommission: '0.00'
			},
			loading: false
		}
	},
	onShow() {
		this.userInfo = uni.getStorageSync('userInfo') || {};
		this.loadData();
	},
	methods: {
		async loadData() {
			if (this.loading) return;
			this.loading = true;
			try {
				const res = await getSalesCenterDashboard();
				if (res) {
					this.staffInfo = res.staff || {};
					this.dashboard = {
						customerCount: res.customerCount || 0,
						monthEstimatedCommission: (res.monthEstimatedCommission || 0).toFixed(2),
						monthSettledCommission: (res.monthSettledCommission || 0).toFixed(2),
						totalCommission: (res.totalCommission || 0).toFixed(2)
					};
				}
			} catch (e) {
				console.error(e);
				const msg = (e && e.message) ? String(e.message) : '';
				if (msg.includes('403') || msg.includes('非销售员')) {
					uni.showModal({
						title: '提示',
						content: '您当前不是销售员，暂无权限访问销售中心',
						showCancel: false,
						success: () => {
							uni.navigateBack();
						}
					});
				} else {
					uni.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
				}
			} finally {
				this.loading = false;
			}
		},
		copyInviteCode() {
			if (!this.staffInfo.invite_code) return;
			uni.setClipboardData({
				data: this.staffInfo.invite_code,
				success: () => {
					uni.showToast({ title: '已复制邀请码', icon: 'none' });
				}
			});
		},
		goToPromotion() {
			uni.navigateTo({ url: '/pages/sales-center/promotion' });
		},
		goToCustomers() {
			uni.navigateTo({ url: '/pages/sales-center/customers' });
		},
		goToCommission() {
			uni.navigateTo({ url: '/pages/sales-center/commission' });
		}
	}
}
</script>

<style lang="scss" scoped>
.container {
	min-height: 100vh;
	background-color: #f5f5f5;
	padding: 30rpx;
}

.header-card {
	background-color: #16a34a;
	padding: 40rpx;
	border-radius: 20rpx;
	color: #ffffff;
	margin-bottom: 30rpx;
	box-shadow: 0 10rpx 20rpx rgba(22, 163, 74, 0.2);

	.user-info {
		display: flex;
		align-items: center;

		.avatar {
			width: 120rpx;
			height: 120rpx;
			border-radius: 60rpx;
			border: 4rpx solid rgba(255, 255, 255, 0.5);
			margin-right: 30rpx;
		}

		.info-content {
			flex: 1;

			.name-row {
				display: flex;
				align-items: center;
				margin-bottom: 10rpx;

				.name {
					font-size: 36rpx;
					font-weight: bold;
					margin-right: 15rpx;
				}

				.tag {
					font-size: 20rpx;
					background: rgba(255, 255, 255, 0.2);
					padding: 4rpx 12rpx;
					border-radius: 20rpx;
				}
			}

			.invite-row {
				display: flex;
				align-items: center;
				font-size: 24rpx;
				opacity: 0.9;

				.invite-code {
					font-weight: 500;
					margin-right: 10rpx;
				}

				.copy-btn {
					text-decoration: underline;
					margin-left: 10rpx;
				}
			}
		}
	}
}

.stats-section {
	margin-bottom: 30rpx;

	.section-title {
		font-size: 30rpx;
		font-weight: bold;
		color: #333;
		margin-bottom: 20rpx;
		padding-left: 10rpx;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20rpx;

		.stat-card {
			background: #fff;
			padding: 30rpx;
			border-radius: 20rpx;
			display: flex;
			flex-direction: column;
			justify-content: center;

			&.large {
				grid-row: span 2;
				background: linear-gradient(135deg, #fff 0%, #f0fdf4 100%);
				
				.stat-value {
					font-size: 64rpx;
					color: #16a34a;
					margin-bottom: 10rpx;
				}
			}

			&.full {
				grid-column: span 2;
				.total-row {
					display: flex;
					align-items: center;
					justify-content: space-between;
				}
			}

			.stat-label {
				font-size: 24rpx;
				color: #666;
				margin-bottom: 10rpx;
			}

			.price-row {
				display: flex;
				align-items: baseline;

				.symbol {
					font-size: 24rpx;
					color: #333;
					margin-right: 4rpx;
				}
			}

			.stat-value {
				font-size: 40rpx;
				color: #333;
				font-weight: bold;

				&.highlight {
					color: #16a34a;
				}
			}

			.stat-unit {
				font-size: 20rpx;
				color: #999;
			}
		}
	}
}

.menu-section {
	background: #fff;
	border-radius: 20rpx;
	overflow: hidden;

	.menu-list {
		.menu-item {
			display: flex;
			align-items: center;
			padding: 40rpx 30rpx;
			border-bottom: 1rpx solid #f0f0f0;

			&:last-child {
				border-bottom: none;
			}

			&:active {
				background-color: #fafafa;
			}

			.menu-icon {
				width: 80rpx;
				height: 80rpx;
				border-radius: 20rpx;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 40rpx;
				margin-right: 30rpx;

				&.promote { background: #dcfce7; color: #16a34a; }
				&.customers { background: #dbeafe; color: #2563eb; }
				&.money { background: #fef9c3; color: #ca8a04; }
			}

			.menu-body {
				flex: 1;

				.title {
					display: block;
					font-size: 28rpx;
					font-weight: bold;
					color: #333;
					margin-bottom: 4rpx;
				}

				.desc {
					font-size: 22rpx;
					color: #999;
				}
			}

			.arrow {
				font-size: 32rpx;
				color: #ccc;
			}
		}
	}
}

.footer-tip {
	text-align: center;
	font-size: 22rpx;
	color: #ccc;
	margin-top: 60rpx;
	margin-bottom: 40rpx;
}
</style>
