<template>
  <view class="page-shell">
    <view class="page-header">
      <view>
        <view class="page-title">提成月结</view>
        <view class="page-subtitle">预览当月未结算提成并管理结算单记录。</view>
      </view>
    </view>
    <view class="filter-card">
    <!-- 一、月结预览：仅当月，月份必选 -->
    <view class="toolbar-row section-block">
      <view class="section-label">月结预览（当月未结算提成，不跨月）</view>
      <view class="uni-group" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
        <picker mode="date" fields="month" :value="previewSettleMonth" @change="onPreviewMonthChange">
          <view class="uni-input" style="border: 1px solid #dcdfe6; padding: 5px 10px; border-radius: 4px; min-width: 100px; text-align: center;">
            {{ previewSettleMonth || '请选择预览月份' }}
          </view>
        </picker>
        <input class="uni-search" @confirm="loadPreview" v-model="previewSalesName" placeholder="业务员姓名（仅预览）" style="width: 140px;" />
        <button class="uni-button" type="default" size="mini" @click="loadPreview">刷新未结统计</button>
        <button class="uni-button" type="primary" size="mini" @click="generateSettle">生成 {{ previewSettleMonth || '—' }} 结算单</button>
      </view>
    </view>

    <!-- 二、结算记录列表：月份可选，可跨月按业务员查 -->
    <view class="toolbar-row section-block list-filter-block">
      <view class="section-label">结算单列表筛选（与预览独立）</view>
      <view class="uni-group" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
        <picker mode="date" fields="month" :value="listMonthPickerValue" @change="onListMonthChange">
          <view class="uni-input" style="border: 1px solid #dcdfe6; padding: 5px 10px; border-radius: 4px; min-width: 100px; text-align: center;">
            {{ listQuery.settle_month || '全部月份' }}
          </view>
        </picker>
        <button class="uni-button" type="default" size="mini" @click="clearListMonth">全部月份</button>
        <input class="uni-search" @confirm="searchList" v-model="listQuery.sales_name" placeholder="业务员姓名（查库）" style="width: 140px;" />
        <view style="width: 200px;">
          <uni-data-select :localdata="salesStaffSelectOptions" v-model="listQuery.sales_id" placeholder="业务员（编号/姓名）"></uni-data-select>
        </view>
        <view style="width: 120px;">
          <uni-data-select v-model="listQuery.settle_status" :localdata="statusOptions" placeholder="结算状态"></uni-data-select>
        </view>
        <input class="uni-search" @confirm="searchList" v-model="listQuery.settle_id" placeholder="结算单ID" style="width: 220px;" />
        <button class="uni-button" type="primary" size="mini" @click="searchList">搜索列表</button>
        <button class="uni-button" type="default" size="mini" @click="resetListFilters">重置列表条件</button>
        <button class="uni-button" type="warn" size="mini" @click="exportSettleList">导出列表(CSV)</button>
      </view>
    </view>

    <view class="section-card preview-box" v-if="previewSettleMonth">
      <view class="preview-title">未结算订单汇总（可纳入新生成结算单，不含待确认单已占用订单）</view>
      <view v-if="previewLoading" class="preview-muted">统计加载中…</view>
      <view v-else-if="previewError" class="preview-error">{{ previewError }}</view>
      <view v-else-if="previewData">
        <view class="preview-row">
          <text>月份 {{ previewData.settle_month }}</text>
          <text class="preview-gap">可纳入月结订单数：{{ previewData.total_eligible_orders }}</text>
          <text class="preview-gap">可纳入提成合计：¥{{ (previewData.total_eligible_commission || 0).toFixed(2) }}</text>
        </view>
        <view class="preview-row preview-muted" v-if="previewData.existing_settle_bills">
          <text>已有结算单：待结算 {{ previewData.existing_settle_bills.pending }} 份</text>
          <text class="preview-gap">已结算 {{ previewData.existing_settle_bills.settled }} 份</text>
        </view>
        <uni-table v-if="(previewData.sales_list || []).length" :loading="false" emptyText="" border stripe class="preview-table">
          <uni-tr>
            <uni-th align="center" width="160">业务员（编号/姓名）</uni-th>
            <uni-th align="center" width="80">单数</uni-th>
            <uni-th align="center" width="100">提成合计</uni-th>
          </uni-tr>
          <uni-tr v-for="(row, idx) in previewData.sales_list" :key="idx">
            <uni-td align="center">{{ formatPreviewSalesRow(row) }}</uni-td>
            <uni-td align="center">{{ row.order_count }}</uni-td>
            <uni-td align="center">¥{{ (row.commission_total || 0).toFixed(2) }}</uni-td>
          </uni-tr>
        </uni-table>
        <view v-else class="preview-muted">当前月份暂无符合规则的未结算订单，或已全部在待确认结算单中。</view>
      </view>
    </view>

    </view>
    <view class="table-card">
      <view class="table-caption">结算单列表（待结算 / 已结算）</view>
      <uni-table ref="table" :loading="loading" emptyText="暂无数据" border stripe>
        <uni-tr>
          <uni-th align="center" width="80">结算月</uni-th>
          <uni-th align="center" width="140">业务员（编号/姓名）</uni-th>
          <uni-th align="center" width="60">总单数</uni-th>
          <uni-th align="center" width="80">首开/续费</uni-th>
          <uni-th align="center" width="80">首开金额</uni-th>
          <uni-th align="center" width="80">续费金额</uni-th>
          <uni-th align="center" width="80">首开提成</uni-th>
          <uni-th align="center" width="80">续费提成</uni-th>
          <uni-th align="center" width="80">总提成</uni-th>
          <uni-th align="center" width="80">已结算</uni-th>
          <uni-th align="center" width="80">未结算</uni-th>
          <uni-th align="center" width="80">状态</uni-th>
          <uni-th align="center" width="130">生成时间</uni-th>
          <uni-th align="center" width="130">确认结算时间</uni-th>
          <uni-th align="center" width="260">操作</uni-th>
        </uni-tr>
        <uni-tr v-for="(item,index) in tableData" :key="index">
          <uni-td align="center">{{item.settle_month}}</uni-td>
          <uni-td align="center">{{ formatSettleListSales(item) }}</uni-td>
          <uni-td align="center">{{item.order_count}}</uni-td>
          <uni-td align="center">{{item.first_open_count}} / {{item.renewal_count}}</uni-td>
          <uni-td align="center">¥{{(item.first_open_amount || 0).toFixed(2)}}</uni-td>
          <uni-td align="center">¥{{(item.renewal_amount || 0).toFixed(2)}}</uni-td>
          <uni-td align="center">¥{{(item.first_open_commission || 0).toFixed(2)}}</uni-td>
          <uni-td align="center">¥{{(item.renewal_commission || 0).toFixed(2)}}</uni-td>
          <uni-td align="center">
            <text style="color:#e43d33; font-weight:bold;">¥{{(item.commission_total || 0).toFixed(2)}}</text>
          </uni-td>
          <uni-td align="center">¥{{(item.commission_paid || 0).toFixed(2)}}</uni-td>
          <uni-td align="center">¥{{(item.commission_unpaid || 0).toFixed(2)}}</uni-td>
          <uni-td align="center">
            <text v-if="item.settle_status === 0" style="color:#f0ad4e">待结算</text>
            <text v-else-if="item.settle_status === 1" style="color:#5cb85c">已结算</text>
            <text v-else-if="item.settle_status === 2" style="color:#007aff">部分结算</text>
          </uni-td>
          <uni-td align="center"><uni-dateformat :date="item.created_at" /></uni-td>
          <uni-td align="center">
            <uni-dateformat v-if="item.settled_at" :date="item.settled_at" />
            <text v-else class="preview-muted">—</text>
          </uni-td>
          <uni-td align="center">
            <view class="uni-group" style="flex-wrap: wrap; justify-content: center;">
              <button class="uni-button" size="mini" type="primary" @click="openSettleDetail(item)">查看详情</button>
              <button class="uni-button" size="mini" type="default" @click="exportSettleDetail(item)">导出明细</button>
              <button v-if="item.settle_status === 0" class="uni-button" size="mini" type="warn" @click="confirmSettle(item)">确认结算</button>
            </view>
          </uni-td>
        </uni-tr>
      </uni-table>
      <view class="uni-pagination-box">
        <uni-pagination show-icon :page-size="pagination.pageSize" :current="pagination.current" :total="pagination.total" @change="onPageChanged" />
      </view>
    </view>
  </view>
