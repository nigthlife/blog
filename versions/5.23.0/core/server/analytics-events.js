const _ = require('lodash');
const Analytics = require('analytics-node');
const config = require('../shared/config');
const logging = require('@tryghost/logging');
const sentry = require('../shared/sentry');

// 监听模型事件以进行分析 - 还使用主题 API 中的“假”theme.uploaded 事件
const events = require('./lib/common/events');

module.exports.init = function () {
    const analytics = new Analytics(config.get('segment:key'));
    const trackDefaults = config.get('segment:trackDefaults') || {};
    const prefix = config.get('segment:prefix') || '';

    const toTrack = [
        {
            event: 'post.published',
            name: 'Post Published'
        },
        {
            event: 'page.published',
            name: 'Page Published'
        },
        {
            event: 'theme.uploaded',
            name: 'Theme Uploaded',
            // {keyOnSuppliedEventData: keyOnTrackedEventData}
            // - 用于从事件数据中提取特定属性并赋予它们有意义的名称
            data: {name: 'name'}
        },
        {
            event: 'integration.added',
            name: 'Custom Integration Added'
        }
    ];

    _.each(toTrack, function (track) {
        events.on(track.event, function (eventData = {}) {
            // 从 eventData 中提取所需的属性并在必要时重命名键
            const data = _.mapValues(track.data || {}, v => eventData[v]);

            try {
                analytics.track(_.extend(trackDefaults, data, {event: prefix + track.name}));
            } catch (err) {
                logging.error(err);
                sentry.captureException(err);
            }
        });
    });
};
