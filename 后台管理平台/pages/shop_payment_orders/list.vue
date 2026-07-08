<template>
  <view>
    <view class="uni-header">
      <view class="uni-group">
        <view class="uni-title"></view>
        <view class="uni-sub-title"></view>
      </view>
      <view class="uni-group">
        <input class="uni-search" type="text" v-model="query" @confirm="search" placeholder="请输入搜索内容" />
        <button class="uni-button" type="default" size="mini" @click="search">搜索</button>
        <button class="uni-button" type="default" size="mini" @click="navigateTo('./add')">新增</button>
        <button class="uni-button" type="default" size="mini" :disabled="!selectedIndexs.length" @click="delTable">批量删除</button>
        <download-excel class="hide-on-phone" :fields="exportExcel.fields" :data="exportExcelData" :type="exportExcel.type" :name="exportExcel.filename">
          <button class="uni-button" type="primary" size="mini">导出 Excel</button>
        </download-excel>
      </view>
    </view>
    <view class="uni-container">
      <unicloud-db ref="udb" :collection="collectionList" field="order_no,shop_id,shop_name,user_id,user_name,plan_type,amount,payment_method,payment_channel,transaction_id,status,pay_date,expire_date,remark,updated_date" :where="where" page-data="replace"
        :orderby="orderby" :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error,options}" :options="options" loadtime="manual" @load="onqueryload">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '没有更多数据'" border stripe type="selection" @selection-change="selectionChange">
          <uni-tr>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'order_no')" sortable @sort-change="sortChange($event, 'order_no')">订单号</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'shop_id')" sortable @sort-change="sortChange($event, 'shop_id')">店铺ID</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'shop_name')" sortable @sort-change="sortChange($event, 'shop_name')">店铺名称</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'user_id')" sortable @sort-change="sortChange($event, 'user_id')">用户ID</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'user_name')" sortable @sort-change="sortChange($event, 'user_name')">用户名称</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.plan_type_localdata" @filter-change="filterChange($event, 'plan_type')">套餐类型</uni-th>
            <uni-th align="center" sortable @sort-change="sortChange($event, 'amount')">支付金额</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.payment_method_localdata" @filter-change="filterChange($event, 'payment_method')">支付方式</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'payment_channel')" sortable @sort-change="sortChange($event, 'payment_channel')">支付渠道</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'transaction_id')" sortable @sort-change="sortChange($event, 'transaction_id')">交易流水号</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.status_localdata" @filter-change="filterChange($event, 'status')">订单状态</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'pay_date')" sortable @sort-change="sortChange($event, 'pay_date')">支付时间</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'expire_date')" sortable @sort-change="sortChange($event, 'expire_date')">订单过期时间</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'remark')" sortable @sort-change="sortChange($event, 'remark')">备注</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'updated_date')" sortable @sort-change="sortChange($event, 'updated_date')">更新时间</uni-th>
            <uni-th align="center">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item,index) in data" :key="index">
            <uni-td align="center">{{item.order_no}}</uni-td>
            <uni-td align="center">{{item.shop_id}}</uni-td>
            <uni-td align="center">{{item.shop_name}}</uni-td>
            <uni-td align="center">{{item.user_id}}</uni-td>
            <uni-td align="center">{{item.user_name}}</uni-td>
            <uni-td align="center">{{options.plan_type_valuetotext[item.plan_type]}}</uni-td>
            <uni-td align="center">{{item.amount}}</uni-td>
            <uni-td align="center">{{options.payment_method_valuetotext[item.payment_method]}}</uni-td>
            <uni-td align="center">{{item.payment_channel}}</uni-td>
            <uni-td align="center">{{item.transaction_id}}</uni-td>
            <uni-td align="center">{{options.status_valuetotext[item.status]}}</uni-td>
            <uni-td align="center">
              <uni-dateformat :threshold="[0, 0]" :date="item.pay_date"></uni-dateformat>
            </uni-td>
            <uni-td align="center">
              <uni-dateformat :threshold="[0, 0]" :date="item.expire_date"></uni-dateformat>
            </uni-td>
            <uni-td align="center">{{item.remark}}</uni-td>
            <uni-td align="center">
              <uni-dateformat :threshold="[0, 0]" :date="item.updated_date"></uni-dateformat>
            </uni-td>
            <uni-td align="center">
              <view class="uni-group">
                <button @click="navigateTo('./edit?id='+item._id, false)" class="uni-button" size="mini" type="primary">修改</button>
                <button @click="confirmDelete(item._id)" class="uni-button" size="mini" type="warn">删除</button>
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
  import { enumConverter, filterToWhere } from '../../js_sdk/validator/shop_payment_orders.js';

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
        collectionList: "shop_payment_orders",
        query: '',
        where: '',
        orderby: dbOrderBy,
        orderByFieldName: "",
        selectedIndexs: [],
        options: {
          pageSize,
          pageCurrent,
          filterData: {
            "plan_type_localdata": [
              {
                "value": "vip",
                "text": "vip"
              },
              {
                "value": "basic",
                "text": "basic"
              }
            ],
            "payment_method_localdata": [
              {
                "value": "wxpay",
                "text": "wxpay"
              },
              {
                "value": "alipay",
                "text": "alipay"
              }
            ],
            "status_localdata": [
              {
                "value": "待支付",
                "text": "待支付"
              },
              {
                "value": "已支付",
                "text": "已支付"
              },
              {
                "value": "已取消",
                "text": "已取消"
              },
              {
                "value": "已退款",
                "text": "已退款"
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
          "filename": "shop_payment_orders.xls",
          "type": "xls",
          "fields": {
            "订单号": "order_no",
            "店铺ID": "shop_id",
            "店铺名称": "shop_name",
            "用户ID": "user_id",
            "用户名称": "user_name",
            "套餐类型": "plan_type",
            "支付金额": "amount",
            "支付方式": "payment_method",
            "支付渠道": "payment_channel",
            "交易流水号": "transaction_id",
            "订单状态": "status",
            "支付时间": "pay_date",
            "订单过期时间": "expire_date",
            "备注": "remark",
            "更新时间": "updated_date"
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
      }
    }
  }
</script>

<style>
</style>


