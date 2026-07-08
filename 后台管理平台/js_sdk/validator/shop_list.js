// 表单校验规则由 schema2code 生成，不建议直接修改校验规则，而建议通过 schema2code 生成, 详情: https://uniapp.dcloud.net.cn/uniCloud/schema


const validator = {
  "shopName": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "店铺名称"
  },
  "category": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "主营类目"
  },
  "region": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "所在地区"
  },
  "address": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "详细地址"
  },
  "contactName": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "联系人"
  },
  "phone": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "联系电话"
  },
  "image": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "店铺照片"
  },
  "plan": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      },
      {
        "range": [
          {
            "value": "vip",
            "text": "vip"
          },
          {
            "value": "basic",
            "text": "basic"
          }
        ]
      }
    ],
    "label": "套餐类型"
  },
  "user_id": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "用户ID"
  },
  "owner": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "label": "所有者"
  },
  "status": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      },
      {
        "range": [
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
      }
    ],
    "label": "状态"
  },
  "updated_date": {
    "rules": [
      {
        "format": "timestamp"
      }
    ],
    "label": "更新时间"
  },
  "approved_date": {
    "rules": [
      {
        "format": "timestamp"
      }
    ],
    "label": "审核通过时间"
  },
  "rejected_reason": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "label": "拒绝原因"
  }
}

const enumConverter = {
  "plan_valuetotext": {
    "vip": "vip",
    "basic": "basic"
  },
  "status_valuetotext": {
    "待审核": "待审核",
    "已通过": "已通过",
    "已拒绝": "已拒绝"
  }
}

function filterToWhere(filter, command) {
  let where = {}
  for (let field in filter) {
    let { type, value } = filter[field]
    switch (type) {
      case "search":
        if (typeof value === 'string' && value.length) {
          where[field] = new RegExp(value)
        }
        break;
      case "select":
        if (value.length) {
          let selectValue = []
          for (let s of value) {
            selectValue.push(command.eq(s))
          }
          where[field] = command.or(selectValue)
        }
        break;
      case "range":
        if (value.length) {
          let gt = value[0]
          let lt = value[1]
          where[field] = command.and([command.gte(gt), command.lte(lt)])
        }
        break;
      case "date":
        if (value.length) {
          let [s, e] = value
          let startDate = new Date(s)
          let endDate = new Date(e)
          where[field] = command.and([command.gte(startDate), command.lte(endDate)])
        }
        break;
      case "timestamp":
        if (value.length) {
          let [startDate, endDate] = value
          where[field] = command.and([command.gte(startDate), command.lte(endDate)])
        }
        break;
    }
  }
  return where
}

export { validator, enumConverter, filterToWhere }
