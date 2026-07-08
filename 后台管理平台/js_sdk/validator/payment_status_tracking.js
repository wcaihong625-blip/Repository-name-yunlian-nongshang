// 表单校验规则由 schema2code 生成，不建议直接修改校验规则，而建议通过 schema2code 生成, 详情: https://uniapp.dcloud.net.cn/uniCloud/schema

const validator = {
  "order_no": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "订单号"
  },
  "order_type": {
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
            "value": "shop_payment",
            "text": "开店付费"
          },
          {
            "value": "refund",
            "text": "退款"
          },
          {
            "value": "dispute",
            "text": "纠纷"
          }
        ]
      }
    ],
    "label": "订单类型",
    "defaultValue": "shop_payment"
  },
  "current_status": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "当前状态"
  },
  "callback_status": {
    "rules": [
      {
        "format": "string"
      },
      {
        "range": [
          {
            "value": "pending",
            "text": "待回调"
          },
          {
            "value": "success",
            "text": "成功"
          },
          {
            "value": "failed",
            "text": "失败"
          }
        ]
      }
    ],
    "label": "回调状态",
    "defaultValue": "pending"
  }
}

const enumConverter = {
  "order_type_valuetotext": {
    "shop_payment": "开店付费",
    "refund": "退款",
    "dispute": "纠纷"
  },
  "callback_status_valuetotext": {
    "pending": "待回调",
    "success": "成功",
    "failed": "失败"
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



