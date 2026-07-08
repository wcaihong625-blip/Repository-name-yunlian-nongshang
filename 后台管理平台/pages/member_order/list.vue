<template>
  <view class="page-shell">
    <view class="page-header">
      <view>
        <view class="page-title">会员订单管理</view>
        <view class="page-subtitle">按支付、提成、异常与处理状态筛选并执行运营动作。</view>
      </view>
    </view>
    <view class="filter-card">
      <view class="toolbar-row">
        <input class="uni-search" @confirm="search" v-model="queryForm.mobile" placeholder="手机号" style="width: 120px;" />
        <input class="uni-search" @confirm="search" v-model="queryForm.customer_id" placeholder="客户ID" style="width: 200px;" />
        <input class="uni-search" @confirm="search" v-model="queryForm.order_id" placeholder="订单ID" style="width: 200px;" />
        <input class="uni-search" @confirm="search" v-model="queryForm.sales_name" placeholder="提成业务员姓名" style="width: 110px;" />
        <view style="width: 200px;">
          <uni-data-select :localdata="salesStaffSelectOptions" v-model="queryForm.sales_id" placeholder="提成业务员（编号/姓名）"></uni-data-select>
        </view>
        <view style="width: 110px;">
          <uni-data-select v-model="queryForm.order_type" :localdata="[{value:1,text:'首开'},{value:2,text:'续费'}]" placeholder="订单类型"></uni-data-select>
        </view>
        <view style="width: 130px;">
          <uni-data-select v-model="queryForm.pay_status" :localdata="payStatusOptions" placeholder="支付状态"></uni-data-select>
        </view>
        <view style="width: 110px;">
          <uni-data-select v-model="queryForm.commission_status" :localdata="[{value:0,text:'未结算'},{value:1,text:'已结算'}]" placeholder="提成结算状态"></uni-data-select>
        </view>
        <view style="width: 200px;">
          <uni-data-select v-model="queryForm.exception_type" :localdata="exceptionTypeOptions" placeholder="异常类型（对账）"></uni-data-select>
        </view>
        <view style="width: 130px;">
          <uni-data-select v-model="queryForm.handle_status" :localdata="handleStatusOptions" placeholder="人工处理状态"></uni-data-select>
        </view>
        <input class="uni-search" @confirm="search" v-model="queryForm.commission_settlement_month" placeholder="提成结算月 YYYY-MM" style="width: 150px;" />
        <view style="width: 250px;">
          <uni-datetime-picker type="daterange" v-model="queryForm.dateRange" />
        </view>
        <button class="uni-button" type="primary" size="mini" @click="search">搜索</button>
        <button class="uni-button" type="default" size="mini" @click="reset">重置</button>
        <button class="uni-button" type="warn" size="mini" :disabled="!selectedIndexs.length" @click="delTable">批量删除</button>
        <view style="flex-grow: 1;"></view>
        <button class="uni-button" type="warn" size="mini" @click="exportData">导出当前结果 (CSV)</button>
      </view>
    </view>
    <view class="table-card">
      <unicloud-db ref="udb" collection="member_order" field="order_no,mobile,customer_id,customer_name,order_type,order_status,pay_status,pay_amount,pay_time,pay_channel,pay_mock_flag,transaction_id,out_trade_no,pay_order_no,sales_id,sales_name,commission_type,commission_amount,commission_status,commission_settlement_id,commission_settlement_month,handle_status,followup_name,handled_at" :where="where" page-data="replace"
        :orderby="orderby" :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent" @load="onOrderLoaded"
        v-slot:default="{data,pagination,loading,error,options}">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '没有更多数据'" border stripe type="selection" @selection-change="selectionChange">
          <uni-tr>
            <uni-th align="center" width="140">订单号</uni-th>
            <uni-th align="center" width="100">手机号</uni-th>
            <uni-th align="center" width="100">客户ID</uni-th>
            <uni-th align="center" width="70">类型</uni-th>
            <uni-th align="center" width="80">支付状态</uni-th>
            <uni-th align="center" width="80">支付渠道</uni-th>
            <uni-th align="center" width="80">支付金额</uni-th>
            <uni-th align="center" width="120">支付时间</uni-th>
            <uni-th align="center" width="90">提成业务员</uni-th>
            <uni-th align="center" width="80">提成金额</uni-th>
            <uni-th align="center" width="80">提成结算</uni-th>
            <uni-th align="center" width="80">结算月份</uni-th>
            <uni-th align="center" width="100">结算单ID</uni-th>
            <uni-th align="center" width="80">处理状态</uni-th>
            <uni-th align="center" width="80">跟进人</uni-th>
            <uni-th align="center" width="120">处理时间</uni-th>
            <uni-th align="center" width="120">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item,index) in data" :key="index">
            <uni-td align="center">{{item.order_no}}</uni-td>
            <uni-td align="center">{{item.mobile}}</uni-td>
            <uni-td align="center"><text class="mono">{{ item.customer_id || '—' }}</text></uni-td>
            <uni-td align="center">
                <text v-if="item.order_type === 1">首开</text>
                <text v-else>续费</text>
            </uni-td>
            <uni-td align="center">
              <text :style="{ color: payStatusColor(item) }">{{ payStatusLabel(item) }}</text>
              <!-- pay_mock_flag 子标签：仅标识历史测试落账，不参与支付逻辑 -->
              <text v-if="item.pay_mock_flag" class="sub">历史测</text>
            </uni-td>
            <uni-td align="center">
              <text>{{ payChannelLabel(item) }}</text>
            </uni-td>
            <uni-td align="center">￥{{item.pay_amount}}</uni-td>
            <uni-td align="center"><uni-dateformat :date="item.pay_time" /></uni-td>
            <uni-td align="center">
              <text>{{ displayOrderSales(item) }}</text>
            </uni-td>
            <uni-td align="center">￥{{item.commission_amount || 0}}</uni-td>
            <uni-td align="center">
              <text v-if="item.commission_status === 1" style="color:#5cb85c">已结算</text>
              <text v-else style="color:#f0ad4e">未结算</text>
            </uni-td>
            <uni-td align="center">{{ item.commission_settlement_month || '—' }}</uni-td>
            <uni-td align="center"><text class="mono tiny">{{ item.commission_settlement_id || '—' }}</text></uni-td>
            <uni-td align="center">{{ handleStatusLabel(item) }}</uni-td>
            <uni-td align="center"><text class="sub">{{ item.followup_name || '—' }}</text></uni-td>
            <uni-td align="center"><uni-dateformat v-if="item.handled_at" :date="item.handled_at" /><text v-else>—</text></uni-td>
            <uni-td align="center">
              <view class="op-btns">
                <button class="uni-button" size="mini" type="primary" plain @click="goDetail(item._id)">详情</button>
                <button class="uni-button" size="mini" type="warn" @click="confirmDelete(item._id)">删除</button>
                <button v-if="item.customer_id" class="uni-button" size="mini" type="default" @click="goCustomer(item.customer_id)">客户</button>
                <button v-if="item.commission_settlement_id" class="uni-button" size="mini" type="primary" @click="goCommissionSettle(item.commission_settlement_id)">结算单</button>
              </view>
            </uni-td>
          </uni-tr>
        </uni-table>
        <view class="uni-pagination-box">
          <uni-pagination show-icon :page-size="pagination.size" v-model="pagination.current" :total="pagination.count" @change="onPageChanged" />
        </view>
      </unicloud-db>
    </view>
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
        salesCodeByStaffId: {},
        payStatusOptions: [
          { value: '', text: '全部（支付状态）' },
          { value: 0, text: '待支付' },
          { value: 1, text: '已支付' },
          { value: 2, text: '已取消' }
        ],
        queryForm: {
          mobile: '',
          customer_id: '',
          order_id: '',
          sales_name: '',
          sales_id: '',
          order_type: '',
          pay_status: '',
          commission_status: '',
          commission_settlement_month: '',
          exception_type: '',
          handle_status: '',
          dateRange: [],
          emptyMobile: false
        },
        handleStatusOptions: [
          { value: '', text: '全部（处理状态）' },
          { value: 'pending', text: '待处理' },
          { value: 'processing', text: '跟进中' },
          { value: 'done', text: '已处理' },
          { value: 'closed', text: '已关闭' }
        ],
        exceptionTypeOptions: [
          { value: '', text: '全部（无异常筛选）' },
          { value: 'commission_unsettled', text: '有提成金额但未结算' },
          { value: 'settled_missing_id', text: '已结算但缺结算单ID' },
          { value: 'settled_missing_month', text: '已结算但缺结算月份' },
          { value: 'missing_customer_id', text: '已支付但缺客户ID' },
          { value: 'missing_customer_name', text: '已支付但缺客户姓名' },
          { value: 'missing_sales', text: '已支付但缺业务员信息' },
          { value: 'invalid_order_type', text: '已支付但订单类型无效' }
        ],
        where: '',
        orderby: dbOrderBy,
        options: { pageSize: 20, pageCurrent: 1 },
        selectedIndexs: []
      }
    },
    async onLoad(e) {
      try {
        const rows = await loadSalesStaffRowsForSelect()
        this.salesStaffSelectOptions = rowsToSalesStaffSelectOptions(rows)
      } catch (err) {
        this.salesStaffSelectOptions = []
      }
      if (e && e.customer_id) {
        this.queryForm.customer_id = decodeURIComponent(String(e.customer_id)).trim()
      }
      if (e && e.order_id) {
        this.queryForm.order_id = decodeURIComponent(String(e.order_id)).trim()
      }
      if (e && e.sales_id) {
        this.queryForm.sales_id = decodeURIComponent(String(e.sales_id)).trim()
      }
      if (e && e.exception) {
        this.queryForm.exception_type = decodeURIComponent(String(e.exception)).trim()
      }
      if (e && e.handle_status) {
        this.queryForm.handle_status = decodeURIComponent(String(e.handle_status)).trim()
      }
      if (e && e.pay_month) {
        const ym = decodeURIComponent(String(e.pay_month)).trim()
        const rg = this.monthToDateRange(ym)
        if (rg.length === 2) {
          this.queryForm.dateRange = rg
        }
      }
      if (e && e.pay_status !== undefined && e.pay_status !== null && String(e.pay_status).trim() !== '') {
        this.queryForm.pay_status = decodeURIComponent(String(e.pay_status)).trim()
      }
      if (e && (e.empty_mobile === '1' || e.empty_mobile === 1 || e.empty_mobile === true)) {
        this.queryForm.emptyMobile = true
      }
      if (e && e.order_type !== undefined && e.order_type !== null && String(e.order_type).trim() !== '') {
        const ot = Number(decodeURIComponent(String(e.order_type)).trim())
        if (!Number.isNaN(ot)) {
          this.queryForm.order_type = ot
        }
      }
      this.$nextTick(() => {
        if (
          this.queryForm.customer_id ||
          this.queryForm.order_id ||
          this.queryForm.sales_id ||
          this.queryForm.exception_type ||
          this.queryForm.handle_status ||
          this.queryForm.pay_status !== '' ||
          this.queryForm.order_type !== '' ||
          this.queryForm.emptyMobile ||
          (this.queryForm.dateRange && this.queryForm.dateRange.length === 2)
        ) {
          this.search()
        }
      })
    },
    methods: {
      onOrderLoaded(data) {
        const rows = data || []
        const ids = [...new Set(rows.map((r) => r && r.sales_id).filter(Boolean).map((x) => String(x)))]
        if (!ids.length) return
        const cmd = db.command
        db.collection('sales_staff')
          .where({ _id: cmd.in(ids) })
          .field('_id,sales_code')
          .limit(300)
          .get()
          .then((res) => {
            const map = { ...this.salesCodeByStaffId }
            const list = (res && res.result && res.result.data) || []
            list.forEach((r) => {
              if (r && r._id) map[String(r._id)] = r.sales_code || ''
            })
            this.salesCodeByStaffId = map
          })
          .catch(() => {})
      },
      displayOrderSales(item) {
        if (!item) return '—'
        const sid = item.sales_id ? String(item.sales_id) : ''
        const code = sid && this.salesCodeByStaffId[sid] ? this.salesCodeByStaffId[sid] : ''
        const name = (item.sales_name || '').trim()
        if (code && name) return `${code} / ${name}`
        if (name) return name
        if (code) return code
        return '—'
      },
      monthToDateRange(ym) {
        const m = /^(\d{4})-(\d{2})$/.exec((ym || '').trim())
        if (!m) return []
        const y = parseInt(m[1], 10)
        const mo = parseInt(m[2], 10)
        if (mo < 1 || mo > 12) return []
        const pad = (n) => (n < 10 ? '0' + n : String(n))
        const lastDay = new Date(y, mo, 0).getDate()
        return [`${y}-${pad(mo)}-01`, `${y}-${pad(mo)}-${pad(lastDay)}`]
      },
      getWhere() {
        const conditions = []
        if (this.queryForm.mobile) {
          const queryRe = new RegExp(this.queryForm.mobile.trim(), 'i')
          conditions.push(`${queryRe}.test(mobile)`)
        }
        const custId = (this.queryForm.customer_id || '').trim().replace(/'/g, '')
        if (custId) {
          conditions.push(`customer_id == '${custId}'`)
        }
        const oid = (this.queryForm.order_id || '').trim().replace(/'/g, '')
        if (oid) {
          conditions.push(`_id == '${oid}'`)
        }
        if (this.queryForm.sales_name) {
          const queryRe = new RegExp(this.queryForm.sales_name.trim(), 'i')
          conditions.push(`${queryRe}.test(sales_name)`)
        }
        if (this.queryForm.sales_id) {
          const sid = String(this.queryForm.sales_id).replace(/'/g, '')
          conditions.push(`sales_id == '${sid}'`)
        }
        if (this.queryForm.order_type !== '') {
          conditions.push(`order_type == ${this.queryForm.order_type}`)
        }
        if (this.queryForm.pay_status !== '' && this.queryForm.pay_status !== null && this.queryForm.pay_status !== undefined) {
          const ps = Number(this.queryForm.pay_status)
          if (ps === 2) {
            conditions.push(`(order_status == 2 || pay_status == 2)`)
          } else {
            conditions.push(`order_status == ${ps}`)
          }
        }
        if (this.queryForm.commission_status !== '') {
          conditions.push(`commission_status == ${this.queryForm.commission_status}`)
        }
        const csm = (this.queryForm.commission_settlement_month || '').trim().replace(/'/g, '')
        if (csm) {
          conditions.push(`commission_settlement_month == '${csm}'`)
        }
        if (this.queryForm.dateRange && this.queryForm.dateRange.length === 2) {
           const start = new Date(this.queryForm.dateRange[0] + ' 00:00:00').getTime()
           const end = new Date(this.queryForm.dateRange[1] + ' 23:59:59').getTime()
           conditions.push(`pay_time >= ${start} && pay_time <= ${end}`)
        }
        const ex = (this.queryForm.exception_type || '').trim()
        if (ex === 'commission_unsettled') {
          conditions.push('commission_amount > 0 && commission_status == 0')
        } else if (ex === 'settled_missing_id') {
          conditions.push(`commission_status == 1 && (commission_settlement_id == null || commission_settlement_id == '')`)
        } else if (ex === 'settled_missing_month') {
          conditions.push(`commission_status == 1 && (commission_settlement_month == null || commission_settlement_month == '')`)
        } else if (ex === 'missing_customer_id') {
          conditions.push(`order_status == 1 && (customer_id == null || customer_id == '')`)
        } else if (ex === 'missing_customer_name') {
          conditions.push(
            `order_status == 1 && customer_id != null && customer_id != '' && (customer_name == null || customer_name == '')`
          )
        } else if (ex === 'missing_sales') {
          conditions.push(
            `order_status == 1 && ((sales_id == null || sales_id == '') || (sales_name == null || sales_name == ''))`
          )
        } else if (ex === 'invalid_order_type') {
          conditions.push('order_status == 1 && order_type != 1 && order_type != 2')
        }
        const hs = (this.queryForm.handle_status || '').trim()
        if (hs === 'pending') {
          conditions.push(
            "(handle_status == null || handle_status == '' || handle_status == 'pending')"
          )
        } else if (hs === 'processing' || hs === 'done' || hs === 'closed') {
          conditions.push(`handle_status == '${hs}'`)
        }
        if (this.queryForm.emptyMobile) {
          conditions.push(`order_status == 1 && (mobile == null || mobile == '')`)
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
          customer_id: '',
          order_id: '',
          sales_name: '',
          sales_id: '',
          order_type: '',
          pay_status: '',
          commission_status: '',
          commission_settlement_month: '',
          exception_type: '',
          handle_status: '',
          dateRange: [],
          emptyMobile: false
        }
        this.search()
      },
      payStatusLabel(item) {
        const ps = item && item.pay_status
        if (ps === 1 || ps === '1') return '已支付'
        if (ps === 2 || ps === '2') return '已取消'
        if (ps === 3 || ps === '3') return '支付失败'
        if (ps === 0 || ps === '0') return '待支付'
        const os = item && Number(item.order_status)
        if (os === 1) return '已支付'
        if (os === 2) return '已取消'
        return '待支付'
      },
      payStatusColor(item) {
        const t = this.payStatusLabel(item)
        if (t === '已支付') return '#5cb85c'
        if (t === '待支付') return '#f0ad4e'
        if (t === '已取消' || t === '支付失败') return '#909399'
        return '#303133'
      },
      payChannelLabel(item) {
        if (!item || !item.pay_channel) return '—'
        if (item.pay_mock_flag) return (item.pay_channel || '') + '（历史测试落账）'
        return item.pay_channel
      },
      handleStatusLabel(item) {
        const s = item && item.handle_status
        if (s === undefined || s === null || s === '') return '待处理'
        const m = { pending: '待处理', processing: '跟进中', done: '已处理', closed: '已关闭' }
        return m[s] || s
      },
      onPageChanged(e) {
        this.selectedIndexs.length = 0
        if (this.$refs.table && this.$refs.table.clearSelection) {
          this.$refs.table.clearSelection()
        }
        this.$refs.udb.loadData({ current: e.current })
      },
      selectionChange(e) {
        this.selectedIndexs = e.detail.index
      },
      selectedItems() {
        return this.selectedIndexs.map((i) => this.$refs.udb.dataList[i]._id)
      },
      async deleteOrdersAndSync(orderIds) {
        const ids = Array.isArray(orderIds) ? orderIds.filter(Boolean) : []
        if (!ids.length) {
          uni.showToast({ title: '缺少订单ID', icon: 'none' })
          return false
        }
        const uniIdToken = uni.getStorageSync('uni_id_token') || ''
        if (!uniIdToken) {
          uni.showToast({ title: '登录状态失效，请重新登录', icon: 'none' })
          return false
        }
        uni.showLoading({ title: '删除中...', mask: true })
        try {
          const res = await uniCloud.callFunction({
            name: 'deleteMemberOrdersAndSync',
            data: {
              uniIdToken,
              token: uniIdToken,
              order_ids: ids
            }
          })
          const body = (res && res.result) || {}
          if (Number(body.code) !== 200) {
            uni.showModal({
              content: body.message || '删除失败',
              showCancel: false
            })
            return false
          }
          uni.showToast({ title: '删除成功', icon: 'success' })
          this.selectedIndexs = []
          if (this.$refs.table && this.$refs.table.clearSelection) {
            this.$refs.table.clearSelection()
          }
          this.$refs.udb.loadData()
          return true
        } catch (err) {
          uni.showModal({
            content: (err && err.message) || '删除失败，请稍后重试',
            showCancel: false
          })
          return false
        } finally {
          uni.hideLoading()
        }
      },
      confirmDelete(id) {
        if (!id) return
        uni.showModal({
          title: '确认删除',
          content: '删除后不可恢复，且可能影响提成对账与结算单关联展示。确定删除该会员订单吗？',
          success: async (res) => {
            if (res.confirm) {
              await this.deleteOrdersAndSync([id])
            }
          }
        })
      },
      delTable() {
        if (!this.selectedIndexs.length) return
        uni.showModal({
          title: '批量删除',
          content: `确认删除选中的 ${this.selectedIndexs.length} 条会员订单吗？删除后不可恢复。`,
          success: async (res) => {
            if (res.confirm) {
              await this.deleteOrdersAndSync(this.selectedItems())
            }
          }
        })
      },
      goCommissionSettle(settleId) {
        if (!settleId) return
        uni.navigateTo({
          url: `/pages/sales_commission_settle/detail?id=${encodeURIComponent(settleId)}`
        })
      },
      goCustomer(customerId) {
        if (!customerId) return
        uni.navigateTo({
          url: `/pages/customer_profile/edit?id=${encodeURIComponent(customerId)}`
        })
      },
      goDetail(orderId) {
        if (!orderId) return
        uni.navigateTo({
          url: `/pages/member_order/detail?id=${encodeURIComponent(orderId)}`
        })
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
          name: 'exportMemberOrderData',
          data: {
             uniIdToken,
             token: uniIdToken,
             mobile: this.queryForm.mobile.trim(),
             customer_id: (this.queryForm.customer_id || '').trim(),
             order_id: (this.queryForm.order_id || '').trim(),
             sales_name: this.queryForm.sales_name.trim(),
             sales_id: this.queryForm.sales_id ? String(this.queryForm.sales_id).trim() : '',
             order_type: this.queryForm.order_type !== '' ? Number(this.queryForm.order_type) : null,
             order_status: this.queryForm.pay_status !== '' && this.queryForm.pay_status !== null && this.queryForm.pay_status !== undefined ? Number(this.queryForm.pay_status) : null,
             commission_status: this.queryForm.commission_status !== '' ? Number(this.queryForm.commission_status) : null,
             commission_settlement_month: (this.queryForm.commission_settlement_month || '').trim(),
             exception_type: (this.queryForm.exception_type || '').trim(),
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
             a.download = `会员订单导出_${new Date().getTime()}.csv`
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
      }
    }
  }
</script>
<style>
@import '@/styles/admin-page.scss';
.page-shell .toolbar-row .uni-button {
  margin: 0;
}
.uni-input { height: 32px; line-height: 32px; font-size: 14px; background: #fff; box-sizing: border-box; }
.mono { font-family: monospace; font-size: 11px; word-break: break-all; }
.mono.tiny { font-size: 10px; }
.sub { display: block; font-size: 10px; color: #909399; }
.muted { color: #909399; font-size: 12px; }
.op-btns { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.op-btns .uni-button { margin: 0; }
</style>
