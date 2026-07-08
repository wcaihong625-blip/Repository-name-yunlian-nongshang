<template>
  <view class="page-shell">
    <view class="page-header">
      <view>
        <text class="page-title">实名认证管理</text>
        <text class="page-subtitle">管理用户实名认证信息。</text>
      </view>
      <view class="header-actions">
        <button class="action-btn primary-btn" @click="navigateTo('./add')">
          <text>新增</text>
        </button>
      </view>
    </view>

    <!-- 搜索和操作栏 -->
    <view class="filter-card search-bar">
      <view class="toolbar-row search-input-wrapper">
        <input class="search-input" type="text" v-model="query" @confirm="search" placeholder="搜索用户ID、姓名、身份证号..." />
        <button class="uni-button" type="primary" size="mini" @click="search">搜索</button>
      </view>
      <view class="toolbar">
        <button class="toolbar-btn" type="default" size="mini" :disabled="!selectedIndexs.length" @click="delTable">
          <text class="toolbar-icon">🗑️</text>
          <text>批量删除</text>
        </button>
        <download-excel class="hide-on-phone" :fields="exportExcel.fields" :data="processedExportData" :type="exportExcel.type" :name="exportExcel.filename" :beforeGenerate="processExportData">
          <button class="toolbar-btn export-btn" type="primary" size="mini"><text>导出 Excel</text></button>
        </download-excel>
      </view>
    </view>
    <!-- 表格容器 -->
    <view class="table-card table-container">
      <unicloud-db ref="udb" :collection="collectionList" field="user_id,realName,idCard,idCardFront,status,rejectReason,auditor_id,auditor_name,audit_date,verified_date" :where="where" page-data="replace"
        :orderby="orderby" :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error,options}" :options="options" loadtime="manual" @load="onqueryload">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '没有更多数据'" border stripe type="selection" @selection-change="selectionChange" class="data-table">
          <uni-tr>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'user_id')" sortable @sort-change="sortChange($event, 'user_id')">用户ID</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'realName')" sortable @sort-change="sortChange($event, 'realName')">真实姓名</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'idCard')" sortable @sort-change="sortChange($event, 'idCard')">身份证号码</uni-th>
            <uni-th align="center">身份证照片</uni-th>
            <uni-th align="center" filter-type="select" :filter-data="options.filterData.status_localdata" @filter-change="filterChange($event, 'status')">认证状态</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'rejectReason')" sortable @sort-change="sortChange($event, 'rejectReason')">驳回原因</uni-th>
            <uni-th align="center" filter-type="search" @filter-change="filterChange($event, 'auditor_name')" sortable @sort-change="sortChange($event, 'auditor_name')">审核人</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'audit_date')" sortable @sort-change="sortChange($event, 'audit_date')">审核时间</uni-th>
            <uni-th align="center" filter-type="timestamp" @filter-change="filterChange($event, 'verified_date')" sortable @sort-change="sortChange($event, 'verified_date')">通过时间</uni-th>
            <uni-th align="center">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item,index) in data" :key="index" class="table-row">
            <uni-td align="center">{{item.user_id || '-'}}</uni-td>
            <uni-td align="center">{{item.realName || '-'}}</uni-td>
            <uni-td align="center" class="id-card-cell">{{formatIdCard(item.idCard)}}</uni-td>
            <uni-td align="center">
              <view class="image-preview-group">
                <image v-if="item.idCardFront" :src="item.idCardFront" mode="aspectFit" class="id-card-image" @click="previewImage(item.idCardFront)"></image>
                <text v-if="!item.idCardFront" class="no-image">-</text>
              </view>
            </uni-td>
            <uni-td align="center">
              <view class="status-badge" :class="getStatusClass(item.status)">
                {{getStatusText(item.status, options)}}
              </view>
            </uni-td>
            <uni-td align="center" class="reject-reason-cell">{{item.rejectReason || '-'}}</uni-td>
            <uni-td align="center">{{item.auditor_name || '-'}}</uni-td>
            <uni-td align="center">
              <uni-dateformat v-if="item.audit_date" :threshold="[0, 0]" :date="item.audit_date"></uni-dateformat>
              <text v-else>-</text>
            </uni-td>
            <uni-td align="center">
              <uni-dateformat v-if="item.verified_date" :threshold="[0, 0]" :date="item.verified_date"></uni-dateformat>
              <text v-else>-</text>
            </uni-td>
            <uni-td align="center">
              <view class="action-buttons">
                <button @click="navigateTo('./edit?id='+item._id, false)" class="action-btn edit-btn" size="mini" type="primary">编辑</button>
                <button @click="confirmDelete(item._id)" class="action-btn delete-btn" size="mini" type="warn">删除</button>
              </view>
            </uni-td>
          </uni-tr>
        </uni-table>
        <view class="pagination-wrapper">
          <uni-pagination show-icon :page-size="pagination.size" v-model="pagination.current" :total="pagination.count" @change="onPageChanged" />
        </view>
      </unicloud-db>
    </view>
  </view>
