<template>
  <view class="uni-container">
    <uni-forms ref="form" :model="formData" :rules="rules" validateTrigger="bind">

      <uni-forms-item name="channel_name" label="渠道名称" required>
        <uni-easyinput placeholder="例如：广州天河01群" v-model="formData.channel_name" trim="both"></uni-easyinput>
      </uni-forms-item>

      <!-- 业务员下拉选择 -->
      <uni-forms-item name="sales_id" label="所属业务员" required>
        <picker :value="salesPickerIndex" :range="salesPickerList" range-key="label"
          @change="onSalesPicked" style="width:100%">
          <view class="picker-display">
            <text v-if="formData.sales_name">{{ formData.sales_name }}</text>
            <text v-else style="color:#999;">请选择业务员</text>
            <text style="float:right;color:#999;">▼</text>
          </view>
        </picker>
      </uni-forms-item>

      <uni-forms-item name="channel_type" label="渠道类型" required>
        <uni-data-checkbox v-model="formData.channel_type" :localdata="channelTypeOptions"></uni-data-checkbox>
      </uni-forms-item>

      <uni-forms-item name="group_name" label="微信群名">
        <uni-easyinput placeholder="类型为微信群时填写" v-model="formData.group_name" trim="both"></uni-easyinput>
      </uni-forms-item>

      <uni-forms-item name="status" label="状态" required>
        <uni-data-checkbox v-model="formData.status" :localdata="statusOptions"></uni-data-checkbox>
      </uni-forms-item>

      <!-- 只读信息展示 -->
      <uni-forms-item label="渠道编号">
        <view class="auto-field">{{ formData.channel_code || '-' }}</view>
      </uni-forms-item>

      <uni-forms-item label="邀请码">
        <view class="auto-field">{{ formData.invite_code || '-' }}</view>
      </uni-forms-item>

      <uni-forms-item label="专属落地页路径">
        <view class="auto-field auto-field--small">{{ formData.landing_path || '-' }}</view>
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
        salesList: [],     // 业务员列表
        salesPickerIndex: 0,
        formData: {
          channel_name: '',
          sales_id: '',
          sales_name: '',
          channel_type: 1,
          group_name: '',
          status: 1,
          channel_code: '',
          invite_code: '',
          landing_path: ''
        },
        channelTypeOptions: [
          { text: '微信群', value: 1 },
          { text: '地推', value: 2 },
          { text: '个人', value: 3 }
        ],
        statusOptions: [
          { text: '正常', value: 1 },
          { text: '停用', value: 0 }
        ],
        rules: {
          channel_name: { rules: [{ required: true, errorMessage: '请填写渠道名称' }] },
          sales_id: { rules: [{ required: true, errorMessage: '请选择所属业务员' }] }
        }
      }
    },
    computed: {
      salesPickerList() {
        return this.salesList.map(s => ({
          label: `${s.sales_name}（${s.sales_code}）`,
          value: s._id,
          sales_name: s.sales_name,
          sales_code: s.sales_code
        }))
      }
    },
    onLoad(e) {
      if (e.id) {
        this.docId = e.id
        this.loadSalesList(() => { this.getDetail(e.id) })
      }
    },
    methods: {
      // 加载正常状态业务员列表
      loadSalesList(callback) {
        uniCloud.database().collection('sales_staff')
          .where('status == 1')
          .field('_id,sales_code,sales_name')
          .orderBy('sales_code', 'asc')
          .get()
          .then(res => {
            if (res.result && res.result.data) {
              this.salesList = res.result.data
            }
            if (callback) callback()
          }).catch(() => { if (callback) callback() })
      },

      // 加载当前渠道详情
      getDetail(id) {
        uni.showLoading({ mask: true })
        uniCloud.database().collection('sales_channel').doc(id).get().then(res => {
          if (res.result.data && res.result.data.length > 0) {
            const row = res.result.data[0]
            this.formData.channel_name = row.channel_name || ''
            this.formData.sales_id = row.sales_id || ''
            this.formData.sales_name = row.sales_name || ''
            this.formData.channel_type = row.channel_type || 1
            this.formData.group_name = row.group_name || ''
            this.formData.status = row.status !== undefined ? row.status : 1
            this.formData.channel_code = row.channel_code || ''
            this.formData.invite_code = row.invite_code || ''
            this.formData.landing_path = row.landing_path || ''

            // 定位 picker 默认选中当前业务员
            const idx = this.salesPickerList.findIndex(s => s.value === row.sales_id)
            if (idx >= 0) this.salesPickerIndex = idx
          }
        }).catch(err => {
          uni.showModal({ content: err.message || '加载失败', showCancel: false })
        }).finally(() => { uni.hideLoading() })
      },

      // 选择业务员
      onSalesPicked(e) {
        const idx = e.detail.value
        this.salesPickerIndex = idx
        const selected = this.salesPickerList[idx]
        if (!selected) return
        this.formData.sales_id = selected.value
        this.formData.sales_name = selected.sales_name
      },

      submit() {
        if (!this.formData.sales_id) {
          uni.showToast({ title: '请先选择所属业务员', icon: 'none' })
          return
        }
        this.$refs.form.validate().then(() => {
          uni.showLoading({ mask: true })
          let data = {
            channel_name: this.formData.channel_name,
            sales_id: this.formData.sales_id,
            sales_name: this.formData.sales_name,
            channel_type: this.formData.channel_type,
            group_name: this.formData.group_name || '',
            status: this.formData.status
            // created_at / updated_at 由 schema forceDefaultValue 自动维护
          }

          uniCloud.database().collection('sales_channel').doc(this.docId).update(data).then(() => {
            uni.showToast({ title: '修改成功' })
            this.getOpenerEventChannel().emit('refreshData')
            setTimeout(() => uni.navigateBack(), 500)
          }).catch(err => {
            uni.showModal({ content: err.message || '保存失败，请重试', showCancel: false })
          }).finally(() => { uni.hideLoading() })
        }).catch(() => {
          uni.showToast({ title: '请检查必填项', icon: 'none' })
        })
      }
    }
  }
</script>

<style>
.picker-display {
  border: 1px solid #e5e5e5;
  border-radius: 6px;
  padding: 8px 12px;
  min-height: 36px;
  line-height: 36px;
  background: #fff;
}
.auto-field {
  color: #888;
  font-size: 13px;
  padding: 8px 0;
  word-break: break-all;
}
.auto-field--small {
  font-size: 12px;
}
</style>
