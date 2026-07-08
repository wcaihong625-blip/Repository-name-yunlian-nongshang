<template>
  <view class="page">
    <view class="uni-header filter-panel">
      <view class="filter-grid">
        <input class="filter-input" v-model="q.user_id" placeholder="用户ID" />
        <input class="filter-input" v-model="q.user_name" placeholder="昵称关键词" />
        <uni-data-select v-model="q.risk_level" :localdata="riskOpts" placeholder="风险状态" style="width: 140px;" />
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
            <uni-th width="120">用户昵称</uni-th>
            <uni-th width="90">信誉分</uni-th>
            <uni-th width="80">好评率</uni-th>
            <uni-th width="70">举报</uni-th>
            <uni-th width="80">属实举报</uni-th>
            <uni-th width="70">采购</uni-th>
            <uni-th width="70">供应</uni-th>
            <uni-th width="80">浏览量</uni-th>
            <uni-th width="90">风险</uni-th>
            <uni-th width="260">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="row in list" :key="row._id">
            <uni-td>{{ row.user_name || '—' }}</uni-td>
            <uni-td>{{ row.reputation_score }}</uni-td>
            <uni-td>{{ row.positive_rate }}%</uni-td>
            <uni-td>{{ row.report_count }}</uni-td>
            <uni-td>{{ row.valid_report_count }}</uni-td>
            <uni-td>{{ row.publish_purchase_count }}</uni-td>
            <uni-td>{{ row.publish_supply_count }}</uni-td>
            <uni-td>{{ row.total_view_count }}</uni-td>
            <uni-td>{{ riskText(row.risk_level) }}</uni-td>
            <uni-td>
              <view class="btn-row">
                <button class="uni-button" size="mini" type="primary" plain @click="openDetail(row)">详情</button>
                <button class="uni-button" size="mini" @click="goReports(row.user_id)">举报记录</button>
                <button class="uni-button" size="mini" @click="goReviews(row.user_id)">评价记录</button>
                <button class="uni-button" size="mini" type="warn" plain @click="rebuild(row.user_id)">重算信誉</button>
              </view>
            </uni-td>
          </uni-tr>
        </uni-table>
      </view>
      <view class="uni-pagination-box">
        <uni-pagination show-icon :page-size="pageSize" v-model="page" :total="total" @change="onPageChange" />
      </view>
    </template>

    <uni-popup ref="detailRef" type="center">
      <view class="detail-card" v-if="detail">
        <view class="detail-title">信誉详情 · {{ detail.user_name }}</view>
        <view class="detail-line"><text class="k">用户ID</text><text class="v mono">{{ detail.user_id }}</text></view>
        <view class="detail-line"><text class="k">信誉分</text><text class="v">{{ detail.reputation_score }}</text></view>
        <view class="detail-line"><text class="k">好评率</text><text class="v">{{ detail.positive_rate }}%（{{ detail.review_count }} 条评价）</text></view>
        <view class="detail-line"><text class="k">举报</text><text class="v">共 {{ detail.report_count }} 次，属实 {{ detail.valid_report_count }} 次</text></view>
        <view class="detail-line"><text class="k">发布</text><text class="v">采购 {{ detail.publish_purchase_count }} · 供应 {{ detail.publish_supply_count }}</text></view>
        <view class="detail-line"><text class="k">浏览/联系/收藏</text><text class="v">{{ detail.total_view_count }} / {{ detail.contact_count }} / {{ detail.favorite_count }}</text></view>
        <view class="detail-line"><text class="k">认证</text><text class="v">实名 {{ detail.is_verified ? '是' : '否' }} · 企业 {{ detail.is_enterprise_verified ? '是' : '否' }}</text></view>
        <view class="detail-line"><text class="k">风险</text><text class="v">{{ riskText(detail.risk_level) }}</text></view>
        <view class="detail-line"><text class="k">最近重算</text><text class="v"><uni-dateformat v-if="detail.last_calculated_at" :date="detail.last_calculated_at" /><text v-else>—</text></text></view>
        <view class="detail-actions">
          <button class="uni-button" type="primary" @click="closeDetail">关闭</button>
          <button class="uni-button" type="warn" @click="rebuild(detail.user_id)">重算该用户</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
const RISK = {
  normal: '正常',
  mild: '轻度风险',
  warning: '已警告'
}

