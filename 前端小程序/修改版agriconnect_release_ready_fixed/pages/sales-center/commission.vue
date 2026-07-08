<template>
	<view class="container">
		<!-- Summary Dashboard -->
		<view class="dashboard-wrap">
			<view class="summary-card">
				<view class="main-stat">
					<text class="label">本月预估提成 (元)</text>
					<text class="value">{{ summary.monthEstimatedCommission || '0.00' }}</text>
				</view>
				<view class="sub-stats">
					<view class="item">
						<text class="label">本月已结</text>
						<text class="value">￥{{ summary.monthSettledCommission || '0.00' }}</text>
					</view>
					<view class="item">
						<text class="label">累计总计</text>
						<text class="value">￥{{ summary.totalCommission || '0.00' }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- Month Filter -->
		<view class="filter-bar">
			<picker mode="date" fields="month" @change="onMonthChange" :value="month">
				<view class="picker-inner">
					<text class="current-month">{{ month }}</text>
					<text class="picker-icon">📅</text>
				</view>
			</picker>
			<text class="filter-tip">筛选月份查询明细</text>
		</view>

		<!-- List -->
		<view class="list-container">
			<view v-for="(item, index) in list" :key="index" class="commission-item">
				<view class="item-header">
					<text class="user">{{ item.customer_nickname || (item.customer_id ? ('客户' + String(item.customer_id).slice(-4)) : '客户') }}</text>
					<text class="type-tag" :class="item.commission_type === 'first_open' ? 'first_open' : 'renewal'">
						{{ item.commission_type === 'first_open' ? '首开' : '续费' }}
					</text>
					<view class="amount">
						<text class="symbol">+￥</text>
						<text class="num">{{ (item.commission_amount || 0).toFixed(2) }}</text>
					</view>
				</view>
				
				<view class="item-body">
					<view class="detail">
						<text class="row">订单金额：￥{{ (item.order_pay_amount || 0).toFixed(2) }}</text>
						<text class="row">时间：{{ formatDate(item.pay_time || item.created_at) }}</text>
					</view>
					<view class="status" :class="item.commission_status === 1 ? 'settled' : 'pending'">
						{{ item.commission_status === 1 ? '已结算' : '待结算' }}
					</view>
				</view>
			</view>

			<!-- Empty / Loading -->
			<view v-if="list.length === 0 && !loading" class="empty-state">
				<text class="icon">🔍</text>
				<text class="text">本月暂无提成明细</text>
			</view>

			<view v-if="loading" class="load-more">正在加载...</view>
			<view v-else-if="list.length > 0 && noMore" class="load-more">没有更多记录了</view>
		</view>
	</view>
</template>

<script>
import { getMySalesCommission } from '@/utils/api.js';

export default {
	data() {
		const now = new Date();
		const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
		return {
			month: monthStr,
			page: 1,
			pageSize: 10,
			list: [],
			summary: {
				monthEstimatedCommission: '0.00',
				monthSettledCommission: '0.00',
				totalCommission: '0.00'
			},
			loading: false,
			noMore: false
		}
	},
	onLoad() {
		this.loadData();
	},
	onPullDownRefresh() {
		this.page = 1;
		this.noMore = false;
		this.loadData(true);
	},
	onReachBottom() {
		if (!this.noMore && !this.loading) {
			this.page++;
			this.loadData();
		}
	},
	methods: {
		async loadData(isRefresh = false) {
			if (this.loading) return;
			this.loading = true;
			try {
				const res = await getMySalesCommission({
					page: this.page,
					pageSize: this.pageSize,
					month: this.month
				});
				
				if (res) {
					if (this.page === 1) {
						this.list = res.list || [];
						this.summary = {
							monthEstimatedCommission: (res.summary?.monthEstimatedCommission || 0).toFixed(2),
							monthSettledCommission: (res.summary?.monthSettledCommission || 0).toFixed(2),
							totalCommission: (res.summary?.totalCommission || 0).toFixed(2)
						};
					} else {
						this.list = this.list.concat(res.list || []);
					}
					
					if ((res.list || []).length < this.pageSize) {
						this.noMore = true;
					}
				}
			} catch (e) {
				console.error(e);
			} finally {
				this.loading = false;
				if (isRefresh) uni.stopPullDownRefresh();
			}
		},
		onMonthChange(e) {
			this.month = e.detail.value;
			this.page = 1;
			this.noMore = false;
			this.loadData();
		},
		formatDate(ts) {
			if (!ts) return '';
			const d = new Date(ts);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
		}
	}
}
</script>

<style lang="scss" scoped>
.container {
	min-height: 100vh;
	background-color: #f5f5f5;
}

.dashboard-wrap {
	padding: 30rpx;
	background: #16a34a;
	padding-bottom: 100rpx;
}

.summary-card {
	background: #fff;
	border-radius: 20rpx;
	padding: 40rpx;
	box-shadow: 0 10rpx 30rpx rgba(0,0,0,0.1);

	.main-stat {
		text-align: center;
		margin-bottom: 40rpx;
		.label {
			font-size: 24rpx;
			color: #999;
			display: block;
			margin-bottom: 15rpx;
		}
		.value {
			font-size: 64rpx;
			font-weight: bold;
			color: #16a34a;
		}
	}

	.sub-stats {
		display: flex;
		border-top: 1rpx solid #f0f0f0;
		padding-top: 30rpx;
		
		.item {
			flex: 1;
			text-align: center;
			&:first-child { border-right: 1rpx solid #f0f0f0; }
			
			.label {
				font-size: 22rpx;
				color: #999;
				display: block;
				margin-bottom: 10rpx;
			}
			.value {
				font-size: 30rpx;
				color: #333;
				font-weight: 500;
			}
		}
	}
}

.filter-bar {
	margin: -60rpx 30rpx 20rpx;
	background: #fff;
	height: 100rpx;
	border-radius: 50rpx;
	display: flex;
	align-items: center;
	padding: 0 40rpx;
	justify-content: space-between;
	box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.05);

	.picker-inner {
		display: flex;
		align-items: center;
		.current-month {
			font-size: 30rpx;
			font-weight: bold;
			color: #333;
			margin-right: 10rpx;
		}
		.picker-icon {
			font-size: 32rpx;
		}
	}

	.filter-tip {
		font-size: 24rpx;
		color: #999;
	}
}

.list-container {
	padding: 0 30rpx 30rpx;
}

.commission-item {
	background: #fff;
	border-radius: 16rpx;
	padding: 30rpx;
	margin-bottom: 20rpx;

	.item-header {
		display: flex;
		align-items: center;
		margin-bottom: 20rpx;

		.user {
			font-size: 28rpx;
			font-weight: bold;
			color: #333;
			max-width: 240rpx;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		.type-tag {
			font-size: 20rpx;
			padding: 2rpx 12rpx;
			border-radius: 4rpx;
			margin-left: 15rpx;
			
			&.first_open { background: #fee2e2; color: #ef4444; }
			&.renewal { background: #dbeafe; color: #3b82f6; }
		}

		.amount {
			margin-left: auto;
			color: #16a34a;
			font-weight: bold;
			.symbol { font-size: 24rpx; }
			.num { font-size: 36rpx; }
		}
	}

	.item-body {
		display: flex;
		justify-content: space-between;
		align-items: flex-end;

		.detail {
			.row {
				display: block;
				font-size: 22rpx;
				color: #999;
				margin-top: 6rpx;
			}
		}

		.status {
			font-size: 22rpx;
			&.settled { color: #16a34a; }
			&.pending { color: #f97316; }
		}
	}
}

.empty-state {
	padding-top: 150rpx;
	text-align: center;
	.icon { font-size: 80rpx; display: block; margin-bottom: 20rpx; opacity: 0.2; }
	.text { font-size: 26rpx; color: #999; }
}

.load-more {
	text-align: center;
	padding: 30rpx;
	font-size: 24rpx;
	color: #ccc;
}
</style>
