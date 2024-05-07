const config = require('../../../shared/config');
const LocalFileCache = require('./LocalFileCache');
const UrlService = require('./UrlService');

// 注意：我们可以为 UrlService 提供某种“数据解析器”而不是路径
// 所以它根本不需要包含读取数据的逻辑。 这将是
// 未来可能的改进
let writeDisabled = false;
let storagePath = config.getContentPath('data');

// TODO: 在可能的情况下删除此 hack 以支持从内容路径加载
// 通过在预启动阶段模拟内容文件夹
if (process.env.NODE_ENV.startsWith('test')){
    storagePath = config.get('paths').urlCache;

     // 注意：防止测试套件覆盖缓存装置。
     // 更好的解决方案是注入不同的实现
     // 基于环境的缓存，这种方法现在应该可以解决问题
    writeDisabled = true;
}

const cache = new LocalFileCache({storagePath, writeDisabled});
const urlService = new UrlService({cache});

// 单例
module.exports = urlService;
