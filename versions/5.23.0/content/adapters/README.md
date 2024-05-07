# Content / Adapters
# 内容/适配器

An adapter is a way to override a default behavior in Ghost.
The default behavior in Ghost is as following:
适配器是一种覆盖 Ghost 中默认行为的方法。
Ghost 中的默认行为如下：

### LocalFileStorage
### 本地文件存储
By default Ghost will upload your images to the `content/images` folder.
The LocalFileStorage is using the file system to read or write images.
This default adapter can be found in `core/server/adapters/storage/LocalFileStorage.js`.
默认情况下，Ghost 会将您的图像上传到“content/images”文件夹。
LocalFileStorage 正在使用文件系统来读取或写入图像。
这个默认适配器可以在 `core/server/adapters/storage/LocalFileStorage.js` 中找到。

### SchedulingDefault
### 调度默认
By default Ghost will schedule your posts using a pure JavaScript solution.
It doesn't use `cron` or similar.
This default adapter can be found in `core/server/adapters/scheduling/SchedulingDefault.js`.
默认情况下，Ghost 将使用纯 JavaScript 解决方案安排您的帖子。
它不使用 `cron` 或类似的东西。
这个默认适配器可以在 `core/server/adapters/scheduling/SchedulingDefault.js` 中找到。

### Custom Adapter
### 自定义适配器
To override any of the default adapters, you have to add a folder (`content/adapters/storage` or `content/adapters/scheduling`) and copy your adapter to it.
要覆盖任何默认适配器，您必须添加一个文件夹（`content/adapters/storage` 或 `content/adapters/scheduling`）并将您的适配器复制到其中。
