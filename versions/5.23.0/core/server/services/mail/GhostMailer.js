// # Mail
// Handles sending email for Ghost
const _ = require('lodash');
const validator = require('@tryghost/validator');
const config = require('../../../shared/config');
const errors = require('@tryghost/errors');
const tpl = require('@tryghost/tpl');
const settingsCache = require('../../../shared/settings-cache');
const urlUtils = require('../../../shared/url-utils');
const metrics = require('@tryghost/metrics');

/**
 * 定义一些常量消息文本包括：邮件标题、配置指南链接、发送失败错误信息等。
 */
const messages = {
    title: 'Ghost at {domain}',
    checkEmailConfigInstructions: 'Please see {url} for instructions on configuring email.',
    failedSendingEmailError: '发送电子邮件失败.',
    incompleteMessageDataError: '消息数据不完整.',
    reason: ' Reason: {reason}.',
    messageSent: '消息已发送。 仔细检查收件箱和垃圾邮件文件夹！'
};

/**
 * 从网站地址中获取域名部分
 * @returns 
 */
function getDomain() {
    const domain = urlUtils.urlFor('home', true).match(new RegExp('^https?://([^/:?#]+)(?:[/:?#]|$)', 'i'));
    return domain && domain[1];
}

/**
 * 用于获取发件人地址，如果未指定则使用配置中的默认地址，如果都不存在则使用默认的 noreply 地址
 * @param {*} requestedFromAddress 
 * @returns 邮箱地址
 */
function getFromAddress(requestedFromAddress) {
    const configAddress = config.get('mail') && config.get('mail').from;

    const address = requestedFromAddress || configAddress;
    // If we don't have a from address at all
    if (!address) {
        // Default to noreply@[blog.url]
        return getFromAddress(`noreply@${getDomain()}`);
    }

    // If we do have a from address, and it's just an email
    if (validator.isEmail(address, {require_tld: false})) {
        const defaultSiteTitle = settingsCache.get('title') ? settingsCache.get('title').replace(/"/g, '\\"') : tpl(messages.title, {domain: getDomain()});
        return `"${defaultSiteTitle}" <${address}>`;
    }

    return address;
}

/**
 * 创建邮件消息对象，设置发件人地址、内容生成方式和编码方式
 * @param {Object} message
 * @param {boolean} [message.forceTextContent] - 强制文本内容
 * @param {string} [message.from] - 发件人电子邮件地址
 * @returns {Object}
 */
function createMessage(message) {
    const encoding = 'base64';
    const generateTextFromHTML = !message.forceTextContent;
    return Object.assign({}, message, {
        from: getFromAddress(message.from),
        generateTextFromHTML,
        encoding
    });
}

/**
 * 创建邮件发送错误的对象，包括错误信息、状态码和帮助信息
 * @param {*} param0 
 * @returns 
 */
function createMailError({message, err, ignoreDefaultMessage} = {message: ''}) {
    const helpMessage = tpl(messages.checkEmailConfigInstructions, {url: 'https://ghost.org/docs/config/#mail'});
    const defaultErrorMessage = tpl(messages.failedSendingEmailError);

    const fullErrorMessage = defaultErrorMessage + message;
    let statusCode = (err && err.name === 'RecipientError') ? 400 : 500;
    return new errors.EmailError({
        message: ignoreDefaultMessage ? message : fullErrorMessage,
        err: err,
        statusCode,
        help: helpMessage
    });
}

/**
 * 
 */
module.exports = class GhostMailer {
    // 构造函数中初始化了邮件传输工具（nodemailer）并根据配置设置使用的传输方式
    constructor() {
        const nodemailer = require('@tryghost/nodemailer');

        let transport = config.get('mail') && config.get('mail').transport || 'direct';
        transport = transport.toLowerCase();

        // nodemailer 改变传递给 createTransport 的选项
        const options = config.get('mail') && _.clone(config.get('mail').options) || {};

        this.state = {
            usingDirect: transport === 'direct',
            usingMailgun: transport === 'mailgun'
        };
        this.transport = nodemailer(transport, options);
    }

    /**
     * 用于实际发送邮件，首先检查消息是否完整，然后创建邮件消息对象并调用 sendMail(message) 方法发送邮件
     * @param {Object} message
     * @param {string} message.subject - 电子邮件主题
     * @param {string} message.html - 邮件内容
     * @param {string} message.to - 邮件回复地址
     * @param {string} [message.from] - 邮件发送地址
     * @param {string} [message.text] - 此消息的文本版本
     * @param {boolean} [message.forceTextContent] - 映射到generateTextFromHTML nodemailer选项
     * 即：“如果设置为 true，则如果未定义文本，则使用 HTML 从 HTML 生成纯文本正文部分"
     * (ref: https://github.com/nodemailer/nodemailer/tree/da2f1d278f91b4262e940c0b37638e7027184b1d#e-mail-message-fields)
     * @returns {Promise<any>}
     */
    async send(message) {
        if (!(message && message.subject && message.html && message.to)) {
            throw createMailError({
                message: tpl(messages.incompleteMessageDataError),
                ignoreDefaultMessage: true
            });
        }

        const messageToSend = createMessage(message);

        const response = await this.sendMail(messageToSend);

        if (this.state.usingDirect) {
            return this.handleDirectTransportResponse(response);
        }

        return response;
    }

    async sendMail(message) {
        const startTime = Date.now();
        try {
            const response = await this.transport.sendMail(message);
            if (this.state.usingMailgun) {
                metrics.metric('mailgun-send-transactional-mail', {
                    value: Date.now() - startTime,
                    statusCode: 200
                });
            }

            return response;
        } catch (err) {
            if (this.state.usingMailgun) {
                metrics.metric('mailgun-send-transactional-mail', {
                    value: Date.now() - startTime,
                    statusCode: err.status
                });
            }
            throw createMailError({
                message: tpl(messages.reason, {reason: err.message || err}),
                err
            });
        }
    }

    /**
     * 用于处理直接传输方式的响应，检查是否有错误或邮件被拒绝，并返回相应的消息
     * @param {*} response 
     * @returns 
     */
    handleDirectTransportResponse(response) {
        if (!response) {
            return tpl(messages.messageSent);
        }

        if (response.pending.length > 0) {
            throw createMailError({
                message: tpl(messages.reason, {reason: 'Email has been temporarily rejected'})
            });
        }

        if (response.errors.length > 0) {
            throw createMailError({
                message: tpl(messages.reason, {reason: response.errors[0].message})
            });
        }

        return tpl(messages.messageSent);
    }
};
