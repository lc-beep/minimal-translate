# 简译

精简的 Chrome / Edge Manifest V3 插件：使用自己的 LLM 翻译网页和 PDF，没有广告、账号系统或自建中转服务。

## 更新到 0.3.1

已安装本地开发版时，在扩展管理页点击「简译」卡片的重新加载按钮，再刷新已打开的文章页。只重新加载即可，已有模型设置会保留。

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
5. 打开文章，点击「翻译 / 隐藏网页译文」。译文紧跟在每段原文内部，沿用正文栏宽度和字体。右侧出现 40px 墨色圆角「译」按钮（深色模式自动反色），点击可切换显示。
6. 若希望以后访问该站直接出现按钮，在插件菜单点击「在此网站显示悬浮按钮」并授权。只对这个网站生效，点击按钮后才发送翻译请求。取消时可在扩展详情中撤销此网站访问权限。
7. PDF：先下载到本机，再从「打开 PDF 对照阅读」选择文件，点击「翻译本页」。

## 模型配置

支持 OpenAI 兼容的 `/chat/completions` 接口；Base URL 可填写 `https://provider.example/v1` 或完整 endpoint。模型名不预填，以免服务商不支持示例模型。API Key 可留空用于无鉴权本地服务。

默认目标语言：简体中文；默认输出上限 4096 token、超时 60 秒、并发上限 2。Temperature、Top P、推理强度默认不发送。可编辑翻译 Prompt，其中 `{{target}}` 替换成目标语言。

「额外请求参数」支持服务商特有 JSON，例如 `{"enable_thinking":false}`。对于只支持 `max_completion_tokens` 的服务，应清空「输出 token 上限」，再用额外参数填写。若收到 HTTP 400，先清空可选推理参数和输出上限，核对模型文档。

接口错误会显示状态码和处理建议，单段失败可点击重试。不会自动重试以免重复收费。隐藏译文会暂停新增请求；已经发出的请求会完成。网页译文保留在当前页面内存，刷新后清除；PDF 已完成的译文按页保留到关闭阅读页或切换文件。

## 网页识别与兼容边界

- 按渲染后的 DOM / CSS 分段，不包含域名、站点类名或 React/Vue 专用规则。结合语义标签、可见性、文本长度、文字占比、标点和链接占比，筛选阅读内容。
- 使用计算后的 `display` 识别段落边界，支持块级 span、自定义元素（普通 DOM）、inline 包装、`display: contents`、嵌套列表、定义列表和表格单元格。
- 译文插入原有段落内部；Flex/Grid 页面优先处理其子项内部的普通文档流，不增加同级布局子项。无法安全容纳译文的直接匿名 Flex/Grid 文本、浮动定位内容、截断预览会跳过。
- 监听文字原地修改、节点增删、可见性及布局相关属性变化；合并修改范围，只重新扫描受影响区域。SPA URL 变化会清理当前页译文；DOM 未变化的路由通过启用期间每 750ms 检查 URL 补充识别，不劫持网站的 history API。
- 每个请求绑定当时的原文节点、格式和路由；过期响应不会插入新内容。已有译文不参与正文提取，不触发自动重复翻译。
- 跳过导航、侧栏、表单、编辑区、代码块、隐藏内容与 `translate="no"` 区域。不支持 iframe、Shadow DOM、canvas 文字、封闭组件或所有虚拟滚动实现。网站读取原元素 `textContent` 时仍可能读到插入的译文，这是 DOM 插入方式的限制。
- 这是通用启发式实现，尚未通过大规模真实站点抽样测得兼容率，不能据此承诺“绝大多数网站完全适配”。
- 译文可保留链接、斜体、加粗、行内代码等格式，通过编号标记还原；只接受原文已有的安全链接。模型破坏标记时回退到纯文本，不执行模型输出的 HTML。
- 同一个段落中的连续 `<br>` 按空行拆分翻译；不对原网页做全文重排。
- PDF：本地文本型 PDF，左侧渲染原页、右侧按页译文。没有 OCR、译文原位排版或双语 PDF 导出。复杂多栏/公式的提取顺序需对照原文核验。长页分块可能影响跨块上下文。
- 仅兼容 Chat Completions 协议，不直接支持 Anthropic 原生 Messages 或 Responses API。
- 不提供自动语言检测、跨页面缓存、翻译历史或自动全站翻译。

## 数据与权限

API Key 保存于 `chrome.storage.local`，限制为扩展可信上下文访问，不云同步；这是本机存储，不是加密密码库。网页内容脚本不读取 Key。请求直接发送到配置的地址；不跟随接口重定向，避免将凭证发往意外目标。错误信息不回显服务端原始响应。

网页默认使用 `activeTab` 按需注入。常驻悬浮按钮通过可选的单站点权限和 `registerContentScripts` 实现，注入按钮本身不发送页面文本。模型地址权限在保存时请求。已授权的旧模型域名不会自动撤销，可在浏览器扩展管理中调整。PDF.js 与字体等资源随插件打包，不从 CDN 动态加载代码。

实现依据：[CSS display](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/display) 和 [MutationObserver.observe](https://developer.mozilla.org/en-US/docs/Web/API/MutationObserver/observe)。

权限设计参考 [Chrome 跨域网络请求文档](https://developer.chrome.com/docs/extensions/develop/concepts/network-requests)；PDF 使用 [Mozilla PDF.js](https://mozilla.github.io/pdf.js/getting_started/)。PDF.js 许可证随构建产物提供。

## 验证

```sh
npm test
node tests/browser.mjs
node tests/layout.mjs
node tests/compatibility.mjs
```

- 18 项单元/DOM 测试：除接口与安全渲染外，覆盖计算布局、隐藏内容、ARIA 导航、原地文字更新、迟到响应、动态追加、布局变化、URL-only 路由变化和局部增量扫描。
- 排版回归：复现正文宽度仅设在 `<p>`、段落内连续 `<br>` 的结构，在 1440px / 390px 窗口验证译文边界、字体、链接、无横向溢出和按钮切换不重复请求。
- 兼容矩阵：新闻 Grid、技术文档、论坛 Flex、卡片布局、表格、自定义标签/嵌套换行、过滤/展开共 7 种结构，加 600 段长列表；验证布局子项数量和列宽、链接事件不受破坏、SPA 切页、节点复用以及按视口请求。均为受控测试页面，模型响应为 mock。
- 浏览器测试：真实无头 Chrome 加载设置页；模拟扩展 API 和模型响应，验证保存/连接提示；使用人工构造的 PDF 验证真实 PDF.js 解析与绘制、译文显示。
- `tests/browser.mjs` 默认使用 macOS Chrome 路径，可按本机情况调整。
- 尚未完成真实用户模型端到端测试，也未以真实扩展身份自动验收权限弹窗和 Service Worker 生命周期。安装后请先运行连接测试，再翻译短文章验收。
