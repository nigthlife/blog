/**
 * We call notify server started when the server is ready to serve traffic
 * When the server is started, but not ready, it is only able to serve 503s
 *
 * If the server isn't able to reach started, notifyServerStarted is called with an error
 * A status message, any error, and debug info are all passed to managing processes via IPC and the bootstrap socket
 */

//所需的 Ghost 内部结构
const config = require('../shared/config');

let notified = {
    started: false,
    ready: false
};

const debugInfo = {
    versions: process.versions,
    platform: process.platform,
    arch: process.arch,
    release: process.release
};

async function notify(type, error = null) {
    // 如果我们已经发送了此通知，则不应再发送
    if (notified[type]) {
        return;
    }

    // 将此函数标记为已调用
    notified[type] = true;

    // 构建我们的信息
    // - 如果出现错误，则服务器尚未准备好，请包含错误
    // - 如果没有错误则服务器已启动
    let message = {};
    if (error) {
        message[type] = false;
        message.error = error;
    } else {
        message[type] = true;
    }
    // 将调试信息添加到消息中
    message.debug = debugInfo;

    // 案例：本地进程管理器与 CLI 的 IPC 通信
    if (process.send) {
        process.send(message);
    }

    // 案例：使用引导套接字与 systemd 的 CLI 进行通信
    let socketAddress = config.get('bootstrap-socket');
    if (socketAddress) {
        const bootstrapSocket = require('@tryghost/bootstrap-socket');
        return bootstrapSocket.connectAndSend(socketAddress, message);
    }

    return Promise.resolve();
}

module.exports.notifyServerStarted = async function (error = null) {
    return await notify('started', error);
};

module.exports.notifyServerReady = async function (error = null) {
    return await notify('ready', error);
};
