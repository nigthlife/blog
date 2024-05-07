const config = require('./config'); // 导入配置信息
const sentryConfig = config.get('sentry');  // 从配置中获取与 Sentry 相关的配置信息
const errors = require('@tryghost/errors'); // 导入错误相关的功能

// 根据 Sentry 配置的启用状态进行条件判断
if (sentryConfig && !sentryConfig.disabled) {
    const Sentry = require('@sentry/node'); // 导入 Sentry 的 Node.js 客户端模块
    const version = require('../../package.json').version;  // 获取当前应用的版本号，从 package.json 文件中读取
    // 获取当前应用的环境配置。
    const environment = config.get('env');
    // 使用 Sentry 的初始化方法对 Sentry 进行配置
    // 包括设置 DSN（Data Source Name）、应用版本号和环境。
    Sentry.init({
        dsn: sentryConfig.dsn,
        release: 'ghost@' + version,
        environment: environment
    });

    // 将其作为模块的导出
    module.exports = {
        // 导出请求处理、错误处理，捕获异常等函数
        requestHandler: Sentry.Handlers.requestHandler(),
        errorHandler: Sentry.Handlers.errorHandler({
            shouldHandleError(error) {
                // Sometimes non-Ghost issues will come into here but they won't
                // have a statusCode so we should always handle them
                if (!errors.utils.isGhostError(error)) {
                    return true;
                }

                // Only handle 500 errors for now
                // This is because the only other 5XX error should be 503, which are deliberate maintenance/boot errors
                return (error.statusCode === 500);
            }
        }),
        captureException: Sentry.captureException
    };
} else {
    // 用于在 Sentry 未启用时作为默认的请求处理器和错误处理器。
    const expressNoop = function (req, res, next) {
        next();
    };

    // 在 Sentry 未启用时，导出函数，这些属性分别指向上述定义的空函数或空方法
    module.exports = {
        requestHandler: expressNoop,
        errorHandler: expressNoop,
        captureException: () => {}
    };
}
