const _debug = require('@tryghost/debug')._base;
const debug = _debug('ghost:services:url:service');
const _ = require('lodash');
const errors = require('@tryghost/errors');
const labs = require('../../../shared/labs');
const UrlGenerator = require('./UrlGenerator');
const Queue = require('./Queue');
const Urls = require('./Urls');
const Resources = require('./Resources');
const urlUtils = require('../../../shared/url-utils');

/**
  * url 服务类将所有实例集中在一个地方。
  * 这是您可以与之交谈的公共 API。
  * 它会告诉你 url 生成是否正在进行。
  */
class UrlService {
    /**
     *
     * @param {Object} options
     * @param {Object} [options.cache] - 缓存处理程序实例
     * @param {Function} [options.cache.read] - 按类型读取缓存
     * @param {Function} [options.cache.write] - 按类型写入缓存
     */
    constructor({cache} = {}) {
        this.utils = urlUtils;
        this.cache = cache;
        this.onFinished = null;
        this.finished = false;
        this.urlGenerators = [];

        // Get urls
        this.queue = new Queue();
        // 注意：Urls 和 Resources 不应该在这里初始化，而只能在 init 方法中初始化。
        // 如果初始化被移除，那么太多的测试会失败，所以暂时保留它
        this.urls = new Urls();
        this.resources = new Resources({
            queue: this.queue
        });

        this._listeners();
    }

    /**
     * @description 为这个实例注册监听器的辅助函数.
     * @private
     */
    _listeners() {
        this._onQueueStartedListener = this._onQueueStarted.bind(this);
        this.queue.addListener('started', this._onQueueStartedListener);

        this._onQueueEndedListener = this._onQueueEnded.bind(this);
        this.queue.addListener('ended', this._onQueueEnded.bind(this));
    }

    /**
     * @description 如果队列以事件开始，队列将通知我们。
     *
     * “init”事件基本上是引导事件，如果是 url 生成，它是 siganliser
     * 是否正在进行中。
     *
     * @param {String} event
     * @private
     */
    _onQueueStarted(event) {
        if (event === 'init') {
            this.finished = false;
        }
    }

    /**
     * @description 如果队列以事件结束，队列将通知我们.
     * @param {String} event
     * @private
     */
    _onQueueEnded(event) {
        if (event === 'init') {
            this.finished = true;
            if (this.onFinished) {
                this.onFinished();
            }
        }
    }

    /**
     * @description 路由器已创建，将其与 url 生成器连接.
     * @param {String} identifier 前端路由器 ID 参考
     * @param {String} filter NQL过滤器
     * @param {String} resourceType
     * @param {String} permalink
     */
    onRouterAddedType(identifier, filter, resourceType, permalink) {
        debug('Registering route: ', filter, resourceType, permalink);

        let urlGenerator = new UrlGenerator({
            identifier,
            filter,
            resourceType,
            permalink,
            queue: this.queue,
            resources: this.resources,
            urls: this.urls,
            position: this.urlGenerators.length
        });
        this.urlGenerators.push(urlGenerator);
    }

    /**
     * @description 路由器更新处理程序 - 重新生成它的资源
     * @param {String} identifier 链接到 UrlGenerator 的路由器 ID
     */
    onRouterUpdated(identifier) {
        const generator = this.urlGenerators.find(g => g.identifier === identifier);
        generator.regenerateResources();
    }

    /**
     * @description 通过 url 获取资源。
     *
     * 你有一个 url，想知道这个 url 属于哪个。
     *
     * 理论上可能多个资源生成相同的 url，
     * 但它们都将提供不同的内容。
     *
     * 例如 如果我们删除 slug 的唯一性并且你创建一个静态的
     * page and a post with the same slug. And both are served under `/` with the permalink `/:slug/`.
     * 页面和具有相同 slug 的帖子。 两者都在 `/` 下使用永久链接 `/:slug/` 提供
     *
     * 每个 url 都是唯一的，它取决于配置的路由器注册层次结构.
     * 没有url冲突，一切取决于注册顺序.
     *
     * e.g. 集合中的帖子比静态页面更强大.
     *
     * 我们只返回将被提供的资源。
     *
     * @NOTE: 目前只接受相对 url。
     *
     * @param {String} url
     * @param {Object} options
     * @returns {Object}
     */
    getResource(url, options) {
        options = options || {};

        let objects = this.urls.getByUrl(url);

        if (!objects.length) {
            if (!this.hasFinished()) {
                throw new errors.InternalServerError({
                    message: 'UrlService is processing.',
                    code: 'URLSERVICE_NOT_READY'
                });
            } else {
                return null;
            }
        }

        if (objects.length > 1) {
            objects = _.reduce(objects, (toReturn, object) => {
                if (!toReturn.length) {
                    toReturn.push(object);
                } else {
                    const i1 = _.findIndex(this.urlGenerators, {uid: toReturn[0].generatorId});
                    const i2 = _.findIndex(this.urlGenerators, {uid: object.generatorId});

                    if (i2 < i1) {
                        toReturn = [];
                        toReturn.push(object);
                    }
                }

                return toReturn;
            }, []);
        }

        if (options.returnEverything) {
            return objects[0];
        }

        return objects[0].resource;
    }

