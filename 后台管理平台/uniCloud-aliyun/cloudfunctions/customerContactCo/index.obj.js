'use strict';

const add = require('./handlers/add');
const remove = require('./handlers/remove');
const updateNote = require('./handlers/updateNote');
const list = require('./handlers/list');
const getProcurementContact = require('./handlers/getProcurementContact');

module.exports = {
  _before() {},

  async add(event = {}, context) {
    return add(event, context);
  },

  async remove(event = {}, context) {
    return remove(event, context);
  },

  async updateNote(event = {}, context) {
    return updateNote(event, context);
  },

  async list(event = {}, context) {
    return list(event, context);
  },

  async getProcurementContact(event = {}, context) {
    return getProcurementContact(event, context);
  }
};
