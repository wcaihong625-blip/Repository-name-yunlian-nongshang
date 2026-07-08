<template>
  <view class="page-container">
    <view class="page-header">
      <view class="header-title">
        <text class="title-icon">➕</text>
        <text class="title-text">新增消息模板</text>
      </view>
      <view class="header-subtitle">为不同业务场景配置消息通知内容</view>
    </view>

    <view class="form-card">
      <uni-forms ref="form" :model="formData" :label-width="120">
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">📄</text>
            <text>基础信息</text>
          </view>

          <uni-forms-item name="name" label="模板名称" required>
            <uni-easyinput
              placeholder="例如：开店成功通知"
              v-model="formData.name"
              :styles="inputStyles"
            ></uni-easyinput>
          </uni-forms-item>

          <uni-forms-item name="code" label="模板编码" required>
            <uni-easyinput
              placeholder="例如：OPEN_SHOP_SUCCESS（英文大写+下划线，供程序使用）"
              v-model="formData.code"
              :styles="inputStyles"
            ></uni-easyinput>
          </uni-forms-item>

          <uni-forms-item name="channel" label="通知渠道" required>
            <uni-data-checkbox
              v-model="formData.channel"
              :localdata="channelOptions"
            ></uni-data-checkbox>
          </uni-forms-item>

          <uni-forms-item name="enabled" label="是否启用">
            <switch v-model="formData.enabled" />
          </uni-forms-item>
        </view>

        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">✉️</text>
            <text>消息内容</text>
          </view>

          <uni-forms-item name="title" label="标题">
            <uni-easyinput
              placeholder="可选，例如：开店成功提醒"
              v-model="formData.title"
              :styles="inputStyles"
            ></uni-easyinput>
          </uni-forms-item>

          <uni-forms-item name="content" label="内容" required>
            <uni-easyinput
              type="textarea"
              autoHeight
              placeholder="例如：亲爱的{{username}}，您的店铺{{shopName}}已成功入驻云链农商平台。"
              v-model="formData.content"
              :styles="inputStyles"
            ></uni-easyinput>
          </uni-forms-item>

          <uni-forms-item name="remark" label="备注说明">
            <uni-easyinput
              type="textarea"
              autoHeight
              placeholder="说明可使用的占位符，例如：{{username}}、{{shopName}}、{{time}} 等"
              v-model="formData.remark"
              :styles="inputStyles"
            ></uni-easyinput>
          </uni-forms-item>
        </view>

        <view class="button-group">
          <button class="submit-btn" @click="submit">
            <text class="btn-icon">✅</text>
            <text>立即提交</text>
          </button>
          <navigator open-type="navigateBack">
            <button class="cancel-btn">
              <text class="btn-icon">↩️</text>
              <text>返回列表</text>
            </button>
          </navigator>
        </view>
      </uni-forms>
    </view>
  </view>
</template>

<script>
const db = uniCloud.database()
const dbCollectionName = 'message_templates'

export default {
  data() {
    return {
      formData: {
        name: '',
        code: '',
        channel: 'app',
        title: '',
        content: '',
        enabled: true,
        remark: ''
      },
      channelOptions: [
        { value: 'app', text: '站内消息' },
        { value: 'sms', text: '短信' },
        { value: 'wechat', text: '微信' },
        { value: 'email', text: '邮件' }
      ],
      inputStyles: {
        borderColor: '#e0e0e0',
        borderRadius: '8px'
      }
    }
  },
  methods: {
    submit() {
      uni.showLoading({
        mask: true
      })
      this.$refs.form
        .validate()
        .then(res => {
          return this.submitForm(res)
        })
        .catch(() => {})
        .finally(() => {
          uni.hideLoading()
        })
    },
    submitForm(value) {
      const now = Date.now()
      return db
        .collection(dbCollectionName)
        .add({
          ...value,
          create_time: now,
          update_time: now
        })
        .then(() => {
          uni.showToast({
            title: '新增成功'
          })
          this.getOpenerEventChannel().emit('refreshData')
          setTimeout(() => uni.navigateBack(), 500)
        })
        .catch(err => {
          uni.showModal({
            content: err.message || '请求服务失败',
            showCancel: false
          })
        })
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
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 20px;
  box-shadow: 0 10px 30px rgba(17, 153, 142, 0.3);
}

.header-title {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
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

.header-subtitle {
  color: rgba(255, 255, 255, 0.9);
  font-size: 14px;
  margin-left: 44px;
}

.form-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

.form-section {
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  border-left: 4px solid #11998e;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
  color: #333333;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 2px solid #e0e0e0;
}

.section-icon {
  font-size: 24px;
  margin-right: 10px;
}

.button-group {
  display: flex;
  justify-content: center;
  gap: 20px;
  margin-top: 40px;
  padding-top: 30px;
  border-top: 2px solid #e0e0e0;
}

.submit-btn,
.cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 14px 40px;
  border-radius: 25px;
  border: none;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  min-width: 150px;
}

.submit-btn {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: #ffffff;
}

.submit-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(17, 153, 142, 0.4);
}

.cancel-btn {
  background: linear-gradient(135deg, #bdc3c7 0%, #95a5a6 100%);
  color: #ffffff;
}

.cancel-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(149, 165, 166, 0.4);
}

.btn-icon {
  margin-right: 8px;
  font-size: 18px;
}

@media (max-width: 768px) {
  .page-container {
    padding: 10px;
  }

  .page-header {
    padding: 20px;
  }

  .title-text {
    font-size: 24px;
  }

  .form-card {
    padding: 20px;
  }

  .form-section {
    padding: 15px;
  }

  .button-group {
    flex-direction: column;
  }

  .submit-btn,
  .cancel-btn {
    width: 100%;
  }
}
</style>




