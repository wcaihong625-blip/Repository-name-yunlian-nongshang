<template>
  <view class="page-container">
    <!-- 页面标题 -->
    <view class="page-header">
      <view class="header-title">
        <text class="title-icon">📨</text>
        <text class="title-text">消息通知模板</text>
      </view>
      <view class="header-subtitle">配置各类业务场景的消息通知模板</view>
    </view>

    <!-- 操作栏 -->
    <view class="action-bar">
      <view class="button-group">
        <button class="action-btn add-btn" @click="navigateTo('./add')">
          <text class="btn-icon">➕</text>
          <text>新增模板</text>
        </button>
        <button
          class="action-btn delete-btn"
          :disabled="!selectedIndexs.length"
          @click="delTable"
        >
          <text class="btn-icon">🗑️</text>
          <text>批量删除</text>
        </button>
      </view>
    </view>

    <!-- 数据表格 -->
    <view class="table-container">
      <unicloud-db
        ref="udb"
        collection="message_templates"
        field="name,code,channel,title,content,enabled,remark,update_time"
        :where="where"
        page-data="replace"
        :orderby="orderby"
        :getcount="true"
        :page-size="options.pageSize"
        :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error}"
        :options="options"
        loadtime="manual"
        @load="onqueryload"
      >
        <uni-table
          ref="table"
          :loading="loading"
          :emptyText="error.message || '没有更多数据'"
          border
          stripe
          type="selection"
          @selection-change="selectionChange"
        >
          <uni-tr>
            <uni-th align="center">模板名称</uni-th>
            <uni-th align="center">模板编码</uni-th>
            <uni-th align="center">渠道</uni-th>
            <uni-th align="center">标题</uni-th>
            <uni-th align="center">内容</uni-th>
            <uni-th align="center">启用</uni-th>
            <uni-th align="center">更新时间</uni-th>
            <uni-th align="center" width="160">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item,index) in data" :key="index">
            <uni-td align="center">
              <text class="table-text-bold">{{item.name}}</text>
            </uni-td>
            <uni-td align="center">{{item.code}}</uni-td>
            <uni-td align="center">{{channelText(item.channel)}}</uni-td>
            <uni-td align="center">{{item.title || '-'}}</uni-td>
            <uni-td align="left">
              <view class="content-cell">
                <text class="content-text">{{item.content}}</text>
              </view>
            </uni-td>
            <uni-td align="center">
              <view
                :class="['status-tag', item.enabled ? 'status-enabled' : 'status-disabled']"
              >
                {{item.enabled ? '启用' : '停用'}}
              </view>
            </uni-td>
            <uni-td align="center">
              <uni-dateformat
                v-if="item.update_time"
                :threshold="[0, 0]"
                :date="item.update_time"
              ></uni-dateformat>
              <text v-else>-</text>
            </uni-td>
            <uni-td align="center">
              <view class="table-action-group">
                <button
                  @click="navigateTo('./edit?id='+item._id, false)"
                  class="table-btn edit-btn"
                  size="mini"
                >修改</button>
                <button
                  @click="confirmDelete(item._id)"
                  class="table-btn delete-btn"
                  size="mini"
                >删除</button>
              </view>
            </uni-td>
          </uni-tr>
        </uni-table>
        <view class="pagination-container">
          <uni-pagination
            show-icon
            :page-size="pagination.size"
            v-model="pagination.current"
            :total="pagination.count"
            @change="onPageChanged"
          />
        </view>
      </unicloud-db>
    </view>
  </view>
</template>

<script>
const db = uniCloud.database()

export default {
  data() {
    return {
      query: '',
      where: '',
      orderby: 'update_time desc',
      selectedIndexs: [],
      options: {
        pageSize: 20,
        pageCurrent: 1
      }
    }
  },
  onLoad() {
    this._filter = {}
  },
  onReady() {
    this.$refs.udb.loadData()
  },
  methods: {
    onqueryload() {},
    channelText(channel) {
      const map = {
        app: '站内消息',
        sms: '短信',
        wechat: '微信',
        email: '邮件'
      }
      return map[channel] || channel || '-'
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
      const dataList = this.$refs.udb.dataList
      return this.selectedIndexs.map(i => dataList[i]._id)
    },
    delTable() {
      this.$refs.udb.remove(this.selectedItems(), {
        success: () => {
          this.$refs.table.clearSelection()
        }
      })
    },
    selectionChange(e) {
      this.selectedIndexs = e.detail.index
    },
    confirmDelete(id) {
      this.$refs.udb.remove(id, {
        success: () => {
          this.$refs.table.clearSelection()
        }
      })
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
  background: linear-gradient(135deg, #5f2c82 0%, #49a09d 100%);
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 20px;
  box-shadow: 0 10px 30px rgba(73, 160, 157, 0.3);
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
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.button-group {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.action-btn {
  display: flex;
  align-items: center;
  padding: 8px 18px;
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

.content-cell {
  max-width: 320px;
}

.content-text {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: #555555;
}

.status-tag {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
}

.status-enabled {
  background: linear-gradient(135deg, #55efc4 0%, #00b894 100%);
  color: #ffffff;
}

.status-disabled {
  background: #e0e0e0;
  color: #666666;
}

.table-action-group {
  display: flex;
  gap: 8px;
  justify-content: center;
}

.table-btn {
  padding: 6px 14px;
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

.table-btn.delete-btn {
  background: linear-gradient(135deg, #ee0979 0%, #ff6a00 100%);
  color: #ffffff;
}

.pagination-container {
  margin-top: 20px;
  padding: 20px 0;
  display: flex;
  justify-content: center;
}

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
    padding: 12px 15px;
  }

  .table-container {
    padding: 15px;
    overflow-x: auto;
  }
}
</style>




