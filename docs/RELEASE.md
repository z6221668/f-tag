# 0.3.0 验收记录

当前版本已经完成代码修改、测试和打包，尚未向 Chrome Web Store 或 Microsoft Edge Add-ons 提交。

## 已完成

| 检查                                   | 结果                                                     |
| -------------------------------------- | -------------------------------------------------------- |
| 格式、语法、资源引用、图标与权限检查   | 通过                                                     |
| 数据、迁移、后台权限、并发、快照与撤销 | 36 项测试通过                                            |
| 网页与设置页功能                       | 9 个浏览器页面测试通过                                   |
| 长页面                                 | 1 万条已保存记录，600 个用户链接，增量回复与等级更新通过 |
| Chrome 实际扩展                        | 页面注入、鼠标操作编辑器、备注、单等级、撤销通过         |
| Chrome 实际存储                        | 旧备份导入、覆盖前快照、恢复和重启后读取通过             |
| 设置页布局与图标                       | 实际扩展截图已检查                                       |
| 发布包                                 | 只包含运行文件，manifest 位于 ZIP 根目录                 |

测试使用独立浏览器配置和示例账号，不读取日常浏览器中的个人记录。页面夹具使用测试存储，实际扩展验证使用 Chrome for Testing 的真实本地存储。

这轮实际 Chrome 验证修复了两个夹具没有暴露的问题：存储返回的对象键顺序会引起错误的冲突判断；扩展设置页在标签页中打开时，消息也会带 `sender.tab`，需要按扩展 ID 和来源 URL 区分设置页与网页脚本。二者都有回归测试。

## 公开页面检查

2026-10-13 在未登录的隔离浏览器中进行只读检查：

| 页面         | 结果                               |
| ------------ | ---------------------------------- |
| 吾爱破解主页 | 显示 10 个用户标记按钮             |
| 知乎主页     | 显示 2 个用户标记按钮              |
| V2EX `/t/1`  | 遇到访问验证页，没有进行绕过或登录 |

这些结果仅证明公开页面的账号链接可被识别，不能代替登录后的回答、展开评论、分页和移动版验收。NodeSeek、LINUX DO、Chiphell 和 Hostloc 已有解析与页面夹具测试，真实登录态交互仍待补充。

## 1.0 前剩余事项

- Edge 实际加载、保存、导出、导入、恢复和升级验证。
- 知乎、V2EX 的登录态作者、回答、评论和分页验证。
- 各新增站点的真实帖子、回复和动态内容验证。
- 小范围连续使用，确认没有误标、丢记录或明显影响页面性能。
- 开发者账号、支持联系方式、商店截图与审核提交。

上述验收完成前保留 0.3.0，不把自动测试通过等同于 1.0 正式发布。

## 本地检查与打包

```sh
npm ci
npm run check
npm test
npm run test:performance
npm run package
```

产物为 `dist/f-tag-0.3.0.zip`。相同运行文件会生成相同内容的 ZIP，开发工具、个人导出文件和测试数据不会进入发布包。

## 原生扩展测试

启动 `python3 tools/preview.py`。使用独立 Chrome for Testing 配置，加载本项目的 `extension` 目录，开放本机调试端口 9478，并打开：

```text
http://127.0.0.1:8768/tests/native-fixture.html
```

然后运行：

```sh
node --experimental-websocket tools/native-smoke.mjs
```

Node.js 22+ 可以省略 `--experimental-websocket`。浏览器必须使用隔离测试配置，这个脚本会创建示例标记并测试旧备份覆盖与恢复。

关闭并用同一测试配置重新启动浏览器，仍打开原生测试页面，再检查持久化：

```sh
node --experimental-websocket tools/native-smoke.mjs --restore-check
```

`tools/site-audit.mjs` 对公开网页做只读检查，不保存实际用户标记。访问验证、登录要求或网络拦截应记录为未验证，不能作为插件功能通过的依据。

## 提交材料

介绍见 [商店资料](STORE.md)，数据处理说明见 [数据说明](PRIVACY.md)。提交时还需补齐开发者账号、项目地址和支持联系方式。

官方流程：[Chrome Web Store](https://developer.chrome.com/docs/webstore/publish)、[Microsoft Edge Add-ons](https://learn.microsoft.com/en-us/microsoft-edge/extensions/publish/publish-extension)。
