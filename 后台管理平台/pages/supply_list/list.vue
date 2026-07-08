<template>
  <view class="page-shell">
    <!-- 页面标题 -->
    <view class="page-header">
      <view>
        <view class="page-title">供应管理</view>
        <view class="page-subtitle">管理平台农产品供应信息</view>
      </view>
    </view>

    <!-- 搜索和操作栏 -->
    <view class="filter-card">
      <view class="toolbar-row search-box">
        <input class="search-input" type="text" v-model="query" @confirm="search" placeholder="搜索供应标题、品类、所在地..." />
        <button class="uni-button" type="primary" size="mini" @click="search">搜索</button>
      </view>
      
      <view class="button-group">
        <button class="action-btn add-btn" @click="navigateTo('./add')">
          <text>新增供应</text>
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
      <unicloud-db ref="udb" :collection="collectionList" field="title,category,specifications,quantity,unit,price,location,images,description,user_id,publisher,status,updated_date" :where="where" page-data="replace"
        :orderby="orderby" :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error,options}" :options="options" loadtime="manual" @load="onqueryload">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '没有更多数据'" border stripe type="selection" @selection-change="selectionChange">
          <uni-tr>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'title')" sortable @sort-change="sortChange($event, 'title')">供应标题</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'category')" sortable @sort-change="sortChange($event, 'category')">产品品类</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'specifications')" sortable @sort-change="sortChange($event, 'specifications')">详细规格</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'quantity')" sortable @sort-change="sortChange($event, 'quantity')">供应数量</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'unit')" sortable @sort-change="sortChange($event, 'unit')">单位</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'price')" sortable @sort-change="sortChange($event, 'price')">单价</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'location')" sortable @sort-change="sortChange($event, 'location')">所在地</uni-th>
            <uni-th align="center" sortable @sort-change="sortChange($event, 'images')">产品图片</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'publisher')" sortable @sort-change="sortChange($event, 'publisher')">发布者</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.status_localdata" @filter-change="filterChange($event, 'status')">状态</uni-th>
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
            <uni-td align="center">{{item.location}}</uni-td>
            <uni-td align="center">
              <image v-if="item.images && item.images.length > 0" :src="Array.isArray(item.images) ? item.images[0] : item.images" mode="aspectFill" class="product-image"></image>
              <text v-else class="no-image">无图片</text>
            </uni-td>
            <uni-td align="center">{{item.publisher || '-'}}</uni-td>
            <uni-td align="center">
              <view :class="['status-tag', getStatusClass(item.status)]">
                {{options.status_valuetotext[item.status]}}
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
  import { enumConverter, filterToWhere } from '../../js_sdk/validator/supply_list.js';

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
        collectionList: "supply_list",
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
            ]
          },
          ...enumConverter
        },
        imageStyles: {
          width: 64,
          height: 64
        },
        exportExcel: {
          "filename": "supply_list.xls",
          "type": "xls",
          "fields": {
            "供应标题": "title",
            "产品品类": "category",
            "详细规格": "specifications",
            "供应数量": "quantity",
            "单位": "unit",
            "单价": "price",
            "所在地": "location",
            "产品图片": "images",
            "产品描述": "description",
            "发布用户ID": "user_id",
            "发布者名称": "publisher",
            "状态": "status",
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
      },
      getStatusClass(status) {
        const statusMap = {
          '已发布': 'status-published',
          '已下架': 'status-offline'
        }
        return statusMap[status] || 'status-default'
      }
    }
  }
</script>

<style scoped>
@import '@/styles/admin-page.scss';
.search-box {
  margin-bottom: 12px;
}
.search-input {
  flex: 1;
  min-width: 260px;
  height: 34px;
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
}
.button-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.table-text-bold {
  font-weight: 600;
  color: #333333;
}

.category-tag {
  display: inline-block;
  padding: 4px 12px;
  background: linear-gradient(135deg, #a8edea 0%, #fed6e3 100%);
  border-radius: 12px;
  font-size: 12px;
  color: #333333;
}

.spec-cell {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quantity-text {
  font-weight: 600;
  color: #11998e;
  margin-right: 4px;
}

.unit-text {
  font-size: 12px;
  color: #999999;
}

.price-text {
  font-weight: 600;
  color: #ee0979;
  font-size: 14px;
}

.product-image {
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

/* 状态标签 */
.status-tag {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.status-published {
  background: linear-gradient(135deg, #55efc4 0%, #00b894 100%);
  color: #ffffff;
}

.status-offline {
  background: linear-gradient(135deg, #ffeaa7 0%, #fdcb6e 100%);
  color: #333333;
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
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: #ffffff;
}

.edit-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(17, 153, 142, 0.4);
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
}

.page-shell {
  min-height: 100%;
}

.page-shell .page-header,
.page-shell .filter-card,
.page-shell .table-card {
  background: #fff !important;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04) !important;
  border: 1px solid #eaf0f6;
}

.title-text {
  font-size: 20px;
  color: #0f172a;
}

</style>
