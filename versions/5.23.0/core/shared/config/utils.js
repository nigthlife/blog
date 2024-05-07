const path = require('path');
const fs = require('fs-extra');
const _ = require('lodash');

/**
 * 将所有相对路径转换为绝对路径
 * @TODO: re-write this function a little bit so we don't have to add the parent path - that is hard to understand
 *
 * Path must be string.
 * Path must match minimum one / or \
 * Path can be a "." to re-present current folder
 */
// 使路径绝对化
const makePathsAbsolute = function makePathsAbsolute(nconf, obj, parent) {
    _.each(obj, function (configValue, pathsKey) {
        if (_.isObject(configValue)) {
            makePathsAbsolute(nconf, configValue, parent + ':' + pathsKey);
        } else if (
            _.isString(configValue) &&
            (configValue.match(/\/+|\\+/) || configValue === '.') &&
            !path.isAbsolute(configValue)
        ) {
            nconf.set(parent + ':' + pathsKey, path.normalize(path.join(__dirname, '../../..', configValue)));
        }
    });
};

// 内容路径是否存在
const doesContentPathExist = function doesContentPathExist(contentPath) {
    if (!fs.pathExistsSync(contentPath)) {
        // 
        // @TODO: revisit this decision when @tryghost/error is no longer dependent on all of ghost-ignition
        // eslint-disable-next-line no-restricted-syntax
        throw new Error('Your content path does not exist! Please double check `paths.contentPath` in your custom config file e.g. config.production.json.');
    }
};

/**
* 检查配置中的 URL 是否有协议，如果不包括应该更改的警告，则对其进行清理
*/
const checkUrlProtocol = function checkUrlProtocol(url) {
    if (!url.match(/^https?:\/\//i)) {
        // new Error is allowed here, as we do not want config to depend on @tryghost/error
        // @TODO: revisit this decision when @tryghost/error is no longer dependent on all of ghost-ignition
        // eslint-disable-next-line no-restricted-syntax
        throw new Error('URL in config must be provided with protocol, eg. "http://my-ghost-blog.com"');
    }
};

/**
 * nconf merges all database keys together and this can be confusing
 * e.g. production default database is sqlite, but you override the configuration with mysql
 *  nconf 将所有数据库键合并在一起，这可能会造成混淆
 *  例如 生产默认数据库是 sqlite，但是你用 mysql 覆盖配置
 * this.clear('key') does not work
 * https://github.com/indexzero/nconf/issues/235#issuecomment-257606507
 */
const sanitizeDatabaseProperties = function sanitizeDatabaseProperties(nconf) {
    if (nconf.get('database:client') === 'mysql') {
        nconf.set('database:client', 'mysql2');
    }

    const database = nconf.get('database');

    if (nconf.get('database:client') === 'mysql2') {
        delete database.connection.filename;
    } else {
        delete database.connection.host;
        delete database.connection.user;
        delete database.connection.password;
        delete database.connection.database;
    }

    nconf.set('database', database);

    if (nconf.get('database:client') === 'sqlite3') {
        makePathsAbsolute(nconf, nconf.get('database:connection'), 'database:connection');
    }
};

module.exports = {
    makePathsAbsolute,
    doesContentPathExist,
    checkUrlProtocol,
    sanitizeDatabaseProperties
};
