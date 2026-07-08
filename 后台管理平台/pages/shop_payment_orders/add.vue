<template>
  <view class="uni-container">
    <uni-forms ref="form" :model="formData" validateTrigger="bind">
      <uni-forms-item name="order_no" label="订单号" required>
        <uni-easyinput placeholder="订单号" v-model="formData.order_no"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="shop_id" label="店铺ID" required>
        <uni-easyinput placeholder="店铺ID" v-model="formData.shop_id"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="shop_name" label="店铺名称">
        <uni-easyinput placeholder="店铺名称" v-model="formData.shop_name"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="user_id" label="用户ID" required>
        <uni-easyinput placeholder="用户ID" v-model="formData.user_id"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="user_name" label="用户名称">
        <uni-easyinput placeholder="用户名称" v-model="formData.user_name"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="plan_type" label="套餐类型">
        <uni-data-checkbox v-model="formData.plan_type" :localdata="formOptions.plan_type_localdata"></uni-data-checkbox>
      </uni-forms-item>
      <uni-forms-item name="amount" label="支付金额" required>
        <undefined v-model="formData.amount"></undefined>
      </uni-forms-item>
      <uni-forms-item name="payment_method" label="支付方式" required>
        <uni-data-checkbox v-model="formData.payment_method" :localdata="formOptions.payment_method_localdata"></uni-data-checkbox>
      </uni-forms-item>
      <uni-forms-item name="payment_channel" label="支付渠道">
        <uni-easyinput placeholder="支付渠道" v-model="formData.payment_channel"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="transaction_id" label="交易流水号">
        <uni-easyinput placeholder="第三方交易流水号" v-model="formData.transaction_id"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="status" label="订单状态" required>
        <uni-data-checkbox v-model="formData.status" :localdata="formOptions.status_localdata"></uni-data-checkbox>
      </uni-forms-item>
      <uni-forms-item name="pay_date" label="支付时间">
        <uni-datetime-picker return-type="timestamp" v-model="formData.pay_date"></uni-datetime-picker>
      </uni-forms-item>
      <uni-forms-item name="expire_date" label="订单过期时间">
        <uni-datetime-picker return-type="timestamp" v-model="formData.expire_date"></uni-datetime-picker>
      </uni-forms-item>
      <uni-forms-item name="remark" label="备注">
        <uni-easyinput placeholder="备注" v-model="formData.remark"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="updated_date" label="更新时间">
        <uni-datetime-picker return-type="timestamp" v-model="formData.updated_date"></uni-datetime-picker>
      </uni-forms-item>
      <view class="uni-button-group">
        <button type="primary" class="uni-button" style="width: 100px;" @click="submit">提交</button>
        <navigator open-type="navigateBack" style="margin-left: 15px;">
          <button class="uni-button" style="width: 100px;">返回</button>
        </navigator>
      </view>
    </uni-forms>
  </view>
</template>

<script>
  import { validator } from '../../js_sdk/validator/shop_payment_orders.js';

  const db = uniCloud.database();
  const dbCmd = db.command;
  const dbCollectionName = 'shop_payment_orders';

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
        "order_no": "",
        "shop_id": "",
        "shop_name": "",
        "user_id": "",
        "user_name": "",
        "plan_type": "",
        "amount": null,
        "payment_method": "",
        "payment_channel": "",
        "transaction_id": "",
        "status": "",
        "pay_date": null,
        "expire_date": null,
        "remark": "",
        "updated_date": null
      }
      return {
        formData,
        formOptions: {
          "plan_type_localdata": [
            {
              "value": "vip",
              "text": "vip"
            },
            {
              "value": "basic",
              "text": "basic"
            }
          ],
          "payment_method_localdata": [
            {
              "value": "wxpay",
              "text": "wxpay"
            },
            {
              "value": "alipay",
              "text": "alipay"
            }
          ],
          "status_localdata": [
            {
              "value": "待支付",
              "text": "待支付"
            },
            {
              "value": "已支付",
              "text": "已支付"
            },
            {
              "value": "已取消",
              "text": "已取消"
            },
            {
              "value": "已退款",
              "text": "已退款"
            }
          ]
        },
        rules: {
          ...getValidator(Object.keys(formData))
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
