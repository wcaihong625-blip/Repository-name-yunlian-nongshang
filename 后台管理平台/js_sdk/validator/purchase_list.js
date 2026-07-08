// 表单校验规则由 schema2code 生成，不建议直接修改校验规则，而建议通过 schema2code 生成, 详情: https://uniapp.dcloud.net.cn/uniCloud/schema


const validator = {
  "title": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "采购标题"
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
    "label": "产品品类"
  },
  "specifications": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "详细规格"
  },
  "quantity": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "采购数量"
  },
  "unit": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "单位"
  },
  "price": {
    "rules": [
      {
        "required": true
      },
      {
        "format": "string"
      }
    ],
    "label": "期望单价"
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
    "label": "收货地址"
  },
  "remarks": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "label": "补充说明"
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
    "label": "发布用户ID"
  },
  "publisher": {
    "rules": [
      {
        "format": "string"
      }
    ],
    "label": "发布者名称"
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
            "value": "已发布",
            "text": "已发布"
          },
          {
            "value": "已下架",
            "text": "已下架"
          }
        ]
      }
    ],
    "label": "状态"
  },
  "urgency": {
    "rules": [
      {
        "format": "string"
      },
      {
        "range": [
          {
            "value": "Normal",
            "text": "Normal"
          },
          {
            "value": "Urgent",
            "text": "Urgent"
          }
        ]
      }
    ],
    "label": "紧急程度"
  },
  "updated_date": {
    "rules": [
      {
        "format": "timestamp"
      }
    ],
    "label": "更新时间"
  },
  "publish_date": {
    "rules": [
      {
        "format": "timestamp"
      }
    ],
    "label": "发布时间"
  }
}

const enumConverter = {
  "status_valuetotext": {
    "已发布": "已发布",
    "已下架": "已下架"
  },
  "urgency_valuetotext": {
    "Normal": "Normal",
    "Urgent": "Urgent"
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
