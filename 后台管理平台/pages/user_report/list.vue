<template>
  <view class="page">
    <view class="uni-header filter-panel">
      <view class="filter-grid">
        <uni-data-select v-model="q.status" :localdata="statusOpts" placeholder="举报状态" style="width: 140px;" />
        <uni-data-select v-model="q.report_reason_code" :localdata="reasonOpts" placeholder="举报原因" style="width: 180px;" />
        <input class="filter-input" v-model="q.reported_user_id" placeholder="被举报用户ID" />
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
      <view class="table-wrap">
        <uni-table border stripe emptyText="暂无数据">
          <uni-tr>
            <uni-th width="200">举报编号</uni-th>
            <uni-th width="100">被举报用户</uni-th>
            <uni-th width="100">举报用户</uni-th>
            <uni-th width="140">举报原因</uni-th>
            <uni-th width="100">来源页面</uni-th>
            <uni-th width="140">提交时间</uni-th>
            <uni-th width="90">状态</uni-th>
            <uni-th width="220">操作</uni-th>
          </uni-tr>
          <uni-tr v-for="row in list" :key="row._id">
            <uni-td><text class="mono small">{{ row._id }}</text></uni-td>
            <uni-td>{{ row.reported_user_name || row.reported_user_id }}</uni-td>
            <uni-td>{{ row.reporter_user_name || row.reporter_user_id }}</uni-td>
            <uni-td>{{ reasonText(row.report_reason_code) }}</uni-td>
            <uni-td>{{ row.page_source || '—' }}</uni-td>
            <uni-td><uni-dateformat v-if="row.created_at" :date="row.created_at" /><text v-else>—</text></uni-td>
            <uni-td>{{ statusText(row.status) }}</uni-td>
            <uni-td>
              <view class="btn-col">
                <button class="uni-button" size="mini" type="primary" plain @click="openDetail(row)">详情</button>
                <button v-if="row.status === 'pending'" class="uni-button" size="mini" @click="handle(row, 'processing')">处理中</button>
                <button v-if="row.status !== 'resolved_valid'" class="uni-button" size="mini" type="warn" @click="handle(row, 'resolved_valid')">属实</button>
                <button v-if="row.status !== 'resolved_invalid'" class="uni-button" size="mini" @click="handle(row, 'resolved_invalid')">不属实</button>
                <button class="uni-button" size="mini" type="default" @click="handle(row, 'closed')">关闭</button>
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
        <view class="detail-title">举报详情</view>
        <view class="detail-line"><text class="k">举报编号</text><text class="v mono">{{ detail._id }}</text></view>
        <view class="detail-line"><text class="k">被举报用户</text><text class="v">{{ detail.reported_user_name }}（{{ detail.reported_user_id }}）</text></view>
        <view class="detail-line"><text class="k">举报人</text><text class="v">{{ detail.reporter_user_name }}（{{ detail.reporter_user_id }}）</text></view>
        <view class="detail-line"><text class="k">原因</text><text class="v">{{ reasonText(detail.report_reason_code) }}</text></view>
        <view class="detail-line"><text class="k">补充说明</text><text class="v">{{ detail.report_description || '—' }}</text></view>
        <view class="detail-line"><text class="k">来源页面</text><text class="v">{{ detail.page_source || '—' }}</text></view>
        <view class="detail-line"><text class="k">关联</text><text class="v">{{ detail.related_content_type }} / {{ detail.related_content_id }}</text></view>
        <view class="detail-line"><text class="k">证据图</text><text class="v">{{ (detail.evidence_urls || []).length }} 张</text></view>
        <view class="detail-line"><text class="k">当前状态</text><text class="v">{{ statusText(detail.status) }}</text></view>
        <view class="detail-line"><text class="k">处理结果</text><text class="v">{{ detail.admin_handle_result || '—' }}</text></view>
        <view class="detail-line"><text class="k">管理员备注</text><text class="v">{{ detail.admin_handle_note || '—' }}</text></view>
        <view class="detail-line"><text class="k">处理人</text><text class="v">{{ detail.handled_by_name || detail.handled_by || '—' }}</text></view>
        <view class="detail-line"><text class="k">处理时间</text><text class="v"><uni-dateformat v-if="detail.handled_at" :date="detail.handled_at" /><text v-else>—</text></text></view>
        <button class="uni-button" type="primary" @click="closeDetail">关闭</button>
      </view>
    </uni-popup>
  </view>
