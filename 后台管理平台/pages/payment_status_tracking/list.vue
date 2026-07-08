<template>
  <view class="page-container">
    <view class="page-header">
      <view class="header-title">
        <text class="title-icon">📊</text>
        <text class="title-text">支付状态跟踪</text>
      </view>
      <view class="header-subtitle">跟踪订单支付状态变化</view>
    </view>

    <view class="action-bar">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input class="search-input" type="text" v-model="query" @confirm="search" placeholder="搜索订单号..." />
        <button class="search-btn" type="primary" @click="search">搜索</button>
      </view>
      
      <view class="button-group">
        <download-excel class="hide-on-phone" :fields="exportExcel.fields" :data="exportExcelData" :type="exportExcel.type" :name="exportExcel.filename">
          <button class="action-btn export-btn">
            <text class="btn-icon">📊</text>
            <text>导出Excel</text>
          </button>
        </download-excel>
      </view>
    </view>

    <view class="table-container">
      <unicloud-db ref="udb" :collection="collectionList" field="order_no,order_type,current_status,payment_info,callback_status,last_check_time,check_count,created_date,updated_date" :where="where" page-data="replace"
        :orderby="orderby" :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error,options}" :options="options" loadtime="manual" @load="onqueryload">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '没有更多数据'" border stripe type="selection" @selection-change="selectionChange">
          <uni-tr>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'order_no')" sortable @sort-change="sortChange($event, 'order_no')">订单号</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.order_type_localdata" @filter-change="filterChange($event, 'order_type')">订单类型</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'current_status')">当前状态</uni-th>
            <uni-th align="center">支付金额</uni-th>
            <uni-th align="center">支付方式</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.callback_status_localdata" @filter-change="filterChange($event, 'callback_status')">回调状态</uni-th>
            <uni-th align="center">检查次数</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'last_check_time')" sortable @sort-change="sortChange($event, 'last_check_time')">最后检查</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'created_date')" sortable @sort-change="sortChange($event, 'created_date')">创建时间</uni-th>
            <uni-th align="center" width="160">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item,index) in data" :key="index">
            <uni-td align="center">
              <text class="table-text-bold">{{item.order_no}}</text>
            </uni-td>
            <uni-td align="center">{{options.order_type_valuetotext[item.order_type] || item.order_type}}</uni-td>
            <uni-td align="center">
              <view :class="['status-tag', getStatusClass(item.current_status)]">
                {{item.current_status}}
              </view>
            </uni-td>
            <uni-td align="center">¥{{item.payment_info && item.payment_info.amount ? item.payment_info.amount : '-'}}</uni-td>
            <uni-td align="center">{{item.payment_info && item.payment_info.payment_method ? item.payment_info.payment_method : '-'}}</uni-td>
            <uni-td align="center">
              <view :class="['callback-tag', getCallbackClass(item.callback_status)]">
                {{options.callback_status_valuetotext[item.callback_status] || item.callback_status}}
              </view>
            </uni-td>
            <uni-td align="center">{{item.check_count || 0}}</uni-td>
            <uni-td align="center">
              <uni-dateformat v-if="item.last_check_time" :threshold="[0, 0]" :date="item.last_check_time"></uni-dateformat>
              <text v-else>-</text>
            </uni-td>
            <uni-td align="center">
              <uni-dateformat :threshold="[0, 0]" :date="item.created_date"></uni-dateformat>
            </uni-td>
            <uni-td align="center">
              <view class="table-action-group">
                <button @click="navigateTo('./edit?id='+item._id, false)" class="table-btn edit-btn" size="mini">查看</button>
              </view>
            </uni-td>
          </uni-tr>
        </uni-table>
        <view class="pagination-container">
          <uni-pagination show-icon :page-size="pagination.size" v-model="pagination.current" :total="pagination.count" @change="onPageChanged" />
        </view>
      </unicloud-db>
    </view>
  </view>
</template>

