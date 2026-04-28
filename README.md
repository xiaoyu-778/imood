# iMood v2 🌙

> "The past is just a story we tell ourselves." — Her (2013)

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.21-blue.svg)](https://expressjs.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**iMood** 是一款灵感源自电影《Her》的沉浸式 AI 语音交互日记应用。通过与 AI 角色进行自然对话，记录你的情绪与思考，让每一次倾诉都成为珍贵的记忆。

![Demo](.github/docs/images/demo-preview.png)

## ✨ 核心特性

### 🎙️ 多模态 AI 交互

- **语音对话** - 像和朋友聊天一样与 AI 交流
- **文字输入** - 支持键盘输入，随时记录想法
- **图片触发** - 上传图片，AI 会主动发起对话
- **双语回复** - AI 用英文回复并自动翻译成中文，边聊边学英语

### 📔 智能情绪日记

- **AI 生成标题** - 自动为对话生成诗意标题
- **情绪标签** - 智能识别 10 种情绪状态（开心、悲伤、焦虑、平静等）
- **日记本管理** - 创建自定义日记本，分类整理记忆
- **时间轴展示** - 按时间线浏览所有日记

### 🎵 沉浸式音乐播放器

- **背景音乐** - 支持上传和播放本地音乐
- **智能音量** - AI 说话时自动降低音乐音量
- **声波动效** - 可视化音频波形，增强沉浸感
- **播放列表** - 管理个人音乐库

### 🎨 视觉体验

- **3D 粒子效果** - Three.js 实现的心形粒子背景
- **图片粒子** - 上传图片后粒子变成图片形态
- **星云动画** - AI 状态可视化（思考/说话/空闲）
- **明暗主题** - 支持暗色/亮色模式切换
- **毛玻璃效果** - 现代化的 UI 设计

## 🚀 快速开始

### 环境要求

- Node.js 18+
- npm 或 yarn
- 阿里云 DashScope API Key

### 安装步骤

```bash
# 1. 克隆项目
git clone https://github.com/yourusername/imood-v2.git
cd imood-v2

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入你的 API Key

# 4. 启动服务
npm start

# 5. 访问应用
open http://localhost:3000
```

### 环境变量配置

```env
DASHSCOPE_API_KEY=your_api_key_here
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_NAME=qwen3.5-omni-flash
PORT=3000
```

## 🏗️ 技术架构

### 后端技术栈

| 技术                  | 用途                            |
| --------------------- | ------------------------------- |
| **Node.js + Express** | Web 服务器框架                  |
| **OpenAI SDK**        | AI API 调用（兼容 OpenAI 格式） |
| **Multer**            | 文件上传处理                    |
| **JSON 文件存储**     | 轻量级数据持久化                |

### 前端技术栈

| 技术                     | 用途               |
| ------------------------ | ------------------ |
| **原生 HTML5/CSS3/ES6+** | 无框架，纯原生开发 |
| **Three.js**             | 3D 粒子效果渲染    |
| **Web Audio API**        | 音频可视化和处理   |
| **Server-Sent Events**   | AI 流式响应        |

### AI 服务

| 服务                 | 模型               | 用途              |
| -------------------- | ------------------ | ----------------- |
| **阿里云 DashScope** | qwen3.5-omni-flash | 主对话 + 语音合成 |

## 📚 文档导航

| 文档                                                    | 说明                         |
| ------------------------------------------------------- | ---------------------------- |
| [📖 完整文档](.github/docs/)                            | 项目详细文档目录             |
| [🔌 自定义模型接入](.github/docs/custom-model-guide.md) | 如何接入自己的全模态模型 API |
| [📡 API 文档](.github/docs/api-reference.md)            | RESTful API 接口说明         |
| [🏛️ 架构设计](.github/docs/architecture.md)             | 系统架构和技术选型说明       |
| [📝 开发笔记](Code%20with%20solo.md)                    | 开发过程记录                 |

## 🔌 接入自定义模型

iMood v2 支持接入任何兼容 OpenAI API 格式的全模态模型。无论是本地部署的模型还是其他云服务商的 API，都可以轻松集成。

### 支持的模型类型

- ✅ 文本对话模型（GPT-4、Claude、Qwen 等）
- ✅ 语音对话模型（支持音频输入输出）
- ✅ 视觉理解模型（支持图片输入）
- ✅ 全模态模型（同时支持文本/语音/图片）

### 快速配置

项目默认使用阿里云 DashScope：

```env
# .env 文件
DASHSCOPE_API_KEY=your_api_key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_NAME=qwen3.5-omni-flash
```

如需使用其他模型提供商（如 OpenAI、本地模型等），请参考 [自定义模型接入指南](.github/docs/custom-model-guide.md) 修改代码配置。

## 📸 功能展示

### 主界面

![Main Interface](.github/docs/images/main-interface.png)

### 日记时间轴

![Diary Timeline](.github/docs/images/diary-timeline.png)

### 音乐播放器

![Music Player](.github/docs/images/music-player.png)

### 图片粒子效果

![Image Particles](.github/docs/images/image-particles.png)

## 🤝 贡献指南

我们欢迎所有形式的贡献！

1. Fork 本项目
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 Pull Request

## 📄 许可证

本项目基于 [MIT](LICENSE) 许可证开源。

## 🙏 致谢

- 灵感来源：电影《Her》(2013)
- AI 服务：阿里云 DashScope
- 3D 渲染：Three.js

## 💬 联系我们

如有问题或建议，欢迎通过以下方式联系：

- 提交 [Issue](https://github.com/yourusername/imood-v2/issues)
- 发送邮件至 your.email@example.com

---

<p align="center">
  Made with ❤️ by Solo
</p>
