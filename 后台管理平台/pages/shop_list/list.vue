<template>
  <view class="page-container">
    <!-- 页面标题 -->
    <view class="page-header">
      <view class="header-title">
        <text class="title-icon">🏪</text>
        <text class="title-text">店铺管理</text>
      </view>
      <view class="header-subtitle">管理平台入驻店铺信息</view>
    </view>

    <!-- 搜索和操作栏 -->
    <view class="action-bar">
      <view class="search-box">
        <text class="search-icon">🔍</text>
        <input class="search-input" type="text" v-model="query" @confirm="search" placeholder="搜索店铺名称、类目、地区..." />
        <button class="search-btn" type="primary" @click="search">搜索</button>
      </view>
      
      <view class="button-group">
        <button class="action-btn add-btn" @click="navigateTo('./add')">
          <text class="btn-icon">➕</text>
          <text>新增店铺</text>
        </button>
        <button class="action-btn delete-btn" :disabled="!selectedIndexs.length" @click="delTable">
          <text class="btn-icon">🗑️</text>
          <text>批量删除</text>
        </button>
        <download-excel class="hide-on-phone" :fields="exportExcel.fields" :data="exportExcelData" :type="exportExcel.type" :name="exportExcel.filename">
          <button class="action-btn export-btn">
            <text class="btn-icon">📊</text>
            <text>导出Excel</text>
          </button>
        </download-excel>
      </view>
    </view>

    <!-- 数据表格 -->
    <view class="table-container">
      <unicloud-db ref="udb" :collection="collectionList" field="shopName,category,region,address,contactName,phone,image,plan,user_id,owner,status,updated_date,approved_date,rejected_reason" :where="where" page-data="replace"
        :orderby="orderby" :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error,options}" :options="options" loadtime="manual" @load="onqueryload">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '没有更多数据'" border stripe type="selection" @selection-change="selectionChange">
          <uni-tr>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'shopName')" sortable @sort-change="sortChange($event, 'shopName')">店铺名称</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'category')" sortable @sort-change="sortChange($event, 'category')">主营类目</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'region')" sortable @sort-change="sortChange($event, 'region')">所在地区</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'address')" sortable @sort-change="sortChange($event, 'address')">详细地址</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'contactName')" sortable @sort-change="sortChange($event, 'contactName')">联系人</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'phone')" sortable @sort-change="sortChange($event, 'phone')">联系电话</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'image')" sortable @sort-change="sortChange($event, 'image')">店铺照片</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.plan_localdata" @filter-change="filterChange($event, 'plan')">套餐类型</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'user_id')" sortable @sort-change="sortChange($event, 'user_id')">用户ID</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'owner')" sortable @sort-change="sortChange($event, 'owner')">所有者</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.status_localdata" @filter-change="filterChange($event, 'status')">状态</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'updated_date')" sortable @sort-change="sortChange($event, 'updated_date')">更新时间</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'approved_date')" sortable @sort-change="sortChange($event, 'approved_date')">审核通过时间</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'rejected_reason')" sortable @sort-change="sortChange($event, 'rejected_reason')">拒绝原因</uni-th>
            <uni-th align="center" width="160">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item,index) in data" :key="index">
            <uni-td align="center">
              <text class="table-text-bold">{{item.shopName}}</text>
            </uni-td>
            <uni-td align="center">{{item.category}}</uni-td>
            <uni-td align="center">{{item.region}}</uni-td>
            <uni-td align="center">{{item.address}}</uni-td>
            <uni-td align="center">{{item.contactName}}</uni-td>
            <uni-td align="center">{{item.phone}}</uni-td>
            <uni-td align="center">
              <image v-if="item.image" :src="item.image" mode="aspectFill" class="shop-image"></image>
              <text v-else class="no-image">无图片</text>
            </uni-td>
            <uni-td align="center">
              <view :class="['plan-tag', item.plan === 'vip' ? 'plan-vip' : 'plan-basic']">
                {{options.plan_valuetotext[item.plan]}}
              </view>
            </uni-td>
            <uni-td align="center">{{item.user_id}}</uni-td>
            <uni-td align="center">{{item.owner}}</uni-td>
            <uni-td align="center">
              <view :class="['status-tag', getStatusClass(item.status)]">
                {{options.status_valuetotext[item.status]}}
              </view>
            </uni-td>
            <uni-td align="center">
              <uni-dateformat :threshold="[0, 0]" :date="item.updated_date"></uni-dateformat>
            </uni-td>
            <uni-td align="center">
              <uni-dateformat :threshold="[0, 0]" :date="item.approved_date"></uni-dateformat>
            </uni-td>
            <uni-td align="center">{{item.rejected_reason}}</uni-td>
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
  import { enumConverter, filterToWhere } from '../../js_sdk/validator/shop_list.js';

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
        collectionList: "shop_list",
        query: '',
        where: '',
        orderby: dbOrderBy,
        orderByFieldName: "",
        selectedIndexs: [],
        options: {
          pageSize,
          pageCurrent,
          filterData: {
            "plan_localdata": [
              {
                "value": "vip",
                "text": "vip"
              },
              {
                "value": "basic",
                "text": "basic"
              }
            ],
            "status_localdata": [
              {
                "value": "待审核",
                "text": "待审核"
              },
              {
                "value": "已通过",
                "text": "已通过"
              },
              {
                "value": "已拒绝",
                "text": "已拒绝"
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
          "filename": "shop_list.xls",
          "type": "xls",
          "fields": {
            "店铺名称": "shopName",
            "主营类目": "category",
            "所在地区": "region",
            "详细地址": "address",
            "联系人": "contactName",
            "联系电话": "phone",
            "店铺照片": "image",
            "套餐类型": "plan",
            "用户ID": "user_id",
            "所有者": "owner",
            "状态": "status",
            "更新时间": "updated_date",
            "审核通过时间": "approved_date",
            "拒绝原因": "rejected_reason"
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
          '待审核': 'status-pending',
          '已通过': 'status-approved',
          '已拒绝': 'status-rejected'
        }
        return statusMap[status] || 'status-default'
      }
    }
  }
</script>

<style scoped>
/* 页面容器 */
.page-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
}

