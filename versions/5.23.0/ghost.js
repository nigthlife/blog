/**
 * 内部 CLI 占位符
 *
 * 如果想添加替代命令、标志或修改环境变量，都放在这里。
 * 提示：此文件不应包含任何需求，除非决定添加 Pretty-cli/commander 类型的工具
 *
 **/

// 设置 NODE_ENV 环境变量
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// 通过 process.argv 获取命令行参数
const argv = process.argv;
// 并从中获取第三个参数作为 mode
const mode = argv[2];
// 引入命令模块
const command = require('./core/cli/command');

// 启动模式切换,根据 mode 的取值
switch (mode) {
case 'repl':
case 'timetravel':
case 'generate-data':
    command.run(mode);
    break;
default:
    // 默认启动顺序
    require('./core/boot')();
}
