<template>
  <view class="uni-container">
    <uni-forms ref="form" :model="formData" :rules="rules" validateTrigger="bind">
      <uni-forms-item name="sales_code" label="业务员编号" required>
        <uni-easyinput v-model="formData.sales_code" disabled placeholder="系统自动生成或历史编号"></uni-easyinput>
        <view v-if="!hadSalesCodeOnLoad" class="hint">本条为旧数据且无编号时，保存将自动补发 YW 编号。</view>
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

      <uni-forms-item name="base_commission_rate_first_pct" label="首开提成（%）">
        <uni-easyinput placeholder="例如填 10 代表 10%" type="number" v-model="formData.base_commission_rate_first_pct"></uni-easyinput>
      </uni-forms-item>

      <uni-forms-item name="base_commission_rate_renew_pct" label="续费提成（%）">
        <uni-easyinput placeholder="例如填 5 代表 5%" type="number" v-model="formData.base_commission_rate_renew_pct"></uni-easyinput>
      </uni-forms-item>

      <uni-forms-item name="status" label="状态" required>
        <uni-data-checkbox v-model="formData.status" :localdata="statusOptions"></uni-data-checkbox>
      </uni-forms-item>

      <uni-forms-item name="remark" label="备注">
        <uni-easyinput type="textarea" placeholder="可选" v-model="formData.remark"></uni-easyinput>
      </uni-forms-item>

      <view class="uni-button-group">
        <button type="primary" class="uni-button" style="width: 120px;" @click="submit">保存</button>
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
        docId: '',
        hadSalesCodeOnLoad: true,
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
          /* 编号在保存时若为空会自动补发，不在此强制 */
          sales_code: { rules: [] },
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
    onLoad(e) {
      if (e.id) {
        this.docId = e.id
        this.getDetail(e.id)
      }
    },
    methods: {
      authPayload() {
        const uniIdToken = uni.getStorageSync('uni_id_token') || ''
        return { uniIdToken, token: uniIdToken }
      },
      async ensureYwCodeIfEmpty() {
        const c = (this.formData.sales_code || '').trim()
        if (c) return c
        const res = await uniCloud.callFunction({
          name: 'getNextSalesStaffCode',
          data: this.authPayload()
        })
        const body = res.result || {}
        if (body.code !== 200 || !body.data || !body.data.sales_code) {
          throw new Error(body.message || '无法生成业务员编号')
        }
        this.formData.sales_code = body.data.sales_code
        return this.formData.sales_code
      },
      getDetail(id) {
        uni.showLoading({ mask: true })
        uniCloud.database().collection('sales_staff').doc(id).get().then(res => {
          if (res.result.data && res.result.data.length > 0) {
            const row = res.result.data[0]
            const sc = row.sales_code || ''
            this.hadSalesCodeOnLoad = !!String(sc).trim()
            this.formData.sales_code = sc
            this.formData.sales_name = row.sales_name || ''
            this.formData.mobile = row.mobile || ''
            this.formData.region = row.region || ''
            this.formData.status = row.status !== undefined ? row.status : 1
            this.formData.remark = row.remark || ''
            this.formData.base_commission_rate_first_pct = row.base_commission_rate_first !== undefined
              ? String((Number(row.base_commission_rate_first) * 100).toFixed(0)) : '10'
            this.formData.base_commission_rate_renew_pct = row.base_commission_rate_renew !== undefined
              ? String((Number(row.base_commission_rate_renew) * 100).toFixed(0)) : '5'
          }
        }).catch(err => {
          uni.showModal({ content: err.message || '加载数据失败', showCancel: false })
        }).finally(() => { uni.hideLoading() })
      },
      submit() {
        this.$refs.form.validate().then(async () => {
          uni.showLoading({ mask: true })
          try {
            const code = await this.ensureYwCodeIfEmpty()
            let data = {
              sales_code: code,
              sales_name: this.formData.sales_name,
              mobile: this.formData.mobile,
              region: this.formData.region || '',
              status: this.formData.status,
              remark: this.formData.remark || '',
              base_commission_rate_first: Number(this.formData.base_commission_rate_first_pct) / 100,
              base_commission_rate_renew: Number(this.formData.base_commission_rate_renew_pct) / 100
            }

            await uniCloud.database().collection('sales_staff').doc(this.docId).update(data)
            uni.showToast({ title: '修改成功' })
            this.getOpenerEventChannel().emit('refreshData')
            setTimeout(() => uni.navigateBack(), 500)
          } catch (err) {
            uni.showModal({ content: (err && err.message) || '保存失败，请重试', showCancel: false })
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
