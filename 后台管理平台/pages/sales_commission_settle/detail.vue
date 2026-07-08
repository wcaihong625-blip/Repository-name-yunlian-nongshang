<template>
  <view class="page-shell settle-detail-page">
    <view v-if="loading" class="section-card">
      <view class="page-feedback muted">加载中…</view>
    </view>
    <view v-else-if="errorMsg" class="section-card">
      <view class="page-feedback err">{{ errorMsg }}</view>
    </view>
    <template v-else-if="settle">
      <view class="page-header">
        <view>
          <view class="page-title">提成结算单详情</view>
          <view class="page-subtitle">查看月结单摘要、对账自检结果、关联订单与导出明细</view>
        </view>
        <view class="header-meta">
          <text class="status-tag" :class="Number(settle.settle_status) === 1 ? 'status-tag--success' : 'status-tag--warn'">{{ settle.settle_status_text || '—' }}</text>
          <view class="meta-line">
            <text class="meta-key">结算月份</text>
            <text class="meta-val">{{ settle.settle_month || '—' }}</text>
          </view>
          <view class="meta-line">
            <text class="meta-key">业务员</text>
            <text class="meta-val">{{ settle.sales_name || '—' }}</text>
          </view>
          <view class="meta-line">
            <text class="meta-key">已结 / 未结</text>
            <text class="meta-val amount-text">¥{{ (settle.commission_paid || 0).toFixed(2) }} / ¥{{ (settle.commission_unpaid || 0).toFixed(2) }}</text>
          </view>
        </view>
      </view>

      <view class="summary-card">
        <view class="summary-grid">
          <view class="summary-item">
            <text class="summary-label">结算月份</text>
            <text class="summary-value">{{ settle.settle_month || '—' }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">业务员</text>
            <text class="summary-value">{{ settle.sales_name || '—' }}</text>
            <text class="summary-sub">编号 {{ settle.sales_code || '—' }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">订单总数</text>
            <text class="summary-value">{{ settle.order_count || 0 }}</text>
            <text class="summary-sub">order_ids {{ settle.order_ids_length || 0 }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">提成总额</text>
            <text class="summary-value amount-highlight">¥{{ (settle.commission_total || 0).toFixed(2) }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">已结 / 未结</text>
            <text class="summary-value">¥{{ (settle.commission_paid || 0).toFixed(2) }} / ¥{{ (settle.commission_unpaid || 0).toFixed(2) }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">结算状态</text>
            <text class="status-tag" :class="Number(settle.settle_status) === 1 ? 'status-tag--success' : 'status-tag--warn'">{{ settle.settle_status_text || '—' }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">确认结算时间</text>
            <text class="summary-value">{{ settle.settled_at_text || '—' }}</text>
          </view>
          <view class="summary-item">
            <text class="summary-label">结算单ID</text>
            <text class="summary-value mono-text">{{ settle._id || '—' }}</text>
          </view>
        </view>
      </view>

      <view class="two-column-main">
        <view class="left-column">
          <view class="section-card">
            <view class="section-title">结算单概要</view>
            <view class="detail-grid">
              <view class="info-pair">
                <text class="info-label">结算月份</text>
                <text class="info-value">{{ settle.settle_month || '—' }}</text>
              </view>
              <view class="info-pair">
                <text class="info-label">结算状态</text>
                <text class="status-tag" :class="Number(settle.settle_status) === 1 ? 'status-tag--success' : 'status-tag--warn'">{{ settle.settle_status_text || '—' }}</text>
              </view>
              <view class="info-pair">
                <text class="info-label">业务员</text>
                <view class="info-stack">
                  <text class="info-value">{{ settle.sales_name || '—' }}</text>
                  <text class="info-sub">编号 {{ settle.sales_code || '—' }}</text>
                  <text class="info-sub mono-text">内部ID {{ settle.sales_id || '—' }}</text>
                </view>
              </view>
              <view class="info-pair">
                <text class="info-label">订单总数</text>
                <text class="info-value">{{ settle.order_count || 0 }}（本单 order_ids：{{ settle.order_ids_length || 0 }}）</text>
              </view>
              <view class="info-pair">
                <text class="info-label">提成总额</text>
                <text class="info-value amount-highlight">¥{{ (settle.commission_total || 0).toFixed(2) }}</text>
              </view>
              <view class="info-pair">
                <text class="info-label">已结 / 未结</text>
                <text class="info-value">¥{{ (settle.commission_paid || 0).toFixed(2) }} / ¥{{ (settle.commission_unpaid || 0).toFixed(2) }}</text>
              </view>
              <view class="info-pair">
                <text class="info-label">确认结算时间</text>
                <text class="info-value">{{ settle.settled_at_text || '—' }}</text>
              </view>
              <view class="info-pair">
                <text class="info-label">创建时间</text>
                <text class="info-value">{{ settle.created_at_text || '—' }}</text>
              </view>
              <view class="info-pair detail-grid-full">
                <text class="info-label">结算单ID</text>
                <text class="info-value mono-text">{{ settle._id || '—' }}</text>
              </view>
              <view class="info-pair detail-grid-full" v-if="settle.remark">
                <text class="info-label">备注</text>
                <text class="info-sub">{{ settle.remark }}</text>
              </view>
            </view>
          </view>

          <view class="section-card">
            <view class="section-head">
              <view class="section-title">本单包含订单</view>
              <view class="section-subtitle">与生成结算单时 order_ids 一致</view>
            </view>
            <view class="table-card order-table-wrap" v-if="orders.length">
              <uni-table :loading="false" border stripe emptyText="">
                <uni-tr>
                  <uni-th align="center" width="160">订单ID</uni-th>
                  <uni-th align="center" width="120">订单号</uni-th>
                  <uni-th align="center" width="120">客户ID</uni-th>
                  <uni-th align="center" width="100">客户姓名</uni-th>
                  <uni-th align="center" width="100">手机号</uni-th>
                  <uni-th align="center" width="100">提成业务员编号</uni-th>
                  <uni-th align="center" width="70">类型</uni-th>
                  <uni-th align="center" width="130">支付时间</uni-th>
                  <uni-th align="center" width="80">支付金额</uni-th>
                  <uni-th align="center" width="80">提成</uni-th>
                  <uni-th align="center" width="90">提成类型</uni-th>
                  <uni-th align="center" width="80">提成状态</uni-th>
                  <uni-th align="center" width="100">结算单ID</uni-th>
                  <uni-th align="center" width="80">结算月</uni-th>
                  <uni-th align="center" width="90">操作</uni-th>
                </uni-tr>
                <uni-tr v-for="(o, idx) in orders" :key="idx">
                  <uni-td align="center"><text class="mono-text">{{ o._id }}</text></uni-td>
                  <uni-td align="center">{{ o.order_no || '—' }}</uni-td>
                  <uni-td align="center"><text class="mono-text">{{ o.customer_id || '—' }}</text></uni-td>
                  <uni-td align="center">{{ o.customer_name || '—' }}</uni-td>
                  <uni-td align="center">{{ o.mobile || '—' }}</uni-td>
                  <uni-td align="center">{{ o.sales_staff_code || '—' }}</uni-td>
                  <uni-td align="center">{{ o.order_type_text }}</uni-td>
                  <uni-td align="center">{{ o.pay_time_text || '—' }}</uni-td>
                  <uni-td align="center">¥{{ (o.pay_amount || 0).toFixed(2) }}</uni-td>
                  <uni-td align="center">¥{{ (o.commission_amount || 0).toFixed(2) }}</uni-td>
                  <uni-td align="center">{{ o.commission_type_text }}</uni-td>
                  <uni-td align="center">{{ o.commission_status_text }}</uni-td>
                  <uni-td align="center"><text class="mono-text">{{ o.commission_settlement_id || '—' }}</text></uni-td>
                  <uni-td align="center">{{ o.commission_settlement_month || '—' }}</uni-td>
                  <uni-td align="center">
                    <button v-if="o.customer_id" class="uni-button" size="mini" type="default" @click="goCustomer(o.customer_id)">客户</button>
                    <text v-else class="text-muted">—</text>
                  </uni-td>
                </uni-tr>
              </uni-table>
            </view>
            <view v-else class="empty-state">
              <view class="empty-icon">!</view>
              <view>暂无订单数据（可能 order_ids 为空或订单已删除）</view>
              <view class="empty-tip">可先核对结算单记录的订单 ID 是否仍有效。</view>
            </view>
          </view>
        </view>

        <view class="right-column">
          <view class="section-card audit-card" v-if="reconcileAudit">
            <view class="section-title">对账自检（基于本页明细）</view>
            <view class="audit-metric-list">
              <view class="audit-row">
                <text class="audit-label">主档提成总额</text>
                <text class="audit-value">¥{{ reconcileAudit.masterTotal.toFixed(2) }}</text>
              </view>
              <view class="audit-row">
                <text class="audit-label">明细提成合计</text>
                <text class="audit-value">¥{{ reconcileAudit.detailSum.toFixed(2) }}</text>
              </view>
              <view class="audit-row">
                <text class="audit-label">总额是否一致</text>
                <text class="audit-value" :class="reconcileAudit.amountConsistent ? 'audit-ok' : 'audit-bad'">{{ reconcileAudit.amountLabel }}</text>
              </view>
              <view class="audit-row">
                <text class="audit-label">明细订单条数</text>
                <text class="audit-value">{{ reconcileAudit.detailCount }}</text>
              </view>
              <view class="audit-row">
                <text class="audit-label">明细中已结算 / 未结算</text>
                <text class="audit-value">
                  <text :class="reconcileAudit.settledCount === reconcileAudit.detailCount ? 'audit-ok' : 'audit-warn'">{{ reconcileAudit.settledCount }}</text>
                  /
                  <text :class="reconcileAudit.unsettledCount === 0 ? 'audit-ok' : 'audit-bad'">{{ reconcileAudit.unsettledCount }}</text>
                </text>
              </view>
              <view class="audit-row">
                <text class="audit-label">结算单 ID 不一致</text>
                <text class="audit-value" :class="reconcileAudit.idMismatch ? 'audit-bad' : 'audit-ok'">{{ reconcileAudit.idMismatch ? '存在' : '无' }}</text>
              </view>
              <view class="audit-row">
                <text class="audit-label">结算月份不一致</text>
                <text class="audit-value" :class="reconcileAudit.monthMismatch ? 'audit-bad' : 'audit-ok'">{{ reconcileAudit.monthMismatch ? '存在' : '无' }}</text>
              </view>
              <view class="audit-row audit-row-strong">
                <text class="audit-label">综合结论</text>
                <text class="audit-value" :class="reconcileAudit.overall === '正常' ? 'audit-ok' : 'audit-bad'">{{ reconcileAudit.overall }}</text>
              </view>
            </view>
          </view>

          <view class="section-card alert-card" v-if="ordersHint">
            <view class="section-title">异常提示</view>
            <view class="alert-text">{{ ordersHint }}</view>
          </view>

          <view class="section-card action-card">
            <view class="section-title">导出明细</view>
            <view class="action-desc">导出当前结算单关联订单明细为 CSV 文件</view>
            <button class="uni-button" type="warn" size="mini" @click="exportDetail">导出明细（CSV）</button>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script>
  export default {
    data() {
      return {
        settleId: '',
        loading: true,
        errorMsg: '',
        settle: null,
        orders: [],
        ordersHint: ''
      }
    },
    onLoad(e) {
      this.settleId = (e && (e.id || e.settle_id)) ? String(e.id || e.settle_id).trim() : ''
      if (!this.settleId) {
        this.loading = false
        this.errorMsg = '缺少结算单参数'
        return
      }
      this.loadDetail()
    },
    computed: {
      reconcileAudit() {
        if (!this.settle) return null
        const settle = this.settle
        const orders = this.orders || []
        const master = Number(settle.commission_total) || 0
        let detailSum = 0
        let settledCnt = 0
        let unsettledCnt = 0
        let idMismatch = false
        let monthMismatch = false
        const settleId = settle._id || ''
        const settleMonth = (settle.settle_month || '').trim()
        for (const o of orders) {
          detailSum += Number(o.commission_amount) || 0
          if (Number(o.commission_status) === 1) settledCnt += 1
          else unsettledCnt += 1
          const oid = (o.commission_settlement_id || '').trim()
          if (Number(o.commission_status) === 1) {
            if (!oid || oid !== settleId) idMismatch = true
          }
          const om = (o.commission_settlement_month || '').trim()
          if (Number(o.commission_status) === 1 && settleMonth && om && om !== settleMonth) {
            monthMismatch = true
          }
        }
        const round2 = (x) => Math.round(x * 100) / 100
        const dSum = round2(detailSum)
        const mTot = round2(master)
        const amountConsistent = Math.abs(dSum - mTot) < 0.02
        const hasOrderAnomaly = unsettledCnt > 0 || idMismatch || monthMismatch
        const overall = !amountConsistent || hasOrderAnomaly ? '存在异常' : '正常'
        return {
          masterTotal: mTot,
          detailSum: dSum,
          amountConsistent,
          amountLabel: amountConsistent ? '一致' : '不一致',
          detailCount: orders.length,
          settledCount: settledCnt,
          unsettledCount: unsettledCnt,
          idMismatch,
          monthMismatch,
          overall
        }
      }
    },
    methods: {
      authPayload() {
        const uniIdToken = uni.getStorageSync('uni_id_token') || ''
        return { uniIdToken, token: uniIdToken }
      },
      commissionSettleCo() {
        return uniCloud.importObject('commissionSettleCo', { customUI: true })
      },
      loadDetail() {
        this.loading = true
        this.errorMsg = ''
        this.commissionSettleCo()
          .detail({
            ...this.authPayload(),
            settle_id: this.settleId
          })
          .then((r) => {
            this.loading = false
            if (r.code !== 200) {
              this.errorMsg = r.message || '加载失败'
              return
            }
            const d = r.data || {}
            this.settle = d.settle || null
            this.orders = d.orders || []
            if (d.orders_expected != null && d.orders_loaded != null && d.orders_expected !== d.orders_loaded) {
              this.ordersHint = `提示：结算单记录 ${d.orders_expected} 个订单 ID，实际加载到 ${d.orders_loaded} 条（部分订单可能已不存在）。`
            } else {
              this.ordersHint = ''
            }
          })
          .catch((err) => {
            this.loading = false
            this.errorMsg = err.message || '请求失败'
          })
      },
      formatSettleMonthForCsv(raw) {
        const s = String(raw || '').trim()
        if (!s) return ''
        if (/^\d{4}年\d{2}月$/.test(s)) return s
        const m = s.match(/^(\d{4})-(\d{1,2})(?:-\d{1,2})?/)
        if (m) {
          const y = m[1]
          const mo = parseInt(m[2], 10)
          if (mo >= 1 && mo <= 12) {
            const mm = mo < 10 ? `0${mo}` : String(mo)
            return `${y}年${mm}月`
          }
        }
        return `月份：${s}`
      },
      buildDetailCsvString(data) {
        let csvString = '\uFEFF' + data.headers_zh.join(',') + '\n'
        data.list.forEach((item) => {
          const row = data.headers.map((header) => {
            let val = item[header]
            if (val === undefined || val === null) val = ''
            if (header === 'settle_month' || header === 'commission_settlement_month') {
              val = this.formatSettleMonthForCsv(val)
            }
            val = String(val).replace(/"/g, '""')
            return `"${val}"`
          })
          csvString += row.join(',') + '\n'
        })
        return csvString
      },
      triggerCsvDownload(csvString, filename) {
        if (typeof window === 'undefined' || !window.Blob) {
          uni.showModal({
            content: '当前环境不支持浏览器下载，请在后台管理 H5 端导出。',
            showCancel: false
          })
          return false
        }
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8' })
        const urlApi = window.URL || window.webkitURL
        const downloadUrl = urlApi.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = downloadUrl
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        urlApi.revokeObjectURL(downloadUrl)
        return true
      },
      safeFilePart(s) {
        return String(s || '')
          .replace(/[/\\:*?"<>|\r\n]/g, '_')
          .slice(0, 40)
      },
      exportDetail() {
        if (!this.settleId) return
        uni.showLoading({ title: '导出中…', mask: true })
        this.commissionSettleCo()
          .exportDetail({
            ...this.authPayload(),
            settle_id: this.settleId
          })
          .then((res) => {
            uni.hideLoading()
            if (res.code !== 200) {
              uni.showModal({ content: res.message || '导出失败', showCancel: false })
              return
            }
            const data = res.data
            if (!data.list || data.list.length === 0) {
              uni.showToast({ title: '该结算单无订单明细', icon: 'none' })
              return
            }
            const csvString = this.buildDetailCsvString(data)
            const fn = `提成月结明细_详情页_${this.safeFilePart(data.settle_month)}_${this.safeFilePart(data.sales_name)}_${this.safeFilePart(this.settleId)}.csv`
            if (this.triggerCsvDownload(csvString, fn)) {
              uni.showToast({ title: '导出成功', icon: 'success' })
            }
          })
          .catch((err) => {
            uni.hideLoading()
            uni.showModal({ content: err.message || '导出失败', showCancel: false })
          })
      },
      goCustomer(customerId) {
        if (!customerId) return
        uni.navigateTo({
          url: `/pages/customer_profile/edit?id=${encodeURIComponent(customerId)}`
        })
      }
    }
  }
</script>

<style scoped lang="scss">
@import '@/styles/admin-page.scss';

.settle-detail-page {
  .page-feedback {
    padding: 6px 0;
  }

  .muted {
    color: #94a3b8;
  }

  .err {
    color: #dc2626;
  }

  .header-meta {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px 14px;
    max-width: 480px;
  }

  .meta-line {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    color: #64748b;
  }

  .meta-key {
    color: #94a3b8;
  }

  .meta-val {
    color: #334155;
    font-weight: 600;
  }

  .amount-text {
    color: #0f172a;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
  }

  .summary-item {
    padding: 12px;
    border: 1px solid #e7edf5;
    border-radius: 10px;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .summary-label {
    font-size: 12px;
    color: #94a3b8;
  }

  .summary-value {
    font-size: 16px;
    line-height: 1.4;
    color: #0f172a;
    font-weight: 600;
    word-break: break-all;
  }

  .summary-sub {
    font-size: 12px;
    color: #64748b;
  }

  .two-column-main {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: 18px;
    align-items: start;
  }

  .left-column,
  .right-column {
    min-width: 0;
  }

  .section-head {
    margin-bottom: 12px;
  }

  .section-subtitle {
    margin-top: 4px;
    font-size: 12px;
    color: #94a3b8;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .detail-grid-full {
    grid-column: 1 / -1;
  }

  .info-pair {
    padding: 10px 12px;
    border: 1px solid #edf2f7;
    border-radius: 10px;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .info-label {
    font-size: 12px;
    color: #94a3b8;
  }

  .info-value {
    font-size: 14px;
    color: #0f172a;
    font-weight: 600;
    line-height: 1.45;
    word-break: break-all;
  }

  .info-sub {
    font-size: 12px;
    color: #64748b;
    line-height: 1.45;
  }

  .info-stack {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .amount-highlight {
    color: #b91c1c;
  }

  .mono-text {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
    font-size: 12px;
    word-break: break-all;
  }

  .order-table-wrap {
    margin-bottom: 0;
    overflow-x: auto;
  }

  .text-muted {
    color: #94a3b8;
  }

  .audit-card {
    border-color: #e2e8f0;
  }

  .audit-metric-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .audit-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px dashed #edf2f7;
    font-size: 13px;
  }

  .audit-row:last-child {
    border-bottom: none;
  }

  .audit-row-strong {
    margin-top: 4px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    border-bottom: none;
  }

  .audit-label {
    color: #64748b;
  }

  .audit-value {
    color: #0f172a;
    font-weight: 600;
    text-align: right;
  }

  .audit-ok {
    color: #15803d;
  }

  .audit-warn {
    color: #b45309;
  }

  .audit-bad {
    color: #b91c1c;
  }

  .alert-card {
    border-color: #fed7aa;
    background: #fffaf3;
  }

  .alert-text {
    font-size: 13px;
    line-height: 1.6;
    color: #9a3412;
  }

  .action-card {
    .action-desc {
      margin-bottom: 10px;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }
  }
}

@media screen and (max-width: 1200px) {
  .settle-detail-page {
    .summary-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
}

@media screen and (max-width: 992px) {
  .settle-detail-page {
    .two-column-main {
      grid-template-columns: 1fr;
    }

    .header-meta {
      justify-content: flex-start;
      max-width: 100%;
    }
  }
}

@media screen and (max-width: 640px) {
  .settle-detail-page {
    .summary-grid,
    .detail-grid {
      grid-template-columns: 1fr;
    }
  }
}
</style>
