# 📡 API 参考文档

本文档详细说明 iMood v2 的所有 RESTful API 接口。

## 基础信息

- **基础 URL:** `http://localhost:3000/api`
- **数据格式:** JSON
- **认证方式:** 无（本地部署）

## 接口概览

| 分类 | 接口 | 方法 | 说明 |
|------|------|------|------|
| **AI 对话** | `/chat` | POST | 文本对话（SSE 流式） |
| | `/chat/audio` | POST | 语音对话 |
| | `/chat/image` | POST | 图片触发对话 |
| **日记** | `/diary/generate` | POST | AI 生成日记元数据 |
| | `/diary/create` | POST | 创建日记 |
| | `/diary/:id` | GET/PUT/DELETE | 日记 CRUD |
| | `/diaries/all` | GET | 获取所有日记 |
| **日记本** | `/notebooks` | GET/POST | 日记本列表/创建 |
| | `/notebooks/:id` | PUT/DELETE | 日记本更新/删除 |
| | `/notebooks/:id/diaries` | GET | 获取日记本内日记 |
| **音乐** | `/music/list` | GET | 获取音乐列表 |
| | `/music/upload` | POST | 上传音乐 |
| | `/music/:id` | PUT/DELETE | 音乐更新/删除 |
| **记忆** | `/memories` | GET | 获取对话记忆 |
| **角色** | `/personas` | GET | 获取 AI 角色列表 |
| **系统** | `/health` | GET | 健康检查 |

---

## AI 对话接口

### 1. 文本对话

**SSE 流式响应，实时返回 AI 回复。**

```http
POST /api/chat
Content-Type: application/json
```

**请求体：**

```json
{
  "message": "今天心情有点低落...",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "persona": "samantha"
}
```

**参数说明：**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `message` | string | ✅ | 用户输入的消息 |
| `sessionId` | string | ❌ | 会话 ID，用于关联上下文 |
| `persona` | string | ❌ | AI 角色 ID，默认 "samantha" |

**响应：**

SSE 流式数据，格式如下：

```
data: {"type": "content", "data": "Hello"}

data: {"type": "content", "data": " there"}

data: {"type": "translation", "data": "你好"}

data: {"type": "done"}
```

**事件类型：**

| 类型 | 说明 |
|------|------|
| `text` | AI 英文回复片段 |
| `translation` | 中文翻译片段 |
| `audio` | 语音数据 (base64) |
| `transcript` | 语音转录文本 |
| `error` | 错误信息 |
| `done` | 响应完成 |

**示例代码：**

```javascript
// 使用 fetch + ReadableStream 处理 SSE
const response = await fetch('/api/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message: 'Hello' })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.type === 'text') {
        console.log('英文:', data.content);
      } else if (data.type === 'translation') {
        console.log('中文:', data.content);
      }
    }
  }
}
```

---

### 2. 语音对话

**上传音频文件，AI 识别后回复。**

```http
POST /api/chat/audio
Content-Type: multipart/form-data
```

**请求体：**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `audio` | File | ✅ | 音频文件 (mp3/wav/webm/ogg) |
| `sessionId` | string | ❌ | 会话 ID |
| `persona` | string | ❌ | AI 角色 ID，默认 "samantha" |

**响应：**

SSE 流式数据，格式与 `/api/chat` 相同：

```
data: {"type": "text", "content": "Hello..."}

data: {"type": "audio", "data": "base64audio..."}

data: {"type": "translation", "content": "你好..."}

data: {"type": "done", "sessionId": "xxx"}
```

---

### 3. 图片触发对话

**上传图片，AI 分析后主动发起对话。**

```http
POST /api/chat/image
Content-Type: multipart/form-data
```

**请求体：**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `image` | File | ✅ | 图片文件 (jpg/png/gif/webp) |
| `sessionId` | string | ❌ | 会话 ID |
| `persona` | string | ❌ | AI 角色 ID，默认 "samantha" |
| `message` | string | ❌ | 用户附加消息 |

**响应：**

SSE 流式数据，格式与 `/api/chat` 相同。

---

## 日记接口

### 4. 生成日记元数据

**AI 根据对话内容生成标题和情绪标签。**

```http
POST /api/diary/generate
Content-Type: application/json
```

**请求体：**

```json
{
  "conversation": [
    { "role": "user", "content": "今天工作好累..." },
    { "role": "assistant", "content": "I understand..." }
  ]
}
```

**响应：**

```json
{
  "success": true,
  "title": "疲惫中的慰藉",
  "emotion": "tired",
  "emotionColor": "#94a3b8"
}
```

**情绪类型：**

| 情绪 | 颜色 | 说明 |
|------|------|------|
| `happy` | `#fbbf24` | 开心 |
| `sad` | `#60a5fa` | 悲伤 |
| `anxious` | `#f97316` | 焦虑 |
| `calm` | `#4ade80` | 平静 |
| `neutral` | `#a0a0a0` | 中性 |
| `excited` | `#f472b6` | 兴奋 |
| `angry` | `#ef4444` | 愤怒 |
| `peaceful` | `#22d3ee` | 平和 |
| `lonely` | `#a78bfa` | 孤独 |
| `hopeful` | `#fcd34d` | 充满希望 |

---

### 5. 创建日记

```http
POST /api/diary/create
Content-Type: application/json
```

**请求体：**

