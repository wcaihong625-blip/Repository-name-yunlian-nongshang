// 表单校验规则由 schema2code 生成，不建议直接修改校验规则，而建议通过 schema2code 生成, 详情: https://uniapp.dcloud.net.cn/uniCloud/schema

const validator = {
  "refund_no": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "退款单号"
  },
  "order_no": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "原订单号"
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
  "refund_amount": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "number"
      }
    ],
    "label": "退款金额"
  },
  "refund_reason": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "退款原因"
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
            "value": "审核通过",
            "text": "审核通过"
          },
          {
            "value": "审核拒绝",
            "text": "审核拒绝"
          },
          {
            "value": "退款中",
            "text": "退款中"
          },
          {
            "value": "退款成功",
            "text": "退款成功"
          },
          {
            "value": "退款失败",
            "text": "退款失败"
          }
        ]
      }
    ],
    "label": "退款状态",
    "defaultValue": "待审核"
  },
  "refund_method": {
    "rules": [
      {
        "format": "string"
      },
      {
        "range": [
          {
            "value": "原路退回",
            "text": "原路退回"
          },
          {
            "value": "线下退款",
            "text": "线下退款"
          }
        ]
      }
    ],
    "label": "退款方式",
    "defaultValue": "原路退回"
  }
}

const enumConverter = {
  "status_valuetotext": {
    "待审核": "待审核",
    "审核通过": "审核通过",
    "审核拒绝": "审核拒绝",
    "退款中": "退款中",
    "退款成功": "退款成功",
    "退款失败": "退款失败"
  },
  "refund_method_valuetotext": {
    "原路退回": "原路退回",
    "线下退款": "线下退款"
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



