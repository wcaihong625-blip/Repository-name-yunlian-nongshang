<template>
  <view class="page-shell">
    <!-- 页面标题 -->
    <view class="page-header">
      <view>
        <view class="page-title">采购管理</view>
        <view class="page-subtitle">管理平台农产品采购需求信息</view>
      </view>
    </view>

    <!-- 搜索和操作栏 -->
    <view class="filter-card">
      <view class="toolbar-row search-box">
        <input class="search-input" type="text" v-model="query" @confirm="search" placeholder="搜索采购标题、品类、地址..." />
        <button class="uni-button" type="primary" size="mini" @click="search">搜索</button>
      </view>
      
      <view class="button-group">
        <button class="action-btn add-btn" @click="navigateTo('./add')">
          <text>新增采购</text>
        </button>
        <button class="action-btn delete-btn" :disabled="!selectedIndexs.length" @click="delTable">
          <text>批量删除</text>
        </button>
        <download-excel class="hide-on-phone" :fields="exportExcel.fields" :data="exportExcelData" :type="exportExcel.type" :name="exportExcel.filename">
          <button class="action-btn export-btn">
            <text>导出Excel</text>
          </button>
        </download-excel>
      </view>
    </view>

    <!-- 数据表格 -->
    <view class="table-card">
      <unicloud-db ref="udb" :collection="collectionList" field="title,category,specifications,quantity,unit,price,address,remarks,user_id,publisher,status,urgency,updated_date,publish_date" :where="where" page-data="replace"
        :orderby="orderby" :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error,options}" :options="options" loadtime="manual" @load="onqueryload">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '没有更多数据'" border stripe type="selection" @selection-change="selectionChange">
          <uni-tr>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'title')" sortable @sort-change="sortChange($event, 'title')">采购标题</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'category')" sortable @sort-change="sortChange($event, 'category')">产品品类</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'specifications')" sortable @sort-change="sortChange($event, 'specifications')">详细规格</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'quantity')" sortable @sort-change="sortChange($event, 'quantity')">采购数量</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'unit')" sortable @sort-change="sortChange($event, 'unit')">单位</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'price')" sortable @sort-change="sortChange($event, 'price')">期望单价</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'address')" sortable @sort-change="sortChange($event, 'address')">收货地址</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'publisher')" sortable @sort-change="sortChange($event, 'publisher')">发布者</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.status_localdata" @filter-change="filterChange($event, 'status')">状态</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.urgency_localdata" @filter-change="filterChange($event, 'urgency')">紧急程度</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'updated_date')" sortable @sort-change="sortChange($event, 'updated_date')">更新时间</uni-th>
            <uni-th align="center" width="160">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item,index) in data" :key="index">
            <uni-td align="center">
              <text class="table-text-bold">{{item.title}}</text>
            </uni-td>
            <uni-td align="center">
              <view class="category-tag">{{item.category}}</view>
            </uni-td>
            <uni-td align="center" class="spec-cell">{{item.specifications || '-'}}</uni-td>
            <uni-td align="center">
              <text class="quantity-text">{{item.quantity}}</text>
              <text class="unit-text">{{item.unit}}</text>
            </uni-td>
            <uni-td align="center">{{item.unit}}</uni-td>
            <uni-td align="center">
              <text class="price-text">¥{{item.price}}</text>
            </uni-td>
            <uni-td align="center" class="address-cell">{{item.address || '-'}}</uni-td>
            <uni-td align="center">{{item.publisher || '-'}}</uni-td>
            <uni-td align="center">
              <view :class="['status-tag', getStatusClass(item.status)]">
                {{options.status_valuetotext[item.status]}}
              </view>
            </uni-td>
            <uni-td align="center">
              <view :class="['urgency-tag', getUrgencyClass(item.urgency)]">
                {{options.urgency_valuetotext[item.urgency] || '-'}}
              </view>
            </uni-td>
            <uni-td align="center">
              <uni-dateformat :threshold="[0, 0]" :date="item.updated_date"></uni-dateformat>
            </uni-td>
            <uni-td align="center">
              <view class="table-action-group">
                <button @click="navigateTo('./edit?id='+item._id, false)" class="table-btn edit-btn" size="mini">修改</button>
                <button @click="confirmDelete(item._id)" class="table-btn delete-btn" size="mini">删除</button>
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
  import { enumConverter, filterToWhere } from '../../js_sdk/validator/purchase_list.js';

  const db = uniCloud.database()
  // 表查询配置
  const dbOrderBy = '' // 排序字段
  const dbSearchFields = [] // 模糊搜索字段，支持模糊搜索的字段列表。联表查询格式: 主表字段名.副表字段名，例如用户表关联角色表 role.role_name
  // 分页配置
  const pageSize = 20
  const pageCurrent = 1

  const orderByMapping = {
    "ascending": "asc",
    "descending": "desc"
  }

  export default {
    data() {
      return {
        collectionList: "purchase_list",
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
              {
                "value": "已发布",
                "text": "已发布"
              },
              {
                "value": "已下架",
                "text": "已下架"
              }
            ],
            "urgency_localdata": [
              {
                "value": "Normal",
                "text": "Normal"
              },
              {
                "value": "Urgent",
                "text": "Urgent"
              }
            ]
          },
          ...enumConverter
        },
        imageStyles: {
          width: 64,
          height: 64
        },
        exportExcel: {
          "filename": "purchase_list.xls",
          "type": "xls",
          "fields": {
            "采购标题": "title",
            "产品品类": "category",
            "详细规格": "specifications",
            "采购数量": "quantity",
            "单位": "unit",
            "期望单价": "price",
            "收货地址": "address",
            "补充说明": "remarks",
            "发布用户ID": "user_id",
            "发布者名称": "publisher",
            "状态": "status",
            "紧急程度": "urgency",
            "更新时间": "updated_date",
            "发布时间": "publish_date"
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
        // clear 表示刷新列表时是否清除页码，true 表示刷新并回到列表第 1 页，默认为 true
        uni.navigateTo({
          url,
          events: {
            refreshData: () => {
              this.loadData(clear)
            }
          }
        })
      },
      // 多选处理
      selectedItems() {
        var dataList = this.$refs.udb.dataList
        return this.selectedIndexs.map(i => dataList[i]._id)
      },
      // 批量删除
      delTable() {
        this.$refs.udb.remove(this.selectedItems(), {
          success:(res) => {
            this.$refs.table.clearSelection()
          }
        })
      },
      // 多选
      selectionChange(e) {
        this.selectedIndexs = e.detail.index
      },
      confirmDelete(id) {
        this.$refs.udb.remove(id, {
          success:(res) => {
            this.$refs.table.clearSelection()
          }
        })
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
          '已发布': 'status-published',
          '已下架': 'status-offline'
        }
        return statusMap[status] || 'status-default'
      },
      getUrgencyClass(urgency) {
        const urgencyMap = {
          'Urgent': 'urgency-urgent',
          'Normal': 'urgency-normal'
        }
        return urgencyMap[urgency] || 'urgency-default'
      }
    }
  }
