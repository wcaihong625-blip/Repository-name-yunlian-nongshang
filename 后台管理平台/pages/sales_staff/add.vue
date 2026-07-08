<template>
  <view class="uni-container">
    <uni-forms ref="form" :model="formData" :rules="rules" validateTrigger="bind">
      <uni-forms-item name="sales_code" label="业务员编号" required>
        <uni-easyinput v-model="formData.sales_code" disabled placeholder="系统自动生成"></uni-easyinput>
        <view class="hint">保存前自动生成，格式 YW10001 递增；请勿与库内已有编号重复。</view>
      </uni-forms-item>

      <uni-forms-item name="sales_name" label="业务员姓名" required>
        <uni-easyinput placeholder="请填写真实姓名" v-model="formData.sales_name" trim="both"></uni-easyinput>
      </uni-forms-item>

      <uni-forms-item name="mobile" label="手机号" required>
        <uni-easyinput placeholder="11位手机号" v-model="formData.mobile" trim="both" type="number"></uni-easyinput>
      </uni-forms-item>

      <uni-forms-item name="region" label="负责区域">
        <uni-easyinput placeholder="例如：广州天河区" v-model="formData.region" trim="both"></uni-easyinput>
      </uni-forms-item>

      <uni-forms-item name="base_commission_rate_first" label="首开提成（%）" required>
        <uni-easyinput placeholder="例如填 10 代表 10%" type="number" v-model="formData.base_commission_rate_first_pct"></uni-easyinput>
      </uni-forms-item>

      <uni-forms-item name="base_commission_rate_renew" label="续费提成（%）" required>
        <uni-easyinput placeholder="例如填 5 代表 5%" type="number" v-model="formData.base_commission_rate_renew_pct"></uni-easyinput>
      </uni-forms-item>

      <uni-forms-item name="status" label="状态" required>
        <uni-data-checkbox v-model="formData.status" :localdata="statusOptions"></uni-data-checkbox>
      </uni-forms-item>

      <uni-forms-item name="remark" label="备注">
        <uni-easyinput type="textarea" placeholder="可选" v-model="formData.remark"></uni-easyinput>
      </uni-forms-item>

      <view class="uni-button-group">
        <button type="primary" class="uni-button" style="width: 120px;" @click="submit">提交</button>
        <navigator open-type="navigateBack" style="margin-left: 15px;">
          <button class="uni-button" style="width: 100px;">返回</button>
        </navigator>
      </view>
    </uni-forms>
  </view>
</template>

<script>
  export default {
    data() {
      return {
        formData: {
          sales_code: '',
          sales_name: '',
          mobile: '',
          region: '',
          base_commission_rate_first_pct: '10',
          base_commission_rate_renew_pct: '5',
          status: 1,
          remark: ''
        },
        statusOptions: [
          { text: '正常', value: 1 },
          { text: '停用', value: 0 }
        ],
        rules: {
          sales_code: { rules: [{ required: true, errorMessage: '正在生成业务员编号…' }] },
          sales_name: { rules: [{ required: true, errorMessage: '请填写业务员姓名' }] },
          mobile: {
            rules: [
              { required: true, errorMessage: '请输入手机号' },
              { validateFunction: (rule, val) => /^1[3-9]\d{9}$/.test(val), errorMessage: '请输入正确的11位手机号' }
            ]
          }
        }
      }
    },
    onLoad() {
      this.refreshSalesCode()
    },
    methods: {
      authPayload() {
        const uniIdToken = uni.getStorageSync('uni_id_token') || ''
        return { uniIdToken, token: uniIdToken }
      },
      async refreshSalesCode() {
        try {
          const res = await uniCloud.callFunction({
            name: 'getNextSalesStaffCode',
            data: this.authPayload()
          })
          const body = res.result || {}
          if (body.code === 200 && body.data && body.data.sales_code) {
            this.formData.sales_code = body.data.sales_code
          } else {
            uni.showModal({
              content: body.message || '获取业务员编号失败，请检查云函数是否已上传',
              showCancel: false
            })
          }
        } catch (e) {
          uni.showModal({ content: e.message || '获取业务员编号失败', showCancel: false })
        }
      },
      async tryAddOnce(db, data) {
        return db.collection('sales_staff').add(data)
      },
      submit() {
        this.$refs.form.validate().then(async () => {
          uni.showLoading({ mask: true })
          const db = uniCloud.database()
          let data = {
            sales_code: (this.formData.sales_code || '').trim(),
            sales_name: this.formData.sales_name,
            mobile: this.formData.mobile,
            region: this.formData.region || '',
            status: this.formData.status,
            remark: this.formData.remark || '',
            base_commission_rate_first: Number(this.formData.base_commission_rate_first_pct) / 100,
            base_commission_rate_renew: Number(this.formData.base_commission_rate_renew_pct) / 100
          }

          const run = async () => {
            if (!data.sales_code) {
              await this.refreshSalesCode()
              data.sales_code = (this.formData.sales_code || '').trim()
            }
            await this.tryAddOnce(db, data)
          }

          try {
            await run()
            uni.showToast({ title: '新增成功' })
            this.getOpenerEventChannel().emit('refreshData')
            setTimeout(() => uni.navigateBack(), 500)
          } catch (err) {
            const msg = (err && err.message) || ''
            if (/duplicate|唯一|unique|重复/i.test(msg) || /sales_code/i.test(msg)) {
              try {
                await this.refreshSalesCode()
                data.sales_code = (this.formData.sales_code || '').trim()
                await this.tryAddOnce(db, data)
                uni.showToast({ title: '新增成功' })
                this.getOpenerEventChannel().emit('refreshData')
                setTimeout(() => uni.navigateBack(), 500)
              } catch (e2) {
                uni.showModal({ content: (e2 && e2.message) || '提交失败，请重试', showCancel: false })
              }
            } else {
              uni.showModal({ content: msg || '提交失败，请重试', showCancel: false })
            }
          } finally {
            uni.hideLoading()
          }
        }).catch(() => {
          uni.showToast({ title: '请检查必填项', icon: 'none' })
        })
      }
    }
  }
</script>

<style>
.hint {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}
</style>
