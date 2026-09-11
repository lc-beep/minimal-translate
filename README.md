# 简译

精简的 Chrome / Edge Manifest V3 插件：使用自己的 LLM 翻译网页和 PDF，没有广告、账号系统或自建中转服务。

## 安装

本地已构建的插件位于 `extension/`，可以直接加载。GitHub 源码需要先执行：

```sh
npm ci
npm run build
```

1. 打开 Chrome 扩展程序管理页 `chrome://extensions`（Edge 使用 `edge://extensions`）。
2. 开启「开发者模式」，点击「加载已解压的扩展程序」，选择 `extension` 文件夹。
3. 打开插件「模型与翻译设置」，填写 Base URL、准确的模型名和 API Key。
4. 点击「保存并测试连接」，按浏览器提示授权访问模型地址。
5. 打开文章，点击「翻译 / 隐藏网页译文」。滚动到的段落会翻译，原文和原文链接保留。
6. PDF：先下载到本机，再从「打开 PDF 对照阅读」选择文件，点击「翻译本页」。

## 模型配置

支持 OpenAI 兼容的 `/chat/completions` 接口；Base URL 可填写 `https://provider.example/v1` 或完整 endpoint。模型名不预填，以免服务商不支持示例模型。API Key 可留空用于无鉴权本地服务。

默认目标语言：简体中文；默认输出上限 4096 token、超时 60 秒、并发上限 2。Temperature、Top P、推理强度默认不发送。可编辑翻译 Prompt，其中 `{{target}}` 替换成目标语言。

「额外请求参数」支持服务商特有 JSON，例如 `{"enable_thinking":false}`。对于只支持 `max_completion_tokens` 的服务，应清空「输出 token 上限」，再用额外参数填写。若收到 HTTP 400，先清空可选推理参数和输出上限，核对模型文档。

接口错误会显示状态码和处理建议，单段失败可点击重试。不会自动重试以免重复收费。隐藏译文会暂停新增请求；已经发出的请求会完成。网页译文保留在当前页面内存，刷新后清除；PDF 已完成的译文按页保留到关闭阅读页或切换文件。

## 第一版边界

- 网页：常见文章标题、段落、列表、表格单元格与正文容器；不保证任意网页布局适配。跳过导航、代码、输入框与声明禁止翻译的区域。不支持 iframe、Shadow DOM，已有节点原地修改文字时需刷新。
- 原文内链接完整保留，译文作为纯文本插入，不重建译文中的链接样式。
- PDF：本地文本型 PDF，左侧渲染原页、右侧按页译文。没有 OCR、译文原位排版或双语 PDF 导出。复杂多栏/公式的提取顺序需对照原文核验。长页分块可能影响跨块上下文。
- 仅兼容 Chat Completions 协议，不直接支持 Anthropic 原生 Messages 或 Responses API。
- 不提供自动语言检测、跨页面缓存、翻译历史或自动全站翻译。

## 数据与权限

API Key 保存于 `chrome.storage.local`，限制为扩展可信上下文访问，不云同步；这是本机存储，不是加密密码库。网页内容脚本不读取 Key。请求直接发送到配置的地址；不跟随接口重定向，避免将凭证发往意外目标。错误信息不回显服务端原始响应。

网页使用 `activeTab` 按需注入。模型地址权限在保存时请求。已授权的旧模型域名不会自动撤销，可在浏览器扩展管理中调整。PDF.js 与字体等资源随插件打包，不从 CDN 动态加载代码。

权限设计参考 [Chrome 跨域网络请求文档](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)；PDF 使用 [Mozilla PDF.js](https://mozilla.github.io/pdf.js/getting_started/)。PDF.js 许可证随构建产物提供。

## 验证

```sh
npm test
node tests/browser.mjs
```

- 6 项单元/DOM 测试：URL、请求参数、鉴权、错误和截断提示、原文链接、纯文本安全插入、显示切换。
- 浏览器测试：真实无头 Chrome 加载设置页；模拟扩展 API 和模型响应，验证保存/连接提示；使用人工构造的 PDF 验证真实 PDF.js 解析与绘制、译文显示。
- `tests/browser.mjs` 默认使用 macOS Chrome 路径，可按本机情况调整。
- 尚未完成真实用户模型端到端测试，也未以真实扩展身份自动验收权限弹窗和 Service Worker 生命周期。安装后请先运行连接测试，再翻译短文章验收。
