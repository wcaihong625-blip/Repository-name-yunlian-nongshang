<template>
  <view class="page-shell">
    <view class="page-header">
      <view>
        <view class="page-title">客户归属管理</view>
        <view class="page-subtitle">管理客户归属、业务员转移与归因核对。</view>
      </view>
    </view>
    <view class="filter-card">
      <view class="uni-group" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
        <input class="uni-search" @confirm="search" v-model="queryForm.mobile" placeholder="手机号" style="width: 120px;" />
        
        <view style="width: 200px;">
          <uni-data-select :localdata="salesStaffSelectOptions" v-model="queryForm.first_sales_id" placeholder="首次业务员（编号/姓名）"></uni-data-select>
        </view>
        <view style="width: 200px;">
          <uni-data-select :localdata="salesStaffSelectOptions" v-model="queryForm.current_sales_id" placeholder="当前业务员（编号/姓名）"></uni-data-select>
        </view>
        <view style="width: 150px;">
          <uni-data-select collection="sales_channel" field="channel_name as text, _id as value" v-model="queryForm.source_channel_id" placeholder="来源渠道"></uni-data-select>
        </view>
        <view style="width: 110px;">
          <uni-data-select v-model="queryForm.member_status" :localdata="[{value:1,text:'已开通'},{value:2,text:'已过期'},{value:0,text:'未开通'}]" placeholder="会员状态"></uni-data-select>
        </view>
        <view style="width: 250px;">
          <uni-datetime-picker type="daterange" v-model="queryForm.dateRange" />
        </view>
        
        <button class="uni-button" type="primary" size="mini" @click="search">搜索</button>
        <button class="uni-button" type="default" size="mini" @click="reset">重置</button>
        <!-- 占位撑开弹性布局 -->
        <view style="flex-grow: 1;"></view>
        <button class="uni-button" type="warn" size="mini" @click="exportData">导出当前结果 (CSV)</button>
      </view>
    </view>
    <view class="table-card">
      <unicloud-db ref="udb" collection="customer_profile" field="mobile,nickname,company_name,contact_name,member_status,source_channel_id,source_channel_name,first_sales_id,first_sales_name,current_sales_id,current_sales_name,member_first_open_time,member_last_renew_time,transfer_status,transfer_count,created_at" :where="where" page-data="replace"
        :orderby="orderby" :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent" @load="onCustomerLoaded"
        v-slot:default="{data,pagination,loading,error,options}">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '没有更多数据'" border stripe>
          <uni-tr>
            <uni-th align="center">手机号</uni-th>
            <uni-th align="center">昵称</uni-th>
            <uni-th align="center">来源渠道</uni-th>
            <uni-th align="center">首次归属业务员</uni-th>
            <uni-th align="center">当前服务业务员</uni-th>
            <uni-th align="center">会员状态</uni-th>
            <uni-th align="center">首次开通时间</uni-th>
            <uni-th align="center">转移状态</uni-th>
            <uni-th align="center">转移次数</uni-th>
            <uni-th align="center">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item,index) in data" :key="index">
            <uni-td align="center">{{item.mobile}}</uni-td>
            <uni-td align="center">{{item.nickname}}</uni-td>
            <uni-td align="center">{{item.source_channel_name || '-'}}</uni-td>
            <uni-td align="center">
              <text v-if="item.first_sales_name">{{ displaySalesCell(item.first_sales_id, item.first_sales_name) }}</text>
              <text v-else style="color:#d9534f">待分配</text>
            </uni-td>
            <uni-td align="center">{{ displaySalesCell(item.current_sales_id, item.current_sales_name) }}</uni-td>
            <uni-td align="center">
              <text v-if="item.member_status === 1" style="color:#5cb85c">已开通</text>
              <text v-else-if="item.member_status === 2" style="color:#f0ad4e">已过期</text>
              <text v-else>未开通</text>
            </uni-td>
            <uni-td align="center"><uni-dateformat :date="item.member_first_open_time" /></uni-td>
            <uni-td align="center">
              <text v-if="hasPendingApply(item._id)" style="color:#f0ad4e">审批中</text>
              <text v-else>正常</text>
            </uni-td>
            <uni-td align="center">{{item.transfer_count || 0}}</uni-td>
            <uni-td align="center">
              <view class="uni-group" style="flex-direction: column; align-items: center;">
                <button class="uni-button" size="mini" type="default" style="margin: 2px 0;" @click="openReconcile(item)">核对信息</button>
                <button
                  class="uni-button"
                  size="mini"
                  type="primary"
                  style="margin: 2px 0;"
                  :disabled="isTransferDisabled(item)"
                  @click="openTransfer(item)"
                >{{ getTransferBtnText(item) }}</button>
              </view>
            </uni-td>
          </uni-tr>
        </uni-table>
        <view class="uni-pagination-box">
          <uni-pagination show-icon :page-size="pagination.size" v-model="pagination.current" :total="pagination.count" @change="onPageChanged" />
        </view>
      </unicloud-db>
    </view>
    
    <!-- 核对：归属 / 渠道 / 转移 / 最近订单 -->
    <uni-popup ref="reconcilePopup" type="center" :mask-click="false">
      <view class="reconcile-panel">
        <view class="reconcile-title">客户核对信息</view>
        <scroll-view scroll-y class="reconcile-scroll" style="max-height: 60vh;">
          <view v-if="reconcileLoading" class="reconcile-muted">加载中…</view>
          <view v-else-if="reconcileError" class="reconcile-muted">{{ reconcileError }}</view>
          <template v-else-if="reconcileRow">
            <view class="reconcile-actions">
              <button class="uni-button" size="mini" type="primary" @click="goOrdersForCustomer">查看该客户订单列表</button>
            </view>
            <view class="reconcile-section">归属与渠道</view>
            <view class="reconcile-line"><text class="rk">客户 ID</text><text class="mono">{{ reconcileRow._id || '—' }}</text></view>
            <view class="reconcile-line"><text class="rk">客户姓名</text>{{ customerDisplayName(reconcileRow) }}</view>
            <view class="reconcile-line"><text class="rk">首次业务员（编号/姓名）</text>{{ formatReconcileSales(reconcileRow.first_sales_code, reconcileRow.first_sales_name) }}</view>
            <view class="reconcile-line"><text class="rk">当前业务员（编号/姓名）</text>{{ formatReconcileSales(reconcileRow.current_sales_code, reconcileRow.current_sales_name) }}</view>
            <view class="reconcile-line"><text class="rk">来源渠道 ID</text>{{ reconcileRow.source_channel_id || '—' }}</view>
            <view class="reconcile-line"><text class="rk">来源渠道名</text>{{ reconcileRow.source_channel_name || '—' }}</view>
            <view class="reconcile-line"><text class="rk">手机号</text>{{ reconcileRow.mobile || '—' }}</view>

            <view class="reconcile-section">转移情况</view>
            <view class="reconcile-line"><text class="rk">转移次数</text>{{ reconcileRow.transfer_count || 0 }}</view>
            <view class="reconcile-line"><text class="rk">是否曾转移</text>{{ (reconcileRow.transfer_count || 0) > 0 ? '是' : '否（以次数为准，历史数据可能未计数）' }}</view>
            <view class="reconcile-line"><text class="rk">待审批申请</text>{{ hasPendingApply(reconcileRow._id) ? '有（列表已标「审批中」）' : '无' }}</view>
            <view class="reconcile-line"><text class="rk">最近转移申请（最多 5 条，时间倒序）</text></view>
            <template v-if="reconcileApplies.length">
              <view v-for="(ap, ai) in reconcileApplies" :key="ai" class="reconcile-apply">
                <text>申请单 ID：<text class="mono">{{ ap._id }}</text> · {{ ap.apply_status_text || '—' }}</text>
                <text class="sub">转出：{{ ap.from_sales_name || '—' }} → 转入：{{ ap.to_sales_name || '—' }}</text>
                <text class="sub">申请时间：<uni-dateformat :date="ap.apply_time" /></text>
                <view v-if="ap.status === 1 || ap.status === 2" class="sub">审批时间：<uni-dateformat v-if="ap.audit_time" :date="ap.audit_time" /><text v-else>—</text></view>
                <text v-if="ap.status === 2 && ap.reject_reason" class="sub warn">拒绝原因：{{ ap.reject_reason }}</text>
              </view>
            </template>
            <view v-else class="reconcile-muted">暂无转移申请记录</view>

            <view class="reconcile-section">最近会员订单（已支付，最多 5 笔，时间倒序）</view>
            <template v-if="reconcileOrders.length">
              <view v-for="(o, oi) in reconcileOrders" :key="oi" class="reconcile-order">
                <text>订单号 {{ o.order_no || '—' }} · {{ o.order_type_text || (o.order_type === 1 ? '首开' : '续费') }} · 实付 ¥{{ o.pay_amount }}</text>
                <text class="sub mono">订单 ID：{{ o._id }}</text>
                <text class="sub"><uni-dateformat :date="o.pay_time" /> · 提成 ¥{{ o.commission_amount || 0 }} · {{ o.commission_status_text || (o.commission_status === 1 ? '已结算' : '未结算') }}</text>
                <text v-if="o.commission_settlement_id" class="sub">结算单：{{ o.commission_settlement_id }} · 结算月：{{ o.commission_settlement_month || '—' }}</text>
                <view v-if="o.commission_settlement_id" class="reconcile-mini-btns">
                  <button class="uni-button" size="mini" type="default" @click="goSettleDetail(o.commission_settlement_id)">打开结算单详情</button>
                </view>
              </view>
            </template>
            <view v-else class="reconcile-muted">暂无已支付订单</view>
          </template>
        </scroll-view>
        <button class="uni-button" type="primary" @click="closeReconcile">关闭</button>
      </view>
    </uni-popup>

    <!-- 发起转移弹窗 -->
    <uni-popup ref="transferPopup" type="dialog">
      <uni-popup-dialog type="info" title="发起客户转移" :before-close="true" @confirm="submitTransfer" @close="closeTransferPopup">
        <uni-forms ref="transferForm" :modelValue="transferData" label-width="110px">
          <uni-forms-item label="客户手机号">
            <uni-easyinput disabled v-model="transferData.mobile" />
          </uni-forms-item>
          <uni-forms-item label="首次业务员">
            <uni-easyinput disabled v-model="transferData.first_sales_name" />
          </uni-forms-item>
          <uni-forms-item label="当前业务员">
            <uni-easyinput disabled v-model="transferData.current_sales_name" />
          </uni-forms-item>
          <uni-forms-item label="目标业务员" required>
            <uni-data-select :localdata="transferSalesSelectOptions" v-model="transferData.to_sales_id" placeholder="编号/姓名"></uni-data-select>
          </uni-forms-item>
          <uni-forms-item label="申请原因" required>
            <uni-easyinput type="textarea" v-model="transferData.apply_reason" placeholder="请输入申请原因" />
          </uni-forms-item>
        </uni-forms>
      </uni-popup-dialog>
    </uni-popup>
    
  </view>
