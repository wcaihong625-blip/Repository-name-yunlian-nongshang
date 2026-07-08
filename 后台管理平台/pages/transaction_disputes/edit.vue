<template>
  <view class="page-container">
    <view class="page-header">
      <view class="header-title">
        <text class="title-icon">⚖️</text>
        <text class="title-text">交易纠纷详情</text>
      </view>
    </view>
    <view class="form-card">
      <uni-forms ref="form" :model="formData" :label-width="120">
        <view class="form-section">
          <view class="section-title">纠纷信息</view>
          <uni-forms-item name="dispute_no" label="纠纷单号">
            <uni-easyinput v-model="formData.dispute_no" :disabled="true"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="order_no" label="关联订单">
            <uni-easyinput v-model="formData.order_no" :disabled="true"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="dispute_reason" label="纠纷原因">
            <uni-easyinput v-model="formData.dispute_reason" type="textarea"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="dispute_desc" label="纠纷描述">
            <uni-easyinput v-model="formData.dispute_desc" type="textarea"></uni-easyinput>
          </uni-forms-item>
        </view>
        <view class="form-section">
          <view class="section-title">处理信息</view>
          <uni-forms-item name="status" label="处理状态">
            <uni-data-checkbox v-model="formData.status" :localdata="formOptions.status_localdata"></uni-data-checkbox>
          </uni-forms-item>
          <uni-forms-item name="mediator_name" label="调解人">
            <uni-easyinput v-model="formData.mediator_name"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="mediation_result" label="调解结果">
            <uni-easyinput v-model="formData.mediation_result" type="textarea"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="mediation_remark" label="调解备注">
            <uni-easyinput v-model="formData.mediation_remark" type="textarea"></uni-easyinput>
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
          status_localdata: [
            {"value": "待处理", "text": "待处理"},
            {"value": "处理中", "text": "处理中"},
            {"value": "已调解", "text": "已调解"},
            {"value": "已关闭", "text": "已关闭"}
          ]
        }
      }
    },
    onLoad(e) {
      if (e.id) this.getDetail(e.id)
    },
    methods: {
      async getDetail(id) {
        const res = await db.collection('transaction_disputes').doc(id).get()
        if (res.result.data.length) this.formData = res.result.data[0]
      },
      async submit() {
        try {
          if (this.formData._id) {
            await db.collection('transaction_disputes').doc(this.formData._id).update({
              ...this.formData,
              updated_date: Date.now(),
              mediation_date: this.formData.status === '已调解' ? Date.now() : this.formData.mediation_date
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



