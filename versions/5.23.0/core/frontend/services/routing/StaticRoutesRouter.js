const debug = require('@tryghost/debug')('routing:static-routes-router');
const errors = require('@tryghost/errors');
const urlUtils = require('../../../shared/url-utils');  
const RSSRouter = require('./RSSRouter');
const controllers = require('./controllers');
const middleware = require('./middleware');
const ParentRouter = require('./ParentRouter');

/**
 * 用于处理静态路由和频道路由。它通过继承 ParentRouter 类来实现路由的注册和处理。
 * 
 * @description 模板路由允许您将各个 URL 映射到主题中的特定模板文件
 */
class StaticRoutesRouter extends ParentRouter {
    // 在构造函数中，根据传入的参数判断路由类型（静态路由或频道路由），并分别注册相应的处理逻辑。
    constructor(mainRoute, object, routerCreated) {
        super('StaticRoutesRouter');

        this.route = {value: mainRoute};
        this.templates = object.templates || [];
        this.data = object.data || {query: {}, router: {}};
        this.routerName = mainRoute === '/' ? 'index' : mainRoute.replace(/\//g, '');
        this.routerCreated = routerCreated;

        debug(this.route.value, this.templates);

        // CASE 1: Route is channel (controller: channel) -  a stream of posts
        // CASE 2: Route is just a static page e.g. landing page
        if (this.isChannel(object)) {
            this.templates = this.templates.reverse();
            this.rss = object.rss !== false;
            this.filter = object.filter;
            this.limit = object.limit;
            this.order = object.order;

            this.controller = object.controller;

            debug(this.route.value, this.templates, this.filter, this.data);
            this._registerChannelRoutes();
        } else {
            this.contentType = object.content_type;
            debug(this.route.value, this.templates);
            this._registerStaticRoute();
        }
    }

    /**
     * @description 频道路由，会注册频道相关的中间件和控制器，并根据参数设置是否启用 RSS，以及路由的分页等功能
     * @private
     */
    _registerChannelRoutes() {
        // REGISTER: 准备上下文对象
        this.router().use(this._prepareChannelContext.bind(this));

        // REGISTER: 是否开启rss
        if (this.rss) {
            this.rssRouter = new RSSRouter();
            this.mountRouter(this.route.value, this.rssRouter.router());
        }

        // REGISTER: 频道路由
        this.mountRoute(this.route.value, controllers[this.controller]);

        // REGISTER: 分页
        this.router().param('page', middleware.pageParam);
        this.mountRoute(urlUtils.urlJoin(this.route.value, 'page', ':page(\\d+)'), controllers[this.controller]);

        this.routerCreated(this);
    }

    /**
     * @description Prepare channel context for further middleware/controllers.
     * @param {Object} req
     * @param {Object} res
     * @param {Function} next
     * @private
     */
    _prepareChannelContext(req, res, next) {
        res.routerOptions = {
            type: this.controller,
            name: this.routerName,
            context: [this.routerName],
            filter: this.filter,
            limit: this.limit,
            order: this.order,
            data: this.data.query,
            templates: this.templates
        };

        next();
    }

    /**
     * @description Register all static routes of this router (...if the router is just a static route)
     * @private
     */
    _registerStaticRoute() {
        // REGISTER: prepare context object
        this.router().use(this._prepareStaticRouteContext.bind(this));

        // REGISTER: static route
        this.mountRoute(this.route.value, controllers.static);

        this.routerCreated(this);
    }

    /**
     * @description Prepare static route context for further middleware/controllers.
     * @param {Object} req
     * @param {Object} res
     * @param {Function} next
     * @private
     */
    _prepareStaticRouteContext(req, res, next) {
        res.routerOptions = {
            type: 'custom',
            templates: this.templates,
            defaultTemplate: () => {
                throw new errors.IncorrectUsageError({
                    message: `Missing template ${res.routerOptions.templates.map(x => `${x}.hbs`).join(', ')} for route "${req.originalUrl}".`
                });
            },
            data: this.data.query,
            context: [this.routerName],
            contentType: this.contentType
        };

        next();
    }

    /**
     * @description Helper function to figure out if this router is a channel.
     * @param {Object} object
     * @returns {boolean}
     */
    isChannel(object) {
        if (object && object.controller && object.controller === 'channel') {
            return true;
        }

        return this.controller === 'channel';
    }
}

module.exports = StaticRoutesRouter;
