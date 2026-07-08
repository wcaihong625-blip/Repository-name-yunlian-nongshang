<template>
  <view>
    <view class="uni-header">
      <view class="uni-group">
        <input class="uni-search" @confirm="search" v-model="query" placeholder="搜索姓名或编号" autofocus="true" />
        <button class="uni-button" type="default" size="mini" @click="search">搜索</button>
        <button class="uni-button" type="primary" size="mini" @click="navigateTo('./add')">新增</button>
        <button class="uni-button" type="warn" size="mini" :disabled="!selectedIndexs.length" @click="delTable">批量删除</button>
      </view>
    </view>
    <view class="uni-container">
      <unicloud-db ref="udb" collection="sales_staff"
        field="_id,sales_code,sales_name,mobile,region,status,base_commission_rate_first,base_commission_rate_renew"
        :where="where" page-data="replace"
        orderby="created_at desc"
        :getcount="true" :page-size="options.pageSize" :page-current="options.pageCurrent"
        v-slot:default="{data,pagination,loading,error}">
        <uni-table ref="table" :loading="loading" :emptyText="error.message || '暂无数据'" border stripe type="selection" @selection-change="selectionChange">
          <uni-tr>
            <uni-th align="center">业务员编号</uni-th>
            <uni-th align="center">姓名</uni-th>
            <uni-th align="center">手机号</uni-th>
            <uni-th align="center">负责区域</uni-th>
            <uni-th align="center">首开提成</uni-th>
            <uni-th align="center">续费提成</uni-th>
            <uni-th align="center">状态</uni-th>
            <uni-th align="center">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="(item, index) in data" :key="index">
            <uni-td align="center">{{ item.sales_code }}</uni-td>
            <uni-td align="center">{{ item.sales_name }}</uni-td>
            <uni-td align="center">{{ item.mobile }}</uni-td>
            <uni-td align="center">{{ item.region || '-' }}</uni-td>
            <uni-td align="center">{{ formatRate(item.base_commission_rate_first) }}</uni-td>
            <uni-td align="center">{{ formatRate(item.base_commission_rate_renew) }}</uni-td>
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
  const dbSearchFields = ['sales_name', 'sales_code']

  export default {
    data() {
      return {
        query: '',
        where: '',
        selectedIndexs: [],
        options: {
          pageSize: 20,
          pageCurrent: 1
        }
      }
    },
    methods: {
      formatRate(val) {
        if (val === undefined || val === null || val === '') return '-'
        return (Number(val) * 100).toFixed(0) + '%'
      },
      getWhere() {
        const query = this.query.trim()
        if (!query) return ''
        // JQL 字符串模糊搜索
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
          content: '删除后不可恢复，确认删除该业务员吗？',
          success: (res) => {
            if (res.confirm) {
              this.$refs.udb.remove(id, {
                needConfirm: false,
                success: () => {
                  if (this.$refs.table && this.$refs.table.clearSelection) {
                    this.$refs.table.clearSelection()
                  }
                }
              })
            }
          }
        })
      },
      delTable() {
        uni.showModal({
          title: '批量删除',
          content: `确认删除选中的 ${this.selectedIndexs.length} 条业务员记录吗？`,
          success: (res) => {
            if (res.confirm) {
              this.$refs.udb.remove(this.selectedItems(), {
                needConfirm: false,
                success: () => {
                  if (this.$refs.table && this.$refs.table.clearSelection) {
                    this.$refs.table.clearSelection()
                  }
                }
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
