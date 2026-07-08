<template>
  <view class="page-container">
    <!-- 页面标题 -->
    <view class="page-header">
      <view class="header-title">
        <text class="title-icon">✏️</text>
        <text class="title-text">编辑采购</text>
      </view>
      <view class="header-subtitle">修改农产品采购需求信息</view>
    </view>

    <!-- 表单卡片 -->
    <view class="form-card">
      <uni-forms ref="form" :model="formData" validateTrigger="bind" :label-width="120">
        <!-- 基本信息 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">🛒</text>
            <text>基本信息</text>
          </view>
          
          <uni-forms-item name="title" label="采购标题" required>
            <uni-easyinput placeholder="请输入采购标题" v-model="formData.title" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="category" label="产品品类" required>
            <uni-easyinput placeholder="如：蔬菜、水果、肉类等" v-model="formData.category" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="specifications" label="详细规格" required>
            <uni-easyinput placeholder="请输入详细规格" v-model="formData.specifications" :styles="inputStyles" type="textarea"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="remarks" label="补充说明">
            <uni-easyinput placeholder="补充说明（选填）" v-model="formData.remarks" :styles="inputStyles" type="textarea"></uni-easyinput>
          </uni-forms-item>
        </view>

        <!-- 数量与价格 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">💰</text>
            <text>数量与价格</text>
          </view>
          
          <uni-forms-item name="quantity" label="采购数量" required>
            <uni-easyinput placeholder="请输入采购数量" v-model="formData.quantity" :styles="inputStyles" type="number"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="unit" label="单位" required>
            <uni-easyinput placeholder="如：吨、公斤、件等" v-model="formData.unit" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="price" label="期望单价" required>
            <uni-easyinput placeholder="期望单价（元/单位）" v-model="formData.price" :styles="inputStyles" type="number"></uni-easyinput>
          </uni-forms-item>
        </view>

        <!-- 收货信息 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">📍</text>
            <text>收货信息</text>
          </view>
          
          <uni-forms-item name="address" label="收货地址" required>
            <uni-easyinput placeholder="请输入收货地址" v-model="formData.address" :styles="inputStyles" type="textarea"></uni-easyinput>
          </uni-forms-item>
        </view>

        <!-- 发布信息 -->
        <view class="form-section">
          <view class="section-title">
            <text class="section-icon">👤</text>
            <text>发布信息</text>
          </view>
          
          <uni-forms-item name="user_id" label="发布用户ID" required>
            <uni-easyinput placeholder="发布用户ID" v-model="formData.user_id" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="publisher" label="发布者名称">
            <uni-easyinput placeholder="发布者名称（冗余字段，便于查询）" v-model="formData.publisher" :styles="inputStyles"></uni-easyinput>
          </uni-forms-item>
          
          <uni-forms-item name="status" label="状态" required>
            <uni-data-checkbox v-model="formData.status" :localdata="formOptions.status_localdata"></uni-data-checkbox>
          </uni-forms-item>
          
          <uni-forms-item name="urgency" label="紧急程度">
            <uni-data-checkbox v-model="formData.urgency" :localdata="formOptions.urgency_localdata"></uni-data-checkbox>
          </uni-forms-item>
          
          <uni-forms-item name="updated_date" label="更新时间">
            <uni-datetime-picker return-type="timestamp" v-model="formData.updated_date"></uni-datetime-picker>
          </uni-forms-item>
          
          <uni-forms-item name="publish_date" label="发布时间">
            <uni-datetime-picker return-type="timestamp" v-model="formData.publish_date"></uni-datetime-picker>
          </uni-forms-item>
        </view>

        <!-- 操作按钮 -->
        <view class="button-group">
          <button class="submit-btn" @click="submit">
            <text class="btn-icon">✅</text>
            <text>保存修改</text>
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
  import { validator } from '../../js_sdk/validator/purchase_list.js';

  const db = uniCloud.database();
  const dbCmd = db.command;
  const dbCollectionName = 'purchase_list';

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
        "title": "",
        "category": "",
        "specifications": "",
        "quantity": "",
        "unit": "",
        "price": "",
        "address": "",
        "remarks": "",
        "user_id": "",
        "publisher": "",
        "status": "",
        "urgency": "",
        "updated_date": null,
        "publish_date": null
      }
      return {
        formData,
        formOptions: {
          "status_localdata": [
            {
              "value": "已发布",
              "text": "已发布"
            },
            {
              "value": "已下架",
              "text": "已下架"
            }
          ],
          "urgency_localdata": [
            {
              "value": "Normal",
              "text": "Normal"
            },
            {
              "value": "Urgent",
              "text": "Urgent"
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
            title: '修改成功'
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

      /**
       * 获取表单数据
       * @param {Object} id
       */
      getDetail(id) {
        uni.showLoading({
          mask: true
        })
        db.collection(dbCollectionName).doc(id).field("title,category,specifications,quantity,unit,price,address,remarks,user_id,publisher,status,urgency,updated_date,publish_date").get().then((res) => {
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
/* 页面容器 */
.page-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  padding: 20px;
}

/* 页面标题 */
.page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 30px;
  margin-bottom: 20px;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
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
  border-radius: 12px;
  padding: 30px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* 表单分组 */
.form-section {
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #f0f0f0;
}

.form-section:last-of-type {
  border-bottom: none;
}

.section-title {
  display: flex;
  align-items: center;
  font-size: 18px;
  font-weight: 600;
  color: #333333;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #667eea;
}

.section-icon {
  font-size: 20px;
  margin-right: 8px;
}

/* 按钮组 */
.button-group {
  display: flex;
  gap: 20px;
  justify-content: center;
  margin-top: 40px;
  padding-top: 30px;
  border-top: 1px solid #f0f0f0;
}

.submit-btn,
.cancel-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 40px;
  border-radius: 8px;
  border: none;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.submit-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #ffffff;
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(102, 126, 234, 0.4);
}

.cancel-btn {
  background: #f5f5f5;
  color: #666666;
}

.cancel-btn:hover {
  background: #e0e0e0;
  transform: translateY(-2px);
}

.btn-icon {
  margin-right: 6px;
  font-size: 16px;
}

/* 响应式 */
@media (max-width: 768px) {
  .page-container {
    padding: 10px;
  }

  .form-card {
    padding: 20px;
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
