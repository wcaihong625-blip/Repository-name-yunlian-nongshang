<template>
	<view class="fix-top-window page-shell dash-page">
		<uni-notice-bar v-if="showdbInit" showGetMore showIcon class="mb-m pointer dash-notice" text="检测到您未初始化db_init.json，请先右键uniCloud/database/db_init.json文件，执行初始化云数据库，否则左侧无法显示菜单等数据" background-color="#fef0f0" color="#f56c6c" @click="toAddAppId" />
		<uni-notice-bar v-if="showAddAppId" showGetMore showIcon class="mb-m pointer dash-notice" text="检测到您还未添加应用，点击前往应用管理添加" @click="toAddAppId" />

		<view class="hero-card">
			<view>
				<text class="hero-title">云链农商后台工作台</text>
				<text class="hero-subtitle">聚焦订单、提成、优惠码与异常流程，帮助快速处理当日运营事项</text>
			</view>
			<view class="hero-right">
				<text class="dash-meta">数据日期：{{ meta.settle_month || '实时' }}（上海时区）</text>
				<view class="refresh-btn" @click="refreshDashboard">
					<uni-icons type="reload" size="16" color="#64748b" :class="{ rotating: dashRefreshing }"></uni-icons>
				</view>
			</view>
		</view>

		<view v-if="dashLoading" class="section-card dash-loading">加载驾驶舱数据…</view>
		<view v-else-if="dashError" class="section-card dash-error">{{ dashError }}</view>
		<template v-else>
			<view class="dash-section">
				<view class="section-title">核心指标</view>
				<view class="stat-grid">
					<view class="stat-card" @click="navTo('/pages/member_order/list?pay_status=0')"><text class="label">待支付会员订单</text><text class="value">{{ cards.pending_member_orders }}</text><text class="meta">需优先跟进</text></view>
					<view class="stat-card" @click="navTo('/pages/member_order/list')"><text class="label">今日新增会员订单</text><text class="value">{{ cards.today_new_member_orders }}</text><text class="meta">新增趋势观察</text></view>
					<view class="stat-card" @click="goMonthPaidByType(1)"><text class="label">本月首开（已支付）</text><text class="value">{{ cards.month_first_open_orders }}</text><text class="meta">支付转化核心</text></view>
					<view class="stat-card" @click="goMonthPaidByType(2)"><text class="label">本月续费（已支付）</text><text class="value">{{ cards.month_renewal_orders }}</text><text class="meta">老客续费表现</text></view>
					<view class="stat-card" @click="navTo('/pages/member_order/list?pay_status=1&exception=commission_unsettled')"><text class="label">未结算提成订单</text><text class="value">{{ cards.pending_commission_orders }}</text><text class="meta">影响结算节奏</text></view>
					<view class="stat-card" @click="navTo('/pages/customer_transfer_apply/list?status=0')"><text class="label">待审批客户转移</text><text class="value">{{ cards.pending_transfer_apply }}</text><text class="meta">待办审批积压</text></view>
					<view class="stat-card" @click="navTo('/pages/order_exception/index')"><text class="label">未关闭异常订单</text><text class="value">{{ cards.open_exception_orders }}</text><text class="meta">异常处理追踪</text></view>
					<view class="stat-card" @click="navTo('/pages/coupon_code/list')"><text class="label">已启用优惠码</text><text class="value">{{ cards.enabled_coupon_codes }}</text><text class="meta">活动投放状态</text></view>
				</view>
			</view>

			<view class="dash-section">
				<view class="section-title">待办提醒</view>
				<view class="todo-grid">
					<view class="todo-card" @click="navTo('/pages/member_order/list?pay_status=0')"><text class="todo-num">{{ cards.pending_member_orders }}</text><text class="todo-title">待支付订单</text><text class="todo-desc">建议先处理高金额订单</text></view>
					<view class="todo-card" @click="navTo('/pages/customer_transfer_apply/list?status=0')"><text class="todo-num">{{ cards.pending_transfer_apply }}</text><text class="todo-title">待审批客户转移</text><text class="todo-desc">避免审批堆积影响流转</text></view>
					<view class="todo-card" @click="navTo('/pages/order_exception/index')"><text class="todo-num">{{ cards.open_exception_orders }}</text><text class="todo-title">未关闭异常订单</text><text class="todo-desc">持续跟进异常闭环</text></view>
					<view class="todo-card" @click="navTo('/pages/order_exception/index?exception_type=missing_customer_name&handle_status=open')"><text class="todo-num">{{ todos.missing_customer_name_orders }}</text><text class="todo-title">缺客户姓名</text><text class="todo-desc">优先完善客户档案字段</text></view>
					<view class="todo-card" @click="navTo('/pages/member_order/list?empty_mobile=1')"><text class="todo-num">{{ todos.missing_mobile_orders }}</text><text class="todo-title">已支付缺手机号</text><text class="todo-desc">补齐联系方式减少回访阻碍</text></view>
				</view>
			</view>

			<view class="workbench-main">
				<view class="workbench-left">
					<view class="section-card">
						<view class="section-title">订单 / 提成 / 优惠码概览</view>
						<view class="overview-grid">
							<view class="overview-card"><view class="panel-hd">订单概览</view><view class="panel-line"><text>待支付</text><text>{{ orderSum.pending }}</text></view><view class="panel-line"><text>已支付</text><text>{{ orderSum.paid }}</text></view><view class="panel-line"><text>已取消</text><text>{{ orderSum.canceled }}</text></view><view class="panel-line"><text>0 元已支付单</text><text>{{ orderSum.zero_amount }}</text></view></view>
							<view class="overview-card"><view class="panel-hd">提成概览（{{ meta.settle_month || '—' }}）</view><view class="panel-line"><text>未结算提成单</text><text>{{ commSum.pending_commission_orders }}</text></view><view class="panel-line"><text>本月预计提成</text><text>¥{{ formatMoney(commSum.month_estimated_commission) }}</text></view><view class="panel-line"><text>可月结订单数</text><text>{{ commSum.month_eligible_orders }}</text></view><view class="panel-line"><text>本月已结算单数</text><text>{{ commSum.month_settled_bills }}</text></view></view>
							<view class="overview-card"><view class="panel-hd">优惠码概览</view><view class="panel-line"><text>已启用</text><text>{{ couponSum.enabled_coupon_codes }}</text></view><view class="panel-line"><text>已有核销记录</text><text>{{ couponSum.used_coupon_codes }}</text></view><view class="panel-line"><text>今日新增码</text><text>{{ couponSum.today_new_coupon_codes }}</text></view><view class="panel-line"><text>今日核销次数</text><text>{{ couponSum.today_verify_count }}</text></view></view>
						</view>
					</view>
					<view class="section-card">
						<view class="section-title">快捷入口</view>
						<view class="quick-entry-grid">
							<view class="quick-entry-item" @click="navTo('/pages/member_order/list')"><view class="entry-icon">订</view><text class="entry-title">会员订单</text><text class="entry-desc">查看订单与支付状态</text></view>
							<view class="quick-entry-item" @click="navTo('/pages/customer_profile/list')"><view class="entry-icon">客</view><text class="entry-title">客户管理</text><text class="entry-desc">维护客户归属关系</text></view>
							<view class="quick-entry-item" @click="navTo('/pages/customer_transfer_apply/list')"><view class="entry-icon">转</view><text class="entry-title">客户转移审批</text><text class="entry-desc">处理转移申请流程</text></view>
							<view class="quick-entry-item" @click="navTo('/pages/sales_commission_settle/list')"><view class="entry-icon">提</view><text class="entry-title">提成月结</text><text class="entry-desc">核对并生成结算单</text></view>
							<view class="quick-entry-item" @click="navTo('/pages/order_exception/index')"><view class="entry-icon">异</view><text class="entry-title">异常订单</text><text class="entry-desc">追踪对账异常问题</text></view>
							<view class="quick-entry-item" @click="navTo('/pages/operation_reconcile/index')"><view class="entry-icon">账</view><text class="entry-title">运营对账</text><text class="entry-desc">查看运营汇总结果</text></view>
							<view class="quick-entry-item" @click="navTo('/pages/coupon_code/list')"><view class="entry-icon">码</view><text class="entry-title">优惠码管理</text><text class="entry-desc">维护批次与状态</text></view>
							<view class="quick-entry-item" @click="navTo('/pages/coupon_code/use-log')"><view class="entry-icon">核</view><text class="entry-title">优惠码核销</text><text class="entry-desc">跟踪核销使用明细</text></view>
						</view>
					</view>
				</view>
				<view class="workbench-right">
					<view class="section-card side-card">
						<view class="section-title">今日待处理</view>
						<view class="panel-line"><text>待支付订单</text><text>{{ cards.pending_member_orders }}</text></view>
						<view class="panel-line"><text>待审批转移</text><text>{{ cards.pending_transfer_apply }}</text></view>
						<view class="panel-line"><text>未关闭异常</text><text>{{ cards.open_exception_orders }}</text></view>
					</view>
					<view class="section-card side-card">
						<view class="section-title">异常关注</view>
						<view class="panel-line"><text>缺客户姓名</text><text>{{ todos.missing_customer_name_orders }}</text></view>
						<view class="panel-line"><text>缺手机号订单</text><text>{{ todos.missing_mobile_orders }}</text></view>
						<view class="panel-line"><text>未结算提成单</text><text>{{ cards.pending_commission_orders }}</text></view>
					</view>
					<view class="section-card side-card">
						<view class="section-title">系统提示</view>
						<view class="empty-state">
							<view class="empty-icon">i</view>
							<text>暂无额外系统提醒</text>
							<text class="empty-tip">建议先处理今日待办后再查看历史记录</text>
						</view>
					</view>
				</view>
			</view>

			<view class="dash-section">
				<view class="section-title">最近动态</view>
				<view class="recent-grid">
					<view class="section-card recent-block">
						<view class="recent-sub">最近创建的会员订单</view>
						<view v-for="(r, i) in recent.member_orders" :key="'c'+i" class="recent-line" @click="goOrder(r._id)"><text>{{ r.order_no || r._id }}</text><text class="recent-muted">{{ orderTypeText(r.order_type) }} · {{ payHint(r) }}</text></view>
						<view v-if="!recent.member_orders.length" class="empty-state"><view class="empty-icon">单</view><text>暂无新建订单</text></view>
					</view>
					<view class="section-card recent-block">
						<view class="recent-sub">最近支付成功</view>
						<view v-for="(r, i) in recent.member_orders_paid" :key="'p'+i" class="recent-line" @click="goOrder(r._id)"><text>{{ r.order_no || r._id }}</text><text class="recent-muted">¥{{ r.pay_amount }} · {{ r.mobile || '—' }}</text></view>
						<view v-if="!recent.member_orders_paid.length" class="empty-state"><view class="empty-icon">付</view><text>暂无支付成功记录</text></view>
					</view>
				</view>
			</view>
		</template>
		<fix-window />
	</view>
