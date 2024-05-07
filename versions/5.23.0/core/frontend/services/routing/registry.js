const _ = require('lodash');
let routes = [];
let routers = {};

/**
 * @description 路由器注册表有助于调试目的，可以搜索现有的路由和路由器。
 */
module.exports = {
    /**
     * @description 注册路由的方法，将路由信息添加到 routes 数组中
     * @param {String} routerName
     * @param {String} route
     */
    setRoute(routerName, route) {
        routes.push({route: route, from: routerName});
    },

    /**
     * @description 注册路由器的方法，将路由器添加到 routers 对象中
     * @param {String} name
     * @param {Express-Router} router
     */
    setRouter(name, router) {
        routers[name] = router;
    },

    /**
     * @description 获取所有注册的路由信息的方法
     * @returns {Array}
     */
    getAllRoutes() {
        return _.cloneDeep(routes);
    },

    /**
     * @description 根据名称获取注册的路由器的方法
     * @param {String} name
     * @returns {Express-Router}
     */
    getRouter(name) {
        return routers[name];
    },

    /**
     * 根据内部路由器名称获取注册的路由器的方法
     * @param {String} name 内部路由名称
     * @returns {Express-Router}
     */
    getRouterByName(name) {
        for (let routerKey in routers) {
            if (routers[routerKey].name === name) {
                return routers[routerKey];
            }
        }
    },


    /**
     * @description 根据配置获取主要的 RSS URL 的方法
     *
     * @param {Object} options
     * @returns {String}
     */
    getRssUrl(options) {
        let rssUrl = null;

        const collectionIndexRouter = _.find(routers, {name: 'CollectionRouter', routerName: 'index'});

        if (collectionIndexRouter) {
            rssUrl = collectionIndexRouter.getRssUrl(options);

            // CASE: is rss enabled?
            if (rssUrl) {
                return rssUrl;
            }
        }

        const collectionRouters = _.filter(routers, {name: 'CollectionRouter'});

        if (collectionRouters && collectionRouters.length === 1) {
            rssUrl = collectionRouters[0].getRssUrl(options);

            // CASE: is rss enabled?
            if (rssUrl) {
                return rssUrl;
            }
        }

        return rssUrl;
    },

    /**
     * @description 重置所有路由的方法
     */
    resetAllRoutes() {
        routes = [];
    },

    /**
     * @description 重置所有路由器的方法
     */
    resetAllRouters() {
        _.each(routers, (value) => {
            value.reset();
        });

        routers = {};
    }
};
