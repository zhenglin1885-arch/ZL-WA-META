# ZL Multi Manager

Windows Electron 多账号管理应用。当前源码版本：0.2.0-R11。

## 启动与构建

需要 Node.js 24。Windows 下运行：

```sh
npm test
npm ci --prefix desktop
npm start --prefix desktop
```

生成安装包：

```sh
npm run dist:win --prefix desktop
```

输出：`desktop/release/ZL-Multi-Manager-Setup.exe`。

## 当前状态

- WhatsApp Web / Meta Business 使用独立的持久会话；用户已验证 WhatsApp 双账号扫码登录、切换聊天与重启保留登录。
- R6 接入真实聊天列表、发送、群管理员发言权限、翻译服务请求、网络检测和 Windows 通知代码。
- 头像同步、Windows 通知、窗口行为及发送/群管理/翻译流程仍需 Windows 实机逐项验收；自动化通过不代表这些流程已实机验证。
- Google 新增非官方免 Key 网页通道，本轮在线请求返回 429，尚未验证成功翻译。DeepL 免费 API 仍需免费 Key；OpenAI/Gemini 需用户自己的 API Key，在本机配置，不要提交到仓库。
- 指纹配置、WhatsApp 原生列表的客户备注/无限置顶尚未全部接入。
- 固定离线激活码为 `ZL2026TESTA1B2C3D4E5`，这是公开源码中的入口校验，不具备防破解能力。云端激活系统未启用。

## GitHub 构建

Actions 中的 **Windows installer** 可手动构建；推送 `v*` 标签会构建并发布 Release。首次发布成功后，固定下载地址为：

https://github.com/zhenglin1885-arch/ZL-WA-META/releases/latest/download/ZL-Multi-Manager-Setup.exe

链接只有在 Release 安装包实际发布后才可下载。

详细变更和验收项目见 `desktop/RELEASE-NOTES.md`、`desktop/ACCEPTANCE.md`。源码含第三方 WA-JS，许可证见 `desktop/vendor/`。本项目不是 WhatsApp / Meta 官方应用。

R8 已接入按账号代理、认证、网络检测和加密保存；实际 Windows 连接仍待验收。

R11 接入本地记录、性能监控和 GitHub 在线升级；仓库必须先发布安装包及 SHA256SUMS.txt 才可下载更新。详细范围见 RELEASE-NOTES。
