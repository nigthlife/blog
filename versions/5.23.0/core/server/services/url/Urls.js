const _ = require('lodash');
const debug = require('@tryghost/debug')('services:url:urls');
const urlUtils = require('../../../shared/url-utils');
const logging = require('@tryghost/logging');
const errors = require('@tryghost/errors');

// 这会发出自己的 url 添加/删除事件
const events = require('../../lib/common/events');

/**
  * 此类跟踪系统中的所有 url。
  * 每个资源都有一个 url。 每个 url 都由一个 url generator id 拥有。
  * 这是 url 生成器和资源的连接器。
  * 默认存储相对 url。
  *
  * 我们必须有一个集中的地方来跟踪所有的 url，否则
  * 我们永远不会知道我们是否两次生成相同的 url。 此外，它更容易
  * 如果你想要一个资源的 url 而不是询问一个集中的类实例
  * 遍历所有 url 生成器并请求它。
  * 你可以很容易地询问 `this.urls[resourceId]`。
  */
class Urls {
    /**
     *
     * @param {Object} [options]
     * @param {Object} [options.urls] 可用 URL 与其资源的映射
     */
    constructor({urls = {}} = {}) {
        this.urls = urls;
    }

    /**
     * @description 向系统添加一个 url。
     * @param {Object} options
     */
    add(options) {
        const url = options.url;
        const generatorId = options.generatorId;
        const resource = options.resource;

        debug('cache', url);

        if (this.urls[resource.data.id]) {
            logging.error(new errors.InternalServerError({
                message: 'This should not happen.',
                code: 'URLSERVICE_RESOURCE_DUPLICATE'
            }));

            this.removeResourceId(resource.data.id);
        }

        this.urls[resource.data.id] = {
            url: url,
            generatorId: generatorId,
            resource: resource
        };

        // @注意：通知整个系统。 目前用于站点地图服务
        events.emit('url.added', {
            url: {
                relative: url,
                absolute: urlUtils.createUrl(url, true)
            },
            resource: resource
        });
    }

    /**
     * @description 通过资源 id 获取 url。
     * @param {String} id
     * @returns {Object}
     */
    getByResourceId(id) {
        return this.urls[id];
    }

    /**
     * @description 通过生成器 id 获取所有 url。
     * @param {String} generatorId
     * @returns {Array}
     */
    getByGeneratorId(generatorId) {
        return _.reduce(Object.keys(this.urls), (toReturn, resourceId) => {
            if (this.urls[resourceId].generatorId === generatorId) {
                toReturn.push(this.urls[resourceId]);
            }

            return toReturn;
        }, []);
    }

    /**
     * @description Get by url.
     *
     * @NOTE:
     * It's is in theory possible that:
     *
     *  - resource1 -> /welcome/
     *  - resource2 -> /welcome/
     *
     *  But depending on the routing registration, you will always serve e.g. resource1,
     *  because the router it belongs to was registered first.
     */
    getByUrl(url) {
        return _.reduce(Object.keys(this.urls), (toReturn, resourceId) => {
            if (this.urls[resourceId].url === url) {
                toReturn.push(this.urls[resourceId]);
            }

            return toReturn;
        }, []);
    }

    /**
     * @description Remove url.
     * @param id
     */
    removeResourceId(id) {
        if (!this.urls[id]) {
            return;
        }

        debug('removed', this.urls[id].url, this.urls[id].generatorId);

        events.emit('url.removed', {
            url: this.urls[id].url,
            resource: this.urls[id].resource
        });

        delete this.urls[id];
    }

    /**
     * @description 重置实例.
     */
    reset() {
        this.urls = {};
    }

    /**
     * @description 软复位实例.
     */
    softReset() {
        this.urls = {};
    }
}

module.exports = Urls;
