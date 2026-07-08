<template>
  <view class="page">
    <view class="uni-header filter-panel">
      <view class="filter-grid">
        <input class="filter-input" v-model="q.target_user_id" placeholder="被评价用户ID" />
        <uni-data-select v-model="q.status" :localdata="statusOpts" placeholder="状态" style="width: 120px;" />
      </view>
      <view class="filter-actions">
        <button class="uni-button" type="primary" size="mini" @click="reload">查询</button>
        <button class="uni-button" type="default" size="mini" @click="reset">重置</button>
      </view>
    </view>

    <view v-if="loading" class="muted pad">加载中…</view>
    <view v-else-if="errMsg" class="err pad">{{ errMsg }}</view>
    <template v-else>
      <view class="muted pad-sm">共 {{ total }} 条</view>
      <view class="table-wrap">
        <uni-table border stripe emptyText="暂无数据">
          <uni-tr>
            <uni-th width="120">被评价用户</uni-th>
            <uni-th width="100">评价人</uni-th>
            <uni-th width="50">分</uni-th>
            <uni-th width="200">内容</uni-th>
            <uni-th width="120">标签</uni-th>
            <uni-th width="80">状态</uni-th>
            <uni-th width="130">时间</uni-th>
            <uni-th width="100">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="row in list" :key="row._id">
            <uni-td>{{ row.target_user_name || row.target_user_id }}</uni-td>
            <uni-td>{{ row.review_user_name || '—' }}</uni-td>
            <uni-td>{{ row.score }}</uni-td>
            <uni-td><text class="ellipsis">{{ row.content || '—' }}</text></uni-td>
            <uni-td>{{ (row.tags || []).join('、') || '—' }}</uni-td>
            <uni-td>{{ row.status === 'hidden' ? '已隐藏' : '正常' }}</uni-td>
            <uni-td><uni-dateformat v-if="row.created_at" :date="row.created_at" /></uni-td>
            <uni-td>
              <button
                v-if="row.status !== 'hidden'"
                class="uni-button"
                size="mini"
                type="warn"
                plain
                @click="hideReview(row)"
              >
                隐藏
              </button>
              <text v-else class="muted">—</text>
            </uni-td>
          </uni-tr>
        </uni-table>
      </view>
      <view class="uni-pagination-box">
        <uni-pagination show-icon :page-size="pageSize" v-model="page" :total="total" @change="onPageChange" />
      </view>
    </template>
  </view>
</template>

<script>
export default {
  data() {
    return {
      q: { target_user_id: '', status: '' },
      statusOpts: [
        { value: '', text: '全部' },
        { value: 'normal', text: '正常' },
        { value: 'hidden', text: '已隐藏' }
      ],
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
      loading: false,
      errMsg: ''
    }
  },
  onLoad(e) {
    if (e && e.target_user_id) {
      this.q.target_user_id = decodeURIComponent(String(e.target_user_id))
    }
    this.reload()
  },
  methods: {
    buildWhere() {
      const db = uniCloud.database()
      const cmd = db.command
      const parts = []
      if (this.q.target_user_id && String(this.q.target_user_id).trim()) {
        parts.push({ target_user_id: String(this.q.target_user_id).trim() })
      }
      if (this.q.status) {
        parts.push({ status: this.q.status })
      }
      if (!parts.length) return {}
      if (parts.length === 1) return parts[0]
      return cmd.and(...parts)
    },
    async reload() {
      this.loading = true
      this.errMsg = ''
      try {
        const db = uniCloud.database()
        const where = this.buildWhere()
        const col = db.collection('user_reputation_review')
        const c1 = await col.where(where).count()
        this.total =
          (c1.result && c1.result.total != null ? c1.result.total : c1.total) || 0
        const skip = (this.page - 1) * this.pageSize
        const res = await col
          .where(where)
          .orderBy('created_at', 'desc')
          .skip(skip)
          .limit(this.pageSize)
          .get()
        this.list = (res.result && res.result.data) || res.data || []
      } catch (e) {
        this.errMsg = e.message || '加载失败'
        this.list = []
      } finally {
        this.loading = false
      }
    },
    reset() {
      this.q = { target_user_id: '', status: '' }
      this.page = 1
      this.reload()
    },
    onPageChange() {
      this.reload()
    },
    hideReview(row) {
      uni.showModal({
        title: '隐藏该评价？',
        content: '小程序侧将不再展示（status=hidden）',
        success: async (r) => {
          if (!r.confirm) return
          try {
            const db = uniCloud.database()
            await db
              .collection('user_reputation_review')
              .doc(row._id)
              .update({ status: 'hidden', updated_at: Date.now() })
            uni.showToast({ title: '已隐藏' })
            this.reload()
            const uid = row.target_user_id
            if (uid) {
              const uniIdToken = uni.getStorageSync('uni_id_token') || ''
              const co = uniCloud.importObject('reputationCo', { customUI: true })
              co.rebuildSummary({ uniIdToken, token: uniIdToken, user_id: uid }).catch(() => {})
            }
          } catch (e) {
            uni.showModal({ content: e.message || '失败', showCancel: false })
          }
        }
      })
    }
  }
}
</script>

<style scoped>
.page {
  padding-bottom: 24px;
}
.filter-panel {
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #eee;
}
.filter-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.filter-input {
  width: 260px;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 13px;
}
.filter-actions {
  margin-top: 10px;
}
.table-wrap {
  padding: 0 16px;
}
.muted {
  color: #888;
  font-size: 12px;
}
.err {
  color: #c00;
}
.pad {
  padding: 16px;
}
.pad-sm {
  padding: 8px 16px;
}
.ellipsis {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
