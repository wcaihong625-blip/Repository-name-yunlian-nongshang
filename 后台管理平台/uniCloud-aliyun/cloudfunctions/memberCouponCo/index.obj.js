'use strict';

const generate = require('./handlers/generate');
const list = require('./handlers/list');
const useLog = require('./handlers/useLog');
const validate = require('./handlers/validate');
const setStatus = require('./handlers/setStatus');
const redeem = require('./handlers/redeem');

module.exports = {
  _before() {},

  async generate(event = {}, context) {
    return generate(event, context);
  },

  async list(event = {}, context) {
    return list(event, context);
  },

  async useLog(event = {}, context) {
    return useLog(event, context);
  },

  async validate(event = {}, context) {
    return validate(event, context);
  },

  async setStatus(event = {}, context) {
    return setStatus(event, context);
  },

  async redeem(event = {}, context) {
    return redeem(event, context);
  }
};