</template>

<script>
const REASON_MAP = {
  fake_info: '不实信息/虚假内容',
  spam: '垃圾广告/骚扰',
  illegal_profile: '头像昵称违规',
  fraud: '欺诈或资金风险',
  abuse: '辱骂/人身攻击',
  other: '其他'
}
const STATUS_MAP = {
  pending: '待处理',
  processing: '处理中',
  resolved_valid: '属实',
  resolved_invalid: '不属实',
  closed: '已关闭'
}

export default {
  data() {
    return {
      q: {
        status: '',
        report_reason_code: '',
        reported_user_id: '',
        dateRange: []
      },
      statusOpts: [
        { value: '', text: '全部状态' },
        { value: 'pending', text: '待处理' },
        { value: 'processing', text: '处理中' },
        { value: 'resolved_valid', text: '属实' },
        { value: 'resolved_invalid', text: '不属实' },
        { value: 'closed', text: '已关闭' }
      ],
      reasonOpts: [
        { value: '', text: '全部原因' },
        { value: 'fake_info', text: REASON_MAP.fake_info },
        { value: 'spam', text: REASON_MAP.spam },
        { value: 'illegal_profile', text: REASON_MAP.illegal_profile },
        { value: 'fraud', text: REASON_MAP.fraud },
        { value: 'abuse', text: REASON_MAP.abuse },
        { value: 'other', text: REASON_MAP.other }
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
  onLoad(e) {
    if (e && e.reported_user_id) {
      this.q.reported_user_id = decodeURIComponent(String(e.reported_user_id))
    }
    this.reload()
  },
  methods: {
    reasonText(c) {
      return REASON_MAP[c] || c || '—'
    },
    statusText(s) {
      return STATUS_MAP[s] || s || '—'
    },
    buildWhere() {
      const db = uniCloud.database()
      const cmd = db.command
      const cond = []
      if (this.q.status) cond.push({ status: this.q.status })
      if (this.q.report_reason_code) cond.push({ report_reason_code: this.q.report_reason_code })
      if (this.q.reported_user_id && String(this.q.reported_user_id).trim()) {
        cond.push({ reported_user_id: String(this.q.reported_user_id).trim() })
      }
      if (this.q.dateRange && this.q.dateRange.length === 2) {
        const a = this.q.dateRange[0]
        const b = this.q.dateRange[1]
        if (a && b) {
          cond.push({ created_at: cmd.and(cmd.gte(a), cmd.lte(b)) })
        }
      }
      if (!cond.length) return {}
      if (cond.length === 1) return cond[0]
      return cmd.and(...cond)
    },
    async reload() {
      this.loading = true
      this.errMsg = ''
      try {
        const db = uniCloud.database()
        const where = this.buildWhere()
        const col = db.collection('user_report')
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
      this.q = { status: '', report_reason_code: '', reported_user_id: '', dateRange: [] }
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
    handle(row, status) {
      const titles = {
        processing: '标记为处理中',
        resolved_valid: '判定属实（将同步更新被举报用户信誉汇总）',
        resolved_invalid: '判定不属实',
        closed: '关闭举报'
      }
      const resultMap = {
        processing: '已受理',
        resolved_valid: '举报属实',
        resolved_invalid: '举报不属实',
        closed: '已关闭'
      }
      uni.showModal({
        title: (titles[status] || '确认操作') + ' - 处理结果',
        editable: true,
        placeholderText: resultMap[status] || status,
        success: (resultInput) => {
          if (!resultInput.confirm) return
          const resultText = (resultInput.content || '').trim() || resultMap[status] || status
          uni.showModal({
            title: '管理员备注',
            editable: true,
            placeholderText: '可选',
            success: (noteInput) => {
              if (!noteInput.confirm) return
              this.submitHandle(row._id, status, resultText, (noteInput.content || '').trim())
            }
          })
        }
      })
    },
    submitHandle(report_id, status, resultText, note) {
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      uni.showLoading({ title: '提交中' })
      const co = uniCloud.importObject('reputationCo', { customUI: true })
      co
        .handleReport({
          uniIdToken,
          token: uniIdToken,
          report_id,
          status,
          admin_handle_result: resultText || status,
          admin_handle_note: note
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
  width: 520px;
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
}
.detail-line .k {
  width: 100px;
  color: #888;
  flex-shrink: 0;
}
.detail-line .v {
  flex: 1;
  word-break: break-all;
}
</style>
