const sentry = require('./shared/sentry');      // 用于错误追踪和日志记录。
const express = require('./shared/express');    // 包含 Express 框架的配置和中间件设置
const config = require('./shared/config');      // 包含应用程序的配置信息。
const urlService = require('./server/services/url');    // 处理 URL 相关逻辑的服务。

// 导入 Node.js 内置的文件系统模块和路径处理模块
const fs = require('fs');
const path = require('path');

// 用于检查是否启用了维护模式。根据请求对象、配置文件中的维护模式设置以及 URL 服务的状态来判断是否处于维护模式
const isMaintenanceModeEnabled = (req) => {
    if (req.app.get('maintenance') || config.get('maintenance').enabled || !urlService.hasFinished()) {
        return true;
    }

    return false;
};

// 中间件函数，用于处理维护模式下的请求。如果处于维护模式，则设置响应头信息，返回状态码503，并返回维护页面的内容。
const maintenanceMiddleware = (req, res, next) => {
    if (!isMaintenanceModeEnabled(req)) {
        return next();
    }

    res.set({
        'Cache-Control': 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0'
    });
    res.writeHead(503, {'content-type': 'text/html'});
    fs.createReadStream(path.resolve(__dirname, './server/views/maintenance.html')).pipe(res);
};

// 用于创建根 Express 应用。在该函数中，创建了一个 Express 应用实例，
// 设置了哨兵请求处理器中间件、启用了维护模式，并使用了之前定义的维护模式中间件
const rootApp = () => {
    const app = express('root');
    app.use(sentry.requestHandler);

    app.enable('maintenance');
    app.use(maintenanceMiddleware);

    return app;
};

// 将 rootApp 函数导出，使其可以被其他模块引入和使用。
module.exports = rootApp;
