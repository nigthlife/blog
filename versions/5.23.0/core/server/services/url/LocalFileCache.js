const fs = require('fs-extra');
const path = require('path');

class LocalFileCache {
    /**
     * @param {Object} options
     * @param {String} options.storagePath - 缓存存储路径
     * @param {Boolean} options.writeDisabled - 控制缓存是否可以写入
     */
    constructor({storagePath, writeDisabled}) {
        const urlsStoragePath = path.join(storagePath, 'urls.json');
        const resourcesCachePath = path.join(storagePath, 'resources.json');

        this.storagePaths = {
            urls: urlsStoragePath,
            resources: resourcesCachePath
        };
        this.writeDisabled = writeDisabled;
    }

    /**
     * 处理从文件系统读取和解析 JSON.
     * 如果文件已损坏或不存在，则返回 null。
     * @param {String} filePath path to read from
     * @returns {Promise<Object>}
     * @private
     */
    async readCacheFile(filePath) {
        let cacheExists = false;
        let cacheData = null;

        try {
            await fs.stat(filePath);
            cacheExists = true;
        } catch (e) {
            cacheExists = false;
        }

        if (cacheExists) {
            try {
                const cacheFile = await fs.readFile(filePath, 'utf8');
                cacheData = JSON.parse(cacheFile);
            } catch (e) {
                //noop，因为如果文件中有任何错误，我们将开始一个漫长的引导过程
            }
        }

        return cacheData;
    }

    /**
     *
     * @param {'urls'|'resources'} type
     * @returns {Promise<Object>}
     */
    async read(type) {
        return await this.readCacheFile(this.storagePaths[type]);
    }

    /**
     *
     * @param {'urls'|'resources'} type 要保留的数据
     * @param {Object} data - 要持久化的数据
     * @returns {Promise<Object>}
     */
    async write(type, data) {
        if (this.writeDisabled) {
            return null;
        }

        return fs.writeFile(this.storagePaths[type], JSON.stringify(data, null, 4));
    }
}

module.exports = LocalFileCache;
