# 简译 <img src="docs/images/logo.png" alt="简译图标" width="36" height="36" align="absmiddle">

一个轻量、开源的 Chrome / Edge 双语阅读插件。使用你自己的大语言模型翻译网页和 PDF，无广告，无需注册。

## 能做什么

- **网页双语阅读**：译文放在原文下方，方便对照，保留链接和常见文字格式。
- **PDF 对照阅读**：左侧原文、右侧译文，按页翻译。
- **自选模型**：配置模型名、Base URL 和 API Key，也可以调整翻译 Prompt 和请求参数。
- **一键切换**：通过插件菜单或网页悬浮按钮显示、隐藏译文。

## 使用效果

网页双语阅读：原文与译文逐段对应，阅读时可以随时对照。

![网页双语阅读效果：HTTP 文档的英文标题和段落下方显示对应中文译文](docs/images/web-reading.png)

## 安装

[下载插件安装包](https://github.com/lc-beep/minimal-translate/releases/latest)，选择附件中的 `minimal-translate-v…zip`，无需安装 Node.js 或运行命令。

1. 解压安装包，将解压后的文件夹放在固定位置，使用期间保留它。
2. 打开 Chrome 的 `chrome://extensions/` 或 Edge 的 `edge://extensions/`。
3. 开启「开发者模式」，点击「加载已解压的扩展程序」，选择解压后的 `extension` 文件夹。
4. 点击浏览器工具栏的扩展图标，找到「简译」。建议将它固定到工具栏，方便随时翻译。

<details>
<summary>开发者：从源码构建</summary>

需要 Node.js 和 npm：

```sh
git clone https://github.com/lc-beep/minimal-translate.git
cd minimal-translate
npm ci
npm run build
```

然后按上面的步骤加载项目中的 `extension` 文件夹。

</details>

## 配置模型

首次打开简译，点击「连接模型，开始使用」，填写：

- **Base URL**：模型服务的接口地址，例如 `https://provider.example/v1`。
- **模型名**：填写服务商提供的准确名称。
- **API Key**：填写你的密钥；无鉴权的本地服务可以留空。

支持 OpenAI 兼容的 Chat Completions 接口。点击「保存并测试连接」，按提示允许访问模型地址。

连接成功后，点击「返回网页，开始阅读」，再通过简译菜单选择「翻译此页 / 隐藏译文」。目标语言默认为简体中文；需要时可展开「翻译偏好与高级参数」调整。

## 使用

**网页**：打开文章，点击插件菜单中的「翻译此页 / 隐藏译文」。向下滚动时会继续翻译；点击悬浮按钮可切换显示。如需在该网站常驻按钮，选择「在此网站显示悬浮按钮」。

**PDF（实验功能）**：先下载文件，再从插件菜单打开「PDF 对照阅读」，选择文件并点击「翻译本页」。翻译失败时可以重试，已完成的片段会保留。

更新时下载新安装包，将其中 `extension` 文件夹的内容覆盖到原安装位置，再在扩展管理页点击「重新加载」并刷新文章页。保持原安装路径可以保留模型设置。

## 使用须知

- API Key 保存在本机浏览器中，待翻译文本直接发送到你配置的模型服务。费用由该服务决定。
- PDF 需要包含可提取的文字，暂不支持扫描件 OCR；复杂分栏和公式请对照原文检查。
- 翻译质量和速度取决于所选模型，部分网页的特殊布局可能无法识别。

遇到问题或有建议，欢迎提交 [Issue](https://github.com/lc-beep/minimal-translate/issues)，附上网址或 PDF 页码、操作步骤和截图。请勿上传 API Key 等敏感信息。