</script>

<style scoped>
@import '@/styles/admin-page.scss';
.search-box { margin-bottom: 12px; }
.search-input {
  flex: 1;
  min-width: 260px;
  height: 34px;
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
}
.button-group { display: flex; gap: 10px; flex-wrap: wrap; }
.action-btn { display: inline-flex; align-items: center; gap: 6px; }
.table-text-bold { font-weight: 600; color: #1f2937; }
.category-tag { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 12px; background: #eef2ff; color: #334155; }
.spec-cell, .address-cell { max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.quantity-text { font-weight: 600; color: #0f172a; margin-right: 4px; }
.unit-text { font-size: 12px; color: #94a3b8; }
.price-text { font-weight: 600; color: #0f172a; font-size: 14px; }
.status-tag, .urgency-tag { display: inline-block; padding: 4px 10px; border-radius: 999px; font-size: 12px; }
.status-published { background: #ecfdf3; color: #15803d; }
.status-offline { background: #fff7ed; color: #b45309; }
.status-default, .urgency-default { background: #f1f5f9; color: #64748b; }
.urgency-urgent { background: #fef2f2; color: #b91c1c; }
.urgency-normal { background: #eff6ff; color: #1d4ed8; }
.table-action-group { display: flex; gap: 8px; justify-content: center; }
.table-btn { padding: 0 10px; }
.pagination-container { margin-top: 16px; display: flex; justify-content: center; }
</style>
