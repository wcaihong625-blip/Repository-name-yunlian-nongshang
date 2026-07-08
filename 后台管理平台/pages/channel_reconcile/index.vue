<template>
  <view class="wrap">
    <view class="uni-header">
      <view class="bar">
        <picker mode="date" fields="month" :value="monthPicker" @change="onMonthChange">
          <view class="picker-box">{{ queryMonth || '选择月份' }}</view>
        </picker>
        <view class="sel">
          <uni-data-select
            :localdata="salesStaffSelectOptions"
            v-model="salesId"
            placeholder="业务员（编号/姓名，可选）"
          />
        </view>
        <input class="uni-search" v-model="channelIdInput" placeholder="渠道ID（可选）" />
        <input class="uni-search" v-model="inviteInput" placeholder="邀请码（可选）" />
        <button class="uni-button" type="primary" size="mini" @click="load">查询</button>
        <button class="uni-button" type="default" size="mini" @click="reset">重置</button>
      </view>
    </view>

    <view v-if="loading" class="muted pad">加载中…</view>
    <view v-else-if="errorMsg" class="err pad">{{ errorMsg }}</view>
    <template v-else>
      <view class="sec-title">统计摘要（已支付，按支付时间落在所选月）</view>
      <view class="cards">
        <view class="card"><text class="k">订单总数</text><text class="v">{{ summary.order_total }}</text></view>
        <view class="card"><text class="k">首开单</text><text class="v">{{ summary.first_open_count }}</text></view>
        <view class="card"><text class="k">续费单</text><text class="v">{{ summary.renewal_count }}</text></view>
        <view class="card warn"><text class="k">空渠道</text><text class="v">{{ summary.empty_channel_count }}</text></view>
        <view class="card warn"><text class="k">空邀请码</text><text class="v">{{ summary.empty_invite_count }}</text></view>
        <view class="card bad"><text class="k">重复首开风险客户数</text><text class="v">{{ summary.multi_first_open_customer_count }}</text></view>
      </view>
      <view class="hint muted">说明：「重复首开风险」指同一客户在同一自然月内存在多笔首开订单（order_type=1），需人工核对是否数据异常。</view>

      <view class="sec-title">渠道 + 邀请码聚合（Top 按订单数）</view>
      <view class="table-wrap">
        <uni-table border stripe emptyText="无数据">
          <uni-tr>
            <uni-th width="120">渠道ID</uni-th>
            <uni-th width="100">渠道名称</uni-th>
            <uni-th width="100">邀请码</uni-th>
            <uni-th width="70" align="center">首开</uni-th>
            <uni-th width="70" align="center">续费</uni-th>
            <uni-th width="70" align="center">合计</uni-th>
            <uni-th width="90" align="center">提成合计</uni-th>
            <uni-th width="140">最近支付</uni-th>
          </uni-tr>
          <uni-tr v-for="(g, idx) in groups" :key="idx">
            <uni-td><text class="mono tiny">{{ g.channel_id || '（空）' }}</text></uni-td>
            <uni-td>{{ g.channel_name || '—' }}</uni-td>
            <uni-td><text class="mono">{{ g.invite_code || '（空）' }}</text></uni-td>
            <uni-td align="center">{{ g.first_open }}</uni-td>
            <uni-td align="center">{{ g.renewal }}</uni-td>
            <uni-td align="center">{{ g.order_total }}</uni-td>
            <uni-td align="center">￥{{ (g.commission_total || 0).toFixed(2) }}</uni-td>
            <uni-td><uni-dateformat v-if="g.last_pay_time" :date="g.last_pay_time" /><text v-else>—</text></uni-td>
          </uni-tr>
        </uni-table>
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
      channelIdInput: '',
      inviteInput: '',
      loading: false,
      errorMsg: '',
      summary: {
        order_total: 0,
        first_open_count: 0,
        renewal_count: 0,
        empty_channel_count: 0,
        empty_invite_count: 0,
        multi_first_open_customer_count: 0
      },
      groups: []
    }
  },
  async onLoad() {
    try {
      const rows = await loadSalesStaffRowsForSelect()
      this.salesStaffSelectOptions = rowsToSalesStaffSelectOptions(rows)
    } catch (e) {
      this.salesStaffSelectOptions = []
    }
    this.load()
  },
  methods: {
    onMonthChange(e) {
      const v = (e.detail && e.detail.value) || ''
      if (v) {
        this.monthPicker = v
        this.queryMonth = v
      }
    },
    reset() {
      const m = defaultMonth()
      this.queryMonth = m
      this.monthPicker = m
      this.salesId = ''
      this.channelIdInput = ''
      this.inviteInput = ''
      this.load()
    },
    async load() {
      this.loading = true
      this.errorMsg = ''
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      try {
        const res = await uniCloud.callFunction({
          name: 'getChannelReconcileSummary',
          data: {
            uniIdToken,
            token: uniIdToken,
            month: this.queryMonth,
            sales_id: this.salesId ? String(this.salesId).trim() : '',
            channel_id: (this.channelIdInput || '').trim(),
            invite_code: (this.inviteInput || '').trim()
          }
        })
        const body = res.result || {}
        if (body.code !== 200) {
          this.errorMsg = body.message || '加载失败'
          return
        }
        const d = body.data || {}
        this.summary = d.summary || this.summary
        this.groups = d.groups || []
      } catch (e) {
        this.errorMsg = e.message || '请求异常'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.wrap {
  padding-bottom: 24px;
}
.bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.picker-box {
  padding: 6px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 13px;
  min-width: 120px;
}
.sel {
  width: 200px;
}
.uni-search {
  width: 140px;
  height: 32px;
  padding: 0 8px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  font-size: 13px;
}
.sec-title {
  font-weight: 600;
  font-size: 15px;
  margin: 16px 12px 10px;
  color: #303133;
}
.cards {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0 12px;
}
.card {
  min-width: 120px;
  padding: 10px 12px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.card.warn {
  border-color: #fde2e2;
}
.card.bad {
  border-color: #fbc4c4;
}
.card .k {
  font-size: 12px;
  color: #909399;
}
.card .v {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
}
.hint {
  padding: 8px 12px 0;
  font-size: 12px;
  line-height: 1.5;
}
.table-wrap {
  padding: 0 12px;
}
.pad {
  padding: 16px;
}
.muted {
  color: #909399;
}
.err {
  color: #f56c6c;
}
.mono {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}
.mono.tiny {
  font-size: 11px;
}
</style>
