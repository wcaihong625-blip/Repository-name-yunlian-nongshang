<template>
  <view class="fix-top-window page-shell config-page">
    <view class="page-header">
      <view>
        <view class="page-title">会员与推广配置</view>
        <view class="page-subtitle">统一维护会员套餐、赠送权益、推广价格与功能开关，小程序与下单云函数均从此读取。</view>
      </view>
      <view class="toolbar-row header-actions">
        <button class="uni-button" type="default" size="mini" :loading="loading" @click="loadData">重新加载</button>
        <button class="uni-button" type="primary" size="mini" :loading="saving" @click="saveAll">保存配置</button>
      </view>
    </view>

    <view class="intro-card">
      <view class="section-title">配置说明</view>
      <view class="intro-list">
        <text>配置保存在 `platform_settings.default.membership_promotion_config`，小程序与下单云函数均从此读取。</text>
        <text>单条推广仅支持 1/3/7 天档位（无 15/30 天），赠送天数与单买价口径按运营文档执行。</text>
        <text>小程序会员页「立省」与「权益价值」计算口径保持现有规则，不在本页变更。</text>
      </view>
    </view>

    <scroll-view scroll-y class="scroll-main">
      <view class="config-shell">
        <view class="section-card">
          <view class="section-title">会员价格</view>
          <view class="plan-sections">
            <view class="plan-group">
              <view class="sub-h">个人会员</view>
              <view class="plan-grid">
                <view class="plan-card">
                  <text class="plan-name">月卡</text>
                  <uni-easyinput type="number" v-model.number="form.member_plans.personal.month.price" />
                  <label class="chk"><checkbox :checked="form.member_plans.personal.month.enabled" @tap.stop="togglePlan('personal','month')" />启用</label>
                </view>
                <view class="plan-card">
                  <text class="plan-name">季卡</text>
                  <uni-easyinput type="number" v-model.number="form.member_plans.personal.quarter.price" />
                  <label class="chk"><checkbox :checked="form.member_plans.personal.quarter.enabled" @tap.stop="togglePlan('personal','quarter')" />启用</label>
                </view>
                <view class="plan-card">
                  <text class="plan-name">年卡</text>
                  <uni-easyinput type="number" v-model.number="form.member_plans.personal.year.price" />
                  <label class="chk"><checkbox :checked="form.member_plans.personal.year.enabled" @tap.stop="togglePlan('personal','year')" />启用</label>
                </view>
              </view>
            </view>
            <view class="plan-group">
              <view class="sub-h">企业会员</view>
              <view class="plan-grid">
                <view class="plan-card">
                  <text class="plan-name">月卡</text>
                  <uni-easyinput type="number" v-model.number="form.member_plans.enterprise.month.price" />
                  <label class="chk"><checkbox :checked="form.member_plans.enterprise.month.enabled" @tap.stop="togglePlan('enterprise','month')" />启用</label>
                </view>
                <view class="plan-card">
                  <text class="plan-name">季卡</text>
                  <uni-easyinput type="number" v-model.number="form.member_plans.enterprise.quarter.price" />
                  <label class="chk"><checkbox :checked="form.member_plans.enterprise.quarter.enabled" @tap.stop="togglePlan('enterprise','quarter')" />启用</label>
                </view>
                <view class="plan-card">
                  <text class="plan-name">年卡</text>
                  <uni-easyinput type="number" v-model.number="form.member_plans.enterprise.year.price" />
                  <label class="chk"><checkbox :checked="form.member_plans.enterprise.year.enabled" @tap.stop="togglePlan('enterprise','year')" />启用</label>
                </view>
              </view>
            </view>
          </view>
        </view>

        <view class="section-card">
          <view class="section-title">会员权益</view>
          <view class="tip-sm">选择会员类型与套餐后再编辑，避免长页面反复滚动。</view>
          <view class="tabs">
            <view class="tab-item" :class="{ active: rightsTierTab === 'personal' }" @click="rightsTierTab = 'personal'">个人会员</view>
            <view class="tab-item" :class="{ active: rightsTierTab === 'enterprise' }" @click="rightsTierTab = 'enterprise'">企业会员</view>
          </view>
          <view class="tabs tabs-sub">
            <view class="tab-item" :class="{ active: rightsPlanTab === 'month' }" @click="rightsPlanTab = 'month'">月卡</view>
            <view class="tab-item" :class="{ active: rightsPlanTab === 'quarter' }" @click="rightsPlanTab = 'quarter'">季卡</view>
            <view class="tab-item" :class="{ active: rightsPlanTab === 'year' }" @click="rightsPlanTab = 'year'">年卡</view>
          </view>
          <view class="sub-h">{{ rightsTierTab === 'enterprise' ? '企业会员' : '个人会员' }} · {{ rightsPlanLabel }}</view>
          <view class="rights-grid">
            <view class="field-row"><text class="lab-w">联系采购次数/月</text><uni-easyinput type="number" v-model.number="currentRights.contact_purchase_quota" /></view>
            <view class="field-row"><text class="lab-w">赠送置顶天数</text><uni-easyinput type="number" v-model.number="currentRights.gift_top_days" /></view>
            <view class="field-row"><text class="lab-w">赠送加急曝光天数</text><uni-easyinput type="number" v-model.number="currentRights.gift_boost_days" /></view>
          </view>
          <view class="toggle-card-grid rights-toggles">
            <label class="toggle-card"><view><text class="toggle-title">优先展示</text></view><checkbox :checked="currentRights.priority_display" @tap.stop="currentRights.priority_display = !currentRights.priority_display" /></label>
            <label class="toggle-card"><view><text class="toggle-title">可查看完整数据</text></view><checkbox :checked="currentRights.full_data_access" @tap.stop="currentRights.full_data_access = !currentRights.full_data_access" /></label>
            <label v-if="rightsTierTab === 'enterprise'" class="toggle-card"><view><text class="toggle-title">展示企业标识</text></view><checkbox :checked="currentRights.enterprise_badge" @tap.stop="currentRights.enterprise_badge = !currentRights.enterprise_badge" /></label>
          </view>
        </view>

        <view class="section-card">
          <view class="section-title">推广价格（元）</view>
          <view class="matrix-wrap">
            <view class="matrix-card">
              <view class="sub-h">置顶推广</view>
              <view class="price-table">
                <view class="price-row head"><text class="c1">用户类型</text><text class="c">1天</text><text class="c">3天</text><text class="c">7天</text></view>
                <view class="price-row"><text class="c1">免费用户</text><uni-easyinput class="c" v-model.number="form.promotion_prices.top.free['1']" /><uni-easyinput class="c" v-model.number="form.promotion_prices.top.free['3']" /><uni-easyinput class="c" v-model.number="form.promotion_prices.top.free['7']" /></view>
                <view class="price-row"><text class="c1">个人会员</text><uni-easyinput class="c" v-model.number="form.promotion_prices.top.personal['1']" /><uni-easyinput class="c" v-model.number="form.promotion_prices.top.personal['3']" /><uni-easyinput class="c" v-model.number="form.promotion_prices.top.personal['7']" /></view>
                <view class="price-row"><text class="c1">企业会员</text><uni-easyinput class="c" v-model.number="form.promotion_prices.top.enterprise['1']" /><uni-easyinput class="c" v-model.number="form.promotion_prices.top.enterprise['3']" /><uni-easyinput class="c" v-model.number="form.promotion_prices.top.enterprise['7']" /></view>
              </view>
            </view>
            <view class="matrix-card">
              <view class="sub-h">加急曝光</view>
              <view class="price-table">
                <view class="price-row head"><text class="c1">用户类型</text><text class="c">1天</text><text class="c">3天</text><text class="c">7天</text></view>
                <view class="price-row"><text class="c1">免费用户</text><uni-easyinput class="c" v-model.number="form.promotion_prices.boost.free['1']" /><uni-easyinput class="c" v-model.number="form.promotion_prices.boost.free['3']" /><uni-easyinput class="c" v-model.number="form.promotion_prices.boost.free['7']" /></view>
                <view class="price-row"><text class="c1">个人会员</text><uni-easyinput class="c" v-model.number="form.promotion_prices.boost.personal['1']" /><uni-easyinput class="c" v-model.number="form.promotion_prices.boost.personal['3']" /><uni-easyinput class="c" v-model.number="form.promotion_prices.boost.personal['7']" /></view>
                <view class="price-row"><text class="c1">企业会员</text><uni-easyinput class="c" v-model.number="form.promotion_prices.boost.enterprise['1']" /><uni-easyinput class="c" v-model.number="form.promotion_prices.boost.enterprise['3']" /><uni-easyinput class="c" v-model.number="form.promotion_prices.boost.enterprise['7']" /></view>
              </view>
            </view>
          </view>
        </view>

        <view class="section-card">
          <view class="section-title">功能开关</view>
          <view class="toggle-card-grid">
            <label class="toggle-card"><view><text class="toggle-title">开启个人会员</text></view><checkbox :checked="form.feature_switches.personal_member_enabled" @tap.stop="form.feature_switches.personal_member_enabled = !form.feature_switches.personal_member_enabled" /></label>
            <label class="toggle-card"><view><text class="toggle-title">开启企业会员</text></view><checkbox :checked="form.feature_switches.enterprise_member_enabled" @tap.stop="form.feature_switches.enterprise_member_enabled = !form.feature_switches.enterprise_member_enabled" /></label>
            <label class="toggle-card"><view><text class="toggle-title">开启置顶推广</text></view><checkbox :checked="form.feature_switches.promotion_top_enabled" @tap.stop="form.feature_switches.promotion_top_enabled = !form.feature_switches.promotion_top_enabled" /></label>
            <label class="toggle-card"><view><text class="toggle-title">开启加急曝光</text></view><checkbox :checked="form.feature_switches.promotion_boost_enabled" @tap.stop="form.feature_switches.promotion_boost_enabled = !form.feature_switches.promotion_boost_enabled" /></label>
            <label class="toggle-card"><view><text class="toggle-title">仅会员可联系采购方</text></view><checkbox :checked="form.feature_switches.purchase_contact_member_only" @tap.stop="form.feature_switches.purchase_contact_member_only = !form.feature_switches.purchase_contact_member_only" /></label>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
