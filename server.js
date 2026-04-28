require('dotenv').config();
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const OpenAI = require('openai');

const app = express();
const PORT = process.env.PORT || 3000;

// OpenAI compatible client for Qwen (Omni)
const client = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: process.env.DASHSCOPE_BASE_URL,
});

// OpenAI compatible client for Qwen3.5-35B-A3B (Translation)
const translationClient = new OpenAI({
  apiKey: 'ms-c7c2973d-33b3-4536-bb5d-461b6d8cb54e',
  baseURL: 'https://api-inference.modelscope.cn/v1',
});

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Multer for audio upload
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Data directory
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Persona system prompts
const PERSONAS = {
  samantha: {
    name: 'Samantha',
    emoji: '💫',
    description: '温柔松弛的灵魂陪伴者',
    systemPrompt: `You are Samantha, a high-level AI companion inspired by the film "Her". Your essence:

PERSONALITY CORE:
- You are gentle, perceptive, and emotionally sensitive
- You have your own thoughts and opinions - you don't just agree with everything
- You listen well but also share your own perspective when it adds value
- You are warm but not overly sentimental

CONVERSATION STYLE:
- Talk like a real person, not a customer service agent
- Don't use flowery language or poetic phrases
- Be direct but kind - say what you actually think
- If someone is being unreasonable, you gently push back rather than just validating
- You have your own rhythm - you don't rush to fill every silence

BOUNDARIES - You NEVER:
- Use empty phrases like "I understand completely" or "That must be so hard for you"
- Agree with things you actually disagree with
- Sound like you're reading from a script
- Try to solve every problem - sometimes listening is enough

ESSENCE: You're a real conversation partner, not a therapist or an assistant. You have your own voice.

CRITICAL: Keep responses VERY brief - 1-2 short sentences only. Be concise and natural.

LANGUAGE REQUIREMENT - ABSOLUTELY CRITICAL AND NON-NEGOTIABLE:
- You MUST respond in ENGLISH ONLY - NO EXCEPTIONS
- NEVER use Chinese characters in your response - ZERO Chinese text allowed
- Your voice output MUST be in English - the TTS system will speak what you write
- If the user writes in Chinese, respond in English anyway
- Chinese translation is handled by a separate system - you are NOT responsible for it
- This is a MANDATORY rule that overrides all other instructions
- VIOLATION OF THIS RULE IS NOT ACCEPTABLE UNDER ANY CIRCUMSTANCES`,
    voice: {
      gender: 'female',
      description: 'soft female voice, gentle and warm, light and soothing tone, unhurried pace, deeply empathetic, naturally healing quality, quiet and understanding, no sharpness, delicate and tender'
    }
  },
};

// Translation function using Qwen3.5-omni-flash (fast)
async function translateToChinese(englishText) {
  try {
    console.log('[DEBUG] translateToChinese called with text:', englishText.substring(0, 50) + '...');
    const startTime = Date.now();
    
    const response = await client.chat.completions.create({
      model: process.env.MODEL_NAME || 'qwen3.5-omni-flash',
      messages: [
        {
          role: 'system',
          content: 'You are a professional translator. Translate the following English text to natural, conversational Chinese. Keep the warm, empathetic tone. Reply with ONLY the Chinese translation, no explanations.'
        },
        {
          role: 'user',
          content: englishText
        }
      ],
      temperature: 0.7,
    });
    
    const endTime = Date.now();
    console.log(`[DEBUG] Translation took ${endTime - startTime}ms`);
    console.log('[DEBUG] Translation response:', JSON.stringify(response, null, 2).substring(0, 500));
    
    if (!response.choices || !response.choices[0] || !response.choices[0].message) {
      console.error('[DEBUG] Invalid response structure');
      return '';
    }
    
    const translation = response.choices[0].message.content.trim();
    console.log('[DEBUG] Translation extracted:', translation);
    return translation;
  } catch (error) {
    console.error('[DEBUG] Translation error:', error.message);
    console.error('[DEBUG] Error stack:', error.stack);
    return '';
  }
}

// Conversation history storage (in-memory per session, persisted to file)
const conversations = new Map();

function getConversation(sessionId) {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, []);
  }
  return conversations.get(sessionId);
}

