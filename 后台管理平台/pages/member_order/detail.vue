<template>
  <view class="page-shell">
    <view class="page-header">
      <view>
        <view class="page-title">会员订单详情</view>
        <view class="page-subtitle">查看会员订单归属、提成结算、客户会员状态与人工处理记录。</view>
      </view>
      <view v-if="order" class="header-tags">
        <text class="status-tag">{{ order.order_status_text }}</text>
        <text class="status-tag">{{ order.pay_status_text || order.order_status_text }}</text>
        <text class="status-tag">{{ order.order_type_text }}</text>
      </view>
    </view>
    <view v-if="loading" class="section-card muted pad">加载中…</view>
    <view v-else-if="errMsg" class="section-card err pad">{{ errMsg }}</view>
    <template v-else-if="order">
      <view class="summary-card">
        <view class="summary-grid">
          <view class="summary-item"><text class="summary-label">订单号</text><text class="summary-value">{{ order.order_no || '—' }}</text></view>
          <view class="summary-item"><text class="summary-label">客户</text><text class="summary-value">{{ order.customer_name || order.mobile || '—' }}</text></view>
          <view class="summary-item"><text class="summary-label">支付金额</text><text class="summary-value strong">￥{{ order.pay_amount }}</text></view>
          <view class="summary-item"><text class="summary-label">订单类型</text><text class="summary-value">{{ order.order_type_text }}</text></view>
          <view class="summary-item"><text class="summary-label">支付状态</text><text class="summary-value">{{ order.pay_status_text || order.order_status_text }}</text></view>
          <view class="summary-item"><text class="summary-label">提成状态</text><text class="summary-value">{{ order.commission_status_text }}</text></view>
          <view class="summary-item"><text class="summary-label">创建时间</text><text class="summary-value"><uni-dateformat v-if="order.created_at" :date="order.created_at" /><text v-else>—</text></text></view>
          <view class="summary-item"><text class="summary-label">支付时间</text><text class="summary-value"><uni-dateformat v-if="order.pay_time" :date="order.pay_time" /> <text v-else>—</text></text></view>
        </view>
      </view>

      <view class="detail-layout">
        <view class="left-col">
          <view class="section-card">
            <view class="section-title">订单基础信息</view>
            <view class="detail-grid">
              <view class="info-pair"><text class="k">订单ID</text><text class="v mono">{{ order._id }}</text></view>
              <view class="info-pair"><text class="k">客户ID</text><text class="v mono">{{ order.customer_id || '—' }}</text></view>
              <view class="info-pair"><text class="k">手机号</text><text class="v">{{ order.mobile || '—' }}</text></view>
              <view class="info-pair"><text class="k">会员天数</text><text class="v">{{ order.member_days != null ? order.member_days : '—' }}</text></view>
              <view class="info-pair"><text class="k">原价</text><text class="v">￥{{ order.original_amount }}</text></view>
              <view class="info-pair"><text class="k">折扣金额</text><text class="v">￥{{ order.discount_amount }}</text></view>
              <view class="info-pair"><text class="k">生效前到期</text><text class="v"><uni-dateformat v-if="order.expire_time_before" :date="order.expire_time_before" /><text v-else>—</text></text></view>
              <view class="info-pair"><text class="k">生效后到期</text><text class="v"><uni-dateformat v-if="order.expire_time_after" :date="order.expire_time_after" /><text v-else>—</text></text></view>
            </view>
            <view v-if="order.coupon_code || order.coupon_id" class="info-pair"><text class="k">会员优惠码</text><text class="v mono">{{ order.coupon_code || '—' }}</text></view>
            <view v-if="order.coupon_id" class="info-pair"><text class="k">优惠码ID</text><text class="v mono tiny">{{ order.coupon_id }}</text></view>
            <view class="info-pair"><text class="k">支付渠道</text><text class="v">{{ order.pay_channel_display || order.pay_channel || '—' }}</text></view>
            <view class="info-pair"><text class="k">交易流水号</text><text class="v mono">{{ order.transaction_id || '—' }}</text></view>
            <view class="info-pair"><text class="k">商户订单号</text><text class="v mono">{{ order.out_trade_no || '—' }}</text></view>
            <view class="info-pair"><text class="k">平台支付单号</text><text class="v mono">{{ order.pay_order_no || '—' }}</text></view>
            <view class="info-pair"><text class="k">回调处理时间</text><text class="v"><uni-dateformat v-if="order.pay_callback_time" :date="order.pay_callback_time" /><text v-else>—</text></text></view>
            <view v-if="order.remark" class="info-pair"><text class="k">订单表备注</text><text class="v">{{ order.remark }}</text></view>
            <view v-if="order.pay_mock_flag" class="info-pair"><text class="k">测试标记</text><text class="v strong">本单为历史测试数据落账（仅展示）</text></view>
          </view>

          <view v-if="showRepairBlock" class="section-card repair-card">
            <view class="section-title">档案安全回填（仅空字段，不覆盖已有值）</view>
            <view class="muted repair-tip">
              从客户档案（customer_profile）回填到本订单；不修改 customer_id、支付与提成字段。修复记录写入下方「处理日志」。
            </view>
            <view class="repair-btns">
              <button
                v-if="showRepairCustomerNameBtn"
                class="uni-button"
                type="default"
                size="mini"
                :loading="repairing === 'customer_name'"
                @click="runRepair(['customer_name'])"
              >
                从档案回填客户姓名
              </button>
              <button
                v-if="showRepairMobileBtn"
                class="uni-button"
                type="default"
                size="mini"
                :loading="repairing === 'mobile'"
                @click="runRepair(['mobile'])"
              >
                从档案回填手机号
              </button>
            </view>
          </view>

          <view class="section-card">
            <view class="section-title">订单归属与提成信息</view>
            <view class="detail-grid">
              <view class="info-pair"><text class="k">首次业务员</text><text class="v">{{ order.first_sales_name || '—' }}<text v-if="order.first_sales_code" class="sub"> 编号 {{ order.first_sales_code }}</text><text v-if="order.first_sales_id" class="sub mono"> · 内部ID {{ order.first_sales_id }}</text></text></view>
              <view class="info-pair"><text class="k">当前业务员（客户档案）</text><text class="v">{{ customer_current_sales_name || '—' }}<text v-if="customer_current_sales_code" class="sub"> 编号 {{ customer_current_sales_code }}</text><text v-if="customer_current_sales_id" class="sub mono"> · 内部ID {{ customer_current_sales_id }}</text></text></view>
              <view class="info-pair"><text class="k">订单提成业务员</text><text class="v">{{ order.sales_name || '—' }}<text v-if="order.sales_code" class="sub"> 编号 {{ order.sales_code }}</text><text v-if="order.sales_id" class="sub mono"> · 内部ID {{ order.sales_id }}</text></text></view>
              <view class="info-pair"><text class="k">来源渠道</text><text class="v">{{ order.channel_name || '—' }} <text class="sub mono">{{ order.channel_id || '' }}</text></text></view>
              <view class="info-pair"><text class="k">邀请码</text><text class="v mono">{{ order.invite_code || '—' }}</text></view>
              <view class="info-pair"><text class="k">提成类型</text><text class="v">{{ order.commission_type || '—' }}</text></view>
              <view class="info-pair"><text class="k">提成比例</text><text class="v">{{ commissionRateText }}</text></view>
              <view class="info-pair"><text class="k">提成金额</text><text class="v">￥{{ order.commission_amount }}</text></view>
              <view class="info-pair"><text class="k">提成状态</text><text class="v">{{ order.commission_status_text }}</text></view>
              <view class="info-pair"><text class="k">结算单ID</text><text class="v mono tiny">{{ order.commission_settlement_id || '—' }}</text></view>
              <view class="info-pair"><text class="k">结算月份</text><text class="v">{{ order.commission_settlement_month || '—' }}</text></view>
              <view class="info-pair"><text class="k">提成结算时间</text><text class="v"><uni-dateformat v-if="order.commission_settle_time" :date="order.commission_settle_time" /> <text v-else>—</text></text></view>
            </view>
          </view>

          <view class="section-card" v-if="membership_summary">
            <view class="section-title">客户会员状态摘要（只读）</view>
            <view class="detail-grid">
              <view class="info-pair"><text class="k">当前判断</text><text class="v strong">{{ membership_summary.display_status }}</text></view>
              <view class="info-pair"><text class="k">档案会员状态</text><text class="v">{{ membership_summary.member_status_text }}（code={{ membership_summary.member_status }}）</text></view>
              <view class="info-pair"><text class="k">会员到期时间</text><text class="v"><uni-dateformat v-if="membership_summary.member_expire_time" :date="membership_summary.member_expire_time" /> <text v-else>—</text></text></view>
              <view class="info-pair"><text class="k">档案最近续费时间</text><text class="v"><uni-dateformat v-if="membership_summary.member_last_renew_time" :date="membership_summary.member_last_renew_time" /> <text v-else>—</text></text></view>
            </view>
            <view class="subsec">最近一次成功会员订单</view>
            <template v-if="membership_summary.last_success_order">
              <view class="detail-grid">
                <view class="info-pair"><text class="k">订单号</text><text class="v">{{ membership_summary.last_success_order.order_no }}</text></view>
                <view class="info-pair"><text class="k">类型</text><text class="v">{{ membership_summary.last_success_order.order_type_text }}</text></view>
                <view class="info-pair"><text class="k">支付时间</text><text class="v"><uni-dateformat :date="membership_summary.last_success_order.pay_time" /></text></view>
                <view class="info-pair"><text class="k">金额</text><text class="v">￥{{ membership_summary.last_success_order.pay_amount }}</text></view>
              </view>
            </template>
            <view v-else class="muted pad-sm">暂无已支付订单</view>
            <view class="subsec">最近一次续费订单</view>
            <template v-if="membership_summary.last_renewal_order">
              <view class="detail-grid">
                <view class="info-pair"><text class="k">订单号</text><text class="v">{{ membership_summary.last_renewal_order.order_no }}</text></view>
                <view class="info-pair"><text class="k">支付时间</text><text class="v"><uni-dateformat :date="membership_summary.last_renewal_order.pay_time" /></text></view>
                <view class="info-pair"><text class="k">续费前到期</text><text class="v"><uni-dateformat v-if="membership_summary.last_renewal_order.expire_time_before" :date="membership_summary.last_renewal_order.expire_time_before" /><text v-else>—</text></text></view>
                <view class="info-pair"><text class="k">续费后到期</text><text class="v"><uni-dateformat v-if="membership_summary.last_renewal_order.expire_time_after" :date="membership_summary.last_renewal_order.expire_time_after" /><text v-else>—</text></text></view>
                <view class="info-pair"><text class="k">支付金额</text><text class="v">￥{{ membership_summary.last_renewal_order.pay_amount }}</text></view>
              </view>
            </template>
            <view v-else class="muted pad-sm">暂无续费记录</view>
          </view>
          <view v-else class="section-card muted">无客户ID，无法汇总会员状态</view>

          <view class="section-card">
            <view class="section-title">历史处理记录（最近20条）</view>
            <view class="timeline-card">
              <view v-if="!timelineRecords.length" class="muted">暂无备注与日志</view>
              <view v-for="(r, idx) in timelineRecords" :key="(r._id || '') + '-' + idx" class="tl-item">
                <view class="tl-head">
                  <text :class="['tl-tag', r.remark_type || 'system']">{{ recordTypeLabel(r.remark_type) }}</text>
                  <text class="tl-meta">{{ r.operator_name || r.operator_uid || '—' }} · <uni-dateformat :date="r.created_at" /></text>
                </view>
                <view class="tl-body pre">{{ r.remark_content }}</view>
              </view>
              <view v-if="timelineTotalCount > 20" class="muted tl-more">仅展示最近 20 条，共 {{ timelineTotalCount }} 条记录。</view>
            </view>
          </view>
        </view>

        <view class="right-col">
          <view class="section-card action-card">
            <view class="section-title">快捷跳转</view>
            <view class="jump-list">
              <view v-if="order.customer_id" class="jump-item">
                <view>
                  <text class="jump-title">客户详情</text>
                  <text class="jump-desc">查看客户档案与归属信息</text>
                </view>
                <button class="uni-button" size="mini" type="default" @click="goCustomer">进入</button>
              </view>
              <view v-if="order.commission_settlement_id" class="jump-item">
                <view>
                  <text class="jump-title">结算单</text>
                  <text class="jump-desc">查看当前订单关联结算单</text>
                </view>
                <button class="uni-button" size="mini" type="primary" @click="goSettle">进入</button>
              </view>
              <view class="jump-item danger">
                <view>
                  <text class="jump-title">删除订单</text>
                  <text class="jump-desc">删除后同步回收会员状态，不可恢复</text>
                </view>
                <button class="uni-button" size="mini" type="warn" :loading="deletingOrder" @click="confirmDeleteOrder">删除</button>
              </view>
            </view>
          </view>

          <view class="section-card process-card">
            <view class="section-title">当前人工处理（不影响支付/提成状态）</view>
            <view class="muted hint">仅记录人工处理结果，不影响支付与提成主状态。</view>
            <view class="info-pair"><text class="k">当前状态</text><text class="v strong">{{ order.handle_status_text }}</text></view>
            <view class="info-pair"><text class="k">跟进人</text><text class="v">{{ order.followup_name || order.followup_uid || '—' }}</text></view>
            <view class="info-pair"><text class="k">最近处理时间</text><text class="v"><uni-dateformat v-if="order.handled_at" :date="order.handled_at" /><text v-else>—</text></text></view>
            <view class="handle-result-block">
              <text class="kr">处理结论（当前）</text>
              <view class="handle-result-body pre">{{ order.handle_result || '（尚未填写）' }}</view>
            </view>
            <view class="form-section form-card handle-form">
              <view class="form-row">
                <text class="fk">状态</text>
                <uni-data-select v-model="editHandleStatus" :localdata="handleStatusEditOptions" style="flex:1" />
              </view>
              <view class="form-row col">
                <text class="fk">结论</text>
                <textarea v-model="editHandleResult" class="ta" placeholder="填写处理结论（保存后写入上方「当前」并记系统日志）" />
              </view>
              <view class="form-row">
                <text class="fk">跟进人</text>
                <input v-model="editFollowupName" class="inp" placeholder="留空则保存为当前登录账号名" />
              </view>
              <button class="uni-button" type="primary" size="mini" :loading="handleSaving" @click="submitHandle">保存人工处理</button>
            </view>
          </view>

          <view class="section-card">
            <view class="section-title">新增备注</view>
            <view class="form-section form-card">
              <view class="form-row">
                <text class="fk">类型</text>
                <uni-data-select v-model="newRemarkType" :localdata="remarkTypeOptions" style="flex:1" />
              </view>
              <view class="form-row col">
                <text class="fk">内容</text>
                <textarea v-model="newRemarkContent" class="ta" placeholder="请输入备注，勿修改支付结果或提成归属" />
              </view>
              <button class="uni-button" type="primary" size="mini" :loading="submitting" @click="submitRemark">提交备注</button>
            </view>
          </view>
        </view>
      </view>
    </template>
  </view>