function cloneDefault() {
  return JSON.parse(
    JSON.stringify({
      member_plans: {
        personal: {
          month: { price: 68, enabled: true },
          quarter: { price: 188, enabled: true },
          year: { price: 598, enabled: true }
        },
        enterprise: {
          month: { price: 138, enabled: true },
          quarter: { price: 388, enabled: true },
          year: { price: 1298, enabled: true }
        }
      },
      member_rights: {
        personal: {
          month: {
            contact_purchase_quota: 50,
            gift_top_days: 2,
            gift_boost_days: 4,
            priority_display: true,
            full_data_access: true
          },
          quarter: {
            contact_purchase_quota: 50,
            gift_top_days: 8,
            gift_boost_days: 18,
            priority_display: true,
            full_data_access: true
          },
          year: {
            contact_purchase_quota: 50,
            gift_top_days: 30,
            gift_boost_days: 72,
            priority_display: true,
            full_data_access: true
          }
        },
        enterprise: {
          month: {
            contact_purchase_quota: 200,
            gift_top_days: 4,
            gift_boost_days: 10,
            priority_display: true,
            full_data_access: true,
            enterprise_badge: true
          },
          quarter: {
            contact_purchase_quota: 200,
            gift_top_days: 18,
            gift_boost_days: 42,
            priority_display: true,
            full_data_access: true,
            enterprise_badge: true
          },
          year: {
            contact_purchase_quota: 200,
            gift_top_days: 70,
            gift_boost_days: 150,
            priority_display: true,
            full_data_access: true,
            enterprise_badge: true
          }
        }
      },
      promotion_prices: {
        top: {
          free: { 1: 14, 3: 36, 7: 78 },
          personal: { 1: 12, 3: 32, 7: 70 },
          enterprise: { 1: 10, 3: 28, 7: 62 }
        },
        boost: {
          free: { 1: 9, 3: 25, 7: 56 },
          personal: { 1: 8, 3: 22, 7: 50 },
          enterprise: { 1: 7, 3: 20, 7: 45 }
        }
      },
      feature_switches: {
        personal_member_enabled: true,
        enterprise_member_enabled: true,
        promotion_top_enabled: true,
        promotion_boost_enabled: true,
        purchase_contact_member_only: true
      }
    })
  )
}