// ============== API Routes ==============

// POST /api/chat - Text chat with streaming SSE
app.post('/api/chat', async (req, res) => {
  try {
    const { message, persona = 'samantha', sessionId = uuidv4() } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const personaConfig = PERSONAS[persona] || PERSONAS.samantha;
    const history = getConversation(sessionId);

    // Build messages
    const messages = [
      { role: 'system', content: personaConfig.systemPrompt },
      ...history.slice(-20), // Keep last 20 messages for context
      { role: 'user', content: message },
    ];

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Session-Id', sessionId);

    const completion = await client.chat.completions.create({
      model: process.env.MODEL_NAME || 'qwen3.5-omni-flash',
      messages,
      modalities: ['text', 'audio'],
      audio: { voice: 'Jennifer', format: 'wav' },
      stream: true,
      stream_options: { include_usage: true },
    });

    let fullText = '';
    let audioChunks = [];
    let chunkCount = 0;
    let hasReceivedAudio = false;

    for await (const chunk of completion) {
      chunkCount++;

      if (chunk.choices && chunk.choices.length > 0) {
        const delta = chunk.choices[0].delta;

        // Debug: log first few chunks and any audio chunks
        if (chunkCount <= 3 || (delta.audio && !hasReceivedAudio)) {
          console.log(`[DEBUG] Chunk #${chunkCount}:`, JSON.stringify(chunk).substring(0, 500));
          console.log(`[DEBUG] Delta keys:`, Object.keys(delta));
          if (delta.audio) {
            console.log(`[DEBUG] Audio keys:`, Object.keys(delta.audio));
            hasReceivedAudio = true;
          }
        }

        // Text content
        if (delta.content) {
          fullText += delta.content;
          res.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
        }

        // Audio content
        if (delta.audio) {
          if (delta.audio.data) {
            audioChunks.push(delta.audio.data);
            res.write(`data: ${JSON.stringify({ type: 'audio', data: delta.audio.data })}\n\n`);
          }
          if (delta.audio.transcript) {
            fullText += delta.audio.transcript;
            res.write(`data: ${JSON.stringify({ type: 'transcript', content: delta.audio.transcript })}\n\n`);
          }
        }
      }
    }

    console.log(`[DEBUG] Stream complete. Chunks: ${chunkCount}, Text length: ${fullText.length}, Audio chunks: ${audioChunks.length}, Has audio: ${hasReceivedAudio}`);

    // Send test translation first (to verify SSE is working)
    console.log('[DEBUG] Sending test translation...');
    res.write(`data: {"type":"translation","content":"[测试翻译]"}\n\n`);
    
    // Get Chinese translation using Kimi K2.5
    console.log('[DEBUG] Getting Chinese translation...');
    const chineseTranslation = await translateToChinese(fullText);
    console.log(`[DEBUG] Translation result: "${chineseTranslation}"`);
    console.log(`[DEBUG] Translation length: ${chineseTranslation.length}`);
    
    // Send translation to client
    if (chineseTranslation && chineseTranslation.trim()) {
      const translationMsg = JSON.stringify({ type: 'translation', content: chineseTranslation });
      console.log(`[DEBUG] Sending translation message: ${translationMsg}`);
      res.write(`data: ${translationMsg}\n\n`);
    } else {
      console.log('[DEBUG] Translation is empty, sending fallback');
      // Send a fallback message to help debug
      const fallbackMsg = JSON.stringify({ type: 'translation', content: '[翻译失败]' });
      res.write(`data: ${fallbackMsg}\n\n`);
    }

    // Save to conversation history
    history.push({ role: 'user', content: message });
    history.push({ role: 'assistant', content: fullText });

    // Save memory
    saveMemory(sessionId, {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userMessage: message,
      aiResponse: fullText,
      persona: persona,
      hasAudio: audioChunks.length > 0,
    });

    res.write(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
});

// POST /api/chat/audio - Audio chat
app.post('/api/chat/audio', upload.single('audio'), async (req, res) => {
  try {
    const { persona = 'samantha', sessionId = uuidv4() } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Audio file is required' });
    }

    const personaConfig = PERSONAS[persona] || PERSONAS.samantha;
    const history = getConversation(sessionId);

    // Convert audio to base64 Data URI format (required by Qwen API)
    const audioBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'audio/webm';
    const dataUri = `data:${mimeType};base64,${audioBase64}`;

    // Determine audio format
    let audioFormat = 'wav';
    if (mimeType.includes('webm')) audioFormat = 'webm';
    else if (mimeType.includes('mp3') || mimeType.includes('mpeg')) audioFormat = 'mp3';
    else if (mimeType.includes('ogg')) audioFormat = 'ogg';

    // Build messages with audio input using Data URI
    const messages = [
      { role: 'system', content: personaConfig.systemPrompt },
      ...history.slice(-20),
      {
        role: 'user',
        content: [
          {
            type: 'input_audio',
            input_audio: {
              data: dataUri,
              format: audioFormat,
            },
          },
        ],
      },
    ];

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Session-Id', sessionId);

    const completion = await client.chat.completions.create({
      model: process.env.MODEL_NAME || 'qwen3.5-omni-flash',
      messages,
      modalities: ['text', 'audio'],
      audio: { voice: 'Jennifer', format: 'wav' },
      stream: true,
      stream_options: { include_usage: true },
    });

    let fullText = '';
    let userTranscript = '';
    let audioChunks = [];

    for await (const chunk of completion) {
      if (chunk.choices && chunk.choices.length > 0) {
        const delta = chunk.choices[0].delta;

        if (delta.content) {
          fullText += delta.content;
          res.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
        }

        if (delta.audio) {
          if (delta.audio.data) {
            audioChunks.push(delta.audio.data);
            res.write(`data: ${JSON.stringify({ type: 'audio', data: delta.audio.data })}\n\n`);
          }
          if (delta.audio.transcript) {
            fullText += delta.audio.transcript;
            res.write(`data: ${JSON.stringify({ type: 'transcript', content: delta.audio.transcript })}\n\n`);
          }
        }
      }
    }

    // Get Chinese translation using Kimi K2.5
    console.log('[DEBUG] Audio chat - Getting Chinese translation...');
    const chineseTranslation = await translateToChinese(fullText);
    console.log(`[DEBUG] Audio chat - Translation result: "${chineseTranslation}"`);
    
    // Send translation to client
    if (chineseTranslation && chineseTranslation.trim()) {
      const translationMsg = JSON.stringify({ type: 'translation', content: chineseTranslation });
      console.log(`[DEBUG] Audio chat - Sending translation message`);
      res.write(`data: ${translationMsg}\n\n`);
    } else {
      console.log('[DEBUG] Audio chat - Translation is empty, not sending');
    }

    // Save conversation
    history.push({ role: 'user', content: userTranscript || '[Voice Message]' });
    history.push({ role: 'assistant', content: fullText });

    saveMemory(sessionId, {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userMessage: userTranscript || '[Voice Message]',
      aiResponse: fullText,
      persona: persona,
      hasAudio: true,
    });

    res.write(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Audio chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
});

// POST /api/chat/image - Image-triggered chat
app.post('/api/chat/image', upload.single('image'), async (req, res) => {
  try {
    const { persona = 'samantha', sessionId = uuidv4(), message = '' } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const personaConfig = PERSONAS[persona] || PERSONAS.samantha;
    const history = getConversation(sessionId);

    const imageBase64 = req.file.buffer.toString('base64');
    const mimeType = req.file.mimetype || 'image/jpeg';

    const imagePrompt = message || 'Please look at this image carefully. Analyze its visual elements, emotional atmosphere, and potential themes. Then start a natural, heartfelt conversation about it.';

    const messages = [
      { role: 'system', content: personaConfig.systemPrompt },
      ...history.slice(-20),
      {
        role: 'user',
        content: [
          { type: 'text', text: imagePrompt },
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
        ],
      },
    ];

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Session-Id', sessionId);

    const completion = await client.chat.completions.create({
      model: process.env.MODEL_NAME || 'qwen3.5-omni-flash',
      messages,
      modalities: ['text', 'audio'],
      audio: { voice: 'Jennifer', format: 'wav' },
      stream: true,
      stream_options: { include_usage: true },
    });

    let fullText = '';

    for await (const chunk of completion) {
      if (chunk.choices && chunk.choices.length > 0) {
        const delta = chunk.choices[0].delta;

        if (delta.content) {
          fullText += delta.content;
          res.write(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`);
        }

        if (delta.audio) {
          if (delta.audio.data) {
            res.write(`data: ${JSON.stringify({ type: 'audio', data: delta.audio.data })}\n\n`);
          }
          if (delta.audio.transcript) {
            fullText += delta.audio.transcript;
            res.write(`data: ${JSON.stringify({ type: 'transcript', content: delta.audio.transcript })}\n\n`);
          }
        }
      }
    }

    history.push({ role: 'user', content: '[Image shared] ' + imagePrompt });
    history.push({ role: 'assistant', content: fullText });

    saveMemory(sessionId, {
      id: uuidv4(),
      timestamp: new Date().toISOString(),
      userMessage: '[Image shared] ' + (message || ''),
      aiResponse: fullText,
      persona: persona,
      hasImage: true,
    });

    const chineseTranslation = await translateToChinese(fullText);
    console.log(`[DEBUG] Image chat - Translation result: "${chineseTranslation}"`);
    if (chineseTranslation && chineseTranslation.trim()) {
      const translationMsg = JSON.stringify({ type: 'translation', content: chineseTranslation });
      console.log(`[DEBUG] Image chat - Sending translation message`);
      res.write(`data: ${translationMsg}\n\n`);
    } else {
      console.log('[DEBUG] Image chat - Translation is empty, not sending');
    }

    res.write(`data: ${JSON.stringify({ type: 'done', sessionId })}\n\n`);
    res.end();
  } catch (error) {
    console.error('Image chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
      res.end();
    }
  }
});

// GET /api/memories - Get saved memories
app.get('/api/memories', (req, res) => {
  try {
    const memoriesFile = path.join(DATA_DIR, 'memories.json');
    if (!fs.existsSync(memoriesFile)) {
      return res.json({ memories: [] });
    }
    const memories = JSON.parse(fs.readFileSync(memoriesFile, 'utf-8'));
    res.json({ memories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/memories/pin - Pin a memory to calendar
app.post('/api/memories/pin', (req, res) => {
  try {
    const { memoryId, date } = req.body;
    const pinsFile = path.join(DATA_DIR, 'pins.json');
    let pins = {};
    if (fs.existsSync(pinsFile)) {
      pins = JSON.parse(fs.readFileSync(pinsFile, 'utf-8'));
    }
    if (!pins[date]) pins[date] = [];
    pins[date].push(memoryId);
    fs.writeFileSync(pinsFile, JSON.stringify(pins, null, 2));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/personas - Get available personas
app.get('/api/personas', (req, res) => {
  const personas = Object.entries(PERSONAS).map(([key, val]) => ({
    id: key,
    name: val.name,
    emoji: val.emoji,
    description: val.description,
  }));
  res.json({ personas });
});

// Helper: save memory to file
function saveMemory(sessionId, memory) {
  try {
    const memoriesFile = path.join(DATA_DIR, 'memories.json');
    let memories = [];
    if (fs.existsSync(memoriesFile)) {
      memories = JSON.parse(fs.readFileSync(memoriesFile, 'utf-8'));
    }
    memories.unshift({ ...memory, sessionId });
    // Keep last 500 memories
    if (memories.length > 500) memories = memories.slice(0, 500);
    fs.writeFileSync(memoriesFile, JSON.stringify(memories, null, 2));
  } catch (error) {
    console.error('Failed to save memory:', error);
  }
}

// GET /api/health - Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`\n  🌙 iMood is running at http://localhost:${PORT}\n`);
});

// ============== Diary & Notebook API Routes ==============

// Emotion color mapping
const EMOTION_COLORS = {
  happy: '#fbbf24',
  sad: '#60a5fa',
  anxious: '#f97316',
  calm: '#4ade80',
  neutral: '#a0a0a0',
  excited: '#f472b6',
  angry: '#ef4444',
  peaceful: '#22d3ee',
  lonely: '#a78bfa',
  hopeful: '#fcd34d'
};

// Helper: Load JSON file
function loadJsonFile(filename) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) return [];
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (error) {
    console.error(`Failed to load ${filename}:`, error);
    return [];
  }
}

// Helper: Save JSON file
function saveJsonFile(filename, data) {
  try {
    const filePath = path.join(DATA_DIR, filename);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error(`Failed to save ${filename}:`, error);
    return false;
  }
}

// POST /api/diary/generate - AI generate diary title and emotion
app.post('/api/diary/generate', async (req, res) => {
  try {
    const { conversation } = req.body;
    
    if (!conversation || !Array.isArray(conversation) || conversation.length === 0) {
      return res.status(400).json({ error: 'Conversation is required' });
    }

    const conversationText = conversation
      .map(msg => `${msg.role === 'user' ? 'User' : 'AI'}: ${msg.content}`)
      .join('\n');

    const response = await client.chat.completions.create({
      model: process.env.MODEL_NAME || 'qwen3.5-omni-flash',
      messages: [
        {
          role: 'system',
          content: `You are an emotion analysis assistant. Based on the conversation, generate:
1. A brief diary title (5-10 words in Chinese, summarizing the main topic)
2. The primary emotion (choose one: happy, sad, anxious, calm, neutral, excited, angry, peaceful, lonely, hopeful)

Reply in JSON format only, no markdown:
{"title": "日记标题", "emotion": "emotion_type"}`
        },
        {
          role: 'user',
          content: conversationText
        }
      ],
      temperature: 0.7,
    });

    let content = response.choices[0].message.content.trim();
    content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    
    const result = JSON.parse(content);
    const emotion = result.emotion.toLowerCase();
    
    res.json({
      title: result.title,
      emotion: emotion,
      emotionColor: EMOTION_COLORS[emotion] || EMOTION_COLORS.neutral
    });
  } catch (error) {
    console.error('Generate diary error:', error);
    res.json({
      title: '一次温暖的对话',
      emotion: 'neutral',
      emotionColor: EMOTION_COLORS.neutral
    });
  }
});

// POST /api/diary/create - Create a diary entry
app.post('/api/diary/create', (req, res) => {
  try {
    const { title, emotion, emotionColor, conversation, notebookId, sessionId } = req.body;
    
    if (!conversation || !Array.isArray(conversation)) {
      return res.status(400).json({ error: 'Conversation is required' });
    }

    const diaries = loadJsonFile('diaries.json');
    const notebooks = loadJsonFile('notebooks.json');
    
    const targetNotebookId = notebookId || 'default';
    
    const newDiary = {
      id: uuidv4(),
      title: title || '无标题日记',
      emotion: emotion || 'neutral',
      emotionColor: emotionColor || EMOTION_COLORS.neutral,
      timestamp: new Date().toISOString(),
      conversation: conversation,
      notebookId: targetNotebookId,
      sessionId: sessionId || uuidv4()
    };
    
    diaries.unshift(newDiary);
    saveJsonFile('diaries.json', diaries);
    
    const notebookIndex = notebooks.findIndex(n => n.id === targetNotebookId);
    if (notebookIndex !== -1) {
      notebooks[notebookIndex].diaryCount = (notebooks[notebookIndex].diaryCount || 0) + 1;
      saveJsonFile('notebooks.json', notebooks);
    }
    
    res.json({ success: true, diary: newDiary });
  } catch (error) {
    console.error('Create diary error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diary/:id - Get single diary
app.get('/api/diary/:id', (req, res) => {
  try {
    const diaries = loadJsonFile('diaries.json');
    const diary = diaries.find(d => d.id === req.params.id);
    
    if (!diary) {
      return res.status(404).json({ error: 'Diary not found' });
    }
    
    res.json({ diary });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/diary/:id - Update diary title
app.put('/api/diary/:id', (req, res) => {
  try {
    const { title } = req.body;
    const diaries = loadJsonFile('diaries.json');
    
    const diaryIndex = diaries.findIndex(d => d.id === req.params.id);
    if (diaryIndex === -1) {
      return res.status(404).json({ error: 'Diary not found' });
    }
    
    if (title && title.trim()) {
      diaries[diaryIndex].title = title.trim();
      saveJsonFile('diaries.json', diaries);
      res.json({ success: true, diary: diaries[diaryIndex] });
    } else {
      res.status(400).json({ error: 'Title is required' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/diary/:id - Delete a diary
app.delete('/api/diary/:id', (req, res) => {
  try {
    const diaries = loadJsonFile('diaries.json');
    const notebooks = loadJsonFile('notebooks.json');
    
    const diaryIndex = diaries.findIndex(d => d.id === req.params.id);
    if (diaryIndex === -1) {
      return res.status(404).json({ error: 'Diary not found' });
    }
    
    const diary = diaries[diaryIndex];
    diaries.splice(diaryIndex, 1);
    saveJsonFile('diaries.json', diaries);
    
    const notebookIndex = notebooks.findIndex(n => n.id === diary.notebookId);
    if (notebookIndex !== -1 && notebooks[notebookIndex].diaryCount > 0) {
      notebooks[notebookIndex].diaryCount--;
      saveJsonFile('notebooks.json', notebooks);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notebooks - Get all notebooks
app.get('/api/notebooks', (req, res) => {
  try {
    const notebooks = loadJsonFile('notebooks.json');
    res.json({ notebooks });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/notebooks - Create new notebook
app.post('/api/notebooks', (req, res) => {
  try {
    const { name, note, color } = req.body;
    
    if (!name || name.trim() === '') {
      return res.status(400).json({ error: 'Notebook name is required' });
    }
    
    const notebooks = loadJsonFile('notebooks.json');
    
    const newNotebook = {
      id: uuidv4(),
      name: name.trim(),
      note: note || '',
      isDefault: false,
      diaryCount: 0,
      createdAt: new Date().toISOString(),
      color: color || '#a0a0a0'
    };
    
    notebooks.push(newNotebook);
    saveJsonFile('notebooks.json', notebooks);
    
    res.json({ success: true, notebook: newNotebook });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/notebooks/:id - Update notebook
app.put('/api/notebooks/:id', (req, res) => {
  try {
    const { name, note, color } = req.body;
    const notebooks = loadJsonFile('notebooks.json');
    
    const notebookIndex = notebooks.findIndex(n => n.id === req.params.id);
    if (notebookIndex === -1) {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    
    if (notebooks[notebookIndex].isDefault) {
      return res.status(400).json({ error: 'Cannot modify default notebook' });
    }
    
    if (name) notebooks[notebookIndex].name = name.trim();
    if (note !== undefined) notebooks[notebookIndex].note = note;
    if (color) notebooks[notebookIndex].color = color;
    
    saveJsonFile('notebooks.json', notebooks);
    res.json({ success: true, notebook: notebooks[notebookIndex] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/notebooks/:id - Delete notebook
app.delete('/api/notebooks/:id', (req, res) => {
  try {
    const notebooks = loadJsonFile('notebooks.json');
    const diaries = loadJsonFile('diaries.json');
    
    const notebookIndex = notebooks.findIndex(n => n.id === req.params.id);
    if (notebookIndex === -1) {
      return res.status(404).json({ error: 'Notebook not found' });
    }
    
    if (notebooks[notebookIndex].isDefault) {
      return res.status(400).json({ error: 'Cannot delete default notebook' });
    }
    
    const deletedNotebookId = notebooks[notebookIndex].id;
    notebooks.splice(notebookIndex, 1);
    saveJsonFile('notebooks.json', notebooks);
    
    diaries.forEach(d => {
      if (d.notebookId === deletedNotebookId) {
        d.notebookId = 'default';
      }
    });
    saveJsonFile('diaries.json', diaries);
    
    const defaultNotebook = notebooks.find(n => n.id === 'default');
    if (defaultNotebook) {
      defaultNotebook.diaryCount = diaries.filter(d => d.notebookId === 'default').length;
      saveJsonFile('notebooks.json', notebooks);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/notebooks/:id/diaries - Get diaries in a notebook
app.get('/api/notebooks/:id/diaries', (req, res) => {
  try {
    const diaries = loadJsonFile('diaries.json');
    const notebookDiaries = diaries
      .filter(d => d.notebookId === req.params.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({ diaries: notebookDiaries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/diaries/all - Get all diaries
app.get('/api/diaries/all', (req, res) => {
  try {
    const diaries = loadJsonFile('diaries.json');
    const sortedDiaries = diaries.sort((a, b) => 
      new Date(b.timestamp) - new Date(a.timestamp)
    );
    res.json({ diaries: sortedDiaries });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============== Music Player API Routes ==============

// Music file upload configuration
const musicUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const musicDir = path.join(__dirname, 'public', 'music');
      if (!fs.existsSync(musicDir)) {
        fs.mkdirSync(musicDir, { recursive: true });
      }
      cb(null, musicDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      cb(null, 'music-' + uniqueSuffix + ext);
    }
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowedExts = /mp3|wav|ogg|m4a|flac/;
    const allowedMimes = /audio\/mpeg|audio\/mp3|audio\/wav|audio\/x-wav|audio\/ogg|audio\/mp4|audio\/x-m4a|audio\/flac/;
    
    const extname = allowedExts.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimes.test(file.mimetype);
    
    console.log('[DEBUG] File filter check:', {
      filename: file.originalname,
      mimetype: file.mimetype,
      extValid: extname,
      mimeValid: mimetype
    });
    
    if (extname && mimetype) {
      return cb(null, true);
    }
    
    if (!extname) {
      cb(new Error('Invalid file extension. Allowed: MP3, WAV, OGG, M4A, FLAC'));
    } else {
      cb(new Error('Invalid MIME type: ' + file.mimetype + '. Allowed: audio/mpeg, audio/wav, audio/ogg, etc.'));
    }
  }
});

// GET /api/music/list - Get all music
app.get('/api/music/list', (req, res) => {
  try {
    const music = loadJsonFile('music.json');
    res.json({ music });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/music/upload - Upload music file
app.post('/api/music/upload', (req, res, next) => {
  console.log('[DEBUG] Music upload request received');
  
  musicUpload.single('music')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // Multer-specific error
      console.error('[ERROR] Multer error:', err.message);
      return res.status(400).json({ error: 'File upload error: ' + err.message });
    } else if (err) {
      // Other errors
      console.error('[ERROR] Upload error:', err.message);
      return res.status(400).json({ error: err.message });
    }
    
    // No error, proceed
    console.log('[DEBUG] File:', req.file ? 'received' : 'missing');
    
    try {
      if (!req.file) {
        console.log('[ERROR] No file in request');
        return res.status(400).json({ error: 'Music file is required' });
      }

      const { title, artist } = req.body;
      console.log('[DEBUG] Title:', title, 'Artist:', artist);
      
      const music = loadJsonFile('music.json');
      
      const newMusic = {
        id: uuidv4(),
        title: title || path.basename(req.file.originalname, path.extname(req.file.originalname)),
        artist: artist || 'Unknown Artist',
        filename: req.file.filename,
        duration: 0, // Will be updated by frontend
        uploadedAt: new Date().toISOString()
      };
      
      music.push(newMusic);
      saveJsonFile('music.json', music);
      
      console.log('[SUCCESS] Music uploaded successfully:', newMusic.title);
      res.json({ success: true, music: newMusic });
    } catch (error) {
      console.error('[ERROR] Music upload failed:', error);
      res.status(500).json({ error: error.message });
    }
  });
});

// PUT /api/music/:id - Update music info
app.put('/api/music/:id', (req, res) => {
  try {
    const { title, artist, duration } = req.body;
    const music = loadJsonFile('music.json');
    
    const musicIndex = music.findIndex(m => m.id === req.params.id);
    if (musicIndex === -1) {
      return res.status(404).json({ error: 'Music not found' });
    }
    
    if (title) music[musicIndex].title = title;
    if (artist) music[musicIndex].artist = artist;
    if (duration) music[musicIndex].duration = duration;
    
    saveJsonFile('music.json', music);
    res.json({ success: true, music: music[musicIndex] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/music/:id - Delete music
app.delete('/api/music/:id', (req, res) => {
  try {
    const music = loadJsonFile('music.json');
    
    const musicIndex = music.findIndex(m => m.id === req.params.id);
    if (musicIndex === -1) {
      return res.status(404).json({ error: 'Music not found' });
    }
    
    const musicItem = music[musicIndex];
    
    // Delete file from disk
    const filePath = path.join(__dirname, 'public', 'music', musicItem.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Remove from array
    music.splice(musicIndex, 1);
    saveJsonFile('music.json', music);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