</template>

<script>
	// #ifdef H5
	import { waitForUniCloudUserContext, hasValidUniIdStorage } from '@/js_sdk/uni-admin/unicloudAuth.js'
	// #endif

	const emptyDash = {
		meta: {},
		cards: {
			pending_member_orders: 0,
			today_new_member_orders: 0,
			month_first_open_orders: 0,
			month_renewal_orders: 0,
			pending_commission_orders: 0,
			pending_transfer_apply: 0,
			open_exception_orders: 0,
			enabled_coupon_codes: 0
		},
		panels: {
			order_summary: { pending: 0, paid: 0, canceled: 0, zero_amount: 0 },
			commission_summary: {
				pending_commission_orders: 0,
				month_estimated_commission: 0,
				month_eligible_orders: 0,
				month_settled_bills: 0
			},
			coupon_summary: {
				enabled_coupon_codes: 0,
				used_coupon_codes: 0,
				today_new_coupon_codes: 0,
				today_verify_count: 0
			}
		},
		todos: { missing_customer_name_orders: 0, missing_mobile_orders: 0 },
		recent: {
			member_orders: [],
			member_orders_paid: [],
			transfer_apply: [],
			commission_settle_recent: [],
			coupon_use_logs: []
		}
	}

	export default {
		data() {
			return {
				showAddAppId: false,
				showdbInit: false,
				dashboardAuthReady: false,
				dashLoading: true,
				dashRefreshing: false,
				dashError: '',
				dash: null
			}
		},
		computed: {
			meta() {
				return (this.dash && this.dash.meta) || {}
			},
			cards() {
				return (this.dash && this.dash.cards) || emptyDash.cards
			},
			todos() {
				return (this.dash && this.dash.todos) || emptyDash.todos
			},
			orderSum() {
				return (this.dash && this.dash.panels && this.dash.panels.order_summary) || emptyDash.panels.order_summary
			},
			commSum() {
				return (this.dash && this.dash.panels && this.dash.panels.commission_summary) || emptyDash.panels.commission_summary
			},
			couponSum() {
				return (this.dash && this.dash.panels && this.dash.panels.coupon_summary) || emptyDash.panels.coupon_summary
			},
			recent() {
				return (this.dash && this.dash.recent) || emptyDash.recent
			}
		},
		async onReady() {
			// #ifdef H5
			await waitForUniCloudUserContext(10000)
			this.dashboardAuthReady = hasValidUniIdStorage()
			if (!this.dashboardAuthReady) {
				this.dashLoading = false
				this.dashError = '登录态未就绪，请重新登录后刷新首页'
				return
			}
			// #endif
			// #ifndef H5
			this.dashboardAuthReady = true
			// #endif
			this.checkAppId()
			this.checkdbInit()
			await this.loadDashboard()
		},
		methods: {
			formatMoney(n) {
				const x = Number(n)
				if (Number.isNaN(x)) return '0.00'
				return x.toFixed(2)
			},
			orderTypeText(t) {
				if (t === 1) return '首开'
				if (t === 2) return '续费'
				return '—'
			},
			payHint(r) {
				if (!r) return ''
				if (r.pay_status === 1 || r.order_status === 1) return '已支付'
				if (r.pay_status === 0 && r.order_status === 0) return '待支付'
				return '其他'
			},
			settleStatusText(s) {
				if (s === 1) return '已结算'
				if (s === 0) return '待结算'
				return '—'
			},
			async loadDashboard() {
				if (!this.dashboardAuthReady) return
				this.dashError = ''
				this.dashLoading = true
				try {
					const { result } = await uniCloud.callFunction({ name: 'getAdminDashboardSummary', data: {} })
					if (!result) {
						this.dashError = '无返回数据'
						this.dash = JSON.parse(JSON.stringify(emptyDash))
						return
					}
					if (result.code === 401) {
						this.dashError = result.message || '登录失效，请重新登录'
						this.dash = JSON.parse(JSON.stringify(emptyDash))
						return
					}
					if (result.code !== 0 || !result.data) {
						this.dashError = result.message || '加载失败'
						this.dash = JSON.parse(JSON.stringify(emptyDash))
						return
					}
					this.dash = result.data
				} catch (e) {
					console.error(e)
					this.dashError = (e && e.message) || '网络异常'
					this.dash = JSON.parse(JSON.stringify(emptyDash))
				} finally {
					this.dashLoading = false
				}
			},
			async refreshDashboard() {
				if (!this.dashboardAuthReady) return
				this.dashRefreshing = true
				await this.loadDashboard()
				this.dashRefreshing = false
			},
			navTo(url) {
				if (!url) return
				if (url.indexOf('http') > -1) {
					// #ifdef H5
					window.open(url)
					// #endif
					return
				}
				uni.navigateTo({ url })
			},
			goMonthPaidByType(orderType) {
				const m = this.meta.settle_month
				let path = `/pages/member_order/list?pay_status=1&order_type=${orderType}`
				if (m) {
					path += `&pay_month=${encodeURIComponent(m)}`
				}
				this.navTo(path)
			},
			goOrder(id) {
				if (!id) return
				uni.navigateTo({ url: '/pages/member_order/detail?id=' + encodeURIComponent(String(id)) })
			},
			goSettle(id) {
				if (!id) return
				uni.navigateTo({ url: '/pages/sales_commission_settle/detail?id=' + encodeURIComponent(String(id)) })
			},
			toAddAppId() {
				this.showAddAppId = false
				uni.navigateTo({
					url: '/pages/system/app/list',
					events: { refreshData: () => this.checkAppId() }
				})
			},
			async checkAppId() {
				// #ifdef H5
				if (!this.dashboardAuthReady) return
				// #endif
				try {
					const db = uniCloud.database()
					const res = await db.collection('opendb-app-list').count()
					this.showAddAppId = (!res.result || res.result.total === 0)
				} catch (e) {
					this.showAddAppId = false
				}
			},
			async checkdbInit() {
				// #ifdef H5
				if (!this.dashboardAuthReady) return
				// #endif
				try {
					const db = uniCloud.database()
					const res = await db.collection('opendb-admin-menus').count()
					this.showdbInit = (!res.result || res.result.total === 0)
					if (this.showdbInit) {
						uni.showModal({
							title: '重要提示',
							content: '检测到您未初始化数据库，请在 uniCloud/database 目录执行初始化云数据库，否则左侧菜单无法显示',
							showCancel: false,
							confirmText: '我知道了'
						})
					}
				} catch (e) {
					this.showdbInit = false
				}
			}
		}
	}
