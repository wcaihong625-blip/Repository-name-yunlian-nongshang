<template>
  <view class="page-container">
    <!-- 页面标题 -->
    <view class="page-header">
      <view class="header-title">
        <text class="title-icon">➕</text>
        <text class="title-text">新增店铺</text>
      </view>
      <view class="header-subtitle">添加新的入驻店铺信息</view>
    </view>

    <!-- 表单卡片 -->
    <view class="form-card">
      <uni-forms ref="form" :model="formData" validateTrigger="bind" :label-width="120">
        <!-- 基本信息 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">🏪</text>
            <text>基本信息</text>
          </view>
          
          <uni-forms-item name="shopName" label="店铺名称" required>
            <uni-easyinput placeholder="请输入店铺名称" v-model="formData.shopName" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="category" label="主营类目" required>
            <uni-easyinput placeholder="如：蔬菜、水果、肉类等" v-model="formData.category" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="image" label="店铺照片" required>
            <uni-easyinput placeholder="店铺门头/环境照片URL" v-model="formData.image" :styles="inputStyles"></uni-easyinput>
            <image v-if="formData.image" :src="formData.image" mode="aspectFill" class="preview-image"></image>
          </uni-forms-item>
        </view>

        <!-- 地址信息 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">📍</text>
            <text>地址信息</text>
          </view>
          
          <uni-forms-item name="region" label="所在地区" required>
            <uni-easyinput placeholder="如：北京市朝阳区" v-model="formData.region" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="address" label="详细地址" required>
            <uni-easyinput placeholder="请输入详细地址" v-model="formData.address" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
        </view>

        <!-- 联系信息 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">📞</text>
            <text>联系信息</text>
          </view>
          
          <uni-forms-item name="contactName" label="联系人" required>
            <uni-easyinput placeholder="请输入联系人姓名" v-model="formData.contactName" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="phone" label="联系电话" required>
            <uni-easyinput placeholder="请输入联系电话" v-model="formData.phone" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
        </view>

        <!-- 账号信息 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">👤</text>
            <text>账号信息</text>
          </view>
          
          <uni-forms-item name="user_id" label="用户ID" required>
            <uni-easyinput placeholder="店铺所有者用户ID" v-model="formData.user_id" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="owner" label="所有者">
            <uni-easyinput placeholder="店铺所有者名称" v-model="formData.owner" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="plan" label="套餐类型" required>
            <uni-data-checkbox v-model="formData.plan" :localdata="formOptions.plan_localdata"></uni-data-checkbox>
          </uni-forms-item>
        </view>

        <!-- 审核信息 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">✅</text>
            <text>审核信息</text>
          </view>
          
          <uni-forms-item name="status" label="状态" required>
            <uni-data-checkbox v-model="formData.status" :localdata="formOptions.status_localdata"></uni-data-checkbox>
          </uni-forms-item>
          
          <uni-forms-item name="updated_date" label="更新时间">
            <uni-datetime-picker return-type="timestamp" v-model="formData.updated_date"></uni-datetime-picker>
          </uni-forms-item>
          
          <uni-forms-item name="approved_date" label="审核通过时间">
            <uni-datetime-picker return-type="timestamp" v-model="formData.approved_date"></uni-datetime-picker>
          </uni-forms-item>
          
          <uni-forms-item name="rejected_reason" label="拒绝原因">
            <uni-easyinput placeholder="拒绝原因（如果被拒绝）" v-model="formData.rejected_reason" :styles="inputStyles" type="textarea"></uni-easyinput>
          </uni-forms-item>
        </view>

        <!-- 操作按钮 -->
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
  import { validator } from '../../js_sdk/validator/shop_list.js';

  const db = uniCloud.database();
  const dbCmd = db.command;
  const dbCollectionName = 'shop_list';

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
        "shopName": "",
        "category": "",
        "region": "",
        "address": "",
        "contactName": "",
        "phone": "",
        "image": "",
        "plan": "",
        "user_id": "",
        "owner": "",
        "status": "",
        "updated_date": null,
        "approved_date": null,
        "rejected_reason": ""
      }
      return {
        formData,
        formOptions: {
          "plan_localdata": [
            {
              "value": "vip",
              "text": "vip"
            },
            {
              "value": "basic",
              "text": "basic"
            }
          ],
          "status_localdata": [
            {
              "value": "待审核",
              "text": "待审核"
            },
            {
              "value": "已通过",
              "text": "已通过"
            },
            {
              "value": "已拒绝",
              "text": "已拒绝"
            }
          ]
        },
        rules: {
          ...getValidator(Object.keys(formData))
        },
        inputStyles: {
          borderColor: '#e0e0e0',
          borderRadius: '8px'
        }
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
        return db.collection(dbCollectionName).add(value).then((res) => {
          uni.showToast({
            title: '新增成功'
          })
          this.getOpenerEventChannel().emit('refreshData')
          setTimeout(() => uni.navigateBack(), 500)
        }).catch((err) => {
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
/* 页面容器 */
.page-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
}

/* 页面标题 */
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

/* 预览图片 */
.preview-image {
  width: 200px;
  height: 200px;
  border-radius: 12px;
  margin-top: 15px;
  object-fit: cover;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border: 3px solid #ffffff;
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