export default {
  data() {
    return {
      q: { user_id: '', user_name: '', risk_level: '' },
      riskOpts: [
        { value: '', text: '全部风险' },
        { value: 'normal', text: '正常' },
        { value: 'mild', text: '轻度风险' },
        { value: 'warning', text: '已警告' }
      ],
      list: [],
      total: 0,
      page: 1,
      pageSize: 20,
      loading: false,
      errMsg: '',
      detail: null
    }
  },
  onLoad() {
    this.reload()
  },
  methods: {
    riskText(l) {
      return RISK[l] || l || '—'
    },
    buildWhere() {
      const db = uniCloud.database()
      const cmd = db.command
      const parts = []
      if (this.q.user_id && String(this.q.user_id).trim()) {
        parts.push({ user_id: String(this.q.user_id).trim() })
      }
      if (this.q.user_name && String(this.q.user_name).trim()) {
        const kw = String(this.q.user_name).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        parts.push({ user_name: db.RegExp({ regexp: kw, options: 'i' }) })
      }
      if (this.q.risk_level) {
        parts.push({ risk_level: this.q.risk_level })
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
        const col = db.collection('user_reputation_summary')
        const skip = (this.page - 1) * this.pageSize
        const res = await col
          .where(where)
          .field({
            _id: true,
            user_id: true,
            user_name: true,
            reputation_score: true,
            positive_rate: true,
            report_count: true,
            valid_report_count: true,
            publish_purchase_count: true,
            publish_supply_count: true,
            total_view_count: true,
            risk_level: true,
            review_count: true,
            contact_count: true,
            favorite_count: true,
            is_verified: true,
            is_enterprise_verified: true,
            last_calculated_at: true,
            updated_at: true
          })
          .orderBy('updated_at', 'desc')
          .skip(skip)
          .limit(this.pageSize)
          .get()
        this.list = (res.result && res.result.data) || res.data || []
        try {
          const c1 = await col.where(where).count()
          this.total =
            (c1.result && c1.result.total != null ? c1.result.total : c1.total) || 0
        } catch (_e) {
          // 大数据量下 count 可能超时：用当前页结果估算，避免页面直接报错
          this.total = skip + this.list.length + (this.list.length === this.pageSize ? this.pageSize : 0)
        }
      } catch (e) {
        this.errMsg = e.message || '加载失败（请确认已上传数据表 schema 并有数据）'
        this.list = []
      } finally {
        this.loading = false
      }
    },
    reset() {
      this.q = { user_id: '', user_name: '', risk_level: '' }
      this.page = 1
      this.reload()
    },
    onPageChange() {
      this.reload()
    },
    openDetail(row) {
      this.detail = row
      this.$refs.detailRef.open()
    },
    closeDetail() {
      this.$refs.detailRef.close()
      this.detail = null
    },
    goReports(uid) {
      if (!uid) return
      uni.navigateTo({
        url: `/pages/user_report/list?reported_user_id=${encodeURIComponent(uid)}`
      })
    },
    goReviews(uid) {
      if (!uid) return
      uni.navigateTo({
        url: `/pages/user_reputation_reviews/list?target_user_id=${encodeURIComponent(uid)}`
      })
    },
    rebuild(userId) {
      if (!userId) return
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      uni.showLoading({ title: '重算中' })
      const co = uniCloud.importObject('reputationCo', { customUI: true })
      co
        .rebuildSummary({ uniIdToken, token: uniIdToken, user_id: userId })
        .then((r) => {
          uni.hideLoading()
          if (r && r.code === 200) {
            uni.showToast({ title: '完成' })
            this.reload()
            this.closeDetail()
          } else {
            uni.showModal({ content: (r && r.message) || '失败', showCancel: false })
          }
        })
        .catch((e) => {
          uni.hideLoading()
          uni.showModal({ content: e.message || '失败', showCancel: false })
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
  width: 200px;
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
.btn-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.muted {
  color: #888;
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
.mono {
  font-family: monospace;
}
.detail-card {
  width: 480px;
  max-width: 92vw;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
}
.detail-title {
  font-weight: bold;
  margin-bottom: 12px;
}
.detail-line {
  display: flex;
  margin-bottom: 8px;
  font-size: 13px;
}
.detail-line .k {
  width: 120px;
  color: #888;
  flex-shrink: 0;
}
.detail-line .v {
  flex: 1;
  word-break: break-all;
}
.detail-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
}
</style>
