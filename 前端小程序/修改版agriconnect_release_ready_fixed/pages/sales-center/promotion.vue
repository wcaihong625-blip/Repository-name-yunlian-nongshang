<template>
	<view class="container">
		<!-- 推广文案（可编辑） -->
		<view class="text-card">
			<view class="card-header">
				<text class="subtitle">推广文案</text>
				<text class="copy-btn" @tap="copyTextText">复制文案</text>
			</view>
			<textarea
				class="text-area"
				v-model="editableShareText"
				:maxlength="2000"
				auto-height
				placeholder="请输入推广文案"
				@input="onShareTextInput"
			/>
		</view>

		<view class="action-section">
			<button class="share-btn primary" open-type="share">
				<text class="icon">💬</text>
				发送给好友/微信群
			</button>
		</view>

		<view class="tips">
			<view class="tip-title">推广说明：</view>
			<view class="tip-item">1. 客户通过您分享的行情卡片进入行情页后，若再前往会员中心开通会员，系统将按您的邀请关系自动锁定归属。</view>
			<view class="tip-item">2. 锁定后，该客户的每一笔会员订单您都将获得相应提成。</view>
			<view class="tip-item">3. 即使客户未即时支付，您的邀请关系也会保留一段时间。</view>
		</view>
	</view>
</template>

<script>
import { getSalesPromotionInfo } from '@/utils/api.js';

/** 与 pages.json 一致：Tab「行情」对应今日行情页 */
const MARKET_PAGE_PATH = '/pages/market-trends/market-trends';
const SHARE_CARD_IMAGE_URL = '/static/share/share-market.jpg';

const LEGACY_SHARE_TEXT = '诚邀您加入云链农商，开启您的专属店铺。';
const DEFAULT_SHARE_TEXT = '云链农商供销发布平台，实时行情每日更新+专业行情分析，产销定价一眼看懂';

function buildMarketPromotionPath(inviteCode) {
	const code = inviteCode != null ? String(inviteCode).trim() : '';
	if (!code) return MARKET_PAGE_PATH;
	return `${MARKET_PAGE_PATH}?invite_code=${encodeURIComponent(code)}`;
}

function storageKeyForShareText(inviteCode) {
	return inviteCode ? `sales_promotion_share_text_${inviteCode}` : '';
}

export default {
	data() {
		return {
			promoInfo: {
				invite_code: '',
				promotion_path: '',
				share_text: ''
			},
			editableShareText: '',
			loading: false
		}
	},
	onLoad() {
		this.loadData();
	},
	onShareAppMessage() {
		const path = buildMarketPromotionPath(this.promoInfo.invite_code);
		return {
			title: '云链农商行情信息',
			path,
			imageUrl: SHARE_CARD_IMAGE_URL
		}
	},
	onShareTimeline() {
		const code = this.promoInfo.invite_code != null ? String(this.promoInfo.invite_code).trim() : '';
		const query = code ? `invite_code=${encodeURIComponent(code)}` : '';
		return {
			title: '云链农商行情信息',
			query,
			imageUrl: SHARE_CARD_IMAGE_URL
		}
	},
	methods: {
		withTimeout(promise, timeoutMs = 8000) {
			return Promise.race([
				promise,
				new Promise((_, reject) => {
					setTimeout(() => reject(new Error('timeout')), timeoutMs);
				})
			]);
		},
		async loadData() {
			this.loading = true;
			try {
				const res = await this.withTimeout(getSalesPromotionInfo(), 8000);
				if (res) {
					this.promoInfo = res;
				}
			} catch (e) {
				console.error(e);
				const msg = e && e.message === 'timeout'
					? '推广信息加载超时，已使用本地文案'
					: '推广信息加载失败，已使用本地文案';
				uni.showToast({ title: msg, icon: 'none' });
			} finally {
				// 无论云对象成功与否，都保证页面有可编辑文案
				this.applyEditableShareTextAfterLoad();
				this.loading = false;
			}
		},
		applyEditableShareTextAfterLoad() {
			const code = this.promoInfo.invite_code || '';
			const defaultFromApi = (this.promoInfo.share_text && String(this.promoInfo.share_text).trim())
				? this.promoInfo.share_text
				: DEFAULT_SHARE_TEXT;
			const key = storageKeyForShareText(code);
			let text = defaultFromApi;
			if (key) {
				try {
					const cached = uni.getStorageSync(key);
					if (cached != null && cached !== '' && typeof cached === 'string') {
						text = cached;
					}
				} catch (e) {
					// ignore
				}
			}
			if (text === LEGACY_SHARE_TEXT) {
				text = DEFAULT_SHARE_TEXT;
				if (key) {
					try {
						uni.setStorageSync(key, text);
					} catch (e) {
						// ignore
					}
				}
			}
			this.editableShareText = text;
		},
		onShareTextInput() {
			const key = storageKeyForShareText(this.promoInfo.invite_code);
			if (key) {
				try {
					uni.setStorageSync(key, this.editableShareText);
				} catch (e) {
					// ignore
				}
			}
		},
		copyTextText() {
			const t = (this.editableShareText != null ? String(this.editableShareText) : '').trim();
			if (!t) {
				uni.showToast({ title: '请先填写推广文案', icon: 'none' });
				return;
			}
			uni.setClipboardData({
				data: t,
				success: () => uni.showToast({ title: '文案已复制', icon: 'none' })
			});
		}
	}
}
</script>

<style lang="scss" scoped>
.container {
	min-height: 100vh;
	background-color: #f5f5f5;
	padding: 30rpx;
	padding-bottom: 48rpx;
}

.text-card {
	background: #fff;
	border-radius: 20rpx;
	padding: 36rpx 30rpx;
	margin-bottom: 36rpx;
	box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);

	.card-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24rpx;

		.subtitle {
			font-size: 32rpx;
			font-weight: bold;
			color: #333;
		}

		.copy-btn {
			font-size: 26rpx;
			color: #16a34a;
		}
	}

	.text-area {
		width: 100%;
		min-height: 280rpx;
		font-size: 28rpx;
		color: #333;
		line-height: 1.65;
		background: #fafafa;
		padding: 24rpx;
		border-radius: 12rpx;
		border: 1rpx solid #e8e8e8;
		box-sizing: border-box;
	}
}

.action-section {
	.share-btn {
		height: 90rpx;
		border-radius: 45rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 30rpx;
		margin-bottom: 0;

		.icon {
			margin-right: 15rpx;
			font-size: 36rpx;
		}

		&.primary {
			background-color: #16a34a;
			color: #fff;
			&::after { border: none; }
		}
	}
}

.tips {
	margin-top: 36rpx;
	padding: 8rpx 4rpx 0;
	.tip-title {
		font-size: 26rpx;
		color: #333;
		font-weight: bold;
		margin-bottom: 15rpx;
	}
	.tip-item {
		font-size: 24rpx;
		color: #999;
		margin-bottom: 10rpx;
		line-height: 1.45;
	}
}
</style>
