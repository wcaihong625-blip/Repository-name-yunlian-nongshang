"use strict";
const fs = require("fs");
const path = require("path");

function merge(target, source) {
	if (!source) return target;
	Object.keys(source).forEach(key => {
		if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
			if (!target[key] || typeof target[key] !== 'object' || Array.isArray(target[key])) {
				target[key] = {};
			}
			merge(target[key], source[key]);
		} else {
			target[key] = source[key];
		}
	});
	return target;
}

class Config {
	constructor({
		pluginId,
		defaultConfig = {},
		customMerge,
		root
	}) {
		this.pluginId = pluginId;
		this.defaultConfig = defaultConfig;
		this.pluginConfigPath = path.resolve(root || __dirname, pluginId);
		this.customMerge = customMerge;
		this._config = undefined;
	}

	resolve(fileName) {
		return path.resolve(this.pluginConfigPath, fileName);
	}

	hasFile(fileName) {
		return fs.existsSync(this.resolve(fileName));
	}

	requireFile(fileName) {
		try {
			return require(this.resolve(fileName));
		} catch (e) {
			if (e.code === 'MODULE_NOT_FOUND') return;
			throw e;
		}
	}

	_getUserConfig() {
		if (this.hasFile("config.js")) {
			return this.requireFile("config.js");
		}
		return this.requireFile("config.json");
	}

	config(key, defaultValue) {
		if (!this._config) {
			const userConfig = this._getUserConfig();
			this._config = Array.isArray(userConfig) ? userConfig : (this.customMerge || merge)(this.defaultConfig,
				userConfig);
		}
		let config = this._config;
		if (!key) return config;

		const keys = key.split('.');
		let result = config;
		for (const k of keys) {
			if (result && Object.prototype.hasOwnProperty.call(result, k)) {
				result = result[k];
			} else {
				return defaultValue;
			}
		}
		return result;
	}
}

const configCenter = new class {
	constructor() {
		this._configMap = new Map();
	}
	plugin({
		pluginId,
		defaultConfig,
		customMerge,
		root = __dirname,
		cache = true
	}) {
		if (this._configMap.has(pluginId) && cache) {
			return this._configMap.get(pluginId);
		}
		const config = new Config({
			pluginId,
			defaultConfig,
			customMerge,
			root
		});
		if (cache) this._configMap.set(pluginId, config);
		return config;
	}
}();

module.exports = configCenter.plugin.bind(configCenter);
