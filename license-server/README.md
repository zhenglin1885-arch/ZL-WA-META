# ZL 激活码系统 v1.0

这是可运行的独立授权服务与管理后台，不是模拟数据页面。Python 3.10 或更高版本即可启动，无第三方 Python 依赖。当前交付不包含 Electron 安装程序；现有 ZL 网页演示仍不会执行真实激活拦截。

## Windows 本机体验

1. 安装 Python 3.10+（勾选 Python Launcher）。解压整个目录。
2. 双击 `setup-windows.bat`，设置至少 12 位的管理员密码。输入密码时屏幕不显示字符是正常现象。没有默认密码。
3. 双击 `start-windows.bat`，保持窗口运行。
4. 在浏览器打开 **http://127.0.0.1:8787**，使用刚设置的密码登录。
5. 生成一个激活码，立即下载 CSV 保存；输入客户或批次备注，便于后续核对。

终端等效操作：

```sh
python server.py --init
python server.py
```

忘记密码：在服务所在电脑运行 `python server.py --reset-password`，会使所有管理登录失效，不影响已激活客户。

## 已实现

- 每码恰好 8 位 A–Z / 0–9，必须同时包含字母与数字；密码学安全随机数生成，数据库唯一约束。
- 一次生成 1–100 个，永久或 30 / 90 / 365 天；有效期从首次成功激活计算。
- 一码绑定一个设备 SHA-256 标识。并发抢先激活只允许一台设备成功。同设备重装可以重新输入原激活码恢复，重新激活会轮换设备令牌。
- 管理员查看未使用、已激活、已停用、已过期、绑定设备、日期、最近验证和最近 100 条日志。停用/启用不清除设备绑定；没有换绑接口。
- 激活码只存 SHA-256 与末 4 位，完整码仅生成时返回；设备令牌与管理员会话也仅保存哈希。
- 管理密码 PBKDF2-SHA256 + 每个密码随机盐；管理登录有效 8 小时；HttpOnly / SameSite cookie；HTTPS 模式增加 Secure。
- 服务器强制检查激活状态、绑定设备和有效期；6 小时一次复检由桌面主进程 SDK 执行。
- SQLite 持久化、原子设备绑定、请求大小/超时限制、登录及激活频率限制、同源管理请求检查。

## 后台使用

生成后完整码仅显示一次，下载 CSV 后分发给客户。列表使用 `****AB12` 形式显示，配合客户备注和唯一编号定位授权；可搜索末 4 位、编号、备注和设备。若丢失完整码，不可恢复，可创建新码并停用旧码。不要将 CSV 放到网站公开目录。

后台显示的是实际数据库记录。未激活时激活日期、设备、最近验证为空。首次激活后绑定信息更新，随后每次验证更新最近验证时间。停用操作立即写入服务端；在线客户端最迟在下一次成功复检时发现失效，已运行客户端不是即时推送退出。

## 公网部署（给客户使用前必须完成）

本机地址只可在运行服务的电脑访问，不能给客户电脑使用。需要你自己的服务器和 HTTPS 域名。将完整目录部署到服务器，以普通用户运行：

```sh
python server.py --init
python server.py --host 127.0.0.1 --port 8787 --origin https://license.your-domain.example
```

`license.your-domain.example` 是文档占位符，请替换成你的实际域名。用服务器的 HTTPS 反向代理转发到 `127.0.0.1:8787`，设置进程自动启动与故障重启。只公开 HTTPS 端口，不公开 8787。保留客户端 Origin 请求头，不允许任意 CORS，不把管理页面缓存。

生产上线前还需配置：TLS 证书、请求速率限制、数据库备份与恢复测试、监控和实际负载测试。此版本使用 Python 标准库 HTTP 服务，适合本机验证和小规模部署基线，未经公网压力测试或独立安全审计。反向代理场景下应用看到代理 IP，内置 IP 限流可能合并所有客户端；上线时需在入口按真实客户端限流并调整应用限流策略后验证目标规模，不能直接按当前默认值扩容。

推荐对 `/`、`/admin.js`、`/admin.css`、`/api/admin/*` 在反向代理额外限制管理来源，公开给客户的只有 `/api/v1/activate`、`/api/v1/verify`。后台管理密码、数据库和客户端令牌不得放在安装包或渲染进程中。`data/` 仅保存在服务端，不应托管到静态网站。