</template>

<script>
export default {
  data() {
    return {
      orderId: '',
      loading: true,
      errMsg: '',
      order: null,
      customer_current_sales_id: '',
      customer_current_sales_name: '',
      customer_current_sales_code: '',
      membership_summary: null,
      remarks: [],
      action_logs: [],
      newRemarkType: 'normal',
      newRemarkContent: '',
      submitting: false,
      remarkTypeOptions: [
        { value: 'normal', text: '普通备注' },
        { value: 'exception', text: '异常备注' },
        { value: 'followup', text: '跟进备注' }
      ],
      editHandleStatus: 'pending',
      editHandleResult: '',
      editFollowupName: '',
      handleSaving: false,
      handleStatusEditOptions: [
        { value: 'pending', text: '待处理' },
        { value: 'processing', text: '跟进中' },
        { value: 'done', text: '已处理' },
        { value: 'closed', text: '已关闭' }
      ],
      repairing: '',
      deletingOrder: false
    }
  },
  computed: {
    showRepairCustomerNameBtn() {
      const o = this.order
      if (!o || !o.customer_id) return false
      const s = o.customer_name
      return s === undefined || s === null || String(s).trim() === ''
    },
    showRepairMobileBtn() {
      const o = this.order
      if (!o || !o.customer_id) return false
      const s = o.mobile
      return s === undefined || s === null || String(s).trim() === ''
    },
    showRepairBlock() {
      return this.showRepairCustomerNameBtn || this.showRepairMobileBtn
    },
    timelineTotalCount() {
      return (this.action_logs || []).length + (this.remarks || []).length
    },
    timelineRecords() {
      const logs = (this.action_logs || []).map((r) => ({ ...r }))
      const rmk = (this.remarks || []).map((r) => ({ ...r }))
      return [...logs, ...rmk]
        .sort((a, b) => {
          const ta = a.created_at ? new Date(a.created_at).getTime() : 0
          const tb = b.created_at ? new Date(b.created_at).getTime() : 0
          return tb - ta
        })
        .slice(0, 20)
    },
    commissionRateText() {
      const r = this.order && this.order.commission_rate
      if (r === null || r === undefined || r === '') return '—'
      const n = Number(r)
      if (Number.isNaN(n)) return String(r)
      if (n <= 1) return `${(n * 100).toFixed(2)}%（存为小数）`
      return `${n}%`
    },
  },
  onLoad(e) {
    if (e && e.id) {
      this.orderId = String(e.id).trim()
    }
    if (this.orderId) {
      this.loadDetail()
    } else {
      this.loading = false
      this.errMsg = '缺少订单ID'
    }
  },
  methods: {
    memberOrderCo() {
      return uniCloud.importObject('memberOrderCo', { customUI: true })
    },
    isEmptyStr(s) {
      return s === undefined || s === null || String(s).trim() === ''
    },
    async runRepair(fields) {
      if (!this.orderId || !fields || !fields.length || this.repairing) return
      const key = fields.length === 1 ? fields[0] : 'both'
      this.repairing = key
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      try {
        const res = await uniCloud.callFunction({
          name: 'repairMemberOrderCustomerInfo',
          data: {
            uniIdToken,
            token: uniIdToken,
            order_id: this.orderId,
            repair_fields: fields
          }
        })
        const body = res.result || {}
        if (body.code !== 200) {
          uni.showModal({ title: '无法回填', content: body.message || '修复失败', showCancel: false })
          return
        }
        const d = body.data || {}
        if (d.partial_errors && d.partial_errors.length) {
          uni.showToast({ title: '部分成功，见提示', icon: 'none' })
          uni.showModal({
            title: '部分成功',
            content: d.partial_errors.join('；'),
            showCancel: false
          })
        } else {
          uni.showToast({ title: '回填成功', icon: 'success' })
        }
        await this.loadDetail()
      } catch (e) {
        uni.showModal({ content: e.message || '请求失败', showCancel: false })
      } finally {
        this.repairing = ''
      }
    },
    remarkTypeLabel(t) {
      const m = { normal: '普通', exception: '异常', followup: '跟进' }
      return m[t] || t
    },
    recordTypeLabel(t) {
      const m = { system: '系统', normal: '普通', exception: '异常', followup: '跟进' }
      return m[t] || t || '系统'
    },
    syncHandleFormFromOrder() {
      if (!this.order) return
      this.editHandleStatus = this.order.handle_status || 'pending'
      this.editHandleResult = this.order.handle_result || ''
      this.editFollowupName = this.order.followup_name || ''
    },
    async submitHandle() {
      this.handleSaving = true
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      try {
        const body = await this.memberOrderCo().updateHandleStatus({
          uniIdToken,
          token: uniIdToken,
          order_id: this.orderId,
          handle_status: this.editHandleStatus,
          handle_result: (this.editHandleResult || '').trim(),
          followup_name: (this.editFollowupName || '').trim()
        })
        if (body.code !== 200) {
          uni.showModal({ content: body.message || '保存失败', showCancel: false })
          return
        }
        uni.showToast({ title: '已保存', icon: 'success' })
        await this.loadDetail()
      } catch (e) {
        uni.showModal({ content: e.message || '请求失败', showCancel: false })
      } finally {
        this.handleSaving = false
      }
    },
    async loadDetail() {
      this.loading = true
      this.errMsg = ''
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      try {
        const body = await this.memberOrderCo().detail({
          uniIdToken,
          token: uniIdToken,
          order_id: this.orderId
        })
        if (body.code !== 200) {
          this.errMsg = body.message || '加载失败'
          this.order = null
          return
        }
        const d = body.data || {}
        this.order = d.order
        this.customer_current_sales_id = d.customer_current_sales_id || ''
        this.customer_current_sales_name = d.customer_current_sales_name || ''
        this.customer_current_sales_code = d.customer_current_sales_code || ''
        this.membership_summary = d.membership_summary
        this.remarks = d.remarks || []
        this.action_logs = d.action_logs || []
        this.syncHandleFormFromOrder()
      } catch (e) {
        this.errMsg = e.message || '请求异常'
        this.order = null
      } finally {
        this.loading = false
      }
    },
    goCustomer() {
      if (!this.order || !this.order.customer_id) return
      uni.navigateTo({
        url: `/pages/customer_profile/edit?id=${encodeURIComponent(this.order.customer_id)}`
      })
    },
    goSettle() {
      if (!this.order || !this.order.commission_settlement_id) return
      uni.navigateTo({
        url: `/pages/sales_commission_settle/detail?id=${encodeURIComponent(this.order.commission_settlement_id)}`
      })
    },
    confirmDeleteOrder() {
      if (!this.orderId || this.deletingOrder) return
      uni.showModal({
        title: '确认删除',
        content: '删除后不可恢复，且会同步回收会员状态。确定删除该会员订单吗？',
        success: async (r) => {
          if (!r.confirm) return
          await this.deleteOrderAndSync()
        }
      })
    },
    async deleteOrderAndSync() {
      if (!this.orderId) return
      this.deletingOrder = true
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      if (!uniIdToken) {
        this.deletingOrder = false
        uni.showToast({ title: '登录状态失效，请重新登录', icon: 'none' })
        return
      }
      uni.showLoading({ title: '删除中...', mask: true })
      try {
        const res = await uniCloud.callFunction({
          name: 'deleteMemberOrdersAndSync',
          data: {
            uniIdToken,
            token: uniIdToken,
            order_ids: [this.orderId]
          }
        })
        const body = (res && res.result) || {}
        if (Number(body.code) !== 200) {
          uni.showModal({ content: body.message || '删除失败', showCancel: false })
          return
        }
        uni.showToast({ title: '删除成功', icon: 'success' })
        setTimeout(() => {
          uni.navigateBack()
        }, 300)
      } catch (e) {
        uni.showModal({ content: e.message || '请求失败', showCancel: false })
      } finally {
        uni.hideLoading()
        this.deletingOrder = false
      }
    },
    async submitRemark() {
      const content = (this.newRemarkContent || '').trim()
      if (!content) {
        uni.showToast({ title: '请填写备注内容', icon: 'none' })
        return
      }
      this.submitting = true
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      try {
        const body = await this.memberOrderCo().addRemark({
          uniIdToken,
          token: uniIdToken,
          order_id: this.orderId,
          remark_type: this.newRemarkType,
          remark_content: content
        })
        if (body.code !== 200) {
          uni.showModal({ content: body.message || '保存失败', showCancel: false })
          return
        }
        this.newRemarkContent = ''
        uni.showToast({ title: '已保存', icon: 'success' })
        await this.loadDetail()
      } catch (e) {
        uni.showModal({ content: e.message || '请求失败', showCancel: false })
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style scoped>
@import '@/styles/admin-page.scss';
.page-shell { padding-bottom: 40px; }
.header-tags { display: flex; gap: 8px; flex-wrap: wrap; }
.summary-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.summary-item { padding: 10px; border: 1px solid #e7edf5; border-radius: 10px; background: #fff; }
.summary-label { display: block; font-size: 12px; color: #94a3b8; margin-bottom: 4px; }
.summary-value { font-size: 14px; color: #0f172a; font-weight: 600; }
.summary-value.strong { color: #2563eb; }
.detail-layout { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; }
.detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 12px; }
.info-pair { display: flex; gap: 8px; line-height: 1.5; }
.pad {
  padding: 16px 0;
}
.pad-sm {
  padding: 8px 0;
}
.muted {
  color: #909399;
  font-size: 13px;
}
.err {
  color: #f56c6c;
  font-size: 14px;
}
.k {
  color: #909399;
  min-width: 96px;
  flex-shrink: 0;
  font-size: 12px;
}
.v {
  color: #303133;
  flex: 1;
  word-break: break-all;
  font-size: 13px;
}
.v.strong {
  font-weight: 600;
  color: #409eff;
}
.sub {
  display: block;
  font-size: 11px;
  color: #909399;
}
.subsec {
  margin: 12px 0 8px;
  font-weight: 600;
  color: #606266;
  font-size: 13px;
}
.mono {
  font-family: monospace;
  font-size: 12px;
}
.mono.tiny {
  font-size: 10px;
}
.btns {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.action-card .jump-list { display: grid; gap: 10px; }
.jump-item { display: flex; justify-content: space-between; align-items: center; gap: 10px; border: 1px solid #e7edf5; border-radius: 10px; padding: 10px; }
.jump-item.danger { border-color: #fbc4c4; background: #fff9f9; }
.jump-title { display: block; font-size: 14px; color: #0f172a; font-weight: 600; }
.jump-desc { display: block; font-size: 12px; color: #94a3b8; margin-top: 2px; }
.form-card .form-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
  gap: 10px;
}
.form-card .form-row.col {
  flex-direction: column;
  align-items: stretch;
}
.fk {
  color: #606266;
  min-width: 48px;
}
.ta {
  width: 100%;
  min-height: 88px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 8px;
  font-size: 13px;
  box-sizing: border-box;
}
.handle-form .inp {
  flex: 1;
  height: 34px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 0 8px;
  font-size: 13px;
}
.pre {
  white-space: pre-wrap;
}
.hint {
  margin-top: 8px;
  font-size: 12px;
}
.process-card { border-left: 3px solid #60a5fa; }
.repair-card .repair-tip {
  margin-bottom: 10px;
  line-height: 1.5;
}
.repair-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.handle-result-block {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #dcdfe6;
}
.kr {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
}
.handle-result-body {
  font-size: 13px;
  color: #303133;
  line-height: 1.55;
  word-break: break-word;
}
.timeline-card {
  max-height: none;
}
.tl-item {
  padding: 10px 0;
  border-bottom: 1px solid #ebeef5;
}
.tl-item:last-of-type {
  border-bottom: none;
}
.tl-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.tl-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  background: #f4f4f5;
  color: #606266;
}
.tl-tag.system {
  background: #ecf5ff;
  color: #409eff;
}
.tl-tag.exception {
  background: #fef0f0;
  color: #f56c6c;
}
.tl-tag.followup {
  background: #fdf6ec;
  color: #e6a23c;
}
.tl-tag.normal {
  background: #f0f9eb;
  color: #67c23a;
}
.tl-meta {
  font-size: 12px;
  color: #909399;
}
.tl-body {
  font-size: 12px;
  color: #303133;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
.tl-more {
  margin-top: 10px;
  font-size: 12px;
}
@media screen and (max-width: 1100px) {
  .summary-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .detail-layout { grid-template-columns: 1fr; }
}
@media screen and (max-width: 768px) {
  .summary-grid, .detail-grid { grid-template-columns: 1fr; }
}
</style>