</template>

<script>
  import { enumConverter, filterToWhere } from '../../js_sdk/validator/realname_auth.js';

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
        collectionList: "realname_auth",
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
              "value": "unverified",
              "text": "未认证"
            },
            {
              "value": "pending",
              "text": "待审核"
            },
            {
              "value": "verified",
              "text": "已认证"
            },
            {
              "value": "rejected",
              "text": "已驳回"
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
          "filename": "realname_auth.xls",
          "type": "xls",
          "fields": {
            "用户ID": "user_id",
            "真实姓名": "realName",
            "身份证号码": "idCard",
            "身份证正面": "idCardFront",
            "认证状态": "status",
            "驳回原因": "rejectReason",
            "审核人ID": "auditor_id",
            "审核人姓名": "auditor_name",
            "审核时间": "audit_date",
            "认证通过时间": "verified_date"
          }
        },
        exportExcelData: [],
        processedExportData: []
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
        this.processedExportData = this.processExportDataForExcel(data)
      },
      // 处理导出数据，将图片URL转换为base64格式的HTML img标签
      processExportDataForExcel(data) {
        if (!data || !Array.isArray(data)) {
          return []
        }
        // 由于图片转换是异步的，这里先返回包含URL的数据
        // 实际的base64转换将在beforeGenerate钩子中完成
        return data.map(item => {
          const processedItem = { ...item }
          
          // 处理身份证正面照片 - 保留原始URL，将在异步处理中转换
          if (processedItem.idCardFront) {
            processedItem.idCardFront = processedItem.idCardFront // 保留原始URL，等待异步转换
          } else {
            processedItem.idCardFront = '-'
          }
          
          // 处理认证状态显示
          if (processedItem.status) {
            processedItem.status = this.getStatusText(processedItem.status, this.options)
          }
          
          // 格式化日期
          if (processedItem.audit_date) {
            processedItem.audit_date = this.formatDate(processedItem.audit_date)
          } else {
            processedItem.audit_date = '-'
          }
          if (processedItem.verified_date) {
            processedItem.verified_date = this.formatDate(processedItem.verified_date)
          } else {
            processedItem.verified_date = '-'
          }
          
          // 处理空值
          processedItem.user_id = processedItem.user_id || '-'
          processedItem.realName = processedItem.realName || '-'
          processedItem.idCard = processedItem.idCard || '-'
          processedItem.rejectReason = processedItem.rejectReason || '-'
          processedItem.auditor_id = processedItem.auditor_id || '-'
          processedItem.auditor_name = processedItem.auditor_name || '-'
          
          return processedItem
        })
      },
      // 将图片URL转换为base64格式的HTML img标签
      async convertImageUrlToBase64Html(imageUrl, altText = '') {
        if (!imageUrl || imageUrl === '-') return '-'
        
        // 如果已经是base64格式，直接使用
        if (imageUrl.startsWith('data:image')) {
          const imgStyle = 'max-width:120px;max-height:80px;object-fit:contain;display:block;margin:0 auto;border:1px solid #e0e0e0;border-radius:4px;'
          return `<img src="${imageUrl}" alt="${altText}" style="${imgStyle}" />`
        }
        
        // 如果是URL，转换为base64
        try {
          const base64 = await this.convertImageUrlToBase64(imageUrl)
          if (base64 && base64.startsWith('data:image')) {
            const imgStyle = 'max-width:120px;max-height:80px;object-fit:contain;display:block;margin:0 auto;border:1px solid #e0e0e0;border-radius:4px;'
            return `<img src="${base64}" alt="${altText}" style="${imgStyle}" />`
          } else {
            // 如果转换失败，使用原始URL
            const imgStyle = 'max-width:120px;max-height:80px;object-fit:contain;display:block;margin:0 auto;border:1px solid #e0e0e0;border-radius:4px;'
            return `<img src="${imageUrl}" alt="${altText}" style="${imgStyle}" />`
          }
        } catch (error) {
          console.error('转换图片失败:', error)
          // 转换失败时使用原始URL
          const imgStyle = 'max-width:120px;max-height:80px;object-fit:contain;display:block;margin:0 auto;border:1px solid #e0e0e0;border-radius:4px;'
          return `<img src="${imageUrl}" alt="${altText}" style="${imgStyle}" />`
        }
      },
      // 将图片URL转换为base64（异步方法，用于需要base64的场景）
      async convertImageUrlToBase64(imageUrl) {
        return new Promise((resolve, reject) => {
          if (!imageUrl) {
            resolve('')
            return
          }
          // 如果已经是base64，直接返回
          if (imageUrl.startsWith('data:image')) {
            resolve(imageUrl)
            return
          }
          
          // 对于uniCloud的图片URL，尝试使用fetch获取并转换为base64
          // 这样可以更好地处理跨域问题
          if (typeof fetch !== 'undefined') {
            fetch(imageUrl, {
              mode: 'cors',
              credentials: 'omit'
            })
            .then(response => {
              if (!response.ok) {
                throw new Error('Network response was not ok')
              }
              return response.blob()
            })
            .then(blob => {
              const reader = new FileReader()
              reader.onloadend = () => {
                resolve(reader.result)
              }
              reader.onerror = () => {
                // 如果FileReader失败，尝试使用Image方式
                this.convertImageUrlToBase64WithImage(imageUrl).then(resolve).catch(() => resolve(imageUrl))
              }
              reader.readAsDataURL(blob)
            })
            .catch(() => {
              // fetch失败，尝试使用Image方式
              this.convertImageUrlToBase64WithImage(imageUrl).then(resolve).catch(() => resolve(imageUrl))
            })
          } else {
            // 不支持fetch，使用Image方式
            this.convertImageUrlToBase64WithImage(imageUrl).then(resolve).catch(() => resolve(imageUrl))
          }
        })
      },
      // 使用Image对象转换图片为base64（备用方法）
      convertImageUrlToBase64WithImage(imageUrl) {
        return new Promise((resolve, reject) => {
          const img = new Image()
          img.crossOrigin = 'anonymous' // 处理跨域
          img.onload = function() {
            try {
              const canvas = document.createElement('canvas')
              canvas.width = this.width
              canvas.height = this.height
              const ctx = canvas.getContext('2d')
              ctx.drawImage(this, 0, 0)
              const base64 = canvas.toDataURL('image/png')
              resolve(base64)
            } catch (error) {
              // 如果转换失败，返回原始URL
              reject(error)
            }
          }
          img.onerror = function() {
            // 如果加载失败，返回原始URL
            reject(new Error('Image load failed'))
          }
          img.src = imageUrl
        })
      },
      // 处理导出前的数据（用于beforeGenerate钩子）
      async processExportData() {
        // 显示加载提示
        uni.showLoading({
          title: '正在处理图片...',
          mask: true
        })
        
        try {
          // 确保数据已处理
          if (this.exportExcelData && this.exportExcelData.length > 0) {
            // 先进行基础数据处理
            let processedData = this.processExportDataForExcel(this.exportExcelData)
            
            // 异步处理所有图片，将URL转换为base64格式
            const processedDataWithImages = await Promise.all(
              processedData.map(async (item) => {
                const processedItem = { ...item }
                
                // 处理身份证正面照片 - 转换为base64格式的HTML img标签
                if (processedItem.idCardFront && processedItem.idCardFront !== '-') {
                  processedItem.idCardFront = await this.convertImageUrlToBase64Html(processedItem.idCardFront, '身份证正面')
                }
                
                return processedItem
              })
            )
            
            this.processedExportData = processedDataWithImages
          } else {
            this.processedExportData = []
          }
        } catch (error) {
          console.error('处理导出数据失败:', error)
          uni.showToast({
            title: '处理数据失败',
            icon: 'none'
          })
          // 即使转换失败，也使用原始数据
          if (this.exportExcelData && this.exportExcelData.length > 0) {
            this.processedExportData = this.processExportDataForExcel(this.exportExcelData)
          }
        } finally {
          uni.hideLoading()
        }
      },
      // 格式化日期
      formatDate(timestamp) {
        if (!timestamp) return '-'
        const date = new Date(timestamp)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')
        const hours = String(date.getHours()).padStart(2, '0')
        const minutes = String(date.getMinutes()).padStart(2, '0')
        const seconds = String(date.getSeconds()).padStart(2, '0')
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
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
      getStatusText(status, options) {
        const statusMap = {
          'unverified': '未认证',
          'pending': '待审核',
          'verified': '已认证',
          'rejected': '已驳回'
        }
        return statusMap[status] || options.status_valuetotext[status] || status
      },
      getStatusClass(status) {
        return {
          'status-unverified': status === 'unverified',
          'status-pending': status === 'pending',
          'status-verified': status === 'verified',
          'status-rejected': status === 'rejected'
        }
      },
      formatIdCard(idCard) {
        if (!idCard) return '-'
        if (idCard.length === 18) {
          return idCard.substring(0, 6) + '****' + idCard.substring(14)
        }
        return idCard
      },
      previewImage(url) {
        if (!url) return
        uni.previewImage({
          urls: [url],
          current: url
        })
      }
    }
  }
