<template>
  <view class="page-shell">
    <view class="page-header">
      <view>
        <view class="page-title">新增采购</view>
        <view class="page-subtitle">添加新的农产品采购需求信息。</view>
      </view>
    </view>

    <view class="form-section">
      <uni-forms ref="form" :model="formData" validateTrigger="bind" :label-width="120">
        <!-- 基本信息 -->
        <view class="detail-section">
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
        <view class="detail-section">
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
        <view class="detail-section">
          <view class="section-title">
            <text class="section-icon">📍</text>
            <text>收货信息</text>
          </view>
          
          <uni-forms-item name="address" label="收货地址" required>
            <uni-easyinput placeholder="请输入收货地址" v-model="formData.address" :styles="inputStyles" type="textarea"></uni-easyinput>
          </uni-forms-item>
        </view>

        <!-- 发布信息 -->
        <view class="detail-section">
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
.section-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
  color: #0f172a;
  margin-bottom: 20px;
}

.section-icon {
  font-size: 16px;
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
  box-shadow: none;
}

.submit-btn {
  background: #3b82f6;
  color: #ffffff;
}

.cancel-btn {
  background: #fff;
  color: #475569;
  border: 1px solid #dbe4ee;
}

.btn-icon {
  margin-right: 6px;
  font-size: 16px;
}

/* 响应式 */
@media (max-width: 768px) {
  .button-group {
    flex-direction: column;
  }

  .submit-btn,
  .cancel-btn {
    width: 100%;
  }
}
</style>
