'use strict';

const generate = require('./handlers/generate');
const confirm = require('./handlers/confirm');
const preview = require('./handlers/preview');
const list = require('./handlers/list');
const detail = require('./handlers/detail');
const exportList = require('./handlers/exportList');
const exportDetail = require('./handlers/exportDetail');

module.exports = {
  _before() {},

  async generate(event = {}, context) {
    return generate(event, context);
  },

  async confirm(event = {}, context) {
    return confirm(event, context);
  },

  async preview(event = {}, context) {
    return preview(event, context);
  },

  async list(event = {}, context) {
    return list(event, context);
  },

  async detail(event = {}, context) {
    return detail(event, context);
  },

  async exportList(event = {}, context) {
    return exportList(event, context);
  },

  async exportDetail(event = {}, context) {
    return exportDetail(event, context);
  }
};
