<template>
  <view class="page-container">
    <view class="page-header">
      <view class="header-title">
        <text class="title-icon">📊</text>
        <text class="title-text">支付状态详情</text>
      </view>
    </view>
    <view class="form-card">
      <uni-forms ref="form" :model="formData" :label-width="120">
        <view class="form-section">
          <view class="section-title">订单信息</view>
          <uni-forms-item name="order_no" label="订单号">
            <uni-easyinput v-model="formData.order_no" :disabled="true"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="order_type" label="订单类型">
            <uni-data-checkbox v-model="formData.order_type" :localdata="formOptions.order_type_localdata"></uni-data-checkbox>
          </uni-forms-item>
          <uni-forms-item name="current_status" label="当前状态">
            <uni-easyinput v-model="formData.current_status"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="callback_status" label="回调状态">
            <uni-data-checkbox v-model="formData.callback_status" :localdata="formOptions.callback_status_localdata"></uni-data-checkbox>
          </uni-forms-item>
        </view>
        <view class="button-group">
          <button class="submit-btn" @click="submit">保存</button>
          <navigator open-type="navigateBack"><button class="cancel-btn">返回</button></navigator>
        </view>
      </uni-forms>
    </view>
  </view>
</template>

<script>
  const db = uniCloud.database();
  export default {
    data() {
      return {
        formData: {},
        formOptions: {
          order_type_localdata: [
            {"value": "shop_payment", "text": "开店付费"},
            {"value": "refund", "text": "退款"},
            {"value": "dispute", "text": "纠纷"}
          ],
          callback_status_localdata: [
            {"value": "pending", "text": "待回调"},
            {"value": "success", "text": "成功"},
            {"value": "failed", "text": "失败"}
          ]
        }
      }
    },
    onLoad(e) {
      if (e.id) this.getDetail(e.id)
    },
    methods: {
      async getDetail(id) {
        const res = await db.collection('payment_status_tracking').doc(id).get()
        if (res.result.data.length) this.formData = res.result.data[0]
      },
      async submit() {
        try {
          if (this.formData._id) {
            await db.collection('payment_status_tracking').doc(this.formData._id).update({
              ...this.formData,
              updated_date: Date.now()
            })
            uni.showToast({ title: '更新成功' })
            setTimeout(() => uni.navigateBack(), 1500)
          }
        } catch (e) {
          uni.showToast({ title: e.message || '操作失败', icon: 'none' })
        }
      }
    }
  }
</script>

<style scoped>
.page-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
}
.page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 20px;
}
.header-title {
  display: flex;
  align-items: center;
}
.title-icon {
  font-size: 32px;
  margin-right: 12px;
}
.title-text {
  font-size: 28px;
  font-weight: bold;
  color: #ffffff;
}
.form-card {
  background: #ffffff;
  border-radius: 12px;
  padding: 20px;
}
.form-section {
  margin-bottom: 20px;
}
.section-title {
  font-size: 18px;
  font-weight: bold;
  margin-bottom: 15px;
}
.button-group {
  display: flex;
  gap: 12px;
  margin-top: 30px;
}
.submit-btn {
  flex: 1;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
  border: none;
  border-radius: 8px;
}
.cancel-btn {
  flex: 1;
  padding: 12px;
  background: #e0e0e0;
  color: #666666;
  border: none;
  border-radius: 8px;
}
</style>