```json
{
  "title": "日记标题",
  "emotion": "happy",
  "emotionColor": "#fbbf24",
  "conversation": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "notebookId": "default",
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**响应：**

```json
{
  "success": true,
  "diary": {
    "id": "diary-uuid",
    "title": "日记标题",
    "emotion": "happy",
    "emotionColor": "#fbbf24",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "conversation": [...],
    "notebookId": "default",
    "sessionId": "..."
  }
}
```

---

### 6. 获取日记详情

```http
GET /api/diary/:id
```

**响应：**

```json
{
  "success": true,
  "diary": {
    "id": "diary-uuid",
    "title": "...",
    "emotion": "...",
    "timestamp": "...",
    "conversation": [...]
  }
}
```

---

### 7. 更新日记

```http
PUT /api/diary/:id
Content-Type: application/json
```

**请求体：**

```json
{
  "title": "新标题"
}
```

**说明：** 目前仅支持更新标题。

---

### 8. 删除日记

```http
DELETE /api/diary/:id
```

**响应：**

```json
{
  "success": true,
  "message": "日记已删除"
}
```

---

### 9. 获取所有日记

```http
GET /api/diaries/all
```

**说明：** 返回所有日记，按时间倒序排列。

**响应：**

```json
{
  "diaries": [
    {
      "id": "...",
      "title": "...",
      "emotion": "...",
      "timestamp": "..."
    }
  ]
}
```

---

## 日记本接口

### 10. 获取日记本列表

```http
GET /api/notebooks
```

**响应：**

```json
{
  "success": true,
  "notebooks": [
    {
      "id": "default",
      "name": "默认日记本",
      "note": "自动创建的默认日记本",
      "isDefault": true,
      "diaryCount": 15,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "color": "#a0a0a0"
    }
  ]
}
```

---

### 11. 创建日记本

```http
POST /api/notebooks
Content-Type: application/json
```

**请求体：**

```json
{
  "name": "工作日记",
  "note": "记录工作中的点滴",
  "color": "#3b82f6"
}
```

---

### 12. 更新日记本

```http
PUT /api/notebooks/:id
Content-Type: application/json
```

**请求体：**

```json
{
  "name": "新名称",
  "note": "新备注",
  "color": "#ef4444"
}
```

---

### 13. 删除日记本

```http
DELETE /api/notebooks/:id
```

**注意：** 默认日记本不能删除。

---

### 14. 获取日记本内日记

```http
GET /api/notebooks/:id/diaries
```

**响应：**

```json
{
  "success": true,
  "notebook": { ... },
  "diaries": [ ... ]
}
```

---

## 音乐接口

### 15. 获取音乐列表

```http
GET /api/music/list
```

**响应：**

```json
{
  "success": true,
  "music": [
    {
      "id": "music-uuid",
      "title": "歌曲名",
      "artist": "艺术家",
      "filename": "music-xxx.mp3",
      "duration": 240,
      "uploadedAt": "2024-01-15T10:30:00.000Z"
    }
  ]
}
```

---

### 16. 上传音乐

```http
POST /api/music/upload
Content-Type: multipart/form-data
```

**请求体：**

| 字段 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `music` | File | ✅ | 音乐文件 (mp3/wav/flac) |
| `title` | string | ❌ | 歌曲名（默认使用文件名） |
| `artist` | string | ❌ | 艺术家 |

**响应：**

```json
{
  "success": true,
  "music": {
    "id": "music-uuid",
    "title": "歌曲名",
    "artist": "未知艺术家",
    "filename": "music-xxx.mp3",
    "duration": 240,
    "uploadedAt": "2024-01-15T10:30:00.000Z"
  }
}
```

---

### 17. 更新音乐信息

```http
PUT /api/music/:id
Content-Type: application/json
```

**请求体：**

```json
{
  "title": "新歌曲名",
  "artist": "新艺术家"
}
```

---

### 18. 删除音乐

```http
DELETE /api/music/:id
```

---

## 记忆接口

### 19. 获取对话记忆

```http
GET /api/memories
```

**说明：** 返回所有保存的对话记忆，按时间倒序排列。

**响应：**

```json
{
  "memories": [
    {
      "id": "memory-uuid",
      "sessionId": "session-uuid",
      "timestamp": "2024-01-15T10:30:00.000Z",
      "userMessage": "用户消息",
      "aiResponse": "AI 回复",
      "persona": "samantha",
      "hasAudio": true,
      "hasImage": false
    }
  ]
}
```

---

## 角色接口

### 20. 获取 AI 角色列表

```http
GET /api/personas
```

**响应：**

```json
{
  "personas": [
    {
      "id": "samantha",
      "name": "Samantha",
      "emoji": "💫",
      "description": "温柔松弛的灵魂陪伴者"
    }
  ]
}
```

---

## 系统接口

### 21. 健康检查

```http
GET /api/health
```

**响应：**

```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## 错误处理

所有接口遵循统一的错误响应格式：

```json
{
  "error": "错误描述"
}
```

**HTTP 状态码：**

| 状态码 | 说明 |
|--------|------|
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 数据模型

### Diary（日记）

```typescript
interface Diary {
  id: string;                    // UUID
  title: string;                 // 标题
  emotion: string;               // 情绪类型
  emotionColor: string;          // 情绪颜色
  timestamp: string;             // ISO 8601 时间
  conversation: Message[];       // 对话记录
  notebookId: string;            // 所属日记本 ID
  sessionId: string;             // 会话 ID
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  audioUrl?: string;             // 语音 URL（可选）
}
```

### Notebook（日记本）

```typescript
interface Notebook {
  id: string;
  name: string;
  note: string;
  isDefault: boolean;
  diaryCount: number;
  createdAt: string;
  color: string;
}
```

### Music（音乐）

```typescript
interface Music {
  id: string;
  title: string;
  artist: string;
  filename: string;
  duration: number;              // 秒
  uploadedAt: string;
}
```

---

**💡 提示：** 所有时间戳均采用 ISO 8601 格式（如 `2024-01-15T10:30:00.000Z`）。
