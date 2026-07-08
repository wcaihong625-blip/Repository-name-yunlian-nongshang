// 表单校验规则由 schema2code 生成，不建议直接修改校验规则，而建议通过 schema2code 生成, 详情: https://uniapp.dcloud.net.cn/uniCloud/schema


const validator = {
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
  "realName": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      },
      {
        "maxLength": 20
      }
    ],
    "label": "真实姓名"
  },
  "idCard": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      },
      {
        "maxLength": 18
      }
    ],
    "label": "身份证号码"
  },
  "idCardFront": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "身份证正面"
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
            "value": "unverified",
            "text": "unverified"
          },
          {
            "value": "pending",
            "text": "pending"
          },
          {
            "value": "verified",
            "text": "verified"
          },
          {
            "value": "rejected",
            "text": "rejected"
          }
        ]
      }
    ],
    "label": "认证状态"
  },
  "rejectReason": {
    "rules": [
      {
        "format": "string"
      },
      {
        "maxLength": 500
      }
    ],
    "label": "驳回原因"
  },
  "auditor_id": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "label": "审核人ID"
  },
  "auditor_name": {
    "rules": [
      {
        "format": "string"
      },
      {
        "maxLength": 50
      }
    ],
    "label": "审核人姓名"
  },
  "audit_date": {
    "rules": [
      {
        "format": "timestamp"
      }
    ],
    "label": "审核时间"
  },
  "verified_date": {
    "rules": [
      {
        "format": "timestamp"
      }
    ],
    "label": "认证通过时间"
  }
}

const enumConverter = {
  "status_valuetotext": {
    "unverified": "unverified",
    "pending": "pending",
    "verified": "verified",
    "rejected": "rejected"
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
