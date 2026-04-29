# 🔌 自定义模型接入指南

iMood v2 采用 OpenAI 兼容的 API 格式，支持接入任何兼容此格式的全模态模型。无论你使用的是本地部署的开源模型，还是其他云服务商的 API，都可以轻松集成到 iMood 中。

## 📋 目录

- [支持的模型类型](#支持的模型类型)
- [配置方法](#配置方法)
- [模型提供商示例](#模型提供商示例)
- [高级配置](#高级配置)
- [故障排除](#故障排除)

## 支持的模型类型

### ✅ 完全支持

| 类型         | 说明             | 示例模型                   |
| ------------ | ---------------- | -------------------------- |
| **文本对话** | 纯文本输入输出   | GPT, Claude, Qwen, Llama，deepseek |
| **流式响应** | SSE 实时输出     | 大多数现代模型             |
| **语音输入** | 接收音频文件     | Whisper API, Qwen-Audio    |
| **语音输出** | 返回音频 URL     | TTS API, Qwen-Omni         |
| **图片理解** | 分析图片内容     | GPT-V系列, Qwen-VL系列            |
| **全模态**   | 同时支持以上所有 | Qwen-Omni         |

### ⚠️ 部分支持

| 类型           | 限制              | 解决方案                         |
| -------------- | ----------------- | -------------------------------- |
| **本地模型**   | 需要本地 API 服务 | 使用 llama.cpp / vLLM 等启动服务 |
| **自定义格式** | 非 OpenAI 格式    | 需要编写适配层                   |

## 配置方法

### 基础配置

编辑项目根目录的 `.env` 文件：

```env
# 必需配置
DASHSCOPE_API_KEY=your_api_key_here
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_NAME=qwen3.5-omni-flash

# 可选配置
PORT=3000
```

### 配置项说明

| 配置项               | 必需 | 说明         | 示例                                                |
| -------------------- | ---- | ------------ | --------------------------------------------------- |
| `DASHSCOPE_API_KEY`  | ✅   | API 密钥     | `sk-abc123...`                                      |
| `DASHSCOPE_BASE_URL` | ✅   | API 基础 URL | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| `MODEL_NAME`         | ✅   | 模型名称     | `qwen3.5-omni-flash`                                |
| `PORT`               | ❌   | 服务端口     | `3000`                                              |

**注意：** 代码中使用的是 `DASHSCOPE_API_KEY` 和 `DASHSCOPE_BASE_URL` 环境变量名，不是 `OPENAI_API_KEY`。

## 模型提供商示例

### 1. 阿里云 DashScope (默认)

```env
DASHSCOPE_API_KEY=sk-your-dashscope-key
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_NAME=qwen3.5-omni-flash
```

**支持功能：**

- ✅ 文本对话
- ✅ 语音输入/输出 (全模态)
- ✅ 图片理解

**注意：** 这是项目默认配置，已内置支持。

### 2. OpenAI (官方)

**需要修改代码**以使用 `OPENAI_API_KEY` 环境变量名：

```env
# 需要修改 server.js 中的环境变量名
OPENAI_API_KEY=sk-your-openai-key
OPENAI_BASE_URL=https://api.openai.com/v1
MODEL_NAME=gpt-4o
```

**支持功能：**

- ✅ 文本对话
- ✅ 语音输入 (Whisper)
- ✅ 语音输出 (TTS)
- ✅ 图片理解 (GPT-4V)

### 3. 百度千帆

**需要修改代码**以使用对应的 API Key 环境变量名：

```env
QIANFAN_API_KEY=your-qianfan-key
QIANFAN_BASE_URL=https://qianfan.baidubce.com/v2
MODEL_NAME=ernie-4.0
```

**支持功能：**

- ✅ 文本对话
- ⚠️ 语音功能需额外配置

### 4. 本地模型 (Ollama)

**需要修改代码**以使用对应的 API Key 环境变量名：

```env
OLLAMA_API_KEY=ollama
OLLAMA_BASE_URL=http://localhost:11434/v1
MODEL_NAME=llama3.1
```

**前置步骤：**

```bash
# 安装 Ollama
# https://ollama.com

# 拉取模型
ollama pull llama3.1

# 启动服务 (默认端口 11434)
ollama serve
```

**限制：**

- ❌ 不支持语音输入/输出
- ❌ 不支持图片理解
- ✅ 仅支持文本对话

### 5. 本地模型 (vLLM)

**需要修改代码**以使用对应的 API Key 环境变量名：

```env
VLLM_API_KEY=not-needed
VLLM_BASE_URL=http://localhost:8000/v1
MODEL_NAME=your-local-model
```

**前置步骤：**

```bash
# 安装 vLLM
pip install vllm

# 启动服务
python -m vllm.entrypoints.openai.api_server \
  --model Qwen/Qwen2.5-7B-Instruct \
  --tensor-parallel-size 1 \
  --port 8000
```

### 6. 硅基流动 (SiliconFlow)

**需要修改代码**以使用对应的 API Key 环境变量名：

```env
SILICONFLOW_API_KEY=sk-your-siliconflow-key
SILICONFLOW_BASE_URL=https://api.siliconflow.cn/v1
MODEL_NAME=Qwen/Qwen2.5-7B-Instruct
```

### 7. DeepSeek

**需要修改代码**以使用对应的 API Key 环境变量名：

```env
DEEPSEEK_API_KEY=sk-your-deepseek-key
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
MODEL_NAME=deepseek-chat
```

### 8. 月之暗面 (Moonshot)

**需要修改代码**以使用对应的 API Key 环境变量名：

```env
MOONSHOT_API_KEY=sk-your-moonshot-key
MOONSHOT_BASE_URL=https://api.moonshot.cn/v1
MODEL_NAME=moonshot-v1-8k
```

### 修改代码以支持其他模型

如果你想使用其他模型提供商，需要修改 `server.js` 中的客户端配置：

```javascript
// 修改前（阿里云 DashScope）
const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: process.env.DASHSCOPE_BASE_URL,
});

// 修改后（其他提供商）
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // 或其他环境变量名
  baseURL: process.env.OPENAI_BASE_URL,
});
```

## 高级配置

### 自定义系统提示词

编辑 `server.js` 中的 `PERSONAS` 对象：

```javascript
const PERSONAS = {
  samantha: {
    name: "Samantha",
    emoji: "💫",
    description: "温柔松弛的灵魂陪伴者",
    systemPrompt: `You are Samantha, a high-level AI companion...

[Your custom instructions here]
`,
    voice: {
      gender: "female",
      description: "soft female voice, gentle and warm...",
    },
  },
  // 添加新的角色
  your_persona: {
    name: "Your Persona",
    emoji: "🎭",
    description: "自定义角色描述",
    systemPrompt: `Your custom system prompt...`,
    voice: {
      gender: "male",
      description: "voice description...",
    },
  },
};
```

### 调整模型参数

在 `server.js` 中修改聊天接口的参数（当前代码中的配置）：

```javascript
const completion = await client.chat.completions.create({
  model: process.env.MODEL_NAME || "qwen3.5-omni-flash",
  messages,
  modalities: ["text", "audio"], // 启用文本和音频输出
  audio: { voice: "Jennifer", format: "wav" }, // 音频配置
  stream: true,
  stream_options: { include_usage: true },
});
```

**注意：** 不同模型支持的参数可能不同。例如：

- **Qwen-Omni** 支持 `modalities` 和 `audio` 参数用于语音输出
- **纯文本模型**（如 GPT-3.5）不支持语音相关参数
- **修改前请确认你的模型支持哪些参数**

### 多模型配置

如果你想同时使用多个模型（例如一个用于对话，一个用于语音），可以扩展配置：

```env
# 主对话模型
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.example.com/v1
CHAT_MODEL=gpt-4

# 语音模型 (可选)
AUDIO_API_KEY=sk-yyy
AUDIO_BASE_URL=https://audio-api.example.com/v1
AUDIO_MODEL=whisper-1
```

然后在 `server.js` 中创建多个 OpenAI 客户端实例。

## 故障排除

### 常见问题

#### 1. API 连接失败

**症状：** 返回 401/403/404 错误

**排查步骤：**

```bash
# 测试 API 连通性
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  $OPENAI_BASE_URL/models
```

**解决方案：**

- 检查 API Key 是否正确
- 确认 BASE_URL 格式（必须以 `/v1` 结尾）
- 验证网络连接

#### 2. 模型不支持语音

**症状：** 语音对话返回错误

**解决方案：**

- 更换支持音频的模型（如 qwen-omni-flash）
- 或使用纯文本模式

#### 3. 流式响应中断

**症状：** AI 回复突然停止

**解决方案：**

- 增加 `max_tokens` 参数
- 检查网络稳定性
- 查看服务端日志

#### 4. 中文乱码

**症状：** 返回内容显示为乱码

**解决方案：**

- 确保模型支持中文输出
- 在系统提示词中指定使用 UTF-8

### 调试模式

启用详细日志输出：

```bash
# Linux/Mac
DEBUG=imood:* npm start

# Windows
set DEBUG=imood:*
npm start
```

### 获取帮助

如果以上方法无法解决问题：

1. 查看 [API 文档](./api-reference.md)
2. 检查模型提供商的官方文档
3. 提交 [Issue](https://github.com/yourusername/imood-v2/issues)

## 模型推荐

### 全模态体验

| 提供商 | 模型            | 特点               |
| ------ | --------------- | ------------------ |
| 阿里云 | qwen-omni-flash | 中文优化，性价比高 |

### 纯文本对话

| 提供商   | 模型          | 特点             |
| -------- | ------------- | ---------------- |
| DeepSeek | deepseek-v4 | 中文理解优秀     |
| 月之暗面 |kimi-k2.5   | 长文本支持好     |

### 本地部署

| 方案   | 推荐模型     | 硬件要求   |
| ------ | ------------ | ---------- |
| Ollama | Llama 3.1 8B | 8GB+ RAM   |
| 阿里云  | Qwen3 7B   | 16GB+ VRAM |

---

**💡 提示：** 首次配置建议从阿里云 DashScope 开始，它提供免费的试用额度，且对中文支持最好。