    /**
     * @description 通过id获取资源。
     * @param {String} resourceId
     * @returns {Object}
     */
    getResourceById(resourceId) {
        const object = this.urls.getByResourceId(resourceId);

        if (!object) {
            throw new errors.NotFoundError({
                message: 'Resource not found.',
                code: 'URLSERVICE_RESOURCE_NOT_FOUND'
            });
        }

        return object.resource;
    }

    /**
     * @description 弄清楚 url 生成是否正在进行中。
     * @returns {boolean}
     */
    hasFinished() {
        return this.finished;
    }

    /**
     * @description Get url by resource id.
     *
     * 如果我们找不到一个 id 的 url，我们必须返回一个 url。
     * Ghost 中有很多组件调用 `getUrlByResourceId` 和
     * 基于返回值，他们将资源 url 设置在某处，例如 元数据。
     * 或者，如果您在 yaml 文件中未定义集合并提供页面。
     * 您会看到帖子的建议，但它们都不属于某个收藏集。
     * 他们会显示 localhost:2368/null/。
     *
     * @param {String} id
     * @param {Object} options
     * @param {Object} [options.absolute]
     * @param {Object} [options.withSubdirectory]
     * @returns {String}
     */
    getUrlByResourceId(id, options) {
        options = options || {};

        const obj = this.urls.getByResourceId(id);

        if (obj) {
            if (options.absolute) {
                return this.utils.createUrl(obj.url, options.absolute);
            }

            if (options.withSubdirectory) {
                return this.utils.createUrl(obj.url, false, true);
            }

            return obj.url;
        }

        if (options.absolute) {
            return this.utils.createUrl('/404/', options.absolute);
        }

        if (options.withSubdirectory) {
            return this.utils.createUrl('/404/', false);
        }

        return '/404/';
    }

    /**
     * @description Check whether a router owns a resource id.
     * @param {String} routerId
     * @param {String} id
     * @returns {boolean}
     */
    owns(routerId, id) {
        debug('owns', routerId, id);

        let urlGenerator;

        this.urlGenerators.every((_urlGenerator) => {
            if (_urlGenerator.identifier === routerId) {
                urlGenerator = _urlGenerator;
                return false;
            }

            return true;
        });

        if (!urlGenerator) {
            return false;
        }

        return urlGenerator.hasId(id);
    }

    /**
     * @description Get permlink structure for url.
     * @param {String} url
     * @param {object} options
     * @returns {*}
     */
    getPermalinkByUrl(url, options) {
        options = options || {};

        const object = this.getResource(url, {returnEverything: true});

        if (!object) {
            return null;
        }

        const permalink = _.find(this.urlGenerators, {uid: object.generatorId}).permalink;

        if (options.withUrlOptions) {
            return urlUtils.urlJoin(permalink, '/:options(edit)?/');
        }

        return permalink;
    }

    /**
     * @description Initializes components needed for the URL Service to function
     * @param {Object} options
     * @param {Function} [options.onFinished] - callback when url generation is finished
     * @param {Boolean} [options.urlCache] - whether to init using url cache or not
     */
    async init({onFinished, urlCache} = {}) {
        this.onFinished = onFinished;

        let persistedUrls;
        let persistedResources;

        if (this.cache && (labs.isSet('urlCache') || urlCache)) {
            persistedUrls = await this.cache.read('urls');
            persistedResources = await this.cache.read('resources');
        }

        if (persistedUrls && persistedResources) {
            this.urls.urls = persistedUrls;
            this.resources.data = persistedResources;
            this.resources.initResourceConfig();
            this.resources.initEventListeners();

            this._onQueueEnded('init');
        } else {
            this.resources.initResourceConfig();
            this.resources.initEventListeners();
            await this.resources.fetchResources();
            // CASE: all resources are fetched, start the queue
            this.queue.start({
                event: 'init',
                tolerance: 100,
                requiredSubscriberCount: 1
            });
        }
    }

    async shutdown() {
        if (!labs.isSet('urlCache')) {
            return null;
        }

        await this.cache.write('urls', this.urls.urls);
        await this.cache.write('resources', this.resources.getAll());
    }

    /**
     * @description Reset this service.
     * @param {Object} options
     */
    reset(options = {}) {
        debug('reset');
        this.urlGenerators = [];

        this.urls.reset();
        this.queue.reset();
        this.resources.reset();

        if (!options.keepListeners) {
            this._onQueueStartedListener && this.queue.removeListener('started', this._onQueueStartedListener);
            this._onQueueEndedListener && this.queue.removeListener('ended', this._onQueueEndedListener);
        }
    }

    /**
     * @description Reset the generators.
     * @param {Object} options
     */
    resetGenerators(options = {}) {
        debug('resetGenerators');
        this.finished = false;
        this.urlGenerators = [];
        this.urls.reset();
        this.queue.reset();

        if (options.releaseResourcesOnly) {
            this.resources.releaseAll();
        } else {
            this.resources.softReset();
        }
    }

    /**
     * @description Soft reset this service. Only used in test env.
     */
    softReset() {
        debug('softReset');
        this.finished = false;
        this.urls.softReset();
        this.queue.softReset();
        this.resources.softReset();
    }
}

module.exports = UrlService;
