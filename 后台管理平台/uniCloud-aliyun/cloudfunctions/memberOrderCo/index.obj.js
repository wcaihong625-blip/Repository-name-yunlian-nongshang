'use strict';

const myOrders = require('./handlers/myOrders');
const detail = require('./handlers/detail');
const addRemark = require('./handlers/addRemark');
const remarks = require('./handlers/remarks');
const updateHandleStatus = require('./handlers/updateHandleStatus');
const deletePendingOrder = require('./handlers/deletePendingOrder');

module.exports = {
  _before() {},

  async myOrders(event = {}, context) {
    return myOrders(event, context);
  },

  async detail(event = {}, context) {
    return detail(event, context);
  },

  async addRemark(event = {}, context) {
    return addRemark(event, context);
  },

  async remarks(event = {}, context) {
    return remarks(event, context);
  },

  async updateHandleStatus(event = {}, context) {
    return updateHandleStatus(event, context);
  },

  async deletePendingOrder(event = {}, context) {
    return deletePendingOrder(event, context);
  }
};
