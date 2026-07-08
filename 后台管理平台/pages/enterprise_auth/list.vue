<template>
  <view class="page-shell page">
    <view class="page-header">
      <view>
        <view class="page-title">企业认证审核</view>
        <view class="page-subtitle">查看认证资料并执行审核通过/驳回操作。</view>
      </view>
    </view>
    <view class="filter-card filter-panel">
      <view class="filter-grid">
        <uni-data-select v-model="q.status" :localdata="statusOpts" placeholder="审核状态" style="width: 140px;" />
        <input class="filter-input" v-model="q.enterprise_name" placeholder="企业名称" />
        <input class="filter-input" v-model="q.contact_mobile" placeholder="联系手机号" />
        <uni-datetime-picker type="daterange" return-type="timestamp" v-model="q.dateRange" />
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
      <view class="table-card table-wrap">
        <uni-table border stripe emptyText="暂无数据">
          <uni-tr>
            <uni-th width="200">申请编号</uni-th>
            <uni-th width="100">用户昵称</uni-th>
            <uni-th width="120">联系手机号</uni-th>
            <uni-th width="140">企业名称</uni-th>
            <uni-th width="180">统一社会信用代码</uni-th>
            <uni-th width="160">企业所在地</uni-th>
            <uni-th width="140">提交时间</uni-th>
            <uni-th width="90">审核状态</uni-th>
            <uni-th width="220">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="row in list" :key="row._id">
            <uni-td><text class="mono small">{{ row._id }}</text></uni-td>
            <uni-td>{{ row.user_nickname || '—' }}</uni-td>
            <uni-td>{{ row.contact_mobile || '—' }}</uni-td>
            <uni-td>{{ row.enterprise_name || '—' }}</uni-td>
            <uni-td><text class="mono small">{{ row.credit_code || '—' }}</text></uni-td>
            <uni-td>{{ row.location_text || '—' }}</uni-td>
            <uni-td><uni-dateformat v-if="row.created_at" :date="row.created_at" /><text v-else>—</text></uni-td>
            <uni-td>{{ statusText(row.status) }}</uni-td>
            <uni-td>
              <view class="btn-col">
                <button class="uni-button" size="mini" type="primary" plain @click="openDetail(row)">查看详情</button>
                <button
                  v-if="row.status === 'pending'"
                  class="uni-button"
                  size="mini"
                  type="primary"
                  @click="doApprove(row)"
                >
                  审核通过
                </button>
                <button v-if="row.status === 'pending'" class="uni-button" size="mini" type="warn" @click="doReject(row)">驳回</button>
              </view>
            </uni-td>
          </uni-tr>
        </uni-table>
      </view>
      <view class="uni-pagination-box">
        <uni-pagination show-icon :page-size="pageSize" v-model="page" :total="total" @change="onPageChange($event)" />
      </view>
    </template>

    <uni-popup ref="detailRef" type="center">
      <view class="detail-card" v-if="detail">
        <view class="detail-title">企业认证详情</view>
        <view class="summary-card info-grid">
          <view class="detail-line"><text class="k">用户</text><text class="v">{{ detail.user_nickname }}（{{ detail.user_id }}）</text></view>
          <view class="detail-line"><text class="k">企业名称</text><text class="v">{{ detail.enterprise_name }}</text></view>
          <view class="detail-line"><text class="k">统一社会信用代码</text><text class="v mono">{{ detail.credit_code }}</text></view>
          <view class="detail-line"><text class="k">联系人</text><text class="v">{{ detail.contact_name }}</text></view>
          <view class="detail-line"><text class="k">联系手机</text><text class="v">{{ detail.contact_mobile }}</text></view>
          <view class="detail-line"><text class="k">所在地</text><text class="v">{{ detail.location_text }}</text></view>
        </view>
        <view class="detail-section">
          <view class="detail-line"><text class="k">详细地址</text><text class="v">{{ detail.address || '—' }}</text></view>
          <view class="detail-line"><text class="k">营业执照</text>
            <view class="v" v-if="detail.business_license_url">
              <image :src="detail.business_license_url" mode="widthFix" class="license-img" @click="preview(detail.business_license_url)" />
            </view>
            <text class="v" v-else>—</text>
          </view>
          <view class="detail-line"><text class="k">备注说明</text><text class="v">{{ detail.remark || '—' }}</text></view>
          <view class="detail-line"><text class="k">当前状态</text><text class="v">{{ statusText(detail.status) }}</text></view>
          <view class="detail-line" v-if="detail.reject_reason"><text class="k">驳回原因</text><text class="v">{{ detail.reject_reason }}</text></view>
        </view>
        <view class="action-bar detail-actions">
          <button class="uni-button" type="default" @click="closeDetail">关闭</button>
          <button v-if="detail.status === 'pending'" class="uni-button" type="primary" @click="doApprove(detail)">审核通过</button>
          <button v-if="detail.status === 'pending'" class="uni-button" type="warn" @click="doReject(detail)">驳回</button>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script>
