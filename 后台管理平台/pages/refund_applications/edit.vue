<template>
  <view class="page-container">
    <view class="page-header">
      <view class="header-title">
        <text class="title-icon">💸</text>
        <text class="title-text">退款申请详情</text>
      </view>
    </view>
    <view class="form-card">
      <uni-forms ref="form" :model="formData" :label-width="120">
        <view class="form-section">
          <view class="section-title">退款信息</view>
          <uni-forms-item name="refund_no" label="退款单号">
            <uni-easyinput v-model="formData.refund_no" :disabled="true"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="order_no" label="原订单号">
            <uni-easyinput v-model="formData.order_no" :disabled="true"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="refund_amount" label="退款金额">
            <uni-easyinput v-model="formData.refund_amount" type="number"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="refund_reason" label="退款原因">
            <uni-easyinput v-model="formData.refund_reason" type="textarea"></uni-easyinput>
          </uni-forms-item>
        </view>
        <view class="form-section">
          <view class="section-title">审核信息</view>
          <uni-forms-item name="status" label="退款状态">
            <uni-data-checkbox v-model="formData.status" :localdata="formOptions.status_localdata"></uni-data-checkbox>
          </uni-forms-item>
          <uni-forms-item name="auditor_name" label="审核人">
            <uni-easyinput v-model="formData.auditor_name"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="audit_remark" label="审核备注">
            <uni-easyinput v-model="formData.audit_remark" type="textarea"></uni-easyinput>
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
            {"value": "待审核", "text": "待审核"},
            {"value": "审核通过", "text": "审核通过"},
            {"value": "审核拒绝", "text": "审核拒绝"},
            {"value": "退款中", "text": "退款中"},
            {"value": "退款成功", "text": "退款成功"},
            {"value": "退款失败", "text": "退款失败"}
          ]
        }
      }
    },
    onLoad(e) {
      if (e.id) this.getDetail(e.id)
    },
    methods: {
      async getDetail(id) {
        const res = await db.collection('refund_applications').doc(id).get()
        if (res.result.data.length) this.formData = res.result.data[0]
      },
      async submit() {
        try {
          if (this.formData._id) {
            await db.collection('refund_applications').doc(this.formData._id).update({
              ...this.formData,
              updated_date: Date.now(),
              audit_date: this.formData.status !== '待审核' ? Date.now() : this.formData.audit_date
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



