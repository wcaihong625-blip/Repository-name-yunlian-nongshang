<template>
  <view class="fix-top-window">
    <view class="uni-header">
      <uni-stat-breadcrumb class="uni-stat-breadcrumb-on-phone" />
      <view class="uni-group">
        <button class="uni-button" size="mini" @click="loadData">
          重新加载
        </button>
      </view>
    </view>

    <view class="uni-container">
      <uni-forms ref="formRef" :modelValue="form" label-width="120">
        <view class="uni-title">
          小程序 - 联系客服
        </view>
        <view class="uni-tip">
          保存后，小程序「我的」页点击「联系客服」将拨打此处号码（写入 platform_settings.default.customer_service_phone）。
        </view>
        <uni-forms-item label="客服电话" name="customer_service_phone">
          <uni-easyinput
            v-model="form.customer_service_phone"
            placeholder="如 400-123-8888 或 19223093308"
          />
        </uni-forms-item>

        <view class="uni-btn-h uni-mt-10">
          <button class="uni-button" type="primary" size="mini" @click="saveCustomerServicePhone">
            保存客服电话
          </button>
        </view>
      </uni-forms>
    </view>
  </view>
</template>

<script>
const db = uniCloud.database()
const COLLECTION = 'platform_settings'
const DOC_ID = 'default'

export default {
  name: 'PlatformSettings',
  data() {
    return {
      loading: false,
      docId: '',
      form: {
        customer_service_phone: '400-123-8888'
      }
    }
  },
  onLoad() {
    this.loadData()
  },
  methods: {
    async ensureDoc() {
      if (this.docId) return
      const now = Date.now()
      try {
        await db.collection(COLLECTION).add({
          _id: DOC_ID,
          customer_service_phone: (this.form.customer_service_phone || '400-123-8888').trim(),
          create_time: now,
          update_time: now
        })
        this.docId = DOC_ID
      } catch (e) {
        console.error(e)
      }
    },
    async loadData() {
      this.loading = true
      try {
        const res = await db.collection(COLLECTION).doc(DOC_ID).get()
        const list = (res.result && res.result.data) || res.data || []
        if (list.length > 0) {
          const doc = list[0]
          this.docId = doc._id
          const phone = doc.customer_service_phone
          if (phone && String(phone).trim()) {
            this.form.customer_service_phone = String(phone).trim()
          }
        } else {
          this.docId = ''
        }
      } catch (e) {
        console.error(e)
        uni.showToast({
          title: '加载配置失败',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    },
    validateCustomerServicePhone(phone) {
      const s = String(phone || '').trim()
      if (!s) {
        uni.showToast({ title: '请输入客服电话', icon: 'none' })
        return false
      }
      if (!/^[\d\-\+\(\)\s]+$/.test(s)) {
        uni.showToast({ title: '电话格式不正确（仅数字、空格、+-()）', icon: 'none' })
        return false
      }
      return true
    },
    async saveCustomerServicePhone() {
      if (this.loading) return
      if (!this.validateCustomerServicePhone(this.form.customer_service_phone)) return
      this.loading = true
      try {
        await this.ensureDoc()
        const now = Date.now()
        const phone = String(this.form.customer_service_phone).trim()
        await db.collection(COLLECTION).doc(DOC_ID).update({
          customer_service_phone: phone,
          update_time: now
        })
        this.form.customer_service_phone = phone
        uni.showToast({
          title: '客服电话已保存',
          icon: 'success'
        })
      } catch (e) {
        console.error(e)
        uni.showToast({
          title: '保存失败',
          icon: 'none'
        })
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style scoped>
.uni-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 10px;
}

.uni-mt-10 {
  margin-top: 10px;
}

.uni-tip {
  font-size: 12px;
  color: #666;
  line-height: 1.5;
  margin: -6px 0 10px;
}

.uni-btn-h {
  display: flex;
  justify-content: flex-start;
}
</style>
