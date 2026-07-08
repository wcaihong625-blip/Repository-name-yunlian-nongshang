<template>
  <view class="page">
    <view class="uni-header panel">
      <view class="title">历史测试会员订单清理（运营工具）</view>
      <view class="desc">
        仅用于清理/排查：默认只处理带测试标记的订单（pay_mock_flag=true）。不参与正式 uni-pay、推广、会员续费等主链路。请先「预演检查」，确认后再「正式清理」。
      </view>
      <view class="form-grid">
        <view class="form-item">
          <text class="label">用户ID</text>
          <input class="uni-input" v-model="form.user_id" placeholder="输入 user_id（可选）" />
        </view>
        <view class="form-item">
          <text class="label">手机号</text>
          <input class="uni-input" v-model="form.mobile" placeholder="输入手机号（可选）" />
        </view>
      </view>
      <view class="switch-row">
        <label class="switch-item">
          <switch :checked="form.only_mock" @change="onOnlyMockChange" />
          <text>仅清理带测试标记订单（推荐）</text>
        </label>
      </view>
      <view class="btn-row">
        <button class="uni-button" type="primary" size="mini" :loading="loading" @click="runDryRun">预演检查</button>
        <button class="uni-button" type="warn" size="mini" :loading="loading" @click="runExecute">正式清理</button>
        <button class="uni-button" type="default" size="mini" :disabled="loading" @click="resetForm">重置</button>
      </view>
    </view>

    <view class="uni-container">
      <view v-if="lastResult" class="result-card">
        <view class="result-line">
          <text class="k">状态：</text>
          <text :class="lastResult.code === 200 ? 'ok' : 'err'">{{ lastResult.message }}</text>
        </view>
        <view class="result-line"><text class="k">用户ID：</text><text>{{ resultData.user_id || '—' }}</text></view>
        <view class="result-line"><text class="k">手机号：</text><text>{{ resultData.mobile || '—' }}</text></view>
        <view class="result-line"><text class="k">匹配订单：</text><text>{{ resultData.matched_order_count || 0 }}</text></view>

        <view class="split"></view>
        <view class="subtitle">删除计划</view>
        <view class="result-line"><text class="k">member_order：</text><text>{{ deletePlan.member_order || 0 }}</text></view>
        <view class="result-line"><text class="k">member_order_remark：</text><text>{{ deletePlan.member_order_remark || 0 }}</text></view>
        <view class="result-line"><text class="k">member_coupon_use_log：</text><text>{{ deletePlan.member_coupon_use_log || 0 }}</text></view>
        <view class="result-line"><text class="k">uni-pay-orders：</text><text>{{ deletePlan.uni_pay_orders || 0 }}</text></view>

        <view class="split"></view>
        <view class="subtitle">命中订单ID</view>
        <view v-if="cleanedOrderIds.length === 0" class="muted">无</view>
        <view v-else class="id-list">
          <text v-for="id in cleanedOrderIds" :key="id" class="id-item">{{ id }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
/**
 * 本页仅调用 cleanupMockMemberOrders：历史测试数据清理 / 排查工具。
 * 不参与正式支付、推广、uni-pay 落账等主链路。
 */
export default {
  data() {
    return {
      loading: false,
      form: {
        user_id: '',
        mobile: '',
        only_mock: true
      },
      lastResult: null
    }
  },
  computed: {
    resultData() {
      return (this.lastResult && this.lastResult.data) || {}
    },
    deletePlan() {
      return this.resultData.delete_plan || {}
    },
    cleanedOrderIds() {
      return this.resultData.cleaned_order_ids || []
    }
  },
  methods: {
    onOnlyMockChange(e) {
      this.form.only_mock = !!(e.detail && e.detail.value)
    },
    resetForm() {
      this.form = {
        user_id: '',
        mobile: '',
        only_mock: true
      }
      this.lastResult = null
    },
    buildPayload(dryRun) {
      const token = uni.getStorageSync('uni_id_token') || ''
      return {
        uniIdToken: token,
        token,
        user_id: (this.form.user_id || '').trim(),
        mobile: (this.form.mobile || '').trim(),
        only_mock: !!this.form.only_mock,
        dry_run: !!dryRun
      }
    },
    async callCleanup(dryRun) {
      const userId = (this.form.user_id || '').trim()
      const mobile = (this.form.mobile || '').trim()
      if (!userId && !mobile) {
        uni.showToast({ title: '请填写 user_id 或手机号', icon: 'none' })
        return
      }
      this.loading = true
      try {
        const res = await uniCloud.callFunction({
          name: 'cleanupMockMemberOrders',
          data: this.buildPayload(dryRun)
        })
        const body = res.result || {}
        this.lastResult = body
        if (body.code === 200) {
          uni.showToast({ title: dryRun ? '预演完成' : '清理完成', icon: 'success' })
        } else {
          uni.showModal({ content: body.message || '执行失败', showCancel: false })
        }
      } catch (err) {
        uni.showModal({ content: err.message || '请求异常', showCancel: false })
      } finally {
        this.loading = false
      }
    },
    runDryRun() {
      this.callCleanup(true)
    },
    runExecute() {
      uni.showModal({
        title: '二次确认',
        content: '确认执行正式清理？该操作会删除命中的测试订单及关联数据。',
        success: (r) => {
          if (r.confirm) this.callCleanup(false)
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
.panel {
  display: block;
  padding: 12px;
}
.title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}
.desc {
  margin-top: 6px;
  color: #606266;
  font-size: 12px;
}
.form-grid {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 360px));
  gap: 12px;
}
.form-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.label {
  font-size: 12px;
  color: #606266;
}
.uni-input {
  height: 36px;
  line-height: 36px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 0 10px;
  box-sizing: border-box;
  background: #fff;
}
.switch-row {
  margin-top: 12px;
}
.switch-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #303133;
}
.btn-row {
  margin-top: 12px;
  display: flex;
  gap: 10px;
}
.result-card {
  margin-top: 8px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  padding: 12px;
}
.subtitle {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}
.result-line {
  line-height: 24px;
  font-size: 13px;
}
.k {
  color: #909399;
}
.ok {
  color: #67c23a;
}
.err {
  color: #f56c6c;
}
.split {
  height: 1px;
  background: #ebeef5;
  margin: 10px 0;
}
.muted {
  color: #909399;
}
.id-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.id-item {
  font-family: monospace;
  font-size: 12px;
  word-break: break-all;
}
</style>
