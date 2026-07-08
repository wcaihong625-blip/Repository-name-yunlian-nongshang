<template>
  <view>
    <view class="uni-header">
      <view class="uni-group" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
        <input class="uni-search" @confirm="search" v-model="queryForm.mobile" placeholder="手机号" style="width: 120px;" />
        <input class="uni-search" @confirm="search" v-model="queryForm.sales_name" placeholder="提成业务员" style="width: 100px;" />
        <view style="width: 130px;">
          <uni-data-select v-model="queryForm.order_type" :localdata="[{value:1,text:'首次开通'},{value:2,text:'续费'},{value:3,text:'类型升级'},{value:4,text:'周期升级'}]" placeholder="订单类型"></uni-data-select>
        </view>
        <view style="width: 150px;">
          <uni-data-select v-model="queryForm.order_scene" :localdata="[{value:'new',text:'新开通'},{value:'renew',text:'续费'},{value:'upgrade_plan',text:'周期升级'},{value:'upgrade_member_type',text:'类型升级'}]" placeholder="场景"></uni-data-select>
        </view>
        <view style="width: 110px;">
          <uni-data-select v-model="queryForm.order_status" :localdata="[{value:0,text:'待支付'},{value:1,text:'已支付'}]" placeholder="支付状态"></uni-data-select>
        </view>
        <view style="width: 110px;">
          <uni-data-select v-model="queryForm.commission_status" :localdata="[{value:0,text:'未结算'},{value:1,text:'已结算'}]" placeholder="结算状态"></uni-data-select>
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
    <view class="uni-container">
      <unicloud-db ref="udb" collection="member_order" field="order_no,mobile,order_type,order_scene,from_member_type,to_member_type,from_plan_type,to_plan_type,order_status,pay_amount,pay_time,sales_name,commission_type,commission_amount,commission_status" :where="where" page-data="replace"
        :orderby="orderby" :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error,options}">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '没有更多数据'" border stripe>
          <uni-tr>
            <uni-th align="center">订单号</uni-th>
            <uni-th align="center">手机号</uni-th>
            <uni-th align="center">类型</uni-th>
            <uni-th align="center">场景</uni-th>
            <uni-th align="center">升级路径</uni-th>
            <uni-th align="center">状态</uni-th>
            <uni-th align="center">支付金额</uni-th>
            <uni-th align="center">支付时间</uni-th>
            <uni-th align="center">提成业务员</uni-th>
            <uni-th align="center">提成金额</uni-th>
            <uni-th align="center">结算状态</uni-th>
          </uni-tr>
          <uni-tr v-for="(item,index) in data" :key="index">
            <uni-td align="center">{{item.order_no}}</uni-td>
            <uni-td align="center">{{item.mobile}}</uni-td>
            <uni-td align="center">
                <text v-if="item.order_type === 1">首次开通</text>
                <text v-else-if="item.order_type === 2">续费</text>
                <text v-else-if="item.order_type === 3">类型升级</text>
                <text v-else-if="item.order_type === 4">周期升级</text>
                <text v-else>未知</text>
            </uni-td>
            <uni-td align="center">{{ sceneText(item.order_scene) }}</uni-td>
            <uni-td align="center">{{ upgradePathText(item) }}</uni-td>
            <uni-td align="center">
                <text v-if="item.order_status === 1" style="color:#5cb85c">已支付</text>
                <text v-else style="color:#f0ad4e">待支付</text>
            </uni-td>
            <uni-td align="center">￥{{item.pay_amount}}</uni-td>
            <uni-td align="center"><uni-dateformat :date="item.pay_time" /></uni-td>
            <uni-td align="center">{{item.sales_name || '-'}}</uni-td>
            <uni-td align="center">￥{{item.commission_amount || 0}}</uni-td>
            <uni-td align="center">
              <text v-if="item.commission_status === 1" style="color:#5cb85c">已结算</text>
              <text v-else style="color:#f0ad4e">未结算</text>
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
          sales_name: '',
          order_type: '',
          order_scene: '',
          order_status: '',
          commission_status: '',
          dateRange: []
        },
        where: '',
        orderby: dbOrderBy,
        options: { pageSize: 20, pageCurrent: 1 }
      }
    },
    methods: {
      getWhere() {
        const conditions = []
        if (this.queryForm.mobile) {
          const queryRe = new RegExp(this.queryForm.mobile.trim(), 'i')
          conditions.push(`${queryRe}.test(mobile)`)
        }
        if (this.queryForm.sales_name) {
          const queryRe = new RegExp(this.queryForm.sales_name.trim(), 'i')
          conditions.push(`${queryRe}.test(sales_name)`)
        }
        if (this.queryForm.order_type !== '') {
          conditions.push(`order_type == ${this.queryForm.order_type}`)
        }
        if (this.queryForm.order_scene) {
          conditions.push(`order_scene == "${String(this.queryForm.order_scene)}"`)
        }
        if (this.queryForm.order_status !== '') {
          conditions.push(`order_status == ${this.queryForm.order_status}`)
        }
        if (this.queryForm.commission_status !== '') {
          conditions.push(`commission_status == ${this.queryForm.commission_status}`)
        }
        if (this.queryForm.dateRange && this.queryForm.dateRange.length === 2) {
           const start = new Date(this.queryForm.dateRange[0] + ' 00:00:00').getTime()
           const end = new Date(this.queryForm.dateRange[1] + ' 23:59:59').getTime()
           conditions.push(`pay_time >= ${start} && pay_time <= ${end}`)
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
          sales_name: '',
          order_type: '',
          order_scene: '',
          order_status: '',
          commission_status: '',
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
          name: 'exportMemberOrderData',
          data: {
             uniIdToken,
             token: uniIdToken,
             mobile: this.queryForm.mobile.trim(),
             sales_name: this.queryForm.sales_name.trim(),
             order_type: this.queryForm.order_type !== '' ? Number(this.queryForm.order_type) : null,
             order_scene: this.queryForm.order_scene || '',
             order_status: this.queryForm.order_status !== '' ? Number(this.queryForm.order_status) : null,
             commission_status: this.queryForm.commission_status !== '' ? Number(this.queryForm.commission_status) : null,
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
             
             // BOM头，防止Excel乱码
             let csvString = '\uFEFF' + data.headers_zh.join(',') + '\n'
             data.list.forEach(item => {
                const row = data.headers.map(header => {
                   let val = item[header]
                   if (val === undefined || val === null) val = ''
                   // 转义CSV双引号和逗号
                   val = String(val).replace(/"/g, '""')
                   return `"${val}"`
                })
                csvString += row.join(',') + '\n'
             })
             
             // 创建下载触发
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
      ,
      sceneText(scene) {
        const s = String(scene || '')
        if (s === 'new') return '新开通'
        if (s === 'renew') return '续费'
        if (s === 'upgrade_plan') return '周期升级'
        if (s === 'upgrade_member_type') return '类型升级'
        return '-'
      },
      upgradePathText(item) {
        const fm = item && item.from_member_type ? String(item.from_member_type) : ''
        const tm = item && item.to_member_type ? String(item.to_member_type) : ''
        const fp = item && item.from_plan_type ? String(item.from_plan_type) : ''
        const tp = item && item.to_plan_type ? String(item.to_plan_type) : ''
        const fmtMember = (v) => (v === 'enterprise' ? '企业' : v === 'personal' ? '个人' : '-')
        const fmtPlan = (v) => (v === 'year' ? '年卡' : v === 'quarter' ? '季卡' : v === 'month' ? '月卡' : '-')
        if ((item && item.order_scene) === 'upgrade_member_type') {
          return `${fmtMember(fm)}→${fmtMember(tm)}`
        }
        if ((item && item.order_scene) === 'upgrade_plan') {
          return `${fmtPlan(fp)}→${fmtPlan(tp)}`
        }
        return '-'
      }
    }
  }
</script>
<style>
.uni-input { height: 32px; line-height: 32px; font-size: 14px; background: #fff; box-sizing: border-box; }
</style>
