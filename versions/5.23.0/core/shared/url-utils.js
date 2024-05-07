const UrlUtils = require('@tryghost/url-utils');    // 用于处理 URL 相关操作的自定义模块。
const config = require('./config'); // 用于获取配置信息。

// 定义了一个常量 BASE_API_PATH，表示博客平台的 API 基础路径
const BASE_API_PATH = '/ghost/api';

// 实例化对象，并传入了一个包含配置信息的对象，
// 包括获取子目录、站点 URL、管理员 URL、slug 配置、重定向缓存最大年龄和基础 API 路径。
const urlUtils = new UrlUtils({
    getSubdir: config.getSubdir,
    getSiteUrl: config.getSiteUrl,  
    getAdminUrl: config.getAdminUrl,
    slugs: config.get('slugs').protected,
    redirectCacheMaxAge: config.get('caching:301:maxAge'),
    baseApiPath: BASE_API_PATH
});

// 对象导出
module.exports = urlUtils;
// 基础API导出
module.exports.BASE_API_PATH = BASE_API_PATH;
