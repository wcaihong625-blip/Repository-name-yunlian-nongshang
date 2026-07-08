<template>
  <view class="page-shell reconcile-page">
    <view class="page-header">
      <view>
        <view class="page-title">运营对账</view>
        <view class="page-subtitle">按月份与业务员维度查看运营摘要、异常项与快捷处理入口。</view>
      </view>
      <text class="header-month">当前月份：{{ queryMonth || '—' }}</text>
    </view>

    <view class="filter-card">
      <view class="toolbar-row bar">
        <picker mode="date" fields="month" :value="monthPicker" @change="onMonthChange">
          <view class="picker-box">{{ queryMonth || '选择月份' }}</view>
        </picker>
        <view class="sel">
          <uni-data-select :localdata="salesStaffSelectOptions" v-model="salesId" placeholder="业务员（编号/姓名，可选）" />
        </view>
        <button class="uni-button" type="primary" size="mini" @click="loadSummary">查询</button>
        <button class="uni-button" type="default" size="mini" @click="resetFilters">重置</button>
      </view>
    </view>

    <view v-if="loading" class="section-card muted pad">加载中…</view>
    <view v-else-if="errorMsg" class="section-card err pad">{{ errorMsg }}</view>
    <template v-else>
      <view class="section-card">
        <view class="section-title">本月运营摘要</view>
        <view class="stat-grid">
          <view class="stat-card"><text class="label">新增客户</text><text class="value">{{ summary.new_customer_count }}</text><text class="meta">客户增量</text></view>
          <view class="stat-card"><text class="label">会员订单（已支付）</text><text class="value">{{ summary.member_order_count }}</text><text class="meta">支付订单数</text></view>
          <view class="stat-card"><text class="label">首开单</text><text class="value">{{ summary.first_open_count }}</text><text class="meta">新增开通</text></view>
          <view class="stat-card"><text class="label">续费单</text><text class="value">{{ summary.renewal_count }}</text><text class="meta">续费表现</text></view>
          <view class="stat-card"><text class="label">未结算提成订单</text><text class="value warn">{{ summary.unsettled_order_count }}</text><text class="meta">需尽快处理</text></view>
          <view class="stat-card"><text class="label">已结算提成订单</text><text class="value ok">{{ summary.settled_order_count }}</text><text class="meta">已完成结算</text></view>
          <view class="stat-card"><text class="label">结算单份数</text><text class="value">{{ summary.settle_bill_count }}</text><text class="meta">本月结算单</text></view>
          <view class="stat-card"><text class="label">本月结算单提成合计</text><text class="value strong">¥{{ (summary.commission_amount_total || 0).toFixed(2) }}</text><text class="meta">提成总额</text></view>
        </view>
      </view>

      <view class="main-grid">
        <view>
          <view class="section-card">
            <view class="section-title">异常提醒（全库扫描）</view>
            <view class="alert-grid exc-grid">
              <view class="alert-card exc" v-for="(row, idx) in exceptionRows" :key="idx">
                <text class="exc-k">{{ row.label }}</text>
                <text :class="['exc-v', row.n > 0 ? 'bad' : '']">{{ row.n }}</text>
              </view>
            </view>
          </view>

          <view class="section-card">
            <view class="section-title">快速入口</view>
            <view class="quick-entry-grid">
              <view class="quick-entry-item" @click="goCustomers"><view class="entry-icon">客</view><text class="entry-title">客户列表</text><text class="entry-desc">总数 {{ quick.customer_total }}</text></view>
              <view class="quick-entry-item" @click="goOrders"><view class="entry-icon">单</view><text class="entry-title">订单列表</text><text class="entry-desc">总数 {{ quick.order_total }}</text></view>
              <view class="quick-entry-item" @click="goSettles"><view class="entry-icon">结</view><text class="entry-title">结算单列表</text><text class="entry-desc">查看月结详情</text></view>
              <view class="quick-entry-item" @click="goTransfers"><view class="entry-icon">审</view><text class="entry-title">转移审批</text><text class="entry-desc">待审 {{ quick.transfer_pending_total }}</text></view>
            </view>
            <view class="warning-links">
              <view class="warn-entry" @click="goOrdersException('commission_unsettled')">订单：有提成未结算</view>
              <view class="warn-entry" @click="goOrdersException('settled_missing_id')">订单：已结缺结算单ID</view>
              <view class="warn-entry" @click="goOrdersException('settled_missing_month')">订单：已结缺结算月</view>
            </view>
          </view>
        </view>

        <view>
          <view class="note-card">
            <view class="section-title">说明</view>
            <view class="muted footnote" v-if="metaNote">{{ metaNote }}</view>
            <view class="empty-state" v-else>
              <view class="empty-icon">i</view>
              <text>暂无额外说明</text>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script>
import { loadSalesStaffRowsForSelect, rowsToSalesStaffSelectOptions } from '@/utils/nxtSalesStaff.js'

function defaultMonth() {
  const d = new Date()
  const y = d.getFullYear()
  const m = d.getMonth() + 1
  return `${y}-${String(m).padStart(2, '0')}`
}

