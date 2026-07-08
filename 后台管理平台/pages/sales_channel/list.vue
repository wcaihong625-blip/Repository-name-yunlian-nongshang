<template>
  <view>
    <view class="uni-header">
      <view class="uni-group">
        <input class="uni-search" @confirm="search" v-model="query" placeholder="搜索渠道名称或业务员姓名" autofocus="true" />
        <button class="uni-button" type="default" size="mini" @click="search">搜索</button>
        <button class="uni-button" type="primary" size="mini" @click="navigateTo('./add')">新增渠道</button>
        <button class="uni-button" type="warn" size="mini" :disabled="!selectedIndexs.length" @click="delTable">批量删除</button>
      </view>
    </view>
    <view class="uni-container">
      <unicloud-db ref="udb" collection="sales_channel"
        field="sales_name,channel_code,channel_name,channel_type,group_name,invite_code,landing_path,status"
        :where="where" page-data="replace"
        orderby="created_at desc"
        :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error}">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '暂无数据'" border stripe type="selection" @selection-change="selectionChange">
          <uni-tr>
            <uni-th align="center">渠道编号</uni-th>
            <uni-th align="center">渠道名称</uni-th>
            <uni-th align="center">所属业务员</uni-th>
            <uni-th align="center">类型</uni-th>
            <uni-th align="center">微信群名</uni-th>
            <uni-th align="center">邀请码</uni-th>
            <uni-th align="center">状态</uni-th>
            <uni-th align="center">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item, index) in data" :key="index">
            <uni-td align="center">{{ item.channel_code }}</uni-td>
            <uni-td align="center">{{ item.channel_name }}</uni-td>
            <uni-td align="center">{{ item.sales_name || '-' }}</uni-td>
            <uni-td align="center">{{ channelTypeLabel(item.channel_type) }}</uni-td>
            <uni-td align="center">{{ item.group_name || '-' }}</uni-td>
            <uni-td align="center">{{ item.invite_code }}</uni-td>
            <uni-td align="center">
              <text :style="item.status === 1 ? 'color:#18bc9c' : 'color:#e74c3c'">
                {{ item.status === 1 ? '正常' : '停用' }}
              </text>
            </uni-td>
            <uni-td align="center">
              <view class="uni-group">
                <button @click="navigateTo('./edit?id=' + item._id, false)" class="uni-button" size="mini" type="primary">编辑</button>
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
  const dbSearchFields = ['channel_name', 'sales_name']

  export default {
    data() {
      return {
        query: '',
        where: '',
        selectedIndexs: [],
        options: { pageSize: 20, pageCurrent: 1 }
      }
    },
    methods: {
      channelTypeLabel(type) {
        const map = { 1: '微信群', 2: '地推', 3: '个人' }
        return map[type] || '-'
      },
      getWhere() {
        const query = this.query.trim()
        if (!query) return ''
        return dbSearchFields.map(name => `${name} == /.*${query}.*/i`).join(' || ')
      },
      search() {
        this.where = this.getWhere()
        this.$nextTick(() => { this.$refs.udb.loadData() })
      },
      navigateTo(url, clear) {
        uni.navigateTo({
          url,
          events: {
            refreshData: () => {
              this.$refs.udb.loadData(clear ? {} : { clear })
            }
          }
        })
      },
      selectedItems() {
        return this.selectedIndexs.map(i => this.$refs.udb.dataList[i]._id)
      },
      selectionChange(e) {
        this.selectedIndexs = e.detail.index
      },
      confirmDelete(id) {
        uni.showModal({
          title: '确认删除',
          content: '删除后不可恢复，确认删除该渠道吗？',
          success: (res) => {
            if (res.confirm) {
              this.$refs.udb.remove(id, {
                success: () => { this.$refs.table.clearSelection() }
              })
            }
          }
        })
      },
      delTable() {
        uni.showModal({
          title: '批量删除',
          content: `确认删除选中的 ${this.selectedIndexs.length} 条渠道记录吗？`,
          success: (res) => {
            if (res.confirm) {
              this.$refs.udb.remove(this.selectedItems(), {
                success: () => { this.$refs.table.clearSelection() }
              })
            }
          }
        })
      },
      onPageChanged(e) {
        this.$refs.udb.loadData({ current: e.current })
      }
    }
  }
</script>

<style>
</style>
