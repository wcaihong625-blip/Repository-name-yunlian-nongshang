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
  "shop_id": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "店铺ID"
  },
  "shop_name": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "label": "店铺名称"
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
  "user_name": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "label": "用户名称"
  },
  "plan_type": {
    "rules": [
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
  "amount": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "number"
      }
    ],
    "label": "支付金额"
  },
  "payment_method": {
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
            "value": "wxpay",
            "text": "wxpay"
          },
          {
            "value": "alipay",
            "text": "alipay"
          }
        ]
      }
    ],
    "label": "支付方式"
  },
  "payment_channel": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "label": "支付渠道"
  },
  "transaction_id": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "label": "交易流水号"
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
      }
    ],
    "label": "订单状态"
  },
  "pay_date": {
    "rules": [
      {
        "format": "timestamp"
      }
    ],
    "label": "支付时间"
  },
  "expire_date": {
    "rules": [
      {
        "format": "timestamp"
      }
    ],
    "label": "订单过期时间"
  },
  "remark": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "label": "备注"
  },
  "updated_date": {
    "rules": [
      {
        "format": "timestamp"
      }
    ],
    "label": "更新时间"
  }
}

const enumConverter = {
  "plan_type_valuetotext": {
    "vip": "vip",
    "basic": "basic"
  },
  "payment_method_valuetotext": {
    "wxpay": "wxpay",
    "alipay": "alipay"
  },
  "status_valuetotext": {
    "待支付": "待支付",
    "已支付": "已支付",
    "已取消": "已取消",
    "已退款": "已退款"
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