</script>

<style scoped>
@import '@/styles/admin-page.scss';
.page-shell { min-height: 100%; }

/* 页面标题栏 */
.page-header {
  padding: 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
}

.header-title-group {
  display: flex;
  align-items: center;
  gap: 15px;
}

.header-actions {
  display: flex;
  gap: 10px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 8px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
}

.primary-btn {
  background: #3b82f6;
  color: #fff;
}

/* 搜索栏 */
.search-bar {
  padding: 16px;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.search-input {
  flex: 1;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #dbe3ee;
  border-radius: 8px;
  font-size: 14px;
  transition: border-color .2s ease;
}

.search-input:focus {
  border-color: #667eea;
  outline: none;
}

.toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #dcdfe6;
  background: #ffffff;
  color: #606266;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.3s ease;
}

.toolbar-btn:hover:not(:disabled) {
  background: #f5f7fa;
  border-color: #c0c4cc;
}

.toolbar-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.export-btn {
  background: #3b82f6;
  color: #ffffff;
  border: none;
}

.toolbar-icon {
  display: none;
}

/* 表格容器 */
.table-container {
  padding: 16px;
  overflow-x: auto;
}

.data-table {
  width: 100%;
}

.table-row:hover {
  background-color: #f5f7fa;
}

.id-card-cell {
  font-family: 'Courier New', monospace;
  font-size: 12px;
}

