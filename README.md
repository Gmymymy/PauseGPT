# 🔍 TechLens - 技术视频智能识别助手

看技术视频时，按 **Alt+T** 或点击悬浮按钮，自动识别视频画面中出现的工具/平台/代码，一键获取官网和学习资源。

---

## 功能特性

- **一键识别**：视频暂停在关键画面，按 Alt+T 即可识别
- **识别内容**：工具名称、类别、描述、官网链接、教程链接
- **代码提取**：自动提取视频中出现的代码片段，支持一键复制
- **可拖动浮窗**：识别结果浮窗可自由拖动，不遮挡视频
- **支持平台**：B 站（bilibili.com）
- **底层模型**：阿里云 qwen-vl-max（通义千问 VL 旗舰版）

---

## 安装方法

### 第一步：获取阿里云 API Key

1. 访问 [阿里云百炼控制台](https://bailian.console.aliyun.com/#/api-key)
2. 登录后点击「创建 API Key」
3. 复制生成的 API Key（格式：`sk-xxxxxxxx`）
4. 新用户有免费额度，qwen-vl-max 每次识别约消耗 0.02 元

### 第二步：加载插件到 Chrome

1. 打开 Chrome 浏览器，地址栏输入：`chrome://extensions/`
2. 右上角开启「**开发者模式**」
3. 点击「**加载已解压的扩展程序**」
4. 选择本项目的 `techlens-extension` 文件夹
5. 插件图标出现在工具栏即安装成功

### 第三步：配置 API Key

1. 点击 Chrome 工具栏中的 🔍 TechLens 图标
2. 在弹窗中粘贴你的 API Key
3. 点击「保存设置」

---

## 使用方法

```
1. 打开 B 站任意视频
2. 播放到你想识别的画面，暂停视频
3. 按 Alt+T 或点击页面右下角的 🔍 悬浮按钮
4. 等待 2-5 秒，识别结果浮窗出现在右上角
5. 按 Esc 或点击 ✕ 关闭浮窗
```

### 快捷键

| 操作 | 快捷键 |
|------|--------|
| 识别当前画面 | `Alt + T` |
| 关闭浮窗 | `Esc` |

---

## 项目结构

```
techlens-extension/
├── manifest.json                 # 插件配置（Manifest V3）
├── background/
│   └── service_worker.js         # 后台：调用阿里云 Qwen-VL API
├── content/
│   ├── content.js                # 注入页面：截帧、快捷键、悬浮按钮
│   └── overlay.js                # 浮窗 UI 逻辑
├── styles/
│   └── overlay.css               # 浮窗和按钮样式
├── popup/
│   ├── popup.html                # 设置页面
│   └── popup.js                  # 设置页面逻辑
└── icons/                        # 插件图标（需自行添加）
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## 添加图标

插件需要图标才能正常显示。你可以：

**方法一（推荐）**：用任意图片编辑工具制作三个尺寸的 PNG 图标放入 `icons/` 目录：
- `icon16.png`（16×16 像素）
- `icon48.png`（48×48 像素）
- `icon128.png`（128×128 像素）

**方法二**：临时去掉 `manifest.json` 中的 `icons` 和 `default_icon` 字段，Chrome 会使用默认图标，不影响功能。

---

## 技术实现

| 模块 | 技术 |
|------|------|
| 插件框架 | Chrome Extension Manifest V3 |
| 截帧 | HTML5 Canvas API |
| 视觉识别 | 阿里云 qwen-vl-max（OpenAI 兼容接口）|
| 数据存储 | chrome.storage.sync |
| 通信机制 | chrome.runtime.sendMessage |

### 核心流程

```
用户触发（Alt+T 或点击按钮）
  ↓
content.js: Canvas 截取 video 当前帧 → base64 JPEG
  ↓
chrome.runtime.sendMessage → background/service_worker.js
  ↓
service_worker.js: 调用 DashScope API（qwen-vl-max）
  ↓
返回 JSON 识别结果
  ↓
content.js → overlay.js: 渲染结果浮窗
```

---

## 常见问题

**Q: 按 Alt+T 没有反应？**
A: 确认已在 B 站视频页（URL 包含 `/video/` 或 `/bangumi/`），且视频已加载完成。部分页面需要刷新后重试。

**Q: 提示「请先配置 API Key」？**
A: 点击工具栏插件图标，在设置页填入并保存 API Key。

**Q: 识别结果不准确？**
A: 尝试在画面最清晰的帧暂停后再识别。界面元素越完整，识别越准确。

**Q: API 调用失败？**
A: 检查 API Key 是否正确，以及阿里云账号余额是否充足。可在 [DashScope 控制台](https://dashscope.console.aliyun.com/) 查看用量。

**Q: 视频画面截不到？**
A: B 站部分视频有 DRM 保护，Canvas 无法截取受保护的视频帧，这是浏览器安全限制，无法绕过。

---

## 后续优化方向

- [ ] 支持 YouTube
- [ ] 识别结果自动保存到笔记库（RAG）
- [ ] 历史识别记录
- [ ] 学习路径推荐
- [ ] 支持识别直播画面
- [ ] 批量识别（自动截取关键帧）

---

## License

MIT