export default {
  data() {
    return {
      loading: false,
      saving: false,
      form: cloneDefault(),
      rightsTierTab: 'personal',
      rightsPlanTab: 'month'
    }
  },
  computed: {
    currentRights() {
      const tier = this.rightsTierTab === 'enterprise' ? 'enterprise' : 'personal'
      const plan = ['month', 'quarter', 'year'].includes(this.rightsPlanTab) ? this.rightsPlanTab : 'month'
      return this.form.member_rights[tier][plan]
    },
    rightsPlanLabel() {
      if (this.rightsPlanTab === 'quarter') return '季卡'
      if (this.rightsPlanTab === 'year') return '年卡'
      return '月卡'
    }
  },
  onLoad() {
    this.loadData()
  },
  methods: {
    togglePlan(tier, key) {
      this.form.member_plans[tier][key].enabled = !this.form.member_plans[tier][key].enabled
    },
    async loadData() {
      this.loading = true
      try {
        const co = uniCloud.importObject('membershipConfigCo', { customUI: true })
        const res = await co.getConfig({})
        if (res && res.code === 200 && res.data) {
          this.form = JSON.parse(JSON.stringify(res.data))
        } else {
          this.form = cloneDefault()
        }
      } catch (e) {
        uni.showToast({ title: e.message || '加载失败', icon: 'none' })
        this.form = cloneDefault()
      } finally {
        this.loading = false
      }
    },
    async saveAll() {
      const uniIdToken = uni.getStorageSync('uni_id_token') || ''
      if (!uniIdToken) {
        uni.showToast({ title: '请先登录后台', icon: 'none' })
        return
      }
      this.saving = true
      try {
        const co = uniCloud.importObject('membershipConfigCo', { customUI: true })
        const res = await co.saveConfig({
          token: uniIdToken,
          uniIdToken,
          config: this.form
        })
        if (res && res.code === 200) {
          uni.showToast({ title: '已保存', icon: 'success' })
          if (res.data) this.form = JSON.parse(JSON.stringify(res.data))
        } else {
          uni.showToast({ title: (res && res.message) || '保存失败', icon: 'none' })
        }
      } catch (e) {
        uni.showToast({ title: e.message || '保存失败', icon: 'none' })
      } finally {
        this.saving = false
      }
    }
  }
}
</script>