export default {
  data() {
    const m = defaultMonth()
    return {
      salesStaffSelectOptions: [],
      queryMonth: m,
      monthPicker: m,
      salesId: '',
      loading: false,
      errorMsg: '',
      summary: {},
      exceptions: {},
      quick: {},
      metaNote: ''
    }
  },
  computed: {
    exceptionRows() {
      const e = this.exceptions || {}
      return [
        { label: '缺首次业务员客户', n: e.customer_missing_first_sales },
        { label: '缺当前业务员客户', n: e.customer_missing_current_sales },
        { label: '缺来源渠道客户', n: e.customer_missing_source_channel },
        { label: '转移次数与已通过记录不一致', n: e.customer_transfer_count_mismatch },
        { label: '已通过转移与当前业务员不一致', n: e.customer_current_sales_mismatch },
        { label: '有提成金额但未结算订单', n: e.order_commission_unsettled },
        { label: '已结算但缺结算单ID', n: e.order_settled_missing_settle_id },
        { label: '已结算但缺结算月份', n: e.order_settled_missing_settle_month },
        { label: '多笔待审批转移（客户维度）', n: e.transfer_multi_pending },
        { label: '转移状态与客户档案不一致', n: e.transfer_status_inconsistent },
        { label: '已通过未同步当前业务员', n: e.transfer_approved_not_synced }
      ]
    }
  },
  async onLoad() {
    try {
      const rows = await loadSalesStaffRowsForSelect()
      this.salesStaffSelectOptions = rowsToSalesStaffSelectOptions(rows)
    } catch (e) {
      this.salesStaffSelectOptions = []
    }
    this.loadSummary()
  },
  methods: {
    authPayload() {
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      return { uniIdToken, token: uniIdToken }
    },
    onMonthChange(e) {
      this.queryMonth = e.detail.value
      this.monthPicker = e.detail.value
    },
    resetFilters() {
      const m = defaultMonth()
      this.queryMonth = m
      this.monthPicker = m
      this.salesId = ''
      this.loadSummary()
    },
    loadSummary() {
      this.loading = true
      this.errorMsg = ''
      const payload = {
        ...this.authPayload(),
        month: (this.queryMonth || '').trim() || defaultMonth()
      }
      const sid = (this.salesId || '').toString().trim()
      if (sid) payload.sales_id = sid
      uniCloud
        .callFunction({ name: 'getOperationReconcileSummary', data: payload })
        .then((res) => {
          this.loading = false
          const r = res.result
          if (r.code !== 200) {
            this.errorMsg = r.message || '加载失败'
            return
          }
          const d = r.data || {}
          this.summary = d.summary || {}
          this.exceptions = d.exceptions || {}
          this.quick = d.quick_links || {}
          this.metaNote = (d._meta && d._meta.note) || ''
        })
        .catch((err) => {
          this.loading = false
          this.errorMsg = err.message || '请求失败'
        })
    },
    goCustomers() {
      const sid = (this.salesId || '').toString().trim()
      const q = sid ? `?current_sales_id=${encodeURIComponent(sid)}` : ''
      uni.navigateTo({ url: `/pages/customer_profile/list${q}` })
    },
    goOrders() {
      const m = (this.queryMonth || '').trim()
      const sid = (this.salesId || '').toString().trim()
      let url = '/pages/member_order/list'
      const ps = []
      if (m) ps.push(`pay_month=${encodeURIComponent(m)}`)
      if (sid) ps.push(`sales_id=${encodeURIComponent(sid)}`)
      if (ps.length) url += '?' + ps.join('&')
      uni.navigateTo({ url })
    },
    goSettles() {
      const m = (this.queryMonth || '').trim()
      const sid = (this.salesId || '').toString().trim()
      let url = '/pages/sales_commission_settle/list'
      const ps = []
      if (m) ps.push(`settle_month=${encodeURIComponent(m)}`)
      if (sid) ps.push(`sales_id=${encodeURIComponent(sid)}`)
      if (ps.length) url += '?' + ps.join('&')
      uni.navigateTo({ url })
    },
    goTransfers() {
      uni.navigateTo({ url: '/pages/customer_transfer_apply/list?status=0' })
    },
    goOrdersException(type) {
      uni.navigateTo({
        url: `/pages/member_order/list?exception=${encodeURIComponent(type)}`
      })
    }
  }
}
</script>

<style scoped>
@import '@/styles/admin-page.scss';
.reconcile-page { max-width: 1200px; margin: 0 auto; }
.header-month { color: #94a3b8; font-size: 12px; }
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.picker-box {
  border: 1px solid #dcdfe6;
  padding: 6px 10px;
  border-radius: 8px;
  min-width: 110px;
  text-align: center;
  font-size: 13px;
}
.sel {
  width: 200px;
}
.stat-card .value.warn {
  color: #e6a23c;
}
.stat-card .value.ok {
  color: #67c23a;
}
.stat-card .value.strong {
  color: #e43d33;
}
.main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
.exc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.exc {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}
.exc-k {
  color: #606266;
  padding-right: 8px;
}
.exc-v {
  font-weight: 600;
}
.exc-v.bad {
  color: #f56c6c;
}
.warning-links { display: grid; gap: 8px; margin-top: 10px; }
.warn-entry { border: 1px solid #f5d2d2; background: #fff7f7; color: #b91c1c; border-radius: 8px; padding: 9px 12px; font-size: 13px; cursor: pointer; }
.muted {
  color: #909399;
  font-size: 12px;
}
.pad {
  padding: 16px;
}
.err {
  color: #f56c6c;
}
.footnote {
  margin-top: 0;
  line-height: 1.5;
}
@media screen and (max-width: 992px) {
  .main-grid { grid-template-columns: 1fr; }
  .exc-grid { grid-template-columns: 1fr; }
}
</style>
