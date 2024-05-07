const _ = require('lodash');    // 这是 Lodash 库，用于提供各种 JavaScript 实用函数
const Promise = require('bluebird');    // 这是 Bluebird 库，用于提供 Promise 相关的功能
const errors = require('@tryghost/errors'); // 导入错误处理
const logging = require('@tryghost/logging');   // 导入日志记录
const tpl = require('@tryghost/tpl');   // 导入目标相关模块

// 用于管理 博客平台的设置和配置信息
const settingsCache = require('./settings-cache');
const config = require('./config');

// 定义了一个包含错误相关消息的对象
const messages = {
    errorMessage: 'The \\{\\{{helperName}\\}\\} helper is not available.',
    errorContext: 'The {flagName} flag must be enabled in labs if you wish to use the \\{\\{{helperName}\\}\\} helper.',
    errorHelp: 'See {url}'
};

// 定义全局启动时的功能
const GA_FEATURES = [
    'sourceAttribution',
    'memberAttribution',
    'audienceFeedback'
];


// 定义Beta阶段的功能
const BETA_FEATURES = [
    'activitypub'
];

// 定义Alpha阶段的功能  
const ALPHA_FEATURES = [
    'urlCache',
    'beforeAfterCard',
    'lexicalEditor',
    'suppressionList',
    'emailStability'
];

// 将全局启用的功能和可写入的功能列表导出为模块的属性
module.exports.GA_KEYS = [...GA_FEATURES];
module.exports.WRITABLE_KEYS_ALLOWLIST = [...BETA_FEATURES, ...ALPHA_FEATURES];

// 用于获取所有实验性功能的状态，并根据配置和环境进行一些处理后返回。
module.exports.getAll = () => {
    const labs = _.cloneDeep(settingsCache.get('labs')) || {};

    ALPHA_FEATURES.forEach((alphaKey) => {
        if (labs[alphaKey] && !(config.get('enableDeveloperExperiments') || process.env.NODE_ENV.startsWith('test'))) {
            delete labs[alphaKey];
        }
    });

    GA_FEATURES.forEach((gaKey) => {
        labs[gaKey] = true;
    });

    labs.members = settingsCache.get('members_signup_access') !== 'none';

    return labs;
};

/**
 * 用于检查指定的实验性功能是否已启用
 * @param {string} flag
 * @returns {boolean}
 */
module.exports.isSet = function isSet(flag) {
    const labsConfig = module.exports.getAll();

    return !!(labsConfig && labsConfig[flag] && labsConfig[flag] === true);
};

/**
 * 用于处理实验性功能未启用时的情况，并提供相应的错误消息和处理方式。
 * @param {object} options
 * @param {string} options.flagKey the internal lookup key of the flag e.g. labs.isSet(matchHelper)
 * @param {string} options.flagName the user-facing name of the flag e.g. Match helper
 * @param {string} options.helperName Name of the helper to be enabled/disabled
 * @param {string} [options.errorMessage] Optional replacement error message
 * @param {string} [options.errorContext] Optional replacement context message
 * @param {string} [options.errorHelp] Optional replacement help message
 * @param {string} [options.helpUrl] Url to show in the help message
 * @param {string} [options.async] is the helper async?
 * @param {function} callback
 * @returns {Promise<Handlebars.SafeString>|Handlebars.SafeString}
 */
module.exports.enabledHelper = function enabledHelper(options, callback) {
    // 用于存储错误信息和错误字符串。
    const errDetails = {};
    let errString;

    // 检查指定的实验性功能是否已启用，如果已启用，则直接调用传入的回调函数。
    if (module.exports.isSet(options.flagKey) === true) {
        // helper is active, use the callback
        return callback();
    }

    // 如果实验性功能未启用
    // 构建错误消息、上下文和帮助信息，根据传入的参数或默认信息进行替换
    errDetails.message = tpl(options.errorMessage || messages.errorMessage, {helperName: options.helperName});
    errDetails.context = tpl(options.errorContext || messages.errorContext, {
        helperName: options.helperName,
        flagName: options.flagName
    });
    // 使用模板引擎（tpl）将错误消息、上下文和帮助信息格式化为具体内容
    errDetails.help = tpl(options.errorHelp || messages.errorHelp, {url: options.helpUrl});

    // 使用 logging.error 记录错误信息，抛出一个 DisabledFeatureError 错误
    logging.error(new errors.DisabledFeatureError(errDetails));

    // 创建一个新的 SafeString 对象，其中包含一段 JavaScript 脚本用于将错误信息输出到控制台
    const {SafeString} = require('express-hbs');
    errString = new SafeString(`<script>console.error("${_.values(errDetails).join(' ')}");</script>`);

    if (options.async) {
        return Promise.resolve(errString);
    }

    return errString;
};

// 用于作为中间件处理器，检查指定的实验性功能是否已启用，如果未启用则抛出一个 NotFoundError。
module.exports.enabledMiddleware = flag => (req, res, next) => {
    if (module.exports.isSet(flag) === true) {
        return next();
    } else {
        return next(new errors.NotFoundError());
    }
};
