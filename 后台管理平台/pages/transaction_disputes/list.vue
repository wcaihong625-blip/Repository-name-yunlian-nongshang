<template>
  <view class="page-container">
    <view class="page-header">
      <view class="header-title">
        <text class="title-icon">⚖️</text>
        <text class="title-text">交易纠纷调解</text>
      </view>
      <view class="header-subtitle">处理买卖双方交易纠纷</view>
    </view>

    <view class="action-bar">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input class="search-input" type="text" v-model="query" @confirm="search" placeholder="搜索纠纷单号、订单号、申诉人..." />
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
      <unicloud-db ref="udb" :collection="collectionList" field="dispute_no,order_no,shop_name,disputant_name,disputant_type,dispute_type,dispute_reason,status,mediator_name,mediation_date,created_date" :where="where" page-data="replace"
        :orderby="orderby" :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error,options}" :options="options" loadtime="manual" @load="onqueryload">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '没有更多数据'" border stripe type="selection" @selection-change="selectionChange">
          <uni-tr>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'dispute_no')" sortable @sort-change="sortChange($event, 'dispute_no')">纠纷单号</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'order_no')">关联订单</uni-th>
            <uni-th align="center">店铺名称</uni-th>
            <uni-th align="center">申诉人</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.disputant_type_localdata" @filter-change="filterChange($event, 'disputant_type')">申诉人类型</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.dispute_type_localdata" @filter-change="filterChange($event, 'dispute_type')">纠纷类型</uni-th>
            <uni-th align="center">纠纷原因</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.status_localdata" @filter-change="filterChange($event, 'status')">处理状态</uni-th>
            <uni-th align="center">调解人</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'mediation_date')" sortable @sort-change="sortChange($event, 'mediation_date')">调解时间</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'created_date')" sortable @sort-change="sortChange($event, 'created_date')">创建时间</uni-th>
            <uni-th align="center" width="160">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item,index) in data" :key="index">
            <uni-td align="center">
              <text class="table-text-bold">{{item.dispute_no}}</text>
            </uni-td>
            <uni-td align="center">{{item.order_no}}</uni-td>
            <uni-td align="center">{{item.shop_name || '-'}}</uni-td>
            <uni-td align="center">{{item.disputant_name || '-'}}</uni-td>
            <uni-td align="center">{{options.disputant_type_valuetotext[item.disputant_type] || item.disputant_type}}</uni-td>
            <uni-td align="center">{{options.dispute_type_valuetotext[item.dispute_type] || item.dispute_type}}</uni-td>
            <uni-td align="center" class="reason-cell">{{item.dispute_reason || '-'}}</uni-td>
            <uni-td align="center">
              <view :class="['status-tag', getStatusClass(item.status)]">
                {{options.status_valuetotext[item.status] || item.status}}
              </view>
            </uni-td>
            <uni-td align="center">{{item.mediator_name || '-'}}</uni-td>
            <uni-td align="center">
              <uni-dateformat v-if="item.mediation_date" :threshold="[0, 0]" :date="item.mediation_date"></uni-dateformat>
              <text v-else>-</text>
            </uni-td>
            <uni-td align="center">
              <uni-dateformat :threshold="[0, 0]" :date="item.created_date"></uni-dateformat>
            </uni-td>
            <uni-td align="center">
              <view class="table-action-group">
                <button @click="navigateTo('./edit?id='+item._id, false)" class="table-btn edit-btn" size="mini">处理</button>
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
  import { enumConverter, filterToWhere } from '../../js_sdk/validator/transaction_disputes.js';

  const db = uniCloud.database()
  const dbOrderBy = ''
  const dbSearchFields = ['dispute_no', 'order_no', 'disputant_name']
  const pageSize = 20
  const pageCurrent = 1

  const orderByMapping = {
    "ascending": "asc",
    "descending": "desc"
  }

  export default {
    data() {
      return {
        collectionList: "transaction_disputes",
        query: '',
        where: '',
        orderby: dbOrderBy,
        orderByFieldName: "",
        selectedIndexs: [],
        options: {
          pageSize,
          pageCurrent,
          filterData: {
            "disputant_type_localdata": [
              {"value": "buyer", "text": "买家"},
              {"value": "seller", "text": "卖家"}
            ],
            "dispute_type_localdata": [
              {"value": "payment", "text": "支付纠纷"},
              {"value": "refund", "text": "退款纠纷"},
              {"value": "service", "text": "服务纠纷"},
              {"value": "quality", "text": "质量问题"}
            ],
            "status_localdata": [
              {"value": "待处理", "text": "待处理"},
              {"value": "处理中", "text": "处理中"},
              {"value": "已调解", "text": "已调解"},
              {"value": "已关闭", "text": "已关闭"}
            ]
          },
          ...enumConverter
        },
        exportExcel: {
          "filename": "transaction_disputes.xls",
          "type": "xls",
          "fields": {
            "纠纷单号": "dispute_no",
            "关联订单": "order_no",
            "店铺名称": "shop_name",
            "申诉人": "disputant_name",
            "纠纷类型": "dispute_type",
            "处理状态": "status",
            "调解人": "mediator_name",
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
        const statusMap = {
          '待处理': 'status-pending',
          '处理中': 'status-processing',
          '已调解': 'status-resolved',
          '已关闭': 'status-closed'
        }
        return statusMap[status] || 'status-default'
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

.reason-cell {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-tag {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.status-pending {
  background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
  color: #333333;
}

.status-processing {
  background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
  color: #ffffff;
}

.status-resolved {
  background: linear-gradient(135deg, #55efc4 0%, #00b894 100%);
  color: #ffffff;
}

.status-closed {
  background: #e0e0e0;
  color: #666666;
}

.status-default {
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



