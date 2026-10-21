# ZL Windows 官方网页会话版

0.2.0 使用 Electron WebContentsView 加载真实 WhatsApp Web 和 Meta Business，按账号隔离持久会话。R6 已接入翻译、发送和群管理调用，实机验证状态详见 RELEASE-NOTES.md 和 ACCEPTANCE.md。

Windows 构建（Node.js 24）：在项目根目录运行：

```sh
npm test
npm ci --prefix desktop
npm run dist:win --prefix desktop
```

产物：`desktop/release/ZL-Multi-Manager-Setup.exe`。
Linux 交叉构建：在 desktop 目录依次运行 `npm run prepare-ui`、`npx electron-builder --win --x64 --dir`，然后设置 NSISDIR 为 NSIS 工具包根目录、MAKENSIS 为官方 NSIS Linux 编译器路径，运行 `node compile-installer.cjs`。该流程直接编译 installer.nsi，不需要执行 Wine。生成的卸载器仅删除打包文件，保留用户数据。

GitHub：上传完整项目源码到仓库后，Actions 页面可以手动运行 Windows installer 下载构建产物。推送 `v0.1.0` 等版本标签会创建 Release，固定安装包名不随版本变化。发布前应在 Windows 实机检查首次激活、重启记忆、托盘恢复、退出和卸载。

构建不包含 license-server 或激活后台。测试版授权保存在 Electron 用户数据目录内的本地浏览器存储中，不做联网检查或防破解承诺。
