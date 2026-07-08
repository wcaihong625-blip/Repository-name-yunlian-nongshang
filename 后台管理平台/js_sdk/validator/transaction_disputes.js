// 表单校验规则由 schema2code 生成，不建议直接修改校验规则，而建议通过 schema2code 生成, 详情: https://uniapp.dcloud.net.cn/uniCloud/schema

const validator = {
  "dispute_no": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "纠纷单号"
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
    "label": "关联订单号"
  },
  "disputant_id": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "申诉人ID"
  },
  "disputant_type": {
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
            "value": "buyer",
            "text": "买家"
          },
          {
            "value": "seller",
            "text": "卖家"
          }
        ]
      }
    ],
    "label": "申诉人类型",
    "defaultValue": "buyer"
  },
  "dispute_type": {
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
            "value": "payment",
            "text": "支付纠纷"
          },
          {
            "value": "refund",
            "text": "退款纠纷"
          },
          {
            "value": "service",
            "text": "服务纠纷"
          },
          {
            "value": "quality",
            "text": "质量问题"
          }
        ]
      }
    ],
    "label": "纠纷类型",
    "defaultValue": "payment"
  },
  "dispute_reason": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "纠纷原因"
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
            "value": "待处理",
            "text": "待处理"
          },
          {
            "value": "处理中",
            "text": "处理中"
          },
          {
            "value": "已调解",
            "text": "已调解"
          },
          {
            "value": "已关闭",
            "text": "已关闭"
          }
        ]
      }
    ],
    "label": "处理状态",
    "defaultValue": "待处理"
  }
}

const enumConverter = {
  "disputant_type_valuetotext": {
    "buyer": "买家",
    "seller": "卖家"
  },
  "dispute_type_valuetotext": {
    "payment": "支付纠纷",
    "refund": "退款纠纷",
    "service": "服务纠纷",
    "quality": "质量问题"
  },
  "status_valuetotext": {
    "待处理": "待处理",
    "处理中": "处理中",
    "已调解": "已调解",
    "已关闭": "已关闭"
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



