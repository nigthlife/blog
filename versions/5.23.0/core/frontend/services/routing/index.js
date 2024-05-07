const registry = require('./registry');
const RouterManager = require('./router-manager');
const routerManager = new RouterManager({registry});

module.exports = {
    // 创建路由管理实例
    routerManager: routerManager,

    // 导出registry 模块的引用
    get registry() {
        return registry;
    }
};
