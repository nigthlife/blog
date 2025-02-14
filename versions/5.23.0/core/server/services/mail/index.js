const path = require('path');
const urlUtils = require('../../../shared/url-utils');
const settingsCache = require('../../../shared/settings-cache');
const EmailContentGenerator = require('@tryghost/email-content-generator');

/**
 *  创建应该邮件内容生成实例 
 *  并：获取站点的 URL 地址、获取站点的标题信息、邮件模板所在的目录路径
 */ 
const emailContentGenerator = new EmailContentGenerator({
    getSiteUrl: () => urlUtils.urlFor('home', true),
    getSiteTitle: () => settingsCache.get('title'),
    templatesDir: path.resolve(__dirname, '..', 'mail', 'templates')
});

exports.GhostMailer = require('./GhostMailer');
exports.utils = {
    generateContent: emailContentGenerator.getContent.bind(emailContentGenerator)
};
