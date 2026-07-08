<template>
  <view class="uni-container">
    <uni-forms ref="form" :model="formData" validateTrigger="bind">
      <uni-forms-item name="ali_openid" label="">
        <uni-easyinput placeholder="支付宝平台openid" v-model="formData.ali_openid"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="apple_openid" label="">
        <uni-easyinput placeholder="苹果登录openid" v-model="formData.apple_openid"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="avatar" label="头像地址">
        <uni-easyinput placeholder="头像地址" v-model="formData.avatar" trim="both"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="avatar_file" label="头像文件">
        <uni-file-picker return-type="object" v-model="formData.avatar_file"></uni-file-picker>
      </uni-forms-item>
      <uni-forms-item name="comment" label="备注">
        <uni-easyinput placeholder="备注" v-model="formData.comment" trim="both"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="dcloud_appid" label="">
        <uni-data-picker :multiple="true" v-model="formData.dcloud_appid"></uni-data-picker>
      </uni-forms-item>
      <uni-forms-item name="department_id" label="部门">
        <uni-data-picker self-field="_id" parent-field="parent_id" v-model="formData.department_id" collection="opendb-department" field="_id as value, name as text" orderby="name asc"></uni-data-picker>
      </uni-forms-item>
      <uni-forms-item name="email" label="邮箱">
        <uni-easyinput placeholder="邮箱地址" v-model="formData.email" trim="both"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="email_confirmed" label="邮箱验证状态">
        <uni-data-checkbox v-model="formData.email_confirmed" :localdata="formOptions.email_confirmed_localdata"></uni-data-checkbox>
      </uni-forms-item>
      <uni-forms-item name="gender" label="性别">
        <uni-data-checkbox v-model="formData.gender" :localdata="formOptions.gender_localdata"></uni-data-checkbox>
      </uni-forms-item>
      <uni-forms-item name="invite_time" label="">
        <uni-datetime-picker return-type="timestamp" v-model="formData.invite_time"></uni-datetime-picker>
      </uni-forms-item>
      <uni-forms-item name="inviter_uid" label="">
        <uni-data-checkbox :multiple="true" v-model="formData.inviter_uid"></uni-data-checkbox>
      </uni-forms-item>
      <uni-forms-item name="last_login_date" label="">
        <uni-datetime-picker return-type="timestamp" v-model="formData.last_login_date"></uni-datetime-picker>
      </uni-forms-item>
      <uni-forms-item name="last_login_ip" label="">
        <uni-easyinput placeholder="最后登录时 IP 地址" v-model="formData.last_login_ip"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="mobile" label="手机号码">
        <uni-easyinput placeholder="手机号码" v-model="formData.mobile" trim="both"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="mobile_confirmed" label="手机号验证状态">
        <uni-data-checkbox v-model="formData.mobile_confirmed" :localdata="formOptions.mobile_confirmed_localdata"></uni-data-checkbox>
      </uni-forms-item>
      <uni-forms-item name="my_invite_code" label="">
        <uni-easyinput placeholder="用户自身邀请码" v-model="formData.my_invite_code"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="nickname" label="昵称">
        <uni-easyinput placeholder="用户昵称" v-model="formData.nickname" trim="both"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="role" label="角色">
        <uni-data-picker :multiple="true" v-model="formData.role" collection="uni-id-roles" field="role_id as value, role_name as text"></uni-data-picker>
      </uni-forms-item>
      <uni-forms-item name="tags" label="标签">
        <uni-data-checkbox :multiple="true" v-model="formData.tags"></uni-data-checkbox>
      </uni-forms-item>
      <uni-forms-item name="score" label="">
        <uni-easyinput placeholder="用户积分，积分变更记录可参考：uni-id-scores表定义" type="number" v-model="formData.score"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="status" label="用户状态">
        <uni-data-checkbox v-model="formData.status" :localdata="formOptions.status_localdata"></uni-data-checkbox>
      </uni-forms-item>
      <uni-forms-item name="token" label="">
        <uni-data-checkbox :multiple="true" v-model="formData.token"></uni-data-checkbox>
      </uni-forms-item>
      <uni-forms-item name="username" label="用户名">
        <uni-easyinput placeholder="用户名，不允许重复" v-model="formData.username" trim="both"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="wx_unionid" label="">
        <uni-easyinput placeholder="微信unionid" v-model="formData.wx_unionid"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="qq_unionid" label="">
        <uni-easyinput placeholder="QQ unionid" v-model="formData.qq_unionid"></uni-easyinput>
      </uni-forms-item>
      <uni-forms-item name="identities" label="">
        <uni-data-checkbox :multiple="true" v-model="formData.identities"></uni-data-checkbox>
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
  import { validator } from '../../js_sdk/validator/uni-id-users.js';

  const db = uniCloud.database();
  const dbCmd = db.command;
  const dbCollectionName = 'uni-id-users';

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
        "ali_openid": "",
        "apple_openid": "",
        "avatar": "",
        "avatar_file": null,
        "comment": "",
        "dcloud_appid": [],
        "department_id": [],
        "email": "",
        "email_confirmed": 0,
        "gender": 0,
        "invite_time": null,
        "inviter_uid": [],
        "last_login_date": null,
        "last_login_ip": "",
        "mobile": "",
        "mobile_confirmed": 0,
        "my_invite_code": "",
        "nickname": "",
        "role": [],
        "tags": [],
        "score": null,
        "status": 0,
        "token": [],
        "username": "",
        "wx_unionid": "",
        "qq_unionid": "",
        "identities": []
      }
      return {
        formData,
        formOptions: {
          "email_confirmed_localdata": [
            {
              "text": "未验证",
              "value": 0
            },
            {
              "text": "已验证",
              "value": 1
            }
          ],
          "gender_localdata": [
            {
              "text": "未知",
              "value": 0
            },
            {
              "text": "男",
              "value": 1
            },
            {
              "text": "女",
              "value": 2
            }
          ],
          "mobile_confirmed_localdata": [
            {
              "text": "未验证",
              "value": 0
            },
            {
              "text": "已验证",
              "value": 1
            }
          ],
          "status_localdata": [
            {
              "text": "正常",
              "value": 0
            },
            {
              "text": "禁用",
              "value": 1
            },
            {
              "text": "审核中",
              "value": 2
            },
            {
              "text": "审核拒绝",
              "value": 3
            },
            {
              "text": "已注销",
              "value": 4
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
        db.collection(dbCollectionName).doc(id).field("ali_openid,apple_openid,avatar,avatar_file,comment,dcloud_appid,department_id,email,email_confirmed,gender,invite_time,inviter_uid,last_login_date,last_login_ip,mobile,mobile_confirmed,my_invite_code,nickname,role,tags,score,status,token,username,wx_unionid,qq_unionid,identities").get().then((res) => {
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
