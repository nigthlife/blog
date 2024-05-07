/**
 * The Bridge
 *
 * The bridge is responsible for handing communication from the server to the frontend.
 * Data should only be flowing server -> frontend.
 * As the architecture improves, the number of cross requires here should go down
 * Eventually, the aim is to make this a component that is initialized on boot and is either handed to or actively creates the frontend, if the frontend is desired.
 *
 * This file is a great place for all the cross-component event handling in lieu of refactoring
 * NOTE: You may require anything from shared, the frontend or server here - it is the one place (other than boot) that is allowed :)
 */

const debug = require('@tryghost/debug')('bridge'); // 用于调试的模块
const errors = require('@tryghost/errors');     // 处理错误的模块
const logging = require('@tryghost/logging');   // 日志记录模块
const tpl = require('@tryghost/tpl');   // 模板处理模块
const themeEngine = require('./frontend/services/theme-engine');    // 主题引擎服务
const appService = require('./frontend/services/apps');     // 应用程序服务
const cardAssetService = require('./frontend/services/card-assets');    // 卡片资源服务
const commentCountsAssetService = require('./frontend/services/comment-counts-assets');     // 评论计数资源服务
const adminAuthAssetService = require('./frontend/services/admin-auth-assets'); // 管理员认证资源服务
const memberAttributionAssetService = require('./frontend/services/member-attribution-assets');     // 成员归因资源服务
const routerManager = require('./frontend/services/routing').routerManager;     // 路由管理器
const settingsCache = require('./shared/settings-cache');   // 设置缓存服务
const urlService = require('./server/services/url');    // URL 服务
const routeSettings = require('./server/services/route-settings');  // 路由设置服务

// Listen to settings.locale.edited, similar to the member service and models/base/listeners
const events = require('./server/lib/common/events');   // 事件处理模块

const messages = {
    activateFailed: 'Unable to activate the theme "{theme}".'
};

class Bridge {
    // 初始化方法，监听 settings.locale.edited 和 settings.timezone.edited 事件
    init() {
        /**
         * When locale changes, we reload theme translations
         */
        events.on('settings.locale.edited', (model) => {
            debug('Active theme init18n');
            this.getActiveTheme().initI18n({locale: model.get('value')});
        });

        // NOTE: eventually this event should somehow be listened on and handled by the URL Service
        //       for now this eliminates the need for the frontend routing to listen to
        //       server events
        events.on('settings.timezone.edited', (model) => {
            routerManager.handleTimezoneEdit(model);
        });
    }

    // 获取当前活动主题
    getActiveTheme() {
        return themeEngine.getActive();
    }

    // 激活主题的方法
    async activateTheme(loadedTheme, checkedTheme) {
        let settings = {
            locale: settingsCache.get('locale')
        };
        // no need to check the score, activation should be used in combination with validate.check
        // Use the two theme objects to set the current active theme
        try {
            themeEngine.setActive(settings, loadedTheme, checkedTheme);

            const cardAssetConfig = this.getCardAssetConfig();
            debug('reload card assets config', cardAssetConfig);
            await cardAssetService.load(cardAssetConfig);

            // TODO: is this in the right place?
            // rebuild asset files
            await commentCountsAssetService.load();
            await adminAuthAssetService.load();
            await memberAttributionAssetService.load();
        } catch (err) {
            logging.error(new errors.InternalServerError({
                message: tpl(messages.activateFailed, {theme: loadedTheme.name}),
                err: err
            }));
        }
    }

    //  获取卡片资源配置
    getCardAssetConfig() {
        if (this.getActiveTheme()) {
            return this.getActiveTheme().config('card_assets');
        } else {
            return true;
        }
    }

    // 重新加载前端的方法
    async reloadFrontend() {
        debug('reload frontend');
        const siteApp = require('./frontend/web/site');

        const routerConfig = {
            routeSettings: await routeSettings.loadRouteSettings(),
            urlService
        };

        await siteApp.reload(routerConfig);

        // re-initialize apps (register app routers, because we have re-initialized the site routers)
        appService.init();

        // connect routers and resources again
        urlService.queue.start({
            event: 'init',
            tolerance: 100,
            requiredSubscriberCount: 1
        });
    }
}

const bridge = new Bridge();

module.exports = bridge;
