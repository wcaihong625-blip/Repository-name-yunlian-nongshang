<template>
  <view class="page-container">
    <!-- 页面标题 -->
    <view class="page-header">
      <view class="header-title">
        <text class="title-icon">✏️</text>
        <text class="title-text">编辑实名认证</text>
      </view>
      <view class="header-subtitle">修改用户实名认证信息</view>
    </view>

    <!-- 表单卡片 -->
    <view class="form-card">
      <uni-forms ref="form" :model="formData" validateTrigger="bind">
        <!-- 基本信息 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">👤</text>
            <text>基本信息</text>
          </view>
          <uni-forms-item name="user_id" label="用户ID" required>
            <uni-easyinput placeholder="请输入用户ID" v-model="formData.user_id"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="realName" label="真实姓名" required>
            <uni-easyinput placeholder="请输入真实姓名" v-model="formData.realName"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="idCard" label="身份证号码" required>
            <uni-easyinput placeholder="请输入18位身份证号码" v-model="formData.idCard" maxlength="18"></uni-easyinput>
          </uni-forms-item>
        </view>

        <!-- 身份证照片 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">🖼️</text>
            <text>身份证照片</text>
          </view>
          <uni-forms-item name="idCardFront" label="身份证正面" required>
            <uni-easyinput placeholder="请输入身份证正面照片URL" v-model="formData.idCardFront"></uni-easyinput>
            <image v-if="formData.idCardFront" :src="formData.idCardFront" mode="aspectFit" class="preview-image" @click="previewImage(formData.idCardFront)"></image>
          </uni-forms-item>
        </view>

        <!-- 认证状态 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">✅</text>
            <text>认证状态</text>
          </view>
          <uni-forms-item name="status" label="认证状态" required>
            <uni-data-checkbox v-model="formData.status" :localdata="formOptions.status_localdata"></uni-data-checkbox>
          </uni-forms-item>
          <uni-forms-item name="rejectReason" label="驳回原因" v-if="formData.status === 'rejected'">
            <uni-easyinput type="textarea" placeholder="请输入驳回原因（认证失败时填写）" v-model="formData.rejectReason"></uni-easyinput>
          </uni-forms-item>
        </view>

        <!-- 审核信息 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">🔍</text>
            <text>审核信息</text>
          </view>
          <uni-forms-item name="auditor_id" label="审核人ID">
            <uni-easyinput placeholder="请输入审核人ID（管理员审核时填写）" v-model="formData.auditor_id"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="auditor_name" label="审核人姓名">
            <uni-easyinput placeholder="请输入审核人姓名" v-model="formData.auditor_name"></uni-easyinput>
          </uni-forms-item>
          <uni-forms-item name="audit_date" label="审核时间">
            <uni-datetime-picker return-type="timestamp" v-model="formData.audit_date"></uni-datetime-picker>
          </uni-forms-item>
          <uni-forms-item name="verified_date" label="认证通过时间">
            <uni-datetime-picker return-type="timestamp" v-model="formData.verified_date"></uni-datetime-picker>
          </uni-forms-item>
        </view>

        <!-- 按钮组 -->
        <view class="button-group">
          <button class="submit-btn" @click="submit">
            <text class="btn-icon">✓</text>
            <text>保存</text>
          </button>
          <navigator open-type="navigateBack">
            <button class="cancel-btn">
              <text class="btn-icon">←</text>
              <text>返回</text>
            </button>
          </navigator>
        </view>
      </uni-forms>
    </view>
  </view>
</template>

<script>
  import { validator } from '../../js_sdk/validator/realname_auth.js';

  const db = uniCloud.database();
  const dbCmd = db.command;
  const dbCollectionName = 'realname_auth';

  function getValidator(fields) {
    let result = {}
    for (let key in validator) {
      if (fields.includes(key)) {
        result[key] = validator[key]
      }
    }
    return result
  }

  

  export default {
    data() {
      let formData = {
        "user_id": "",
        "realName": "",
        "idCard": "",
        "idCardFront": "",
        "status": "",
        "rejectReason": "",
        "auditor_id": "",
        "auditor_name": "",
        "audit_date": null,
        "verified_date": null
      }
      return {
        formData,
        formOptions: {
          "status_localdata": [
            {
              "value": "unverified",
              "text": "未认证"
            },
            {
              "value": "pending",
              "text": "待审核"
            },
            {
              "value": "verified",
              "text": "已认证"
            },
            {
              "value": "rejected",
              "text": "已驳回"
            }
          ]
        },
        rules: {
          ...getValidator(Object.keys(formData))
        }
      }
    },
    onLoad(e) {
      if (e.id) {
        const id = e.id
        this.formDataId = id
        this.getDetail(id)
      }
    },
    onReady() {
      this.$refs.form.setRules(this.rules)
    },
    methods: {
      
      /**
       * 验证表单并提交
       */
      submit() {
        uni.showLoading({
          mask: true
        })
        this.$refs.form.validate().then((res) => {
          return this.submitForm(res)
        }).catch(() => {
        }).finally(() => {
          uni.hideLoading()
        })
      },

      /**
       * 提交表单
       */
      submitForm(value) {
        // 使用 clientDB 提交数据
        return db.collection(dbCollectionName).doc(this.formDataId).update(value).then((res) => {
          uni.showToast({
            title: '修改成功',
            icon: 'success'
          })
          this.getOpenerEventChannel().emit('refreshData')
          setTimeout(() => uni.navigateBack(), 500)
        }).catch((err) => {
          uni.showModal({
            content: err.message || '请求服务失败',
            showCancel: false
          })
        })
      },
      previewImage(url) {
        uni.previewImage({
          urls: [url],
          current: url
        })
      },

      /**
       * 获取表单数据
       * @param {Object} id
       */
      getDetail(id) {
        uni.showLoading({
          mask: true
        })
        db.collection(dbCollectionName).doc(id).field("user_id,realName,idCard,idCardFront,status,rejectReason,auditor_id,auditor_name,audit_date,verified_date").get().then((res) => {
          const data = res.result.data[0]
          if (data) {
            this.formData = data
            
          }
        }).catch((err) => {
          uni.showModal({
            content: err.message || '请求服务失败',
            showCancel: false
          })
        }).finally(() => {
          uni.hideLoading()
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

/* 页面标题 */
.page-header {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 20px;
  box-shadow: 0 10px 30px rgba(245, 87, 108, 0.3);
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

/* 表单卡片 */
.form-card {
  background: #ffffff;
  border-radius: 16px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
}

/* 表单分组 */
.form-section {
  margin-bottom: 30px;
  padding: 20px;
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-radius: 12px;
  border-left: 4px solid #f5576c;
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

/* 预览图片 */
.preview-image {
  width: 200px;
  height: 200px;
  border-radius: 12px;
  margin-top: 15px;
  object-fit: cover;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border: 3px solid #ffffff;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.preview-image:hover {
  transform: scale(1.05);
}

/* 按钮组 */
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
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: #ffffff;
}

.submit-btn:hover {
  transform: translateY(-3px);
  box-shadow: 0 8px 25px rgba(245, 87, 108, 0.4);
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

/* 响应式 */
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

  .preview-image {
    width: 100%;
    height: auto;
  }
}
</style>
