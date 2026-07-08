<template>
  <view class="uni-container">
    <uni-forms ref="form" :model="formData" :rules="rules" validateTrigger="bind">

      <uni-forms-item name="channel_name" label="渠道名称" required>
        <uni-easyinput placeholder="例如：广州天河01群" v-model="formData.channel_name" trim="both"></uni-easyinput>
      </uni-forms-item>

      <!-- 业务员下拉选择（核心改造） -->
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

      <!-- 自动生成预览（只读） -->
      <uni-forms-item label="渠道编号（自动）">
        <view class="auto-field">{{ formData.channel_code || '保存时自动生成' }}</view>
      </uni-forms-item>

      <uni-forms-item label="邀请码（自动）">
        <view class="auto-field">{{ formData.invite_code || '选择业务员后自动生成' }}</view>
      </uni-forms-item>

      <uni-forms-item label="专属路径（自动）">
        <view class="auto-field auto-field--small">{{ formData.landing_path || '保存成功后自动写入' }}</view>
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
        // 业务员列表（从数据库加载）
        salesList: [],
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
      // 下拉选项文本：显示"姓名（编号）"
      salesPickerList() {
        return this.salesList.map(s => ({
          label: `${s.sales_name}（${s.sales_code}）`,
          value: s._id,
          sales_name: s.sales_name,
          sales_code: s.sales_code
        }))
      }
    },
    onLoad() {
      this.loadSalesList()
    },
    methods: {
      // 加载正常状态的业务员列表
      loadSalesList() {
        uniCloud.database().collection('sales_staff')
          .where('status == 1')
          .field('_id,sales_code,sales_name')
          .orderBy('sales_code', 'asc')
          .get()
          .then(res => {
            if (res.result && res.result.data) {
              this.salesList = res.result.data
            }
          }).catch(() => {})
      },

      // 选择业务员
      onSalesPicked(e) {
        const idx = e.detail.value
        this.salesPickerIndex = idx
        const selected = this.salesPickerList[idx]
        if (!selected) return
        this.formData.sales_id = selected.value
        this.formData.sales_name = selected.sales_name
        // 实时预览邀请码
        this.previewInviteCode(selected.sales_code)
      },

      // 生成邀请码预览（业务员编号 + 时间后缀）
      previewInviteCode(salesCode) {
        const suffix = Date.now().toString().slice(-4)
        this.formData.invite_code = (salesCode || 'S') + '-' + suffix
      },

      submit() {
        if (!this.formData.sales_id) {
          uni.showToast({ title: '请先选择所属业务员', icon: 'none' })
          return
        }
        this.$refs.form.validate().then(async () => {
          uni.showLoading({ mask: true })
          try {
            const db = uniCloud.database()

            // 1. 生成渠道编号：查当前数量，生成 CH001、CH002...
            const countRes = await db.collection('sales_channel').count()
            const nextNum = (countRes.result.total || 0) + 1
            const channelCode = 'CH' + String(nextNum).padStart(3, '0')

            // 2. 邀请码（已在 onSalesPicked 中生成，若未选则兜底）
            const inviteCode = this.formData.invite_code || (this.formData.sales_id.slice(-4) + '-' + Date.now().toString().slice(-4))

            // 3. 先写入基础数据（不含 landing_path，因为 _id 尚未生成）
            const data = {
              channel_name: this.formData.channel_name,
              sales_id: this.formData.sales_id,
              sales_name: this.formData.sales_name,
              channel_type: this.formData.channel_type,
              group_name: this.formData.group_name || '',
              status: this.formData.status,
              channel_code: channelCode,
              invite_code: inviteCode
              // created_at / updated_at 由 schema forceDefaultValue 自动生成
            }

            const addRes = await db.collection('sales_channel').add(data)
            const newId = addRes.result.id

            // 4. 用新 _id 补写 landing_path
            const landingPath = `/pages/open-shop/open-shop?sales_id=${this.formData.sales_id}&channel_id=${newId}`
            await db.collection('sales_channel').doc(newId).update({ landing_path: landingPath })

            uni.showToast({ title: '新增成功' })
            this.getOpenerEventChannel().emit('refreshData')
            setTimeout(() => uni.navigateBack(), 500)

          } catch (err) {
            uni.showModal({ content: err.message || '提交失败，请重试', showCancel: false })
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
