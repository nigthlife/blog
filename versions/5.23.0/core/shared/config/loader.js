const Nconf = require('nconf'); // 使用 Nconf 库来加载和管理配置信息
const path = require('path');  // 这是 Node.js 提供的用于处理文件路径的模块
const _debug = require('@tryghost/debug')._base;  // 处理调试信息的模块
const debug = _debug('ghost:config');   // 输出调试信息的函数,并指定调试信息的标识符
const localUtils = require('./utils');  // 引入工具模块
const helpers = require('./helpers');   // 引入辅助模块
const urlHelpers = require('@tryghost/config-url-helpers'); // 处理 URL 相关操作的库。
const env = process.env.NODE_ENV || 'development'; // 获取环境变量 NODE_ENV 的值,默认开发环境

/**
 * @param {object} options
 * @returns {Nconf.Provider & urlHelpers.BoundHelpers & helpers.ConfigHelpers}
 */
function loadNconf(options) {
    // 输出调试信息
    debug('config start');
    // 如果未提供 options 参数，则将其设为一个空对象
    options = options || {};

    const baseConfigPath = options.baseConfigPath || __dirname;
    const customConfigPath = options.customConfigPath || process.cwd();
    const nconf = new Nconf.Provider();

    // ## 加载配置

    // 加载覆盖文件
    nconf.file('overrides', path.join(baseConfigPath, 'overrides.json'));

    // 加载命令行参数
    nconf.argv();
    nconf.env({separator: '__', parseValues: true});

    // 加载各种配置 json 文件
    nconf.file('custom-env', path.join(customConfigPath, 'config.' + env + '.json'));
    if (env !== 'testing') {
        nconf.file('local-env', path.join(customConfigPath, 'config.local.json'));
    }
    nconf.file('default-env', path.join(baseConfigPath, 'env', 'config.' + env + '.json'));

    // 加载默认配置json文件
    nconf.file('defaults', path.join(baseConfigPath, 'defaults.json'));

    // ##  配置方法

    // 公开动态实用程序方法
    urlHelpers.bindAll(nconf);
    helpers.bindAll(nconf);

    // ## 消毒配置

    // 将所有相对路径转换为绝对路径
    localUtils.makePathsAbsolute(nconf, nconf.get('paths'), 'paths');


    // 为 Ghost-CLI 转换 sqlite 文件名路径
    localUtils.sanitizeDatabaseProperties(nconf);


    // 检查config中的URL是否有协议
    localUtils.checkUrlProtocol(nconf.get('url'));

    // 确保内容路径存在
    localUtils.doesContentPathExist(nconf.get('paths:contentPath'));

    // ## 其他的东西，设置环境变量值。

    // 手动设置值
    nconf.set('env', env);

    // Wrap this in a check, because else nconf.get() is executed unnecessarily
    // To output this, use DEBUG=ghost:*,ghost-config
    if (_debug.enabled('ghost-config')) {
        debug(nconf.get());
    }
    // 输出调试信息，表示配置加载结束
    debug('config end');
    return nconf;
}
// 将 loadNconf 函数作为模块的导出
module.exports.loadNconf = loadNconf;