.reject-reason-cell {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 身份证照片预览 */
.image-preview-group {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
}

.id-card-image {
  width: 60px;
  height: 40px;
  border-radius: 6px;
  object-fit: cover;
  cursor: pointer;
  border: 2px solid #e4e7ed;
  transition: all 0.3s ease;
}

.id-card-image:hover {
  transform: scale(1.1);
  border-color: #667eea;
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.no-image {
  color: #c0c4cc;
  font-size: 12px;
}

/* 状态标签 */
.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.status-unverified {
  background: #f0f0f0;
  color: #909399;
}

.status-pending {
  background: #fff3cd;
  color: #856404;
}

.status-verified {
  background: #d4edda;
  color: #155724;
}

.status-rejected {
  background: #f8d7da;
  color: #721c24;
}

/* 操作按钮 */
.action-buttons {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.action-btn {
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 12px;
  border: none;
  cursor: pointer;
  transition: all 0.3s ease;
}

.edit-btn {
  background: #3b82f6;
  color: #ffffff;
}

.delete-btn {
  background: #dc2626;
  color: #ffffff;
}

/* 分页 */
.pagination-wrapper {
  margin-top: 20px;
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

/* 响应式 */
@media (max-width: 768px) {
  .page-wrapper {
    padding: 10px;
  }

  .header-content {
    flex-direction: column;
    align-items: flex-start;
    gap: 15px;
  }

  .search-input-wrapper {
    flex-direction: column;
  }

  .search-input {
    width: 100%;
  }

  .search-btn {
    width: 100%;
  }

  .table-container {
    padding: 10px;
    overflow-x: scroll;
  }

  .action-buttons {
    flex-direction: column;
  }

  .action-btn {
    width: 100%;
  }
}
</style>