<script>
  import { enumConverter, filterToWhere } from '../../js_sdk/validator/payment_status_tracking.js';

  const db = uniCloud.database()
  const dbOrderBy = ''
  const dbSearchFields = ['order_no']
  const pageSize = 20
  const pageCurrent = 1

  const orderByMapping = {
    "ascending": "asc",
    "descending": "desc"
  }

  export default {
    data() {
      return {
        collectionList: "payment_status_tracking",
        query: '',
        where: '',
        orderby: dbOrderBy,
        orderByFieldName: "",
        selectedIndexs: [],
        options: {
          pageSize,
          pageCurrent,
          filterData: {
            "order_type_localdata": [
              {"value": "shop_payment", "text": "开店付费"},
              {"value": "refund", "text": "退款"},
              {"value": "dispute", "text": "纠纷"}
            ],
            "callback_status_localdata": [
              {"value": "pending", "text": "待回调"},
              {"value": "success", "text": "成功"},
              {"value": "failed", "text": "失败"}
            ]
          },
          ...enumConverter
        },
        exportExcel: {
          "filename": "payment_status_tracking.xls",
          "type": "xls",
          "fields": {
            "订单号": "order_no",
            "订单类型": "order_type",
            "当前状态": "current_status",
            "回调状态": "callback_status",
            "检查次数": "check_count",
            "创建时间": "created_date"
          }
        },
        exportExcelData: []
      }
    },
    onLoad() {
      this._filter = {}
    },
    onReady() {
      this.$refs.udb.loadData()
    },
    methods: {
      onqueryload(data) {
        this.exportExcelData = data
      },
      getWhere() {
        const query = this.query.trim()
        if (!query) {
          return ''
        }
        const queryRe = new RegExp(query, 'i')
        return dbSearchFields.map(name => queryRe + '.test(' + name + ')').join(' || ')
      },
      search() {
        const newWhere = this.getWhere()
        this.where = newWhere
        this.$nextTick(() => {
          this.loadData()
        })
      },
      loadData(clear = true) {
        this.$refs.udb.loadData({
          clear
        })
      },
      onPageChanged(e) {
        this.selectedIndexs.length = 0
        this.$refs.table.clearSelection()
        this.$refs.udb.loadData({
          current: e.current
        })
      },
      navigateTo(url, clear) {
        uni.navigateTo({
          url,
          events: {
            refreshData: () => {
              this.loadData(clear)
            }
          }
        })
      },
      selectedItems() {
        var dataList = this.$refs.udb.dataList
        return this.selectedIndexs.map(i => dataList[i]._id)
      },
      selectionChange(e) {
        this.selectedIndexs = e.detail.index
      },
      sortChange(e, name) {
        this.orderByFieldName = name;
        if (e.order) {
          this.orderby = name + ' ' + orderByMapping[e.order]
        } else {
          this.orderby = ''
        }
        this.$refs.table.clearSelection()
        this.$nextTick(() => {
          this.$refs.udb.loadData()
        })
      },
      filterChange(e, name) {
        this._filter[name] = {
          type: e.filterType,
          value: e.filter
        }
        let newWhere = filterToWhere(this._filter, db.command)
        if (Object.keys(newWhere).length) {
          this.where = newWhere
        } else {
          this.where = ''
        }
        this.$nextTick(() => {
          this.$refs.udb.loadData()
        })
      },
      getStatusClass(status) {
        if (!status) return 'status-default'
        if (status.includes('成功') || status.includes('完成')) return 'status-success'
        if (status.includes('失败') || status.includes('拒绝')) return 'status-failed'
        if (status.includes('待') || status.includes('处理中')) return 'status-pending'
        return 'status-default'
      },
      getCallbackClass(status) {
        const statusMap = {
          'pending': 'callback-pending',
          'success': 'callback-success',
          'failed': 'callback-failed'
        }
        return statusMap[status] || 'callback-default'
      }
    }
  }
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
}

.page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 20px;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
}

.header-title {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.title-icon {
  font-size: 32px;
  margin-right: 12px;
}

.title-text {
  font-size: 28px;
  font-weight: bold;
  color: #ffffff;
}

.header-subtitle {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  margin-left: 44px;
}

.action-bar {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.search-box {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  background: #f5f7fa;
  border-radius: 8px;
  padding: 8px 12px;
}

.search-icon {
  font-size: 18px;
  margin-right: 8px;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 14px;
  outline: none;
}

.search-btn {
  margin-left: 10px;
  padding: 8px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
}

.button-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  cursor: pointer;
}

.export-btn {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: #333333;
}

.table-container {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.table-text-bold {
  font-weight: 600;
  color: #333333;
}

.status-tag {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.status-success {
  background: linear-gradient(135deg, #55efc4 0%, #00b894 100%);
  color: #ffffff;
}

.status-failed {
  background: linear-gradient(135deg, #ff7675 0%, #d63031 100%);
  color: #ffffff;
}

.status-pending {
  background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
  color: #333333;
}

.status-default {
  background: #e0e0e0;
  color: #666666;
}

.callback-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 16px;
  font-size: 11px;
  font-weight: 500;
}

.callback-pending {
  background: #fff3cd;
  color: #856404;
}

.callback-success {
  background: #d4edda;
  color: #155724;
}

.callback-failed {
  background: #f8d7da;
  color: #721c24;
}

.callback-default {
  background: #e0e0e0;
  color: #666666;
}

.table-action-group {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.table-btn {
  padding: 6px 16px;
  border-radius: 6px;
  border: none;
  font-size: 12px;
  cursor: pointer;
}

.edit-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
}

.pagination-container {
  margin-top: 20px;
  padding: 20px 0;
  display: flex;
  justify-content: center;
}

.hide-on-phone {
  display: block;
}

@media (max-width: 768px) {
  .hide-on-phone {
    display: none !important;
  }
}
</style>



