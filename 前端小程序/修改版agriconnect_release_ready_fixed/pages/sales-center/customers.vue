<template>
	<view class="container">
		<!-- Search Bar -->
		<view class="search-wrap">
			<view class="search-box">
				<text class="search-icon">🔍</text>
				<input 
					class="input" 
					placeholder="搜索客户昵称/手机号" 
					v-model="keyword" 
					@confirm="onSearch"
					confirm-type="search"
				/>
				<text v-if="keyword" class="clear-icon" @tap="clearSearch">✕</text>
			</view>
		</view>

		<!-- List -->
		<view class="list-container">
			<view v-for="(item, index) in list" :key="index" class="customer-card">
				<view class="card-header">
					<view class="user-info">
						<image class="avatar" :src="item.user_avatar || '/static/images/logo.png'" mode="aspectFill"></image>
						<view class="name-box">
							<text class="nickname">{{ item.user_nickname || ((item._id || item.customer_id) ? ('用户' + String(item._id || item.customer_id).slice(-4)) : '客户') }}</text>
							<text class="mobile">{{ formatMobile(item.user_mobile) }}</text>
						</view>
					</view>
					<view class="status-tag" :class="item.member_status === 1 ? 'active' : (item.member_status === 2 ? 'expired' : 'inactive')">
						{{ item.member_status === 1 ? '会员可用' : (item.member_status === 2 ? '已过期' : '非会员') }}
					</view>
				</view>
				
				<view class="divider"></view>
				
				<view class="info-grid">
					<view class="info-item">
						<text class="label">归属时间</text>
						<text class="value">{{ formatDate(item.bind_time || item.created_at) }}</text>
					</view>
					<view class="info-item">
						<text class="label">最近订单</text>
						<text class="value">{{ formatDate(item.last_order_time) || '暂无订单' }}</text>
					</view>
				</view>
			</view>
			
			<!-- Load More / Empty -->
			<view v-if="list.length === 0 && !loading" class="empty-state">
				<image class="empty-img" src="/static/images/logo.png" mode="aspectFit"></image>
				<text class="empty-text">暂无代理客户</text>
			</view>
			
			<view v-if="loading" class="load-more">正在加载...</view>
			<view v-else-if="list.length > 0 && noMore" class="load-more">没有更多了</view>
		</view>
	</view>
</template>

<script>
import { getMySalesCustomers } from '@/utils/api.js';

export default {
	data() {
		return {
			keyword: '',
			page: 1,
			pageSize: 10,
			list: [],
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
				const res = await getMySalesCustomers({
					page: this.page,
					pageSize: this.pageSize,
					keyword: this.keyword
				});
				
				if (res && res.list) {
					if (this.page === 1) {
						this.list = res.list;
					} else {
						this.list = this.list.concat(res.list);
					}
					if (res.list.length < this.pageSize) {
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
		onSearch() {
			this.page = 1;
			this.noMore = false;
			this.loadData();
		},
		clearSearch() {
			this.keyword = '';
			this.onSearch();
		},
		formatMobile(mobile) {
			if (!mobile) return '未绑定手机';
			const s = String(mobile);
			if (s.includes('*')) return s;
			return s.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
		},
		formatDate(ts) {
			if (!ts) return '';
			const d = new Date(ts);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		}
	}
}
</script>

<style lang="scss" scoped>
.container {
	min-height: 100vh;
	background-color: #f5f5f5;
}

.search-wrap {
	position: sticky;
	top: 0;
	z-index: 10;
	background-color: #f5f5f5;
	padding: 20rpx 30rpx;
}

.search-box {
	background: #fff;
	height: 80rpx;
	border-radius: 40rpx;
	display: flex;
	align-items: center;
	padding: 0 30rpx;
	border: 1rpx solid #e0e0e0;

	.search-icon {
		font-size: 32rpx;
		margin-right: 20rpx;
		color: #999;
	}

	.input {
		flex: 1;
		font-size: 28rpx;
	}

	.clear-icon {
		padding: 10rpx;
		color: #ccc;
		font-size: 32rpx;
	}
}

.list-container {
	padding: 10rpx 30rpx 30rpx;
}

.customer-card {
	background: #fff;
	border-radius: 20rpx;
	padding: 30rpx;
	margin-bottom: 20rpx;
	box-shadow: 0 4rpx 10rpx rgba(0,0,0,0.02);

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20rpx;

		.user-info {
			display: flex;
			align-items: center;
			
			.avatar {
				width: 90rpx;
				height: 90rpx;
				border-radius: 45rpx;
				margin-right: 20rpx;
				background: #f9f9f9;
			}

			.name-box {
				.nickname {
					display: block;
					font-size: 30rpx;
					font-weight: bold;
					color: #333;
					margin-bottom: 4rpx;
				}
				.mobile {
					font-size: 24rpx;
					color: #999;
				}
			}
		}

		.status-tag {
			font-size: 20rpx;
			padding: 4rpx 16rpx;
			border-radius: 6rpx;
			
			&.active {
				background: #dcfce7;
				color: #16a34a;
			}
			&.inactive {
				background: #f3f4f6;
				color: #9ca3af;
			}
			&.expired {
				background: #ffedd5;
				color: #c2410c;
			}
		}
	}

	.divider {
		height: 1rpx;
		background: #f5f5f5;
		margin: 20rpx 0;
	}

	.info-grid {
		display: flex;
		
		.info-item {
			flex: 1;
			.label {
				display: block;
				font-size: 22rpx;
				color: #999;
				margin-bottom: 6rpx;
			}
			.value {
				font-size: 26rpx;
				color: #333;
			}
		}
	}
}

.empty-state {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: flex-start;
	width: 100%;
	box-sizing: border-box;
	padding: 160rpx 30rpx 60rpx;

	.empty-img {
		display: block;
		width: 200rpx;
		height: 200rpx;
		opacity: 0.2;
		margin: 0 auto 32rpx;
		flex-shrink: 0;
	}

	.empty-text {
		display: block;
		width: 100%;
		text-align: center;
		color: #999;
		font-size: 28rpx;
		line-height: 1.5;
	}
}

.load-more {
	text-align: center;
	padding: 30rpx;
	font-size: 24rpx;
	color: #ccc;
}
</style>