const STATUS_MAP = {
  pending: '审核中',
  approved: '已通过',
  rejected: '已驳回'
}

export default {
  data() {
    return {
      q: {
        status: '',
        enterprise_name: '',
        contact_mobile: '',
        dateRange: []
      },
      statusOpts: [
        { value: '', text: '全部状态' },
        { value: 'pending', text: '审核中' },
        { value: 'approved', text: '已通过' },
        { value: 'rejected', text: '已驳回' }
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
    statusText(s) {
      return STATUS_MAP[s] || s || '—'
    },
    buildPayload() {
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      const payload = {
        uniIdToken,
        token: uniIdToken,
        page: this.page,
        pageSize: this.pageSize
      }
      if (this.q.status) payload.status = this.q.status
      if (this.q.enterprise_name && String(this.q.enterprise_name).trim()) {
        payload.enterprise_name = String(this.q.enterprise_name).trim()
      }
      if (this.q.contact_mobile && String(this.q.contact_mobile).trim()) {
        payload.contact_mobile = String(this.q.contact_mobile).trim()
      }
      if (this.q.dateRange && this.q.dateRange.length === 2) {
        const a = this.q.dateRange[0]
        const b = this.q.dateRange[1]
        if (a && b) {
          payload.created_from = a
          payload.created_to = b
        }
      }
      return payload
    },
    async reload() {
      this.loading = true
      this.errMsg = ''
      try {
        const co = uniCloud.importObject('enterpriseAuthCo', { customUI: true })
        const r = await co.getList(this.buildPayload())
        if (r && r.code === 200 && r.data) {
          this.list = r.data.list || []
          this.total = r.data.total || 0
        } else {
          this.errMsg = (r && r.message) || '加载失败'
          this.list = []
        }
      } catch (e) {
        this.errMsg = e.message || '加载失败'
        this.list = []
      } finally {
        this.loading = false
      }
    },
    reset() {
      this.q = { status: '', enterprise_name: '', contact_mobile: '', dateRange: [] }
      this.page = 1
      this.reload()
    },
    onPageChange(e) {
      if (e && e.current) {
        this.page = e.current
      }
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
    preview(url) {
      uni.previewImage({ urls: [url], current: url })
    },
    doApprove(row) {
      uni.showModal({
        title: '确认通过',
        content: `企业：${row.enterprise_name || ''}`,
        success: (r) => {
          if (!r.confirm) return
          this.submitHandle(row._id, 'approve', '')
        }
      })
    },
    doReject(row) {
      uni.showModal({
        title: '驳回原因',
        editable: true,
        placeholderText: '请填写驳回原因',
        success: (r) => {
          if (!r.confirm) return
          const reason = (r.content || '').trim()
          if (!reason) {
            uni.showToast({ title: '请填写驳回原因', icon: 'none' })
            return
          }
          this.submitHandle(row._id, 'reject', reason)
        }
      })
    },
    submitHandle(id, action, rejectReason) {
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      uni.showLoading({ title: '提交中' })
      const co = uniCloud.importObject('enterpriseAuthCo', { customUI: true })
      co
        .handle({
          uniIdToken,
          token: uniIdToken,
          id,
          action: action === 'approve' ? 'approve' : 'reject',
          rejectReason
        })
        .then((r) => {
          uni.hideLoading()
          if (r && r.code === 200) {
            uni.showToast({ title: '已保存' })
            this.closeDetail()
            this.reload()
          } else {
            uni.showModal({ content: (r && r.message) || '失败', showCancel: false })
          }
        })
        .catch((err) => {
          uni.hideLoading()
          uni.showModal({ content: err.message || '请求失败', showCancel: false })
        })
    }
  }
}
</script>

<style scoped>
@import '@/styles/admin-page.scss';
.page {
  padding: 22px;
}
.filter-panel {
  padding: 16px;
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
.table-wrap { padding: 16px; }
.btn-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: stretch;
}
.muted {
  color: #888;
  font-size: 13px;
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
.small {
  font-size: 12px;
}
.mono {
  font-family: monospace;
}
.detail-card {
  width: 560px;
  max-width: 92vw;
  max-height: 80vh;
  overflow-y: auto;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
}
.detail-title {
  font-weight: bold;
  margin-bottom: 12px;
  font-size: 16px;
}
.detail-line {
  display: flex;
  margin-bottom: 8px;
  font-size: 13px;
  line-height: 1.5;
  flex-wrap: wrap;
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
.license-img {
  max-width: 320px;
  border: 1px solid #eee;
  border-radius: 4px;
}
.detail-actions {
  margin-top: 16px;
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
