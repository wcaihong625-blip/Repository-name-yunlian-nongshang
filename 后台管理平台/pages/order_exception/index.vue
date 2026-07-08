<template>
  <view class="page-shell">
    <view class="page-header">
      <view>
        <view class="page-title">异常订单处理</view>
        <view class="page-subtitle">聚焦对账异常订单并跟踪处理闭环。</view>
      </view>
    </view>
    <view class="filter-card filter-panel">
      <view class="filter-grid">
        <view class="filter-item fi-exception">
          <uni-data-select v-model="query.exception_type" :localdata="exceptionTypeOptions" placeholder="异常类型" />
        </view>
        <view class="filter-item fi-handle">
          <uni-data-select v-model="query.handle_status" :localdata="handleStatusOptions" placeholder="处理状态" />
        </view>
        <view class="filter-item fi-otype">
          <uni-data-select v-model="query.order_type" :localdata="orderTypeOptions" placeholder="订单类型" />
        </view>
        <view class="filter-item fi-comm">
          <uni-data-select
            v-model="query.commission_status"
            :localdata="commissionStatusOptions"
            placeholder="提成结算"
          />
        </view>
        <view class="filter-item fi-month">
          <picker mode="date" fields="month" :value="monthPicker" @change="onMonthChange">
            <view class="picker-box" :title="query.month || '支付月份（可选）'">
              {{ query.month || '支付月份（可选）' }}
            </view>
          </picker>
        </view>
        <view class="filter-item fi-sales">
          <uni-data-select
            :localdata="salesStaffSelectOptions"
            v-model="query.sales_id"
            placeholder="业务员（编号/姓名，可选）"
          />
        </view>
        <view class="filter-item fi-channel">
          <input
            class="filter-input"
            v-model="query.channel_id"
            placeholder="渠道ID（可选）"
            :title="query.channel_id || ''"
          />
        </view>
      </view>
      <view class="filter-actions">
        <button class="uni-button" type="primary" size="mini" @click="reload">查询</button>
        <button class="uni-button" type="default" size="mini" @click="reset">重置</button>
        <button class="uni-button" type="warn" size="mini" @click="exportCsv">导出当前清单</button>
      </view>
    </view>

    <view v-if="loading" class="section-card muted pad">加载中…</view>
    <view v-else-if="errMsg" class="section-card err pad">{{ errMsg }}</view>
    <template v-else>
      <view class="muted pad-sm">共 {{ total }} 条（仅含至少命中一种对账异常的订单）</view>
      <view class="table-card table-wrap">
        <uni-table border stripe emptyText="暂无数据">
          <uni-tr>
            <uni-th width="110">订单号</uni-th>
            <uni-th width="72">客户姓名</uni-th>
            <uni-th width="96">手机号</uni-th>
            <uni-th width="52">类型</uni-th>
            <uni-th width="120">支付时间</uni-th>
            <uni-th width="64">支付额</uni-th>
            <uni-th width="64">提成</uni-th>
            <uni-th width="128">异常类型</uni-th>
            <uni-th width="64">处理状态</uni-th>
            <uni-th width="180">处理摘要</uni-th>
            <uni-th width="64">跟进人</uni-th>
            <uni-th width="108">处理时间</uni-th>
            <uni-th width="72">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(row, idx) in list" :key="row._id || idx">
            <uni-td>{{ row.order_no }}</uni-td>
            <uni-td>{{ row.customer_name || '—' }}</uni-td>
            <uni-td>{{ row.mobile || '—' }}</uni-td>
            <uni-td>{{ row.order_type_text }}</uni-td>
            <uni-td><uni-dateformat v-if="row.pay_time" :date="row.pay_time" /><text v-else>—</text></uni-td>
            <uni-td>￥{{ row.pay_amount }}</uni-td>
            <uni-td>￥{{ row.commission_amount }}</uni-td>
            <uni-td>
              <text class="small">{{ row.exception_type_text }}</text>
              <text v-if="repairHint(row)" class="fix-hint">{{ repairHint(row) }}</text>
            </uni-td>
            <uni-td>{{ row.handle_status_text }}</uni-td>
            <uni-td>
              <view class="sum-cell" :title="summaryTitle(row)">
                <text class="sum-main ellipsis">{{ displaySummary(row) }}</text>
                <text v-if="row.latest_exception_remark" class="sum-sub ellipsis">异：{{ row.latest_exception_remark }}</text>
              </view>
            </uni-td>
            <uni-td><text class="small">{{ row.followup_name || '—' }}</text></uni-td>
            <uni-td><uni-dateformat v-if="row.handled_at" :date="row.handled_at" /><text v-else>—</text></uni-td>
            <uni-td>
              <button class="uni-button" size="mini" type="primary" plain @click="goDetail(row._id)">详情</button>
            </uni-td>
          </uni-tr>
        </uni-table>
      </view>
      <view class="uni-pagination-box">
        <uni-pagination show-icon :page-size="pageSize" v-model="page" :total="total" @change="onPageChange" />
      </view>
    </template>
  </view>