</template>

<script>
  import { loadSalesStaffRowsForSelect, rowsToSalesStaffSelectOptions } from '@/utils/nxtSalesStaff.js'

  export default {
    data() {
      const date = new Date()
      let year = date.getFullYear()
      let month = date.getMonth() + 1
      month = month < 10 ? '0' + month : month
      const ymd = `${year}-${month}`
      return {
        salesStaffSelectOptions: [],
        previewSettleMonth: ymd,
        previewSalesName: '',
        listQuery: {
          settle_month: '',
          sales_name: '',
          sales_id: '',
          settle_status: '',
          settle_id: ''
        },
        statusOptions: [
          { value: 0, text: '待结算' },
          { value: 1, text: '已结算' },
          { value: 2, text: '部分结算' }
        ],
        loading: false,
        tableData: [],
        pagination: {
          current: 1,
          pageSize: 20,
          total: 0
        },
        previewLoading: false,
        previewData: null,
        previewError: ''
      }
    },
    computed: {
      listMonthPickerValue() {
        return this.listQuery.settle_month || this.previewSettleMonth
      }
    },
    async onLoad(e) {
      try {
        const rows = await loadSalesStaffRowsForSelect()
        this.salesStaffSelectOptions = rowsToSalesStaffSelectOptions(rows)
      } catch (err) {
        this.salesStaffSelectOptions = []
      }
      if (e && e.settle_month) {
        this.listQuery.settle_month = decodeURIComponent(String(e.settle_month)).trim()
      }
      if (e && e.sales_id) {
        this.listQuery.sales_id = decodeURIComponent(String(e.sales_id)).trim()
      }
      this.loadData()
      this.loadPreview()
    },
    methods: {
      formatPreviewSalesRow(row) {
        if (!row) return '—'
        const c = (row.sales_code || '').trim()
        const n = (row.sales_name || '').trim()
        if (c && n) return `${c} / ${n}`
        if (n) return n
        if (c) return c
        return row.sales_id || '—'
      },
      formatSettleListSales(item) {
        if (!item) return '—'
        const c = (item.sales_code || '').trim()
        const n = (item.sales_name || '').trim()
        if (c && n) return `${c} / ${n}`
        if (n) return n
        if (c) return c
        return '—'
      },
      onPreviewMonthChange(e) {
        this.previewSettleMonth = e.detail.value
      },
      onListMonthChange(e) {
        this.listQuery.settle_month = e.detail.value
      },
      clearListMonth() {
        this.listQuery.settle_month = ''
      },
      searchList() {
        this.pagination.current = 1
        this.loadData()
      },
      resetListFilters() {
        this.listQuery = {
          settle_month: '',
          sales_name: '',
          sales_id: '',
          settle_status: '',
          settle_id: ''
        }
        this.searchList()
      },
      onPageChanged(e) {
        this.pagination.current = e.current
        this.loadData()
      },
      openSettleDetail(item) {
        if (!item || !item._id) return
        uni.navigateTo({
          url: `/pages/sales_commission_settle/detail?id=${encodeURIComponent(item._id)}`
        })
      },
      loadPreview() {
        if (!this.previewSettleMonth) {
          this.previewData = null
          this.previewError = ''
          return
        }
        this.previewLoading = true
        this.previewError = ''
        const payload = {
          settle_month: this.previewSettleMonth
        }
        const pn = (this.previewSalesName || '').trim()
        if (pn) {
          payload.sales_name = pn
        }
        this.commissionSettleCo().preview({ ...this.authPayload(), ...payload }).then(res => {
          this.previewLoading = false
          if (res.code === 200) {
            this.previewData = res.data || null
          } else {
            this.previewData = null
            this.previewError = res.message || '预览失败'
          }
        }).catch(err => {
          this.previewLoading = false
          this.previewData = null
          this.previewError = err.message || '请求失败'
        })
      },
      buildSettleListPayload() {
        const payload = {
          page: this.pagination.current,
          pageSize: this.pagination.pageSize
        }
        const sm = (this.listQuery.settle_month || '').trim()
        if (sm) {
          payload.settle_month = sm
        }
        const sn = (this.listQuery.sales_name || '').trim()
        if (sn) {
          payload.sales_name = sn
        }
        const sid = (this.listQuery.sales_id || '').trim()
        if (sid) {
          payload.sales_id = sid
        }
        if (this.listQuery.settle_status !== '' && this.listQuery.settle_status !== null && this.listQuery.settle_status !== undefined) {
          payload.settle_status = Number(this.listQuery.settle_status)
        }
        const settleId = (this.listQuery.settle_id || '').trim()
        if (settleId) {
          payload.settle_id = settleId
        }
        return payload
      },
      /** 与列表筛选一致，用于导出（不分页） */
      buildSettleListExportPayload() {
        const payload = {}
        const sm = (this.listQuery.settle_month || '').trim()
        if (sm) {
          payload.settle_month = sm
        }
        const sn = (this.listQuery.sales_name || '').trim()
        if (sn) {
          payload.sales_name = sn
        }
        const sid = (this.listQuery.sales_id || '').trim()
        if (sid) {
          payload.sales_id = sid
        }
        if (this.listQuery.settle_status !== '' && this.listQuery.settle_status !== null && this.listQuery.settle_status !== undefined) {
          payload.settle_status = Number(this.listQuery.settle_status)
        }
        const sid2 = (this.listQuery.settle_id || '').trim()
        if (sid2) {
          payload.settle_id = sid2
        }
        return payload
      },
      authPayload() {
        const uniIdToken = uni.getStorageSync('uni_id_token') || ''
        return { uniIdToken, token: uniIdToken }
      },
      commissionSettleCo() {
        return uniCloud.importObject('commissionSettleCo', { customUI: true })
      },
      safeFilePart(s) {
        return String(s || '')
          .replace(/[/\\:*?"<>|\r\n]/g, '_')
          .slice(0, 40)
      },
      /** 与云函数一致：结算月份导出为「YYYY年MM月」，避免 Excel 将 2026-04 识别为日期 */
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
      triggerCsvDownload(csvString, filename) {
        if (typeof window === 'undefined' || !window.Blob) {
          uni.showModal({
            content: '当前运行环境不支持浏览器下载，请在后台管理 H5 端使用导出。',
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
      buildCsvString(data) {
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
      exportSettleList() {
        uni.showLoading({ title: '导出中…', mask: true })
        this.commissionSettleCo()
          .exportList({
            ...this.authPayload(),
            ...this.buildSettleListExportPayload()
          })
          .then((res) => {
            uni.hideLoading()
            if (res.code !== 200) {
              uni.showModal({ content: res.message || '导出失败', showCancel: false })
              return
            }
            const data = res.data
            if (!data.list || data.list.length === 0) {
              uni.showToast({ title: '当前筛选条件下无数据', icon: 'none' })
              return
            }
            const csvString = this.buildCsvString(data)
            const monthPart = (this.listQuery.settle_month || '').trim() || '全部月份'
            const filename = `提成月结列表_${this.safeFilePart(monthPart)}.csv`
            if (this.triggerCsvDownload(csvString, filename)) {
              uni.showToast({ title: '导出成功', icon: 'success' })
            }
            if (data.truncated) {
              uni.showModal({
                content: `已导出前 ${data.max_export} 条，数据量超过上限可能被截断，请缩小筛选条件后分批导出。`,
                showCancel: false
              })
            }
          })
          .catch((err) => {
            uni.hideLoading()
            uni.showModal({ content: err.message || '导出失败', showCancel: false })
          })
      },
      exportSettleDetail(item) {
        if (!item || !item._id) {
          uni.showToast({ title: '缺少结算单', icon: 'none' })
          return
        }
        uni.showLoading({ title: '导出中…', mask: true })
        this.commissionSettleCo()
          .exportDetail({
            ...this.authPayload(),
            settle_id: item._id
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
            const csvString = this.buildCsvString(data)
            const fn = `提成月结明细_${this.safeFilePart(data.settle_month)}_${this.safeFilePart(data.sales_name)}_${this.safeFilePart(item._id)}.csv`
            if (this.triggerCsvDownload(csvString, fn)) {
              uni.showToast({ title: '导出成功', icon: 'success' })
            }
          })
          .catch((err) => {
            uni.hideLoading()
            uni.showModal({ content: err.message || '导出失败', showCancel: false })
          })
      },
      loadData() {
        this.loading = true
        this.commissionSettleCo().list({ ...this.authPayload(), ...this.buildSettleListPayload() }).then(res => {
          this.loading = false
          if (res.code === 200) {
            this.tableData = res.data.list || []
            this.pagination.total = res.data.total || 0
          } else {
            uni.showToast({ title: res.message || '加载失败', icon: 'none' })
          }
        }).catch(err => {
          this.loading = false
          uni.showToast({ title: err.message || '请求报错', icon: 'none' })
        })
      },
      generateSettle() {
        if (!this.previewSettleMonth) {
          uni.showToast({ title: '请先在月结预览中选择结算月份', icon: 'none' })
          return
        }
        uni.showModal({
          title: '生成结算单',
          content: `确定要生成 ${this.previewSettleMonth} 月的业务员提成结算单吗？`,
          success: (res) => {
            if (res.confirm) {
              uni.showLoading({ title: '生成中...' })
              this.commissionSettleCo().generate({
                ...this.authPayload(),
                settle_month: this.previewSettleMonth
              }).then(result => {
                uni.hideLoading()
                const { code, message, data } = result
                if (code === 200) {
                  uni.showModal({
                    title: '操作完成',
                    content: message + (data && data.created_count !== undefined ? ` (新增 ${data.created_count} 份单据)` : ''),
                    showCancel: false,
                    success: () => {
                      this.loadPreview()
                      this.loadData()
                    }
                  })
                } else {
                  uni.showModal({ content: message || '生成失败', showCancel: false })
                }
              }).catch(err => {
                uni.hideLoading()
                uni.showModal({ content: err.message || '请求失败', showCancel: false })
              })
            }
          }
        })
      },
      confirmSettle(item) {
        uni.showModal({
          title: '确认结算',
          content: `是否确认给业务员 [${this.formatSettleListSales(item)}] 结算 ${item.settle_month} 月提成：¥${item.commission_total} ？\n确认后无法撤销，相关订单将被标记为已结算。`,
          editable: true,
          placeholderText: '可在此输入备注（选填）',
          success: (res) => {
            if (res.confirm) {
              uni.showLoading({ title: '处理中...' })
              this.commissionSettleCo().confirm({
                ...this.authPayload(),
                settle_id: item._id,
                remark: res.content || ''
              }).then(result => {
                uni.hideLoading()
                if (result.code === 200) {
                  uni.showToast({ title: '结算成功', icon: 'success' })
                  this.loadData()
                  this.loadPreview()
                } else {
                  uni.showModal({ content: result.message || '结算失败', showCancel: false })
                }
              }).catch(err => {
                uni.hideLoading()
                uni.showModal({ content: err.message || '请求失败', showCancel: false })
              })
            }
          }
        })
      }
    }
  }
</script>
<style>
@import '@/styles/admin-page.scss';
.uni-input { height: 32px; line-height: 32px; font-size: 14px; background: #fff; box-sizing: border-box; }
.section-block { margin-bottom: 8px; }
.section-label { font-size: 12px; color: #606266; margin-bottom: 6px; width: 100%; }
.list-filter-block { border-top: 1px solid #ebeef5; padding-top: 10px; }
.preview-box { margin-bottom: 0; }
.preview-title { font-weight: 600; margin-bottom: 10px; font-size: 14px; }
.preview-row { font-size: 13px; margin-bottom: 6px; }
.preview-gap { margin-left: 16px; }
.preview-muted { color: #909399; font-size: 13px; }
.preview-error { color: #f56c6c; font-size: 13px; }
.preview-table { margin-top: 10px; }
.table-caption { font-size: 13px; color: #606266; margin-bottom: 8px; }
</style>
