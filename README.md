# ZL Multi Manager

Windows Electron 多账号管理应用。当前源码版本：0.2.0-R6。

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
- 翻译需要用户自己的服务 API Key，在本机配置，不要提交到仓库。
- 代理与指纹配置、WhatsApp 原生列表的客户备注/无限置顶、在线更新尚未全部接入。
- 固定离线激活码为 `ZL2026TESTA1B2C3D4E5`，这是公开源码中的入口校验，不具备防破解能力。云端激活系统未启用。

## GitHub 构建

Actions 中的 **Windows installer** 可手动构建；推送 `v*` 标签会构建并发布 Release。首次发布成功后，固定下载地址为：

https://github.com/zhenglin1885-arch/ZL-WA-META/releases/latest/download/ZL-Multi-Manager-Setup.exe

链接只有在 Release 安装包实际发布后才可下载。

详细变更和验收项目见 `desktop/RELEASE-NOTES.md`、`desktop/ACCEPTANCE.md`。源码含第三方 WA-JS，许可证见 `desktop/vendor/`。本项目不是 WhatsApp / Meta 官方应用。