<style scoped>
@import '@/styles/admin-page.scss';
.config-page { background: #f6f8fb; }
.header-actions { margin-left: auto; }
.scroll-main {
  height: calc(100vh - 154px);
}
.config-shell { max-width: 1140px; margin: 0 auto; padding-bottom: 22px; }
.intro-list { display: grid; gap: 8px; font-size: 13px; color: #475569; line-height: 1.5; }
.sub-h {
  font-weight: 600;
  margin: 0 0 10px;
  color: #1f2d3d;
}
.tabs {
  display: flex;
  gap: 8px;
  margin: 8px 0 10px;
}
.tabs-sub {
  margin-top: 0;
}
.tab-item {
  padding: 8px 14px;
  background: #fff;
  border: 1px solid #dfe4ec;
  border-radius: 999px;
  color: #475569;
  font-size: 13px;
  cursor: pointer;
}
.tab-item.active {
  border-color: #2979ff;
  color: #1d4ed8;
  background: #edf4ff;
}
.plan-sections {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}
.plan-group {
  border: 1px solid #e8edf4;
  border-radius: 10px;
  background: #fff;
  padding: 12px;
}
.plan-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}
.plan-card {
  border: 1px solid #edf1f6;
  border-radius: 10px;
  padding: 10px;
  background: #fff;
}
.plan-name {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 8px;
}
.rights-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px 12px;
}
.field-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid #edf0f5;
  border-radius: 6px;
}
.lab-w {
  width: 120px;
  font-size: 14px;
  color: #475569;
}
.field-row ::v-deep .uni-easyinput {
  flex: 1;
  max-width: 220px;
}
.chk {
  margin-top: 8px;
  font-size: 13px;
  white-space: nowrap;
  color: #334155;
}
.rights-toggles { margin-top: 10px; }
::v-deep .uni-easyinput__content {
  border-radius: 6px !important;
}
::v-deep .uni-easyinput__content-input {
  min-height: 34px;
}
.matrix-wrap { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.price-table { background: #fff; border: 1px solid #edf0f5; border-radius: 8px; overflow: hidden; }
.price-row {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
  gap: 10px;
}
.price-row:last-child {
  border-bottom: none;
}
.price-row.head {
  background: #f8fafc;
  font-weight: 600;
  color: #475569;
}
.price-row .c1 {
  width: 110px;
  font-size: 13px;
  color: #334155;
}
.price-row .c {
  flex: 1;
  min-width: 0;
}
@media screen and (max-width: 1100px) {
  .plan-sections, .matrix-wrap, .rights-grid, .toggle-card-grid { grid-template-columns: 1fr; }
  .plan-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media screen and (max-width: 768px) {
  .plan-grid { grid-template-columns: 1fr; }
  .scroll-main { height: auto; }
}
</style>