</script>

<style scoped>
	@import '@/styles/admin-page.scss';
	@import '@/common/admin-refactor.scss';
	.dash-page { padding-top: 0; }
	.hero-card { @include admin-card; padding: 22px; margin-bottom: 18px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
	.hero-title { display: block; font-size: 22px; font-weight: 600; color: #0f172a; }
	.hero-subtitle { display: block; margin-top: 8px; font-size: 13px; color: #94a3b8; }
	.hero-right { display: flex; align-items: center; gap: 10px; }
	.dash-meta { font-size: 12px; color: #94a3b8; }
	.refresh-btn { cursor: pointer; width: 34px; height: 34px; border-radius: 8px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e5ebf3; }
	.rotating { animation: dash-rotate 0.9s linear infinite; }
	@keyframes dash-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
	.dash-section { margin-bottom: 18px; }
	.stat-card { cursor: pointer; }
	.todo-grid { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
	.todo-card { @include admin-card; padding: 12px; cursor: pointer; min-height: 110px; }
	.todo-num { font-size: 26px; font-weight: 600; color: #0f172a; display: block; }
	.todo-title { display: block; margin-top: 6px; font-size: 14px; color: #334155; font-weight: 600; }
	.todo-desc { display: block; margin-top: 4px; font-size: 12px; color: #94a3b8; }
	.workbench-main { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 18px; }
	.overview-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
	.overview-card { border: 1px solid #e8edf4; border-radius: 10px; padding: 12px; background: #fff; }
	.panel-hd { font-size: 14px; font-weight: 600; color: #0f172a; margin-bottom: 8px; }
	.panel-line { display: flex; justify-content: space-between; font-size: 13px; color: #475569; padding: 5px 0; }
	.side-card { min-height: 150px; }
	.recent-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
	.recent-block { min-height: 260px; }
	.recent-sub { font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 10px; }
	.recent-line { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px; background: #f8fafc; border-radius: 8px; margin-bottom: 8px; cursor: pointer; }
	.recent-muted { font-size: 12px; color: #94a3b8; flex-shrink: 0; max-width: 55%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	@media screen and (max-width: 1200px) {
		.todo-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
		overview-grid { grid-template-columns: 1fr; }
	}
	@media screen and (max-width: 992px) {
		.hero-card { flex-direction: column; align-items: flex-start; }
		.workbench-main, .recent-grid { grid-template-columns: 1fr; }
		.todo-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
</style>
