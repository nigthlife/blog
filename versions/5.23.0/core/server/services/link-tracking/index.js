const LinkClickRepository = require('./LinkClickRepository');
const PostLinkRepository = require('./PostLinkRepository');
const errors = require('@tryghost/errors');
const urlUtils = require('../../../shared/url-utils');

class LinkTrackingServiceWrapper {
    async init() {
        if (this.service) {
            // 已经完成了
            return;
        }

        const linkRedirection = require('../link-redirection');
        if (!linkRedirection.service) {
            throw new errors.InternalServerError({message: 'LinkRedirectionService should be initialised before LinkTrackingService'});
        }

        // 连接所有依赖项
        const models = require('../../models');
        const {MemberLinkClickEvent} = require('@tryghost/member-events');
        const DomainEvents = require('@tryghost/domain-events');

        const {LinkClickTrackingService} = require('@tryghost/link-tracking');

        const postLinkRepository = new PostLinkRepository({
            LinkRedirect: models.Redirect,
            linkRedirectRepository: linkRedirection.linkRedirectRepository
        });

        this.linkClickRepository = new LinkClickRepository({
            MemberLinkClickEventModel: models.MemberClickEvent,
            Member: models.Member,
            MemberLinkClickEvent: MemberLinkClickEvent,
            DomainEvents
        });

        // 暴露服务
        this.service = new LinkClickTrackingService({
            linkRedirectService: linkRedirection.service,
            linkClickRepository: this.linkClickRepository,
            postLinkRepository,
            DomainEvents,
            urlUtils
        });

        await this.service.init();
    }
}

module.exports = new LinkTrackingServiceWrapper();