</template>

<script>
  import { loadSalesStaffRowsForSelect, rowsToSalesStaffSelectOptions } from '@/utils/nxtSalesStaff.js'

  const db = uniCloud.database()
  const dbOrderBy = 'created_at desc'
  
  export default {
    data() {
      return {
        salesStaffSelectOptions: [],
        transferSalesSelectOptions: [],
        salesCodeMap: {},
        queryForm: {
          mobile: '',
          first_sales_id: '',
          current_sales_id: '',
          source_channel_id: '',
          member_status: '',
          dateRange: []
        },
        where: '',
        orderby: dbOrderBy,
        options: { pageSize: 20, pageCurrent: 1 },
        transferData: {
          customer_id: '',
          mobile: '',
          first_sales_name: '',
          current_sales_id: '',
          current_sales_name: '',
          to_sales_id: '',
          apply_reason: ''
        },
        pendingApplyMap: {},
        reconcileRow: null,
        reconcileLoading: false,
        reconcileOrders: [],
        reconcileApplies: [],
        reconcileError: ''
      }
    },
    async onLoad(e) {
      await this.loadSalesSelectOptions()
      if (e && e.current_sales_id) {
        this.queryForm.current_sales_id = decodeURIComponent(String(e.current_sales_id)).trim()
      }
      this.$nextTick(() => {
        if (this.queryForm.current_sales_id) {
          this.search()
        }
      })
    },
    methods: {
      async loadSalesSelectOptions() {
        try {
          const rows = await loadSalesStaffRowsForSelect()
          this.salesStaffSelectOptions = rowsToSalesStaffSelectOptions(rows)
          const enabled = rows.filter((r) => Number(r.status) === 1)
          this.transferSalesSelectOptions = rowsToSalesStaffSelectOptions(enabled)
        } catch (e) {
          this.salesStaffSelectOptions = []
          this.transferSalesSelectOptions = []
        }
      },
      displaySalesCell(salesId, salesName) {
        const id = salesId ? String(salesId) : ''
        const code = id && this.salesCodeMap[id] ? this.salesCodeMap[id] : ''
        const n = (salesName || '').trim()
        if (code && n) return `${code} / ${n}`
        return n || code || '—'
      },
      formatReconcileSales(code, name) {
        const c = (code || '').trim()
        const n = (name || '').trim()
        if (c && n) return `${c} / ${n}`
        if (n) return n
        if (c) return c
        return '—'
      },
      customerDisplayName(row) {
        if (!row) return '—'
        return row.company_name || row.contact_name || row.nickname || row.mobile || '—'
      },
      goOrdersForCustomer() {
        const id = this.reconcileRow && this.reconcileRow._id
        if (!id) return
        this.closeReconcile()
        uni.navigateTo({
          url: `/pages/member_order/list?customer_id=${encodeURIComponent(id)}`
        })
      },
      goSettleDetail(settleId) {
        if (!settleId) return
        this.closeReconcile()
        uni.navigateTo({
          url: `/pages/sales_commission_settle/detail?id=${encodeURIComponent(settleId)}`
        })
      },
      openReconcile(item) {
        const cid = String(item._id || '').trim()
        if (!cid) return
        this.reconcileLoading = true
        this.reconcileError = ''
        this.reconcileRow = null
        this.reconcileOrders = []
        this.reconcileApplies = []
        this.$refs.reconcilePopup.open()
        const uniIdToken = uni.getStorageSync('uni_id_token') || ''
        uniCloud
          .callFunction({
            name: 'getCustomerAuditInfo',
            data: {
              uniIdToken,
              token: uniIdToken,
              customer_id: cid
            }
          })
          .then((res) => {
            const r = res.result || {}
            if (r.code !== 200) {
              this.reconcileError = r.message || '加载失败'
              uni.showModal({ content: this.reconcileError, showCancel: false })
              return
            }
            const d = r.data || {}
            this.reconcileRow = d.customer || null
            this.reconcileOrders = d.recent_orders || []
            this.reconcileApplies = d.recent_transfer_records || []
          })
          .catch((err) => {
            this.reconcileError = (err && err.message) || '请求失败'
            uni.showModal({ content: this.reconcileError, showCancel: false })
          })
          .finally(() => {
            this.reconcileLoading = false
          })
      },
      closeReconcile() {
        this.$refs.reconcilePopup.close()
        this.reconcileRow = null
        this.reconcileError = ''
      },
      getWhere() {
        const conditions = []
        if (this.queryForm.mobile) {
          const queryRe = new RegExp(this.queryForm.mobile.trim(), 'i')
          conditions.push(`${queryRe}.test(mobile)`)
        }
        if (this.queryForm.first_sales_id) {
          conditions.push(`first_sales_id == '${this.queryForm.first_sales_id}'`)
        }
        if (this.queryForm.current_sales_id) {
          conditions.push(`current_sales_id == '${this.queryForm.current_sales_id}'`)
        }
        if (this.queryForm.source_channel_id) {
          const sc = String(this.queryForm.source_channel_id).replace(/'/g, '')
          conditions.push(`source_channel_id == '${sc}'`)
        }
        if (this.queryForm.member_status !== '') {
          conditions.push(`member_status == ${this.queryForm.member_status}`)
        }
        if (this.queryForm.dateRange && this.queryForm.dateRange.length === 2) {
           const start = new Date(this.queryForm.dateRange[0] + ' 00:00:00').getTime()
           const end = new Date(this.queryForm.dateRange[1] + ' 23:59:59').getTime()
           conditions.push(`created_at >= ${start} && created_at <= ${end}`)
        }
        return conditions.join(' && ')
      },
      search() {
        const newWhere = this.getWhere()
        this.where = newWhere
        this.$nextTick(() => {
          this.$refs.udb.loadData()
        })
      },
      reset() {
        this.queryForm = {
          mobile: '',
          first_sales_id: '',
          current_sales_id: '',
          source_channel_id: '',
          member_status: '',
          dateRange: []
        }
        this.search()
      },
      onPageChanged(e) {
        this.$refs.udb.loadData({ current: e.current })
      },
      exportData() {
        uni.showLoading({ title: '正在导出数据...', mask: true })
        let date_start = null
        let date_end = null
        if (this.queryForm.dateRange && this.queryForm.dateRange.length === 2) {
          date_start = new Date(this.queryForm.dateRange[0] + ' 00:00:00').getTime()
          date_end = new Date(this.queryForm.dateRange[1] + ' 23:59:59').getTime()
        }

        const uniIdToken = uni.getStorageSync('uni_id_token') || ''
        uniCloud.callFunction({
          name: 'exportCustomerProfileData',
          data: {
             uniIdToken,
             token: uniIdToken,
             mobile: this.queryForm.mobile.trim(),
             first_sales_id: this.queryForm.first_sales_id,
             current_sales_id: this.queryForm.current_sales_id,
             source_channel_id: this.queryForm.source_channel_id ? String(this.queryForm.source_channel_id).trim() : '',
             member_status: this.queryForm.member_status !== '' ? Number(this.queryForm.member_status) : null,
             date_start,
             date_end
          }
        }).then(res => {
          uni.hideLoading()
          if (res.result.code === 200) {
             const data = res.result.data
             if (!data.list || data.list.length === 0) {
               uni.showToast({ title: '当前条件下无数据', icon: 'none' })
               return
             }
             
             let csvString = '\uFEFF' + data.headers_zh.join(',') + '\n'
             data.list.forEach(item => {
                const row = data.headers.map(header => {
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
             a.download = `客户数据导出_${new Date().getTime()}.csv`
             document.body.appendChild(a)
             a.click()
             document.body.removeChild(a)
             url.revokeObjectURL(downloadUrl)
             
             uni.showToast({ title: '导出成功', icon: 'success' })
          } else {
             uni.showModal({ content: res.result.message || '导出失败', showCancel: false })
          }
        }).catch(err => {
          uni.hideLoading()
          uni.showModal({ content: err.message || '请求报错', showCancel: false })
        })
      },
      openTransfer(item) {
        // 按钮置灰时通常不会触发；这里再做一次兜底校验
        if (this.hasPendingApply(item._id)) {
          uni.showToast({ title: '审批中', icon: 'none' })
          return
        }
        if (!item.current_sales_id) {
          uni.showToast({ title: '客户当前未分配业务员，无法转移', icon: 'none' })
          return
        }
        this.transferData = {
          customer_id: item._id,
          mobile: item.mobile || '',
          first_sales_name: item.first_sales_name || '-',
          current_sales_id: item.current_sales_id || '',
          current_sales_name: item.current_sales_name || '-',
          to_sales_id: '',
          apply_reason: ''
        }
        this.$refs.transferPopup.open()
      },
      closeTransferPopup() {
        this.$refs.transferPopup.close()
      },
      onCustomerLoaded(data) {
        const rows = data || []
        const cmd = db.command
        const salesIds = []
        rows.forEach((d) => {
          if (d && d.first_sales_id) salesIds.push(d.first_sales_id)
          if (d && d.current_sales_id) salesIds.push(d.current_sales_id)
        })
        const uniq = [...new Set(salesIds.map((x) => String(x)).filter(Boolean))]
        if (uniq.length) {
          db.collection('sales_staff')
            .where({ _id: cmd.in(uniq) })
            .field('_id,sales_code')
            .limit(500)
            .get()
            .then((res) => {
              const map = { ...this.salesCodeMap }
              const list = (res && res.result && res.result.data) || []
              list.forEach((r) => {
                if (r && r._id) map[String(r._id)] = r.sales_code || ''
              })
              this.salesCodeMap = map
            })
            .catch(() => {})
        }

        const ids = rows.map(d => d && d._id).filter(Boolean)
        if (!ids.length) {
          this.pendingApplyMap = {}
          return
        }
        db.collection('customer_transfer_apply')
          .where({
            customer_id: cmd.in(ids),
            status: 0
          })
          .field('customer_id')
          .limit(1000)
          .get()
          .then(res => {
            const map = {}
            const list = (res && res.result && res.result.data) || []
            list.forEach(row => {
              if (row && row.customer_id) map[row.customer_id] = true
            })
            this.pendingApplyMap = map
          })
          .catch(() => {
            // 查询失败时不阻塞列表展示，默认都可点（云函数侧仍会拦截重复待审）
            this.pendingApplyMap = {}
          })
      },
      hasPendingApply(customerId) {
        return !!(customerId && this.pendingApplyMap && this.pendingApplyMap[customerId])
      },
      isTransferDisabled(item) {
        if (!item) return true
        if (!item.current_sales_id) return true
        if (this.hasPendingApply(item._id)) return true
        return false
      },
      getTransferBtnText(item) {
        if (!item) return '发起转移'
        if (!item.current_sales_id) return '不可转移'
        if (this.hasPendingApply(item._id)) return '审批中'
        return '发起转移'
      },
      submitTransfer() {
        if (!this.transferData.to_sales_id) {
          uni.showToast({ title: '请选择目标业务员', icon: 'none' })
          return
        }
        if (this.transferData.current_sales_id && this.transferData.to_sales_id === this.transferData.current_sales_id) {
          uni.showToast({ title: '目标业务员不能与当前业务员相同', icon: 'none' })
          return
        }
        const applyReason = (this.transferData.apply_reason || '').trim()
        if (!applyReason) {
          uni.showToast({ title: '请输入申请原因', icon: 'none' })
          return
        }
        uni.showLoading({ title: '提交中' })
        const uniIdToken = uni.getStorageSync('uni_id_token') || ''
        uniCloud.callFunction({
          name: 'createCustomerTransferApply',
          data: {
            uniIdToken,
            token: uniIdToken,
            customer_id: this.transferData.customer_id,
            to_sales_id: this.transferData.to_sales_id,
            apply_reason: applyReason
          }
        }).then(res => {
          uni.hideLoading()
          if (res.result.code === 200) {
            uni.showToast({ title: '申请提交成功', icon: 'success' })
            this.$refs.transferPopup.close()
            this.$refs.udb.loadData()
          } else {
            uni.showModal({ content: res.result.message || '提交失败', showCancel: false })
          }
        }).catch(err => {
          uni.hideLoading()
          uni.showModal({ content: err.message || '请求报错', showCancel: false })
        })
      }
    }
  }
</script>
<style>
.uni-input { height: 32px; line-height: 32px; font-size: 14px; background: #fff; box-sizing: border-box; }
.reconcile-panel {
  width: 90vw;
  max-width: 520px;
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-sizing: border-box;
  box-shadow: 0 4px 20px rgba(0,0,0,0.12);
}
.reconcile-title { font-weight: 600; font-size: 16px; margin-bottom: 10px; color: #303133; }
.reconcile-section { font-weight: 600; margin: 14px 0 8px; font-size: 14px; color: #303133; border-top: 1px solid #ebeef5; padding-top: 12px; }
.reconcile-section:first-of-type { border-top: none; padding-top: 0; margin-top: 0; }
.reconcile-line { display: flex; flex-wrap: wrap; font-size: 13px; margin-bottom: 8px; line-height: 1.5; gap: 8px; }
.rk { color: #909399; min-width: 118px; flex-shrink: 0; }
.reconcile-muted { color: #909399; font-size: 13px; padding: 8px 0; }
.reconcile-apply { display: flex; flex-direction: column; font-size: 13px; margin: 6px 0 10px; padding: 8px 10px; background: #f5f7fa; border-radius: 4px; }
.reconcile-order { margin-bottom: 10px; font-size: 13px; display: flex; flex-direction: column; padding: 6px 0; border-bottom: 1px solid #f0f0f0; }
.reconcile-order:last-child { border-bottom: none; }
.reconcile-panel .sub { font-size: 12px; color: #909399; margin-top: 4px; display: block; }
.reconcile-panel .uni-button { width: 100%; margin-top: 12px; }
.reconcile-actions { margin-bottom: 10px; }
.reconcile-actions .uni-button { width: 100%; margin-top: 0; }
.reconcile-mini-btns { margin-top: 6px; }
.reconcile-mini-btns .uni-button { width: auto; margin: 0; }
.reconcile-panel .mono { font-family: monospace; font-size: 12px; word-break: break-all; }
.reconcile-panel .warn { color: #e6a23c; }
</style>
