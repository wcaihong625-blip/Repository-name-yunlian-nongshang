<template>
  <view class="tool-page">
    <view class="tool-card">
      <view class="tool-title">推广浏览量全局配置工具</view>
      <view class="tool-desc">
        你在这里设置一次后：后续新创建的推广订单会自动按该值；勾选“应用到历史订单”可一次改完已有订单。
      </view>

      <view class="form-row">
        <text class="lab">每日增加浏览量</text>
        <input class="num-input" type="number" v-model="dailyValue" placeholder="536" />
      </view>

      <view class="form-row">
        <text class="lab">应用范围</text>
        <label class="chk-wrap">
          <checkbox :checked="applyToAllExisting" @click="toggleApplyAll" />
          <text>同时应用到历史所有推广订单</text>
        </label>
      </view>

      <view class="btn-row">
        <button class="uni-button" type="default" size="mini" @click="loadGlobal">刷新当前值</button>
        <button class="uni-button" type="primary" size="mini" :loading="saving" @click="saveGlobal">保存配置</button>
      </view>

      <view v-if="lastResult" class="result-box">
        <text>{{ lastResult }}</text>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  data() {
    return {
      dailyValue: '536',
      applyToAllExisting: true,
      saving: false,
      lastResult: ''
    }
  },
  onLoad() {
    this.loadGlobal()
  },
  methods: {
    uniToken() {
      return uni.getStorageSync('uni_id_token') || ''
    },
    toggleApplyAll() {
      this.applyToAllExisting = !this.applyToAllExisting
    },
    async loadGlobal() {
      const token = this.uniToken()
      try {
        const co = uniCloud.importObject('promotionOrderCo', { customUI: true })
        const body = await co.getGlobalDailyViewIncrement({
          uniIdToken: token,
          token
        })
        if (body.code !== 200) {
          uni.showToast({ title: body.message || '读取失败', icon: 'none' })
          return
        }
        const raw = Number(body.data && body.data.promotion_daily_view_increment)
        this.dailyValue = Number.isFinite(raw) && raw >= 0 ? String(Math.floor(raw)) : '536'
        this.lastResult = `当前全局值：${this.dailyValue}`
      } catch (e) {
        uni.showToast({ title: (e && e.message) || '读取失败', icon: 'none' })
      }
    },
    async saveGlobal() {
      const raw = Number(this.dailyValue)
      if (!Number.isFinite(raw) || raw < 0) {
        uni.showToast({ title: '请输入>=0的数字', icon: 'none' })
        return
      }
      const daily = Math.floor(raw)
      const token = this.uniToken()
      const applyText = this.applyToAllExisting ? '并应用到历史订单' : '仅影响后续新订单'
      const ok = await new Promise((resolve) => {
        uni.showModal({
          title: '确认保存',
          content: `将全局每日增量设为 ${daily}，${applyText}。`,
          success: (r) => resolve(!!r.confirm),
          fail: () => resolve(false)
        })
      })
      if (!ok) return

      this.saving = true
      try {
        const co = uniCloud.importObject('promotionOrderCo', { customUI: true })
        const body = await co.setGlobalDailyViewIncrement({
          uniIdToken: token,
          token,
          promotion_daily_view_increment: daily,
          apply_to_all_existing: this.applyToAllExisting
        })
        if (body.code !== 200) {
          uni.showToast({ title: body.message || '保存失败', icon: 'none' })
          return
        }
        const n = (body.data && body.data.updated_count) || 0
        this.dailyValue = String(daily)
        this.lastResult = this.applyToAllExisting
          ? `保存成功：全局值 ${daily}，已更新历史订单 ${n} 条`
          : `保存成功：全局值 ${daily}，后续新订单将按此值创建`
        uni.showToast({ title: '保存成功', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: (e && e.message) || '保存失败', icon: 'none' })
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
.tool-page {
  padding: 16px;
}
.tool-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}
.tool-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}
.tool-desc {
  color: #666;
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 14px;
}
.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}
.lab {
  width: 130px;
  color: #333;
  font-size: 14px;
}
.num-input {
  width: 160px;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  padding: 6px 8px;
  font-size: 14px;
}
.chk-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #333;
  font-size: 14px;
}
.btn-row {
  margin-top: 6px;
  display: flex;
  gap: 8px;
}
.result-box {
  margin-top: 14px;
  padding: 8px 10px;
  border-radius: 4px;
  background: #f5f7fa;
  color: #333;
  font-size: 13px;
}
</style>
