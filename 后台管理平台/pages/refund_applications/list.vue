<template>
  <view class="page-container">
    <view class="page-header">
      <view class="header-title">
        <text class="title-icon">💸</text>
        <text class="title-text">退款申请处理</text>
      </view>
      <view class="header-subtitle">处理用户退款申请</view>
    </view>

    <view class="action-bar">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input class="search-input" type="text" v-model="query" @confirm="search" placeholder="搜索退款单号、订单号、用户..." />
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
      <unicloud-db ref="udb" :collection="collectionList" field="refund_no,order_no,shop_name,user_name,original_amount,refund_amount,refund_reason,status,refund_method,auditor_name,audit_date,refund_date,created_date" :where="where" page-data="replace"
        :orderby="orderby" :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error,options}" :options="options" loadtime="manual" @load="onqueryload">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '没有更多数据'" border stripe type="selection" @selection-change="selectionChange">
          <uni-tr>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'refund_no')" sortable @sort-change="sortChange($event, 'refund_no')">退款单号</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'order_no')">原订单号</uni-th>
            <uni-th align="center">店铺名称</uni-th>
            <uni-th align="center">申请人</uni-th>
            <uni-th align="center" sortable @sort-change="sortChange($event, 'refund_amount')">退款金额</uni-th>
            <uni-th align="center">退款原因</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.status_localdata" @filter-change="filterChange($event, 'status')">退款状态</uni-th>
            <uni-th align="center">退款方式</uni-th>
            <uni-th align="center">审核人</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'audit_date')" sortable @sort-change="sortChange($event, 'audit_date')">审核时间</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'created_date')" sortable @sort-change="sortChange($event, 'created_date')">申请时间</uni-th>
            <uni-th align="center" width="160">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item,index) in data" :key="index">
            <uni-td align="center">
              <text class="table-text-bold">{{item.refund_no}}</text>
            </uni-td>
            <uni-td align="center">{{item.order_no}}</uni-td>
            <uni-td align="center">{{item.shop_name || '-'}}</uni-td>
            <uni-td align="center">{{item.user_name || '-'}}</uni-td>
            <uni-td align="center">¥{{item.refund_amount || 0}}</uni-td>
            <uni-td align="center" class="reason-cell">{{item.refund_reason || '-'}}</uni-td>
            <uni-td align="center">
              <view :class="['status-tag', getStatusClass(item.status)]">
                {{options.status_valuetotext[item.status] || item.status}}
              </view>
            </uni-td>
            <uni-td align="center">{{options.refund_method_valuetotext[item.refund_method] || item.refund_method || '-'}}</uni-td>
            <uni-td align="center">{{item.auditor_name || '-'}}</uni-td>
            <uni-td align="center">
              <uni-dateformat v-if="item.audit_date" :threshold="[0, 0]" :date="item.audit_date"></uni-dateformat>
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
  import { enumConverter, filterToWhere } from '../../js_sdk/validator/refund_applications.js';

  const db = uniCloud.database()
  const dbOrderBy = ''
  const dbSearchFields = ['refund_no', 'order_no', 'user_name']
  const pageSize = 20
  const pageCurrent = 1

  const orderByMapping = {
    "ascending": "asc",
    "descending": "desc"
  }

  export default {
    data() {
      return {
        collectionList: "refund_applications",
        query: '',
        where: '',
        orderby: dbOrderBy,
        orderByFieldName: "",
        selectedIndexs: [],
        options: {
          pageSize,
          pageCurrent,
          filterData: {
            "status_localdata": [
              {"value": "待审核", "text": "待审核"},
              {"value": "审核通过", "text": "审核通过"},
              {"value": "审核拒绝", "text": "审核拒绝"},
              {"value": "退款中", "text": "退款中"},
              {"value": "退款成功", "text": "退款成功"},
              {"value": "退款失败", "text": "退款失败"}
            ],
            "refund_method_localdata": [
              {"value": "原路退回", "text": "原路退回"},
              {"value": "线下退款", "text": "线下退款"}
            ]
          },
          ...enumConverter
        },
        exportExcel: {
          "filename": "refund_applications.xls",
          "type": "xls",
          "fields": {
            "退款单号": "refund_no",
            "原订单号": "order_no",
            "店铺名称": "shop_name",
            "申请人": "user_name",
            "退款金额": "refund_amount",
            "退款原因": "refund_reason",
            "退款状态": "status",
            "审核时间": "audit_date",
            "申请时间": "created_date"
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
          '待审核': 'status-pending',
          '审核通过': 'status-approved',
          '审核拒绝': 'status-rejected',
          '退款中': 'status-processing',
          '退款成功': 'status-success',
          '退款失败': 'status-failed'
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

.status-approved {
  background: linear-gradient(135deg, #55efc4 0%, #00b894 100%);
  color: #ffffff;
}

.status-rejected {
  background: linear-gradient(135deg, #ff7675 0%, #d63031 100%);
  color: #ffffff;
}

.status-processing {
  background: linear-gradient(135deg, #74b9ff 0%, #0984e3 100%);
  color: #ffffff;
}

.status-success {
  background: linear-gradient(135deg, #55efc4 0%, #00b894 100%);
  color: #ffffff;
}

.status-failed {
  background: linear-gradient(135deg, #ff7675 0%, #d63031 100%);
  color: #ffffff;
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



