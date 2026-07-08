<template>
  <view class="page-shell">
    <view class="page-header">
      <view>
        <view class="page-title">客户归属审核</view>
        <view class="page-subtitle">基于客户档案核对后执行业务员分配。</view>
      </view>
    </view>
    <view v-if="docId && audit.loaded" class="detail-section reconcile-snap">
      <view class="snap-title">客户核对信息（只读）</view>
      <view class="snap-line"><text class="sk">手机号</text>{{ audit.mobile || '—' }}</view>
      <view class="snap-line"><text class="sk">首次业务员（编号 / 姓名）</text>{{ formatAuditSales(audit.first_sales_code, audit.first_sales_name) }}</view>
      <view class="snap-line"><text class="sk">当前业务员（编号 / 姓名）</text>{{ formatAuditSales(audit.current_sales_code, audit.current_sales_name) }}</view>
      <view class="snap-line"><text class="sk">来源渠道 ID / 名称</text>{{ audit.source_channel_id || '—' }} / {{ audit.source_channel_name || '—' }}</view>
      <view class="snap-line"><text class="sk">转移次数</text>{{ audit.transfer_count != null ? audit.transfer_count : 0 }}</view>
      <view class="snap-muted">内部关联仍使用数据库业务员 _id，此处仅展示业务员编号便于运营核对。</view>
      <view class="snap-muted">完整核对（最近订单、转移申请）请在「客户归属管理」列表点「核对信息」弹窗查看。</view>
    </view>

    <view v-if="docId && audit.loaded && membership" class="detail-section member-snap">
      <view class="snap-title">会员状态核对（只读）</view>
      <view class="snap-line"><text class="sk">当前判断</text><text class="em">{{ membership.display_status || '—' }}</text></view>
      <view class="snap-line"><text class="sk">档案会员状态</text>{{ membership.member_status_text || '—' }}（code={{ membership.member_status }}）</view>
      <view class="snap-line"><text class="sk">会员到期时间</text><uni-dateformat v-if="membership.member_expire_time" :date="membership.member_expire_time" /><text v-else>—</text></view>
      <view class="snap-line"><text class="sk">档案最近续费时间</text><uni-dateformat v-if="membership.member_last_renew_time" :date="membership.member_last_renew_time" /><text v-else>—</text></view>

      <view class="sub-h">最近一次成功会员订单</view>
      <template v-if="membership.last_success_order">
        <view class="snap-line"><text class="sk">订单号</text>{{ membership.last_success_order.order_no }}</view>
        <view class="snap-line"><text class="sk">类型</text>{{ membership.last_success_order.order_type_text }}</view>
        <view class="snap-line"><text class="sk">支付时间</text><uni-dateformat :date="membership.last_success_order.pay_time" /></view>
        <view class="snap-line"><text class="sk">支付金额</text>￥{{ membership.last_success_order.pay_amount }}</view>
      </template>
      <view v-else class="snap-muted">暂无已支付会员订单</view>

      <view class="sub-h">最近一次续费订单</view>
      <template v-if="membership.last_renewal_order">
        <view class="snap-line"><text class="sk">支付时间</text><uni-dateformat :date="membership.last_renewal_order.pay_time" /></view>
        <view class="snap-line"><text class="sk">续费前到期</text><uni-dateformat v-if="membership.last_renewal_order.expire_time_before" :date="membership.last_renewal_order.expire_time_before" /><text v-else>—</text></view>
        <view class="snap-line"><text class="sk">续费后到期</text><uni-dateformat v-if="membership.last_renewal_order.expire_time_after" :date="membership.last_renewal_order.expire_time_after" /><text v-else>—</text></view>
        <view class="snap-line"><text class="sk">支付金额</text>￥{{ membership.last_renewal_order.pay_amount }}</view>
      </template>
      <view v-else class="snap-muted">暂无续费记录</view>
    </view>

    <view class="form-section">
    <uni-forms ref="form" :model="formData" validateTrigger="bind">
      <uni-forms-item name="sales_code_input" label="业务员编号" required>
        <uni-easyinput placeholder="例如 YW10001（失焦后自动匹配姓名）" v-model="formData.sales_code_input" trim="both" @blur="resolveSalesFromCode"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="first_sales_name" label="业务员姓名">
        <uni-easyinput placeholder="自动带出" v-model="formData.first_sales_name" disabled></uni-easyinput>
      </uni-forms-item>
      <view class="uni-button-group">
        <button type="primary" class="uni-button" style="width: 100px;" @click="submit">提交分配</button>
        <navigator open-type="navigateBack" style="margin-left: 15px;">
          <button class="uni-button" style="width: 100px;">返回</button>
        </navigator>
      </view>
    </uni-forms>
    </view>
  </view>
</template>

