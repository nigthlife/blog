const config = require('./core/shared/config');
const ghostVersion = require('@tryghost/version');

/**
 * 
 * 包含一些在 服务器中进行全局覆盖操作的代码逻辑
 */
require('./core/server/overrides');

// 将一个对象导出为模块的默认导出
module.exports = {
    // 当前安全版本。
    currentVersion: ghostVersion.safe,
    // 获取数据库连接信息。
    database: config.get('database'),
    // 取数据库迁移文件的路径
    migrationPath: config.get('paths:migrationPath')
};