/* 页面标题 */
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

/* 操作栏 */
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
  transition: all 0.3s ease;
}

.search-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
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
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.btn-icon {
  margin-right: 6px;
  font-size: 16px;
}

.add-btn {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: #ffffff;
}

.delete-btn {
  background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%);
  color: #ffffff;
}

.delete-btn[disabled] {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-btn {
  background: linear-gradient(135deg, #fa709a 0%, #fee140 100%);
  color: #333333;
}

/* 表格容器 */
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

.shop-image {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  object-fit: cover;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.no-image {
  color: #999999;
  font-size: 12px;
}

/* 套餐标签 */
.plan-tag {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.plan-vip {
  background: linear-gradient(135deg, #ffd89b 0%, #19547b 100%);
  color: #ffffff;
}

.plan-basic {
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
  color: #333333;
}

/* 状态标签 */
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

.status-default {
  background: #e0e0e0;
  color: #666666;
}

/* 表格操作按钮 */
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
  transition: all 0.3s ease;
}

.edit-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
}

.edit-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.table-btn.delete-btn {
  background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%);
  color: #ffffff;
}

.table-btn.delete-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(238, 9, 121, 0.4);
}

/* 分页容器 */
.pagination-container {
  margin-top: 20px;
  padding: 20px 0;
  display: flex;
  justify-content: center;
}

/* 响应式 */
@media (max-width: 768px) {
  .page-container {
    padding: 10px;
  }

  .page-header {
    padding: 20px;
  }

  .title-text {
    font-size: 24px;
  }

  .action-bar {
    padding: 15px;
  }

  .button-group {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
    justify-content: center;
  }

  .table-container {
    padding: 15px;
    overflow-x: auto;
  }

  .hide-on-phone {
    display: none !important;
  }
}
</style>