<script>
  export default {
    data() {
      return {
        formData: {
          sales_code_input: '',
          resolved_sales_id: '',
          first_sales_name: ''
        },
        docId: '',
        audit: {
          loaded: false,
          mobile: '',
          first_sales_id: '',
          first_sales_name: '',
          first_sales_code: '',
          current_sales_id: '',
          current_sales_name: '',
          current_sales_code: '',
          source_channel_id: '',
          source_channel_name: '',
          transfer_count: 0
        },
        membership: null
      }
    },
    onLoad(e) {
      if (e && e.id) {
        this.docId = e.id
        this.loadAuditBundle()
      }
    },
    methods: {
      formatAuditSales(code, name) {
        const c = (code || '').trim()
        const n = (name || '').trim()
        if (c && n) return `${c} / ${n}`
        if (n) return n
        if (c) return c
        return '—'
      },
      authPayload() {
        const uniIdToken = uni.getStorageSync('uni_id_token') || ''
        return { uniIdToken, token: uniIdToken }
      },
      async loadAuditBundle() {
        if (!this.docId) return
        const uniIdToken = uni.getStorageSync('uni_id_token') || ''
        try {
          const res = await uniCloud.callFunction({
            name: 'getCustomerAuditInfo',
            data: {
              uniIdToken,
              token: uniIdToken,
              customer_id: this.docId
            }
          })
          const body = res.result || {}
          if (body.code === 200 && body.data) {
            const c = body.data.customer || {}
            this.audit = {
              loaded: true,
              mobile: c.mobile || '',
              first_sales_id: c.first_sales_id || '',
              first_sales_name: c.first_sales_name || '',
              first_sales_code: c.first_sales_code || '',
              current_sales_id: c.current_sales_id || '',
              current_sales_name: c.current_sales_name || '',
              current_sales_code: c.current_sales_code || '',
              source_channel_id: c.source_channel_id || '',
              source_channel_name: c.source_channel_name || '',
              transfer_count: c.transfer_count != null ? c.transfer_count : 0
            }
            this.membership = body.data.membership || null
          } else {
            this.audit = { ...this.audit, loaded: true }
            this.membership = null
            if (body.message) {
              console.warn('[getCustomerAuditInfo]', body.message)
            }
          }
        } catch (err) {
          this.audit = { ...this.audit, loaded: true }
          this.membership = null
          console.warn('[getCustomerAuditInfo] fail', err)
        }
      },
      async resolveSalesFromCode() {
        const raw = (this.formData.sales_code_input || '').trim()
        this.formData.resolved_sales_id = ''
        this.formData.first_sales_name = ''
        if (!raw) return
        try {
          const res = await uniCloud.callFunction({
            name: 'resolveSalesStaffByInput',
            data: {
              ...this.authPayload(),
              sales_input: raw
            }
          })
          const body = res.result || {}
          if (body.code === 200 && body.data) {
            this.formData.resolved_sales_id = body.data._id || ''
            this.formData.first_sales_name = body.data.sales_name || ''
            if (body.data.sales_code) {
              this.formData.sales_code_input = body.data.sales_code
            }
          } else {
            uni.showToast({ title: body.message || '未找到业务员', icon: 'none' })
          }
        } catch (e) {
          uni.showToast({ title: '查询失败', icon: 'none' })
        }
      },
      async submit() {
        await this.resolveSalesFromCode()
        const sid = (this.formData.resolved_sales_id || '').trim()
        if (!sid || !this.formData.first_sales_name) {
          uni.showToast({ title: '请输入有效业务员编号并匹配到业务员', icon: 'none' })
          return
        }
        uni.showLoading({ mask: true })
        const data = {
          first_sales_id: sid,
          first_sales_name: this.formData.first_sales_name,
          current_sales_id: sid,
          current_sales_name: this.formData.first_sales_name,
          first_bind_time: Date.now(),
          updated_at: Date.now()
        }

        uniCloud
          .database()
          .collection('customer_profile')
          .doc(this.docId)
          .update(data)
          .then(() => {
            uni.showToast({ title: '分配成功' })
            this.getOpenerEventChannel().emit('refreshData')
            this.loadAuditBundle()
            setTimeout(() => uni.navigateBack(), 500)
          })
          .catch((err) => {
            uni.showModal({ content: err.message || '请求失败', showCancel: false })
          })
          .finally(() => {
            uni.hideLoading()
          })
      }
    }
  }
</script>

<style scoped>
.reconcile-snap,
.member-snap {
  margin-bottom: 20px;
  padding: 12px 14px;
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}
.member-snap {
  background: #f5f9ff;
  border-color: #d9ecff;
}
.snap-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 10px;
  color: #303133;
}
.snap-line {
  font-size: 13px;
  margin-bottom: 8px;
  line-height: 1.5;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.sk {
  color: #909399;
  min-width: 160px;
  flex-shrink: 0;
}
.em {
  font-weight: 600;
  color: #409eff;
}
.snap-muted {
  font-size: 12px;
  color: #909399;
  margin-top: 10px;
}
.sub-h {
  font-weight: 600;
  font-size: 13px;
  margin: 12px 0 8px;
  color: #606266;
}
</style>