备份：停止服务后备份整个 `data/`（包括可能存在的 SQLite WAL 文件），或使用 SQLite 在线备份 API。恢复时保持数据库和目录权限，验证已有激活码/设备绑定记录。测试数据库不会进入交付包。

## 接口

### 激活

`POST /api/v1/activate`，Content-Type 为 application/json：

```json
{"code":"AB12CD34","device_id":"64位小写SHA256十六进制字符串","device_name":"客户电脑显示名称"}
```

上例是格式说明，不是可用激活码；实际应使用后台生成的码。成功返回 `valid`、`license_id`、`device_token`、`activated_at`、`expires_at`（永久为 null）、`server_time`、`valid_until`、`recheck_after_seconds`（21600）。时间均为 UTC Unix 秒。

### 验证

`POST /api/v1/verify`，`Authorization: Bearer <device_token>`：

```json
{"device_id":"与首次激活相同的64位设备标识"}
```

客户端不应内置管理员密码或通用后台密钥。激活接口凭激活码授权；验证接口凭设备令牌和匹配设备标识授权。

### 拒绝 / 网络故障

- HTTP 403 + `disabled` / `expired`：授权已停用 / 过期。
- HTTP 403 + `device_mismatch`：绑定设备不符。
- HTTP 403 + `invalid_code` / `invalid_token`：码或令牌无效。
- HTTP 429 / 5xx、超时或无法联网：临时不可用，不应伪称激活码已失效。

## Electron 主进程接入

`client.mjs` 是实际调用上述服务的 SDK。仅在 Electron 主进程使用；不要在网页渲染进程放管理密码或授权令牌。

```js
import { LicenseClient } from './client.mjs';
const client = new LicenseClient({
  baseUrl: 'https://你的授权域名',
  deviceId: stableDeviceSha256,
  deviceName: computerName,
  readToken: () => readFromOSProtectedStorage(),
  writeToken: token => writeToOSProtectedStorage(token),
  onValid: info => unlockMainWindow(info),
  onInvalid: reason => {
    // 锁定主窗口、停止账号与群发任务，再退出软件。
    // activation_required 时显示激活小窗口，而不是循环退出。
    handleAuthoritativeInvalidLicense(reason);
  },
  onUnavailable: error => showNetworkRetryStatus(error)
});
// 启动后先验证；成功才开放主窗口。初次无令牌显示激活窗口。
await client.start();
// 用户提交激活码：
await client.activate(userCode);
// 完全退出前：client.stop();
```

上面回调属于桌面端集成点，需要结合真实 Electron 主进程实现，不能直接当作完整 Electron 程序运行。系统首次安装后第一次启动进入激活小窗口；验证成功后进入主界面。安装器本身不必保存激活码。后续启动验证令牌，运行中每 6 小时复检。明确失效时 SDK 清理令牌并调用 `onInvalid`；由主进程执行关闭软件，下次启动再次激活。

临时网络故障 SDK 每 60 秒重试，不执行停用回调。**本版本没有持久离线签名许可证**：启动时没有成功联网验证应保持锁定；已经运行时临时网络故障如何处理由主进程回调决定。若要求长时间离线可用且按期限强制锁定，需要后续增加服务端非对称签名许可证与本机有效期校验，不能仅信任普通 JSON 或可编辑的本地开关。

设备标识由桌面端基于稳定的 Windows 设备信息计算 SHA-256，不能用临时随机数或仅用电脑名；原始硬件字段不上传。同系统重装应用应产生同一标识，但更换硬件或重装操作系统可能改变标识，届时按业务流程处理；不要宣称任何设备指纹绝对不可伪造。本版服务器检查客户端提交的标识，尚无硬件证明或反破解保护。

## 测试

```sh
python -m unittest discover -s tests -v
node --test tests/client.test.mjs
```

覆盖 100 个生成码格式和唯一性、并发设备绑定、同设备恢复、不同设备拒绝、停用/启用、过期、管理密码与限流、HTTP 登录与同源限制、真实激活/验证 HTTP 请求，以及 SDK 的失效/网络分支。
