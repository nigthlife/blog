const debug = require('@tryghost/debug')('shared:express'); // 导入 debug 的模块，并创建了一个调试器实例。这个调试器可以用于在开发过程中输出日志和调试信息。
const express = require('express'); // 导入 Express 框架模块
const { createLazyRouter } = require('express-lazy-router');  // 用于创建一个支持懒加载的 Express 路由
const sentry = require('./sentry'); // 用于错误追踪和日志记录。

// 创建一个懒加载路由的实例。
const lazyLoad = createLazyRouter();

// 定义函数，该函数用于创建一个 Express 应用实例
module.exports = (name) => {
    // 创建了一个 Express 应用实例，并设置了应用的名称
    debug('new app start', name);
    const app = express();
    app.set('name', name);

    // 启用对代理请求的安全验证
    app.enable('trust proxy');

    // 将 sentry.errorHandler 中间件作为第一个错误处理器。
    app.use(sentry.errorHandler);

    // 该方法用于进行懒加载的中间件使用，接受一个挂载路径和一个要懒加载的中间件模块的函数
    app.lazyUse = function lazyUse(mountPath, requireFn) {
        app.use(mountPath, lazyLoad(() => {
            debug(`lazy-loading on ${mountPath}`);
            return Promise.resolve(requireFn());
        }));
    };

    debug('new app end', name);
    return app;
};


// 用于创建一个 Express 路由实例
// This is mostly an experiment, and can likely be removed soon
module.exports.Router = (name, options) => {
    // 函数中，创建了一个 Express 路由实例，并将 sentry.errorHandler 中间件作为错误处理器。
    debug('new Router start', name);
    const router = express.Router(options);

    router.use(sentry.errorHandler);

    debug('new Router end', name);
    return router;
};

module.exports.static = express.static;

// Export the OG module for testing based on the internals
// 将原始的 Express 模块导出，以便在测试时可以访问内部功能。
module.exports._express = express;
