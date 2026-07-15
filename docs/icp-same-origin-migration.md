# ICP 备案后同源部署迁移方案

> 状态：待执行。只有在 `haximtus.cn` 的 ICP 备案通过，且阿里云完成接入备案后才能开始生产切换。
>
> 本文不授权提前修改生产 DNS、主站托管或停用 GitHub Pages。

## 背景与目标

当前主站 `https://haximtus.cn/` 由 GitHub Pages 托管。试卷预览与下载已经统一使用主站同源的 `/assets/papers/`，不再依赖 API；登录与提交等动态功能仍由北京阿里云服务器上的 `https://api.haximtus.cn/api/` 提供。已观察到部分中国内地网络或浏览器访问 API 子域名时，TLS 连接被重置，而服务器内部的 Nginx 与 Node 服务均正常。

备案完成后，将生产访问统一到同一个源：

```text
https://haximtus.cn/             静态网站
https://haximtus.cn/api/         登录、提交及其他 API
https://haximtus.cn/papers/      试卷预览与下载
```

浏览器只访问 `haximtus.cn`，不再依赖 `api.haximtus.cn`。目标是消除子域名可达性、跨域、第三方静态托管和浏览器下载策略之间的差异。

## 执行门槛

开始迁移前必须全部满足：

- `haximtus.cn` 的 ICP 备案状态已在工信部系统中生效，而不只是提交或初审通过。
- 阿里云已完成该域名的接入备案，允许域名解析到当前中国内地服务器。
- 已确认备案主体、网站名称和实际网站内容一致。
- 已准备在网站底部展示备案号并链接到工信部备案系统。
- 已了解并安排网站上线后的公安联网备案要求。
- 当前服务器、安全组、80/443 端口和磁盘容量满足主站、API 与试卷文件同时运行。
- 已在服务器或外部存储保存完整备份，且已验证恢复方式。

任一条件不满足时，继续保持 GitHub Pages 主站和现有部署方式，不进行 DNS 切换。

## 目标架构

```text
浏览器
  -> https://haximtus.cn/
       -> Nginx 静态目录 /var/www/tus
       -> /api/*    反向代理到 127.0.0.1:3001
       -> /papers/* 由 Nginx 或 Node 从 /var/lib/tus-auth/papers 提供

GitHub 仓库 / GitHub Pages
  -> 保留源代码、试卷备份和紧急回滚副本
```

推荐让 PDF 预览继续走支持 `Range` 的同源接口，让下载走同源附件接口。不要将 `/var/lib/tus-auth/papers` 直接暴露为任意目录索引。

## 实施顺序

### 1. 迁移前盘点与备份

- 导出生产 Nginx 配置、systemd 服务配置和应用环境变量的键名清单。
- 备份 `/opt/tus/backend`、`/var/lib/tus-auth` 和现有证书配置。
- 对本地、GitHub 与阿里云的试卷文件逐个核对文件数和 SHA-256。
- 记录现有 DNS TTL，并至少提前一天将计划修改记录的 TTL 调低。
- 明确回滚负责人、切换时间和观察窗口。

备份中可能包含敏感信息，不得提交到 Git 仓库。

### 2. 在阿里云建立同源预发布环境

- 将静态网站发布到版本化目录，例如 `/var/www/tus/releases/<timestamp>`。
- 使用只读方式挂载或读取 `/var/lib/tus-auth/papers`。
- 新增 `haximtus.cn` 的 Nginx 配置，但先通过临时主机名或本机 `hosts` 验证，不提前修改公共 DNS。
- 配置 HTTPS、HTTP 到 HTTPS 跳转、HSTS 策略和基础安全响应头。
- `/api/` 反向代理到现有 `tus-auth.service`。
- `/papers/preview` 与 `/papers/download` 保留 Range、HEAD、ETag、Last-Modified、中文附件名和路径校验。
- 静态资源采用带版本号的长缓存；HTML 使用短缓存或 `no-cache`，避免发布后长期命中旧入口。

### 3. 修改应用为同源 URL

- 将前端 API 基址从 `https://api.haximtus.cn/api` 改为 `/api`。
- 将预览与下载 URL 改为 `https://haximtus.cn` 下的同源相对路径。
- 收紧 CORS：同源请求不需要宽泛 CORS；仅为明确的管理或回滚来源保留白名单。
- 检查 CSP、cookie、跳转地址和登录状态是否仍引用 API 子域名。
- 更新提交、后台管理和部署脚本中的域名与路径。
- 更新公告内容与 `SEEN_KEY`，说明服务迁移和可能的短时缓存刷新。
- 在所有 HTML 中显示真实备案号；备案号必须链接至 `https://beian.miit.gov.cn/`。

### 4. 预发布验收

在不修改公共 DNS 的情况下完成：

- 桌面 Chrome、Edge、Safari 和 Firefox 的首页、搜索、预览、下载。
- iOS Safari、Android Chrome、QQ 浏览器、夸克浏览器或对应真实测试设备。
- 登录、退出、跨设备登录和未登录浏览。
- PDF.js 首屏、滚动加载、返回详情和再次进入。
- PDF、DOC、DOCX 下载，中文文件名和当前页面不跳走。
- `bytes=N-M`、`bytes=N-`、`bytes=-N`、非法 Range、HEAD、If-Range 和 416。
- 弱网、缓存命中、缓存清除以及 API 服务重启期间的页面表现。
- 安全检查：目录遍历、非法后缀、错误 CORS 来源和敏感文件不可访问。

### 5. 灰度切换

- 先发布同源代码和 Nginx 配置，确认服务器本机健康检查通过。
- 将 `haximtus.cn` 的 DNS 从 GitHub Pages 切换到已备案的阿里云入口。
- 保留 `api.haximtus.cn` 一段过渡期，并将其响应重定向或继续服务旧缓存客户端。
- GitHub Pages 暂不关闭，作为只读回滚副本，但避免两个入口同时接受用户提交。
- 连续观察 TLS、Nginx 4xx/5xx、Node 服务、下载失败率、磁盘和带宽。

建议选择低访问时段切换，并至少观察 24 小时后再清理旧入口。

## 回滚方案

出现以下任一情况时回滚：

- 主站或 API 在主要运营商网络上不可达。
- 登录或提交出现数据错误。
- PDF 预览、Range 或附件下载产生广泛回归。
- TLS、证书续期或 Nginx 配置异常。

回滚步骤：

1. 将 DNS 恢复到迁移前记录，并保留较低 TTL。
2. 恢复 GitHub Pages 作为主入口。
3. 恢复前端上一版本的 API 基址与静态资源版本。
4. 保持阿里云数据库和试卷目录只读，禁止通过回滚覆盖新数据。
5. 对比切换期间产生的数据后再决定重新迁移时间。

## 完成标准

- 中国内地主要网络可稳定访问 `https://haximtus.cn/`、`/api/health` 和试卷接口。
- 浏览器网络请求中不再出现 `api.haximtus.cn` 生产依赖。
- 登录、提交、预览和下载完整流程通过真实设备测试。
- 预览和下载响应继续标记阿里云来源，并正确支持 Range。
- 备案号在页面底部正确展示并可跳转验证。
- GitHub Pages 已明确降级为备份或正式退役。
- 监控、备份、证书续期和部署文档均已更新。

## 备案完成后的启动指令

当维护者确认“ICP 备案与阿里云接入备案均已生效”后，再根据本文创建具体实施任务。执行前仍需重新检查阿里云和工信部当时的最新规则，不直接照搬可能已经过期的控制台步骤。
