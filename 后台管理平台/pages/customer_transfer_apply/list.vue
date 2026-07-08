<template>
  <view>
    <view class="uni-header">
      <view class="uni-group" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
        <input class="uni-search" @confirm="search" v-model="queryForm.mobile" placeholder="客户手机号" style="width: 120px;" />
        <view style="width: 120px;">
          <uni-data-select v-model="queryForm.status" :localdata="statusOptions" placeholder="申请状态"></uni-data-select>
        </view>
        <input class="uni-search" @confirm="search" v-model="queryForm.from_sales_name" placeholder="原业务员" style="width: 100px;" />
        <input class="uni-search" @confirm="search" v-model="queryForm.to_sales_name" placeholder="目标业务员" style="width: 110px;" />
        <view style="width: 250px;">
          <uni-datetime-picker type="daterange" v-model="queryForm.dateRange" />
        </view>
        <button class="uni-button" type="primary" size="mini" @click="search">搜索</button>
        <button class="uni-button" type="default" size="mini" @click="reset">重置</button>
      </view>
    </view>
    <view class="uni-container">
      <unicloud-db ref="udb" collection="customer_transfer_apply" field="_id,customer_name,mobile,from_sales_name,to_sales_name,apply_by_name,apply_reason,status,audit_by_name,approve_by_name,audit_time,approve_time,audit_reason,reject_reason,created_at" page-data="replace"
        :where="where" :orderby="orderby" :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error,options}">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '没有更多数据'" border stripe>
          <uni-tr>
            <uni-th align="center">申请时间</uni-th>
            <uni-th align="center">客户</uni-th>
            <uni-th align="center">原业务员</uni-th>
            <uni-th align="center">目标业务员</uni-th>
            <uni-th align="center">申请人</uni-th>
            <uni-th align="center">申请原因</uni-th>
            <uni-th align="center">申请状态</uni-th>
            <uni-th align="center">审批人</uni-th>
            <uni-th align="center">审批时间</uni-th>
            <uni-th align="center">审批原因</uni-th>
            <uni-th align="center">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item,index) in data" :key="index">
            <uni-td align="center"><uni-dateformat :date="item.created_at" /></uni-td>
            <uni-td align="center">{{ getCustomerDisplay(item) }}</uni-td>
            <uni-td align="center">{{item.from_sales_name || '-'}}</uni-td>
            <uni-td align="center">{{item.to_sales_name || '-'}}</uni-td>
            <uni-td align="center">{{item.apply_by_name || '-'}}</uni-td>
            <uni-td align="center">{{item.apply_reason || '-'}}</uni-td>
            <uni-td align="center">
              <text v-if="getStatus(item) === 0" style="color:#f0ad4e">待审批</text>
              <text v-else-if="getStatus(item) === 1" style="color:#5cb85c">已通过</text>
              <text v-else-if="getStatus(item) === 2" style="color:#d9534f">已拒绝</text>
              <text v-else>-</text>
            </uni-td>
            <uni-td align="center">{{ getAuditByName(item) }}</uni-td>
            <uni-td align="center"><uni-dateformat :date="getAuditTime(item)" /></uni-td>
            <uni-td align="center">{{ getAuditReason(item) }}</uni-td>
            <uni-td align="center">
              <view class="uni-group" v-if="getStatus(item) === 0">
                <button class="uni-button" size="mini" type="primary" @click="approve(item)">通过</button>
                <button class="uni-button" size="mini" type="warn" style="margin-top: 5px; margin-left: 0;" @click="reject(item)">拒绝</button>
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
  const db = uniCloud.database()
  const dbOrderBy = 'created_at desc'
  
  export default {
    data() {
      return {
        queryForm: {
          mobile: '',
          status: '',
          from_sales_name: '',
          to_sales_name: '',
          dateRange: []
        },
        statusOptions: [
          { value: 0, text: '待审批' },
          { value: 1, text: '已通过' },
          { value: 2, text: '已拒绝' }
        ],
        where: '',
        orderby: dbOrderBy,
        options: { pageSize: 20, pageCurrent: 1 }
      }
    },
    onLoad(e) {
      if (e && e.status !== undefined && e.status !== null && String(e.status).trim() !== '') {
        const n = Number(e.status)
        if (!Number.isNaN(n)) {
          this.queryForm.status = n
        }
      }
      this.$nextTick(() => {
        if (this.queryForm.status !== '' && this.queryForm.status !== null) {
          this.search()
        }
      })
    },
    methods: {
      getWhere() {
        const conditions = []
        if (this.queryForm.mobile) {
          const queryRe = new RegExp(this.queryForm.mobile, 'i')
          conditions.push(`${queryRe}.test(mobile)`)
        }
        if (this.queryForm.status !== '' && this.queryForm.status !== null) {
          conditions.push(`status == ${this.queryForm.status}`)
        }
        if (this.queryForm.from_sales_name) {
          const queryRe = new RegExp(this.queryForm.from_sales_name, 'i')
          conditions.push(`${queryRe}.test(from_sales_name)`)
        }
        if (this.queryForm.to_sales_name) {
          const queryRe = new RegExp(this.queryForm.to_sales_name, 'i')
          conditions.push(`${queryRe}.test(to_sales_name)`)
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
          status: '',
          from_sales_name: '',
          to_sales_name: '',
          dateRange: []
        }
        this.search()
      },
      getStatus(item) {
        if (!item) return -1
        if (item.status === undefined || item.status === null) return -1
        return Number(item.status)
      },
      getCustomerDisplay(item) {
        if (!item) return '-'
        const customerName = (item.customer_name || '').trim()
        const mobile = (item.mobile || '').trim()
        if (customerName && mobile) {
          return `${customerName} / ${mobile}`
        }
        return customerName || mobile || '-'
      },
      getAuditByName(item) {
        return (item && (item.audit_by_name || item.approve_by_name)) || '-'
      },
      getAuditTime(item) {
        return (item && (item.audit_time || item.approve_time)) || ''
      },
      getAuditReason(item) {
        return (item && (item.audit_reason || item.reject_reason)) || '-'
      },
      onPageChanged(e) {
        this.$refs.udb.loadData({ current: e.current })
      },
      approve(item) {
        console.log('[审批-通过] item 完整对象:', JSON.stringify(item))
        console.log('[审批-通过] item._id:', item._id, '| item.id:', item.id)
        const applyId = item._id || item.id
        if (!applyId) {
          uni.showModal({ content: '无法获取申请单ID（_id为空），请刷新后重试', showCancel: false })
          return
        }
        uni.showModal({
          title: '通过申请',
          content: '确认通过该客户转移申请？',
          showCancel: true,
          success: (res) => {
            if (res.confirm) {
              this.submitAudit(applyId, 'approve', '')
            }
          }
        })
      },
      reject(item) {
        console.log('[审批-拒绝] item 完整对象:', JSON.stringify(item))
        console.log('[审批-拒绝] item._id:', item._id, '| item.id:', item.id)
        const applyId = item._id || item.id
        if (!applyId) {
          uni.showModal({ content: '无法获取申请单ID（_id为空），请刷新后重试', showCancel: false })
          return
        }
        uni.showModal({
          title: '拒绝申请',
          editable: true,
          placeholderText: '请输入拒绝原因（必填）',
          success: (res) => {
            if (!res.confirm) return
            const reason = (res.content || '').trim()
            if (!reason) {
              uni.showToast({ title: '请填写拒绝原因', icon: 'none' })
              return
            }
            this.submitAudit(applyId, 'reject', reason)
          }
        })
      },
      submitAudit(applyId, action, audit_reason) {
        console.log('[审批-提交] apply_id:', applyId, '| action:', action, '| audit_reason:', audit_reason)
        uni.showLoading({ title: '提交中' })
        const uniIdToken = uni.getStorageSync('uni_id_token') || ''
        const requestData = {
          uniIdToken,
          token: uniIdToken,
          apply_id: applyId,
          action,
          audit_reason
        }
        console.log('[审批-提交] 完整请求参数:', JSON.stringify(requestData))
        uniCloud.callFunction({
          name: 'auditCustomerTransferApply',
          data: requestData
        }).then(res => {
          uni.hideLoading()
          if (res.result.code === 200) {
            uni.showToast({ title: '操作成功' })
            this.$refs.udb.loadData()
          } else {
            uni.showModal({ content: res.result.message || '操作失败', showCancel: false })
          }
        }).catch(err => {
          uni.hideLoading()
          uni.showModal({ content: err.message || '请求报错', showCancel: false })
        })
      }
    }
  }
</script>