</template>

<script>
import { loadSalesStaffRowsForSelect, rowsToSalesStaffSelectOptions } from '@/utils/nxtSalesStaff.js'

function defaultMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default {
  data() {
    const m = defaultMonth()
    return {
      salesStaffSelectOptions: [],
      query: {
        exception_type: '',
        handle_status: 'open',
        order_type: '',
        commission_status: '',
        month: '',
        sales_id: '',
        channel_id: ''
      },
      monthPicker: m,
      exceptionTypeOptions: [
        { value: '', text: '全部异常类型' },
        { value: 'commission_unsettled', text: '有提成金额但未结算' },
        { value: 'settled_missing_id', text: '已结算但缺结算单ID' },
        { value: 'settled_missing_month', text: '已结算但缺结算月份' },
        { value: 'missing_customer_id', text: '已支付但缺客户ID' },
        { value: 'missing_customer_name', text: '已支付但缺客户姓名' },
        { value: 'missing_sales', text: '已支付但缺业务员信息' },
        { value: 'invalid_order_type', text: '已支付但订单类型无效' }
      ],
      handleStatusOptions: [
        { value: '', text: '全部状态' },
        { value: 'open', text: '未关闭（待处理+跟进中）' },
        { value: 'pending', text: '待处理' },
        { value: 'processing', text: '跟进中' },
        { value: 'done', text: '已处理' },
        { value: 'closed', text: '已关闭' }
      ],
      orderTypeOptions: [
        { value: '', text: '全部订单类型' },
        { value: 1, text: '首开' },
        { value: 2, text: '续费' }
      ],
      commissionStatusOptions: [
        { value: '', text: '全部提成状态' },
        { value: 0, text: '未结算' },
        { value: 1, text: '已结算' }
      ],
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
      loading: false,
      errMsg: ''
    }
  },
  async onLoad(e) {
    try {
      const rows = await loadSalesStaffRowsForSelect()
      this.salesStaffSelectOptions = rowsToSalesStaffSelectOptions(rows)
    } catch (e) {
      this.salesStaffSelectOptions = []
    }
    if (e && e.exception_type) {
      this.query.exception_type = decodeURIComponent(String(e.exception_type)).trim()
    }
    if (e && e.handle_status) {
      this.query.handle_status = decodeURIComponent(String(e.handle_status)).trim()
    }
    this.reload()
  },
  methods: {
    displaySummary(row) {
      const s = (row && row.latest_handle_summary) || ''
      return s.trim() ? s : '—'
    },
    summaryTitle(row) {
      const parts = []
      if (row && row.latest_handle_summary) parts.push(row.latest_handle_summary)
      if (row && row.latest_remark_summary && row.latest_remark_summary !== row.latest_handle_summary) {
        parts.push('备注摘要：' + row.latest_remark_summary)
      }
      if (row && row.latest_exception_remark) parts.push('异常备注：' + row.latest_exception_remark)
      return parts.join('\n') || ''
    },
    repairHint(row) {
      if (!row || !row.customer_id) return ''
      const parts = []
      const noName = !(row.customer_name && String(row.customer_name).trim())
      const noMobile = !(row.mobile && String(row.mobile).trim())
      if (noName) parts.push('姓名')
      if (noMobile) parts.push('手机')
      if (!parts.length) return ''
      return `· 档案可回填${parts.join('/')}（点详情）`
    },
    onMonthChange(e) {
      const v = (e.detail && e.detail.value) || ''
      this.monthPicker = v
      this.query.month = v
    },
    reset() {
      const m = defaultMonth()
      this.monthPicker = m
      this.query = {
        exception_type: '',
        handle_status: 'open',
        order_type: '',
        commission_status: '',
        month: '',
        sales_id: '',
        channel_id: ''
      }
      this.page = 1
      this.reload()
    },
    onPageChange(e) {
      this.page = e.current
      this.fetchList()
    },
    reload() {
      this.page = 1
      this.fetchList()
    },
    buildPayload() {
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      return {
        uniIdToken,
        token: uniIdToken,
        page: this.page,
        pageSize: this.pageSize,
        exception_type: (this.query.exception_type || '').trim(),
        handle_status: (this.query.handle_status || '').trim(),
        order_type: this.query.order_type === '' || this.query.order_type === null ? '' : this.query.order_type,
        commission_status:
          this.query.commission_status === '' || this.query.commission_status === null
            ? ''
            : this.query.commission_status,
        month: (this.query.month || '').trim(),
        sales_id: this.query.sales_id ? String(this.query.sales_id).trim() : '',
        channel_id: (this.query.channel_id || '').trim()
      }
    },
    async fetchList() {
      this.loading = true
      this.errMsg = ''
      try {
        const res = await uniCloud.callFunction({
          name: 'getOrderExceptionList',
          data: this.buildPayload()
        })
        const body = res.result || {}
        if (body.code !== 200) {
          this.errMsg = body.message || '加载失败'
          this.list = []
          this.total = 0
          return
        }
        const d = body.data || {}
        this.list = d.list || []
        this.total = d.total || 0
      } catch (e) {
        this.errMsg = e.message || '请求异常'
        this.list = []
        this.total = 0
      } finally {
        this.loading = false
      }
    },
    goDetail(id) {
      if (!id) return
      uni.navigateTo({ url: `/pages/member_order/detail?id=${encodeURIComponent(id)}` })
    },
    async exportCsv() {
      uni.showLoading({ title: '导出中…', mask: true })
      try {
        const p = this.buildPayload()
        delete p.page
        delete p.pageSize
        const res = await uniCloud.callFunction({
          name: 'exportOrderExceptionData',
          data: p
        })
        const body = res.result || {}
        uni.hideLoading()
        if (body.code !== 200) {
          uni.showModal({ content: body.message || '导出失败', showCancel: false })
          return
        }
        const data = body.data || {}
        if (!data.list || !data.list.length) {
          uni.showToast({ title: '无数据可导出', icon: 'none' })
          return
        }
        if (data.truncated) {
          uni.showToast({ title: '数据过多已截断前1.2万条', icon: 'none' })
        }
        let csvString = '\uFEFF' + data.headers_zh.join(',') + '\n'
        data.list.forEach((item) => {
          const row = data.headers.map((header) => {
            let val = item[header]
            if (val === undefined || val === null) val = ''
            val = String(val).replace(/"/g, '""')
            return `"${val}"`
          })
          csvString += row.join(',') + '\n'
        })
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' })
        const url = window.URL || window.webkitURL
        const downloadUrl = url.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = `异常订单处理清单_${new Date().getTime()}.csv`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        url.revokeObjectURL(downloadUrl)
        uni.showToast({ title: '导出成功', icon: 'success' })
      } catch (e) {
        uni.hideLoading()
        uni.showModal({ content: e.message || '导出异常', showCancel: false })
      }
    }
  }
}
</script>

<style scoped>
@import '@/styles/admin-page.scss';
.page-shell {
  padding-bottom: 24px;
}
/* 覆盖全局 .uni-header 的横向 flex，避免与筛选区并排挤压；下拉层不能被父级裁剪 */
.filter-panel.uni-header {
  display: block;
  min-height: auto;
  align-items: stretch;
  justify-content: flex-start;
  overflow: visible;
}
.filter-panel {
  padding: 0;
  overflow: visible;
}
.filter-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 12px;
  align-items: flex-start;
  margin-bottom: 12px;
  overflow: visible;
}
.filter-item {
  min-height: 36px;
  box-sizing: border-box;
  /* 禁止 overflow:hidden：会裁剪 uni-data-select 下拉层并导致无法点选 */
  overflow: visible;
}
.fi-exception {
  min-width: 200px;
  flex: 1 1 200px;
}
.fi-handle {
  min-width: 160px;
  flex: 1 1 160px;
}
.fi-otype,
.fi-comm {
  min-width: 140px;
  flex: 0 1 140px;
}
.fi-month {
  min-width: 168px;
  flex: 0 1 168px;
}
.fi-sales {
  min-width: 160px;
  flex: 1 1 160px;
}
.fi-channel {
  min-width: 168px;
  flex: 1 1 168px;
}
.picker-box {
  min-height: 36px;
  line-height: 36px;
  padding: 0 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
  box-sizing: border-box;
  background: #fff;
}
.filter-input {
  width: 100%;
  min-width: 0;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 13px;
  box-sizing: border-box;
  background: #fff;
}
.filter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  overflow: visible;
}
.table-wrap { padding: 0; }
.small {
  font-size: 11px;
  line-height: 1.35;
  display: block;
}
.fix-hint {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #67c23a;
}
.sum-cell {
  max-width: 176px;
  text-align: left;
}
.sum-main {
  display: block;
  font-size: 12px;
  color: #303133;
  line-height: 1.4;
}
.sum-sub {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #e6a23c;
  line-height: 1.35;
}
.ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pad {
  padding: 16px;
}
.pad-sm {
  padding: 4px 12px;
}
.muted {
  color: #909399;
}
.err {
  color: #f56c6c;
}
</style>
