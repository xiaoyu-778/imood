/**
 * iMood — AI Voice Diary Application
 * Immersive Voice Interface
 */

// ============================================
// App State
// ============================================
const state = {
  currentPersona: 'samantha',
  sessionId: null,
  isRecording: false,
  isPlaying: false,
  isProcessing: false,
  mediaRecorder: null,
  audioChunks: [],
  audioContext: null,
  analyser: null,
  memories: [],
  currentMonth: new Date(),
  currentSubtitle: '',
  currentTranslation: '',
  currentConversation: [],
  hasConversation: false,
};

// Persona config (mirrors server) - Samantha Only
const PERSONA_CONFIG = {
  samantha: { name: 'Samantha', emoji: '💫', color: '#a78bfa' },
};

// ============================================
// DOM Elements
// ============================================
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const elements = {
  bgCanvas: $('#bgCanvas'),
  nebulaCanvas: $('#nebulaCanvas'),
  nebulaContainer: $('#nebulaContainer'),
  aiStatus: $('#aiStatus'),
  statusDot: $('#statusDot'),
  textInput: $('#textInput'),
  sendBtn: $('#sendBtn'),
  imageInput: $('#imageInput'),
  overlay: $('#overlay'),
  waveformCanvas: $('#waveformCanvas'),
  waveformContainer: $('#waveformContainer'),
  subtitleText: $('#subtitleText'),
  subtitleTranslation: $('#subtitleTranslation'),
  aiBubble: $('#aiBubble'),
  aiBubbleContent: $('#aiBubbleContent'),
  aiBubbleEn: $('#aiBubbleEn'),
  aiBubbleCn: $('#aiBubbleCn'),
  aiBubbleExpandBtn: $('#aiBubbleExpandBtn'),
  voiceWaveformCapsule: $('#voiceWaveformCapsule'),
  voiceWaveformCanvas: $('#voiceWaveformCanvas'),
};

// ============================================
// Background Particle System
// ============================================
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.initParticles();
  }

  initParticles() {
    this.particles = [];
    const count = Math.floor((this.canvas.width * this.canvas.height) / 15000);
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        size: Math.random() * 1.5 + 0.5,
        speedX: (Math.random() - 0.5) * 0.15,
        speedY: (Math.random() - 0.5) * 0.15,
        opacity: Math.random() * 0.5 + 0.1,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.02 + 0.005,
      });
    }
  }

  update() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.particles.forEach((p) => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.pulse += p.pulseSpeed;

      // Wrap
      if (p.x < 0) p.x = this.canvas.width;
      if (p.x > this.canvas.width) p.x = 0;
      if (p.y < 0) p.y = this.canvas.height;
      if (p.y > this.canvas.height) p.y = 0;

      const alpha = p.opacity * (0.5 + 0.5 * Math.sin(p.pulse));
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      // Monochrome particle color - silver/gray
      this.ctx.fillStyle = `rgba(180, 180, 180, ${alpha})`;
      this.ctx.fill();
    });
  }

  animate() {
    this.update();
    requestAnimationFrame(() => this.animate());
  }
}

// ============================================
// Waveform Visualizer - Minimalist White Neon Lines
// ============================================
class WaveformVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isActive = false;
    this.dataArray = null;
    this.analyser = null;
    this.time = 0;
    this.smoothData = [];
    this.particles = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth;
    this.canvas.height = container.clientHeight;
    // Initialize smooth data array
    this.smoothData = new Array(80).fill(0);
    // Initialize scattered particles
    this.initParticles();
  }

  initParticles() {
    this.particles = [];
    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
      this.particles.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 1.5 + 0.5,
        speed: Math.random() * 0.3 + 0.1,
        phase: Math.random() * Math.PI * 2,
        opacity: Math.random() * 0.5 + 0.2
      });
    }
  }

  start(audioContext, source) {
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    this.analyser.smoothingTimeConstant = 0.9;
    source.connect(this.analyser);
    
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
    
    this.isActive = true;
    elements.waveformContainer.classList.add('active');
    this.animate();
  }

  stop() {
    this.isActive = false;
    elements.waveformContainer.classList.remove('active');
  }

  lerp(start, end, t) {
    return start * (1 - t) + end * t;
  }

  animate() {
    if (!this.isActive) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    requestAnimationFrame(() => this.animate());

    this.analyser.getByteFrequencyData(this.dataArray);
    this.time += 0.016;

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerY = height / 2;

    // Check theme
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    // Clear with theme-appropriate background
    ctx.fillStyle = isLight ? '#f5f5f5' : '#000000';
    ctx.fillRect(0, 0, width, height);

    // Sample data points
    const barCount = 80;
    const barWidth = width / barCount;
    const bars = [];

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * this.dataArray.length * 0.7);
      const value = this.dataArray[dataIndex] / 255;
      
      // Smooth the data
      this.smoothData[i] = this.lerp(this.smoothData[i] || 0, value, 0.12);
      
      const barHeight = this.smoothData[i] * height * 0.7;
      const x = i * barWidth + barWidth / 2;
      
      bars.push({ x, height: barHeight, value: this.smoothData[i] });
    }

    // Draw vertical spectrum bars - theme aware
    this.drawVerticalBars(ctx, bars, centerY, barWidth, isLight);
    
    // Draw scattered particle light points
    this.drawParticles(ctx, width, height, isLight);
    
    // Apply film grain texture overlay (only in dark mode)
    if (!isLight) {
      this.drawFilmGrain(ctx, width, height);
    }
  }

  drawVerticalBars(ctx, bars, centerY, barWidth, isLight) {
    const lineWidth = Math.max(0.5, barWidth * 0.25);
    
    // Theme-aware colors
    const mainColor = isLight ? '74, 74, 74' : '255, 255, 255';
    const glowColor = isLight ? '120, 120, 120' : '255, 255, 255';
    
    bars.forEach((bar, i) => {
      if (bar.height < 2) return;
      
      const halfHeight = bar.height / 2;
      const topY = centerY - halfHeight;
      const bottomY = centerY + halfHeight;
      
      // Main line - theme aware
      ctx.beginPath();
      ctx.moveTo(bar.x, topY);
      ctx.lineTo(bar.x, bottomY);
      ctx.strokeStyle = `rgba(${mainColor}, ${0.5 + bar.value * 0.5})`;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = 'round';
      ctx.stroke();
      
      // Soft glow effect - outer
      ctx.beginPath();
      ctx.moveTo(bar.x, topY);
      ctx.lineTo(bar.x, bottomY);
      ctx.strokeStyle = `rgba(${glowColor}, ${0.1 * bar.value})`;
      ctx.lineWidth = lineWidth * 2.5;
      ctx.stroke();
      
      // Bloom at tips
      if (bar.value > 0.3) {
        const bloomSize = 2 + bar.value * 3;
        const gradient = ctx.createRadialGradient(bar.x, topY, 0, bar.x, topY, bloomSize);
        gradient.addColorStop(0, `rgba(${mainColor}, ${bar.value * 0.4})`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(bar.x, topY, bloomSize, 0, Math.PI * 2);
        ctx.fill();
        
        const gradient2 = ctx.createRadialGradient(bar.x, bottomY, 0, bar.x, bottomY, bloomSize);
        gradient2.addColorStop(0, `rgba(${mainColor}, ${bar.value * 0.4})`);
        gradient2.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient2;
        ctx.beginPath();
        ctx.arc(bar.x, bottomY, bloomSize, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  drawParticles(ctx, width, height, isLight) {
    const particleColor = isLight ? '100, 100, 100' : '255, 255, 255';
    
    this.particles.forEach(p => {
      // Update particle position
      p.phase += p.speed * 0.02;
      const x = (p.x + Math.sin(p.phase) * 0.02) * width;
      const y = (p.y + Math.cos(p.phase * 0.7) * 0.02) * height;
      
      // Soft glow particle - theme aware
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, p.size * 2);
      gradient.addColorStop(0, `rgba(${particleColor}, ${p.opacity})`);
      gradient.addColorStop(0.5, `rgba(${particleColor}, ${p.opacity * 0.3})`);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, p.size * 2, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  drawFilmGrain(ctx, width, height) {
    // Subtle film grain texture
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    for (let i = 0; i < data.length; i += 16) { // Skip pixels for performance
      const noise = (Math.random() - 0.5) * 8;
      data[i] = Math.min(255, Math.max(0, data[i] + noise));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
    }
    
    ctx.putImageData(imageData, 0, 0);
  }

  simulate() {
    this.isActive = true;
    elements.waveformContainer.classList.add('active');
    this.simulateAnimation();
  }

  simulateAnimation() {
    if (!this.isActive) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }

    requestAnimationFrame(() => this.simulateAnimation());

    this.time += 0.016;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerY = height / 2;

    // Check theme
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    // Clear with theme-appropriate background
    ctx.fillStyle = isLight ? '#f5f5f5' : '#000000';
    ctx.fillRect(0, 0, width, height);

    // Generate simulated waveform data
    const barCount = 80;
    const barWidth = width / barCount;
    const bars = [];

    for (let i = 0; i < barCount; i++) {
      const t = i / (barCount - 1);
      
      // Simulated audio wave
      const flowOffset = this.time * 3;
      const wave1 = Math.sin(t * Math.PI * 6 + flowOffset) * 0.6;
      const wave2 = Math.sin(t * Math.PI * 12 + flowOffset * 1.5) * 0.3;
      const wave3 = Math.sin(t * Math.PI * 18 + flowOffset * 0.8) * 0.15;
      const noise = (Math.random() - 0.5) * 0.1;
      
      // Envelope
      const envelope = Math.sin(t * Math.PI) * 0.7 + 0.3;
      
      const value = Math.max(0, (wave1 + wave2 + wave3 + noise) * envelope);
      
      // Smooth
      this.smoothData[i] = this.lerp(this.smoothData[i] || 0, value, 0.1);
      
      const barHeight = this.smoothData[i] * height * 0.6;
      const x = i * barWidth + barWidth / 2;
      
      bars.push({ x, height: barHeight, value: this.smoothData[i] });
    }

    // Draw vertical spectrum bars
    this.drawVerticalBars(ctx, bars, centerY, barWidth, isLight);
    
    // Draw scattered particles
    this.drawParticles(ctx, width, height, isLight);
    
    // Apply film grain (only in dark mode)
    if (!isLight) {
      this.drawFilmGrain(ctx, width, height);
    }
  }
}

// ============================================
// Voice Waveform Visualizer - Compact capsule version
// ============================================
class VoiceWaveformVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.isActive = false;
    this.dataArray = null;
    this.analyser = null;
    this.time = 0;
    this.smoothData = [];
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const container = this.canvas.parentElement;
    this.canvas.width = container.clientWidth || 100;
    this.canvas.height = container.clientHeight || 28;
    this.smoothData = new Array(20).fill(0);
  }

  start(audioContext, source) {
    this.analyser = audioContext.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;
    source.connect(this.analyser);
    
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
    
    this.isActive = true;
    if (elements.voiceWaveformCapsule) {
      elements.voiceWaveformCapsule.classList.add('active');
    }
    this.animate();
  }

  stop() {
    this.isActive = false;
    if (elements.voiceWaveformCapsule) {
      elements.voiceWaveformCapsule.classList.remove('active');
    }
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  lerp(start, end, t) {
    return start * (1 - t) + end * t;
  }

  animate() {
    if (!this.isActive) return;
    requestAnimationFrame(() => this.animate());

    this.analyser.getByteFrequencyData(this.dataArray);
    this.time += 0.05;

    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const barCount = 20;
    const barWidth = width / barCount;
    const gap = barWidth * 0.3;
    const actualBarWidth = barWidth - gap;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor((i / barCount) * this.dataArray.length * 0.5);
      const value = this.dataArray[dataIndex] / 255;
      
      this.smoothData[i] = this.lerp(this.smoothData[i] || 0, value, 0.15);
      
      const barHeight = this.smoothData[i] * height * 0.7;
      const x = i * barWidth + gap / 2;
      
      // Draw rounded bar
      const radius = actualBarWidth / 2;
      const topY = centerY - barHeight / 2;
      const bottomY = centerY + barHeight / 2;
      
      ctx.fillStyle = isLight ? 'rgba(80, 80, 80, 0.7)' : 'rgba(200, 200, 200, 0.8)';
      
      ctx.beginPath();
      ctx.roundRect(x, topY, actualBarWidth, barHeight, radius);
      ctx.fill();
    }
  }

  simulate() {
    this.isActive = true;
    if (elements.voiceWaveformCapsule) {
      elements.voiceWaveformCapsule.classList.add('active');
    }
    this.simulateAnimation();
  }

  simulateAnimation() {
    if (!this.isActive) return;
    requestAnimationFrame(() => this.simulateAnimation());

    this.time += 0.05;
    const ctx = this.ctx;
    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    const barCount = 20;
    const barWidth = width / barCount;
    const gap = barWidth * 0.3;
    const actualBarWidth = barWidth - gap;

    for (let i = 0; i < barCount; i++) {
      const t = i / (barCount - 1);
      const flowOffset = this.time * 2;
      const wave = Math.sin(t * Math.PI * 4 + flowOffset) * 0.5 + 0.5;
      const noise = (Math.random() - 0.5) * 0.15;
      const value = Math.max(0, Math.min(1, wave + noise));
      
      this.smoothData[i] = this.lerp(this.smoothData[i] || 0, value, 0.1);
      
      const barHeight = this.smoothData[i] * height * 0.6;
      const x = i * barWidth + gap / 2;
      
      const radius = actualBarWidth / 2;
      const topY = centerY - barHeight / 2;
      
      ctx.fillStyle = isLight ? 'rgba(80, 80, 80, 0.7)' : 'rgba(200, 200, 200, 0.8)';
      
      ctx.beginPath();
      ctx.roundRect(x, topY, actualBarWidth, barHeight, radius);
      ctx.fill();
    }
  }
}

// ============================================
// Nebula Visualizer
// ============================================
class NebulaVisualizer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.time = 0;
    this.intensity = 0.5;
    this.targetIntensity = 0.5;
    this.persona = 'samantha';

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const container = this.canvas.parentElement;
    const size = Math.min(container.clientWidth, container.clientHeight);
    this.canvas.width = size * 2;
    this.canvas.height = size * 2;
    this.canvas.style.width = size + 'px';
    this.canvas.style.height = size + 'px';
    this.cx = this.canvas.width / 2;
    this.cy = this.canvas.height / 2;
    this.radius = this.canvas.width * 0.35;
  }

  setPersona(persona) {
    this.persona = persona;
  }

  setState(newState) {
    switch (newState) {
      case 'idle':
        this.targetIntensity = 0.4;
        break;
      case 'listening':
        this.targetIntensity = 0.7;
        break;
      case 'thinking':
        this.targetIntensity = 0.6;
        break;
      case 'speaking':
        this.targetIntensity = 0.9;
        break;
    }
  }

  getColors() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      // Light mode: monochrome gray tones
      switch (this.persona) {
        case 'dr_sharp':
          return ['#9a9088', '#8b827a', '#7c746c'];
        case 'atlas':
          return ['#8a9098', '#7e858d', '#757b83'];
        default:
          return ['#a0a0a0', '#808080', '#606060'];
      }
    }
    // Dark mode: monochrome silver/white tones with subtle warmth
    switch (this.persona) {
      case 'dr_sharp':
        return ['#e0e0e0', '#c0c0c0', '#a0a0a0'];
      case 'atlas':
        return ['#d0d0d8', '#b0b0b8', '#909098'];
      default:
        return ['#f0f0f0', '#d0d0d0', '#b0b0b0'];
    }
  }

  draw() {
    this.time += 0.008;
    this.intensity += (this.targetIntensity - this.intensity) * 0.05;

    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    const colors = this.getColors();

    // Draw multiple nebula layers
    for (let layer = 0; layer < 5; layer++) {
      const layerOffset = layer * 0.8;
      const layerRadius = this.radius * (0.5 + layer * 0.15);
      const layerAlpha = (0.08 + this.intensity * 0.08) * (1 - layer * 0.15);

      ctx.beginPath();
      const points = 120;
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const noise1 = Math.sin(angle * 3 + this.time * 2 + layerOffset) * 0.15;
        const noise2 = Math.cos(angle * 5 + this.time * 1.5 + layerOffset) * 0.1;
        const noise3 = Math.sin(angle * 7 + this.time * 3 + layerOffset) * 0.05 * this.intensity;
        const r = layerRadius * (1 + noise1 + noise2 + noise3);

        const x = this.cx + Math.cos(angle) * r;
        const y = this.cy + Math.sin(angle) * r;

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();

      const gradient = ctx.createRadialGradient(
        this.cx, this.cy, 0,
        this.cx, this.cy, layerRadius * 1.3
      );

      const colorIdx = layer % colors.length;
      const color = colors[colorIdx];
      gradient.addColorStop(0, color + Math.floor(layerAlpha * 255 * 2).toString(16).padStart(2, '0'));
      gradient.addColorStop(0.5, color + Math.floor(layerAlpha * 255).toString(16).padStart(2, '0'));
      gradient.addColorStop(1, color + '00');

      ctx.fillStyle = gradient;
      ctx.filter = `blur(${8 + layer * 4}px)`;
      ctx.fill();
    }

    ctx.filter = 'none';

    // Central glow
    const coreGrad = ctx.createRadialGradient(
      this.cx, this.cy, 0,
      this.cx, this.cy, this.radius * 0.3
    );
    const coreAlpha = 0.3 + this.intensity * 0.4;
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha * 0.7})`);
      coreGrad.addColorStop(0.3, `rgba(160, 160, 160, ${coreAlpha * 0.2})`);
      coreGrad.addColorStop(1, 'transparent');
    } else {
      coreGrad.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha * 0.8})`);
      coreGrad.addColorStop(0.3, `rgba(200, 200, 200, ${coreAlpha * 0.3})`);
      coreGrad.addColorStop(1, 'transparent');
    }

    ctx.fillStyle = coreGrad;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Orbiting particles
    const particleCount = Math.floor(10 + this.intensity * 20);
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2 + this.time * (0.5 + i * 0.03);
      const dist = this.radius * (0.3 + Math.sin(this.time + i) * 0.4);
      const x = this.cx + Math.cos(angle) * dist;
      const y = this.cy + Math.sin(angle) * dist;
      const size = 1 + Math.sin(this.time * 2 + i) * 1;
      const alpha = 0.3 + Math.sin(this.time * 3 + i * 0.5) * 0.3;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      ctx.fillStyle = isLight ? `rgba(90, 85, 95, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
      ctx.fill();
    }
  }

  animate() {
    this.draw();
    requestAnimationFrame(() => this.animate());
  }
}

// ============================================
// Audio Manager
// ============================================
class AudioManager {
  constructor() {
    this.audioContext = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.currentAudioSource = null;
  }

  async initAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async startRecording() {
    try {
      await this.initAudioContext();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      this.audioChunks = [];
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.audioChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100);
      this.isRecording = true;
      return true;
    } catch (error) {
      console.error('Failed to start recording:', error);
      return false;
    }
  }

  stopRecording() {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: 'audio/webm' });
        this.isRecording = false;

        this.mediaRecorder.stream.getTracks().forEach((t) => t.stop());
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  async playAudioBase64(base64Data, onEnded) {
    try {
      this.stopPlayback();

      if (!base64Data || base64Data.length === 0) {
        console.warn('Empty audio data received');
        return;
      }

      await this.initAudioContext();
      
      // Lower music volume when AI starts speaking
      if (typeof musicPlayer !== 'undefined') {
        musicPlayer.adjustVolumeForAI(true);
      }

      const binaryString = atob(base64Data);
      const pcmBytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        pcmBytes[i] = binaryString.charCodeAt(i);
      }

      const pcmData = new Int16Array(pcmBytes.buffer);
      const sampleRate = 24000;
      const audioBuffer = this.audioContext.createBuffer(1, pcmData.length, sampleRate);
      const channelData = audioBuffer.getChannelData(0);

      for (let i = 0; i < pcmData.length; i++) {
        channelData[i] = pcmData[i] / 32768.0;
      }

      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      this.currentAudioSource = source;

      source.onended = () => {
        this.currentAudioSource = null;
        // Restore music volume when AI stops speaking
        if (typeof musicPlayer !== 'undefined') {
          musicPlayer.adjustVolumeForAI(false);
        }
        if (onEnded) onEnded();
      };

      source.start(0);
      
      // Start voice waveform capsule visualization for AI speech
      app.voiceWaveform.start(this.audioContext, source);
      
    } catch (error) {
      console.error('Audio playback error:', error);
      // Restore music volume on error
      if (typeof musicPlayer !== 'undefined') {
        musicPlayer.adjustVolumeForAI(false);
      }
    }
  }

  stopPlayback() {
    if (this.currentAudioSource) {
      try {
        this.currentAudioSource.stop();
        this.currentAudioSource.disconnect();
      } catch (e) {}
      this.currentAudioSource = null;
    }
    app.voiceWaveform.stop();
    // Restore music volume when playback is stopped
    if (typeof musicPlayer !== 'undefined') {
      musicPlayer.adjustVolumeForAI(false);
    }
  }
}

// ============================================
// Subtitle Manager
// ============================================
class SubtitleManager {
  constructor() {
    this.currentText = '';
    this.currentTranslation = '';
    this.fullEnglishText = '';
    this.fullChineseText = '';
    this.isExpanded = false;
    this.typeSpeed = 30;
    this.isTyping = false;
    this.bindExpandButton();
  }

  bindExpandButton() {
    if (elements.aiBubbleExpandBtn) {
      elements.aiBubbleExpandBtn.addEventListener('click', () => this.toggleExpand());
    }
  }

  showBubble() {
    if (elements.aiBubble) {
      elements.aiBubble.classList.add('visible');
    }
  }

  hideBubble() {
    if (elements.aiBubble) {
      elements.aiBubble.classList.remove('visible');
    }
  }

  // During streaming - only show English, max 2 lines
  setStreamingSubtitle(text) {
    this.currentText = text;
    const truncated = this.truncateToTwoLines(text);
    // Update AI bubble
    if (elements.aiBubbleEn) {
      elements.aiBubbleEn.textContent = truncated;
    }
    if (elements.aiBubbleCn) {
      elements.aiBubbleCn.textContent = '';
    }
    if (elements.aiBubbleContent) {
      elements.aiBubbleContent.classList.add('collapsed');
      elements.aiBubbleContent.classList.remove('expanded');
    }
    // Update subtitle glass (bottom subtitles)
    if (elements.subtitleText) {
      elements.subtitleText.textContent = truncated;
    }
    if (elements.subtitleTranslation) {
      elements.subtitleTranslation.textContent = '';
    }
    this.showBubble();
    this.hideExpandButton();
  }

  // After stream complete - show both English and Chinese
  setFinalSubtitle(english, chinese) {
    console.log('[DEBUG] setFinalSubtitle called with english:', english);
    console.log('[DEBUG] setFinalSubtitle called with chinese:', chinese);
    
    this.fullEnglishText = english;
    this.fullChineseText = chinese;
    this.currentText = english;
    this.currentTranslation = chinese;
    this.isExpanded = false;

    const truncatedEnglish = this.truncateToTwoLines(english);
    const truncatedChinese = this.truncateToTwoLines(chinese);
    
    console.log('[DEBUG] truncatedEnglish:', truncatedEnglish);
    console.log('[DEBUG] truncatedChinese:', truncatedChinese);

    // Update AI bubble
    if (elements.aiBubbleEn) {
      elements.aiBubbleEn.textContent = truncatedEnglish;
    }
    if (elements.aiBubbleCn) {
      elements.aiBubbleCn.textContent = chinese ? truncatedChinese : '';
      console.log('[DEBUG] aiBubbleCn textContent set to:', elements.aiBubbleCn.textContent);
    }
    if (elements.aiBubbleContent) {
      elements.aiBubbleContent.classList.add('collapsed');
      elements.aiBubbleContent.classList.remove('expanded');
    }
    // Update subtitle glass (bottom subtitles)
    if (elements.subtitleText) {
      elements.subtitleText.textContent = truncatedEnglish;
    }
    if (elements.subtitleTranslation) {
      elements.subtitleTranslation.textContent = chinese ? truncatedChinese : '';
      console.log('[DEBUG] subtitleTranslation textContent set to:', elements.subtitleTranslation.textContent);
    }
    this.showBubble();

    // Show expand button if text is long (more than 120 chars)
    const totalLength = english.length + (chinese ? chinese.length : 0);
    if (totalLength > 120) {
      this.showExpandButton();
    }
  }

  // Legacy method for compatibility
  setSubtitle(text, translation = '') {
    this.currentText = text;
    this.currentTranslation = translation;
    // Update AI bubble
    if (elements.aiBubbleEn) {
      elements.aiBubbleEn.textContent = this.truncateToTwoLines(text);
    }
    if (elements.aiBubbleCn) {
      elements.aiBubbleCn.textContent = translation ? this.truncateToTwoLines(translation) : '';
    }
    if (elements.aiBubbleContent) {
      elements.aiBubbleContent.classList.add('collapsed');
      elements.aiBubbleContent.classList.remove('expanded');
    }
    // Update subtitle glass (bottom subtitles)
    if (elements.subtitleText) {
      elements.subtitleText.textContent = this.truncateToTwoLines(text);
    }
    if (elements.subtitleTranslation) {
      elements.subtitleTranslation.textContent = translation ? this.truncateToTwoLines(translation) : '';
    }
    this.showBubble();
  }

  // Truncate text to approximately 2 lines
  truncateToTwoLines(text) {
    if (!text) return '';
    // Responsive max chars based on screen width
    const maxChars = window.innerWidth <= 768 ? 80 : 120;
    if (text.length <= maxChars) return text;
    return text.substring(0, maxChars) + '...';
  }

  // Toggle expand/collapse
  toggleExpand() {
    this.isExpanded = !this.isExpanded;

    if (this.isExpanded) {
      // Update AI bubble
      if (elements.aiBubbleEn) {
        elements.aiBubbleEn.textContent = this.fullEnglishText;
      }
      if (elements.aiBubbleCn) {
        elements.aiBubbleCn.textContent = this.fullChineseText || '';
      }
      if (elements.aiBubbleContent) {
        elements.aiBubbleContent.classList.remove('collapsed');
        elements.aiBubbleContent.classList.add('expanded');
      }
      // Update subtitle glass
      if (elements.subtitleText) {
        elements.subtitleText.textContent = this.fullEnglishText;
      }
      if (elements.subtitleTranslation) {
        elements.subtitleTranslation.textContent = this.fullChineseText || '';
      }
      this.updateExpandButton(true);
    } else {
      const truncatedEnglish = this.truncateToTwoLines(this.fullEnglishText);
      const truncatedChinese = this.truncateToTwoLines(this.fullChineseText);
      // Update AI bubble
      if (elements.aiBubbleEn) {
        elements.aiBubbleEn.textContent = truncatedEnglish;
      }
      if (elements.aiBubbleCn) {
        elements.aiBubbleCn.textContent = this.fullChineseText ? truncatedChinese : '';
      }
      if (elements.aiBubbleContent) {
        elements.aiBubbleContent.classList.add('collapsed');
        elements.aiBubbleContent.classList.remove('expanded');
      }
      // Update subtitle glass
      if (elements.subtitleText) {
        elements.subtitleText.textContent = truncatedEnglish;
      }
      if (elements.subtitleTranslation) {
        elements.subtitleTranslation.textContent = this.fullChineseText ? truncatedChinese : '';
      }
      this.updateExpandButton(false);
    }
  }

  showExpandButton() {
    if (elements.aiBubbleExpandBtn) {
      elements.aiBubbleExpandBtn.classList.add('visible');
      this.updateExpandButton(false);
    }
  }

  hideExpandButton() {
    if (elements.aiBubbleExpandBtn) {
      elements.aiBubbleExpandBtn.classList.remove('visible');
    }
  }

  updateExpandButton(isExpanded) {
    if (elements.aiBubbleExpandBtn) {
      elements.aiBubbleExpandBtn.innerHTML = isExpanded
        ? '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>';
      elements.aiBubbleExpandBtn.title = isExpanded ? '收起' : '展开';
    }
  }

  async typeText(text, translation = '') {
    this.isTyping = true;
    // Clear AI bubble
    if (elements.aiBubbleEn) {
      elements.aiBubbleEn.textContent = '';
    }
    if (elements.aiBubbleCn) {
      elements.aiBubbleCn.textContent = '';
    }
    // Clear subtitle glass
    if (elements.subtitleText) {
      elements.subtitleText.textContent = '';
    }
    if (elements.subtitleTranslation) {
      elements.subtitleTranslation.textContent = '';
    }
    this.showBubble();

    for (let i = 0; i < text.length; i++) {
      if (!this.isTyping) break;
      if (elements.aiBubbleEn) {
        elements.aiBubbleEn.textContent += text[i];
      }
      if (elements.subtitleText) {
        elements.subtitleText.textContent = elements.aiBubbleEn.textContent;
      }
      await this.delay(this.typeSpeed);
    }

    if (translation && this.isTyping) {
      if (elements.aiBubbleCn) {
        elements.aiBubbleCn.textContent = translation;
      }
      if (elements.subtitleTranslation) {
        elements.subtitleTranslation.textContent = translation;
      }
    }

    this.isTyping = false;
  }

  stopTyping() {
    this.isTyping = false;
  }

  clear() {
    this.stopTyping();
    this.currentText = '';
    this.currentTranslation = '';
    this.fullEnglishText = '';
    this.fullChineseText = '';
    this.isExpanded = false;
    // Clear AI bubble
    if (elements.aiBubbleEn) {
      elements.aiBubbleEn.textContent = '';
    }
    if (elements.aiBubbleCn) {
      elements.aiBubbleCn.textContent = '';
    }
    // Clear subtitle glass
    if (elements.subtitleText) {
      elements.subtitleText.textContent = '';
    }
    if (elements.subtitleTranslation) {
      elements.subtitleTranslation.textContent = '';
    }
    this.hideBubble();
    this.hideExpandButton();
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================
// Main Application
// ============================================
class IMoodApp {
  constructor() {
    this.audio = new AudioManager();
    this.nebula = null;
    this.particles = null;
    this.waveform = null;
    this.subtitle = new SubtitleManager();
    this.currentStreamAudio = [];
    this.pendingTranslation = '';
  }

  init() {
    console.log('[App] Initializing iMood...');
    
    this.particles = new ParticleSystem(elements.bgCanvas);
    this.particles.animate();

    console.log('[App] Checking for HeartParticlesVisualizer...');
    if (typeof HeartParticlesVisualizer !== 'undefined') {
      console.log('[App] HeartParticlesVisualizer found, initializing...');
      this.nebula = new HeartParticlesVisualizer(elements.nebulaContainer);
      console.log('[App] HeartParticles initialized:', this.nebula ? 'success' : 'failed');
    } else if (typeof CatParticlesVisualizer !== 'undefined') {
      console.log('[App] Using CatParticlesVisualizer');
      this.nebula = new CatParticlesVisualizer(elements.nebulaContainer);
    } else if (typeof RabbitParticlesVisualizer !== 'undefined') {
      console.log('[App] Using RabbitParticlesVisualizer');
      this.nebula = new RabbitParticlesVisualizer(elements.nebulaContainer);
    } else {
      console.warn('[App] No particle visualizer found, using fallback NebulaVisualizer');
      this.nebula = new NebulaVisualizer(elements.nebulaCanvas);
      this.nebula.animate();
    }

    this.waveform = new WaveformVisualizer(elements.waveformCanvas);
    this.voiceWaveform = new VoiceWaveformVisualizer(elements.voiceWaveformCanvas);
    this.initTheme();
    this.bindEvents();
    state.sessionId = 'session_' + Date.now();
    this.checkServerConnection();
    this.updateEndConversationBtn(); // Initialize button state

    console.log('iMood initialized');
  }

  // Check server connection status
  async checkServerConnection() {
    try {
      const response = await fetch('/api/health', { method: 'GET' });
      if (response.ok) {
        this.setConnectionStatus(true);
      } else {
        this.setConnectionStatus(false);
      }
    } catch (error) {
      console.warn('Server connection check failed:', error);
      this.setConnectionStatus(false);
    }
  }

  // Set connection status indicator
  setConnectionStatus(connected) {
    const statusDot = document.getElementById('statusDot');
    if (statusDot) {
      if (connected) {
        statusDot.classList.add('connected');
      } else {
        statusDot.classList.remove('connected');
      }
    }
  }

  // Show reset particle button
  showResetButton() {
    const resetBtn = document.getElementById('resetParticleBtn');
    if (resetBtn) {
      resetBtn.style.display = 'flex';
    }
  }

  // Hide reset particle button
  hideResetButton() {
    const resetBtn = document.getElementById('resetParticleBtn');
    if (resetBtn) {
      resetBtn.style.display = 'none';
    }
  }

  // Reset particles to heart shape
  resetParticles() {
    if (this.nebula && this.nebula.resetToHeart) {
      this.nebula.resetToHeart();
      this.hideResetButton();
    }
  }

  // Theme Management
  initTheme() {
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('imood-theme');
    if (savedTheme) {
      document.documentElement.setAttribute('data-theme', savedTheme);
    } else {
      // Check system preference
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      if (prefersLight) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('imood-theme', newTheme);
    
    console.log(`Theme switched to: ${newTheme}`);
  }

  // Update send button state based on input
  updateSendButtonState() {
    const hasText = elements.textInput.value.trim().length > 0;
    if (hasText) {
      elements.sendBtn.classList.add('active');
    } else {
      elements.sendBtn.classList.remove('active');
    }
  }

  bindEvents() {
    // Send text message
    elements.sendBtn.addEventListener('click', () => this.sendTextMessage());
    elements.textInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.sendTextMessage();
      }
    });

    // Input state - update send button
    elements.textInput.addEventListener('input', () => {
      this.updateSendButtonState();
    });

    // Image upload
    elements.imageInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        this.sendImageMessage(e.target.files[0]);
        e.target.value = '';
      }
    });

    // Persona switching
    $$('.persona-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        $$('.persona-chip').forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        state.currentPersona = chip.dataset.persona;
        this.nebula.setPersona(state.currentPersona);
        this.setAiStatus('Ready to listen');
      });
    });

    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }
    elements.overlay.addEventListener('click', () => this.closePanel());

    // Reset particle button
    const resetParticleBtn = document.getElementById('resetParticleBtn');
    if (resetParticleBtn) {
      resetParticleBtn.addEventListener('click', () => this.resetParticles());
    }
  }

  // ---------- Text Chat ----------
  async sendTextMessage() {
    const text = elements.textInput.value.trim();
    if (!text || state.isProcessing) return;

    elements.textInput.value = '';
    this.updateSendButtonState();

    this.subtitle.clear();

    state.isProcessing = true;
    this.setAiStatus('Thinking...');
    this.nebula.setState('thinking');

    state.currentConversation.push({ role: 'user', content: text });
    state.hasConversation = true;
    this.updateEndConversationBtn();

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          persona: state.currentPersona,
          sessionId: state.sessionId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      this.setConnectionStatus(true);

      await this.processStream(response);
    } catch (error) {
      this.subtitle.setSubtitle(`Sorry, something went wrong: ${error.message}`);
      console.error('Chat error:', error);
    } finally {
      state.isProcessing = false;
      this.setAiStatus('Ready to listen');
      this.nebula.setState('idle');
    }
  }

  // ---------- Voice Chat ----------
  // Voice recording functions removed - text input only

  // ---------- Image Chat ----------
  async sendImageMessage(file) {
    if (state.isProcessing) return;

    state.isProcessing = true;
    this.setAiStatus('Analyzing image...');
    this.nebula.setState('thinking');
    this.subtitle.clear();

    try {
      // 创建图片 URL 并转换为粒子效果
      const imageUrl = URL.createObjectURL(file);
      if (this.nebula && this.nebula.createImageParticles) {
        await this.nebula.createImageParticles(imageUrl);
        // 显示重置按钮
        this.showResetButton();
      }

      const formData = new FormData();
      formData.append('image', file);
      formData.append('persona', state.currentPersona);
      formData.append('sessionId', state.sessionId);

      const response = await fetch('/api/chat/image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      await this.processStream(response);
    } catch (error) {
      this.subtitle.setSubtitle(`Image analysis failed: ${error.message}`);
      console.error('Image error:', error);
    } finally {
      state.isProcessing = false;
      this.setAiStatus('Ready to listen');
      this.nebula.setState('idle');
    }
  }

  // ---------- SSE Stream Processor ----------
  async processStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let fullText = '';
    this.currentStreamAudio = [];
    let hasReceivedAudio = false;
    this.isStreamPaused = false;
    this.currentReader = reader;

    this.nebula.setState('speaking');
    this.setAiStatus('Speaking...');
    
    // Start voice waveform capsule for AI speaking
    this.voiceWaveform.simulate();
    
    // Show pause button
    this.showPauseButton();

    let buffer = '';

    try {
      while (true) {
        // Check if paused
        while (this.isStreamPaused) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          console.log('[DEBUG] SSE line:', line);
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const data = JSON.parse(jsonStr);
            console.log('[DEBUG] Parsed data:', data);

            switch (data.type) {
              case 'text':
                fullText += data.content;
                // During streaming, show English directly (no bilingual format needed)
                this.subtitle.setStreamingSubtitle(fullText);
                break;

              case 'transcript':
                fullText += data.content;
                hasReceivedAudio = true;
                this.subtitle.setStreamingSubtitle(fullText);
                break;

              case 'audio':
                hasReceivedAudio = true;
                this.currentStreamAudio.push(data.data);
                break;

              case 'translation':
                // Store translation for display after stream completes
                console.log('[DEBUG] Received translation:', data.content);
                this.pendingTranslation = data.content;
                console.log('[DEBUG] pendingTranslation set to:', this.pendingTranslation);
                break;

              case 'done':
                if (data.sessionId) {
                  state.sessionId = data.sessionId;
                }
                break;

              case 'error':
                fullText += `\n[Error: ${data.message}]`;
                this.subtitle.setStreamingSubtitle(fullText);
                break;
            }
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Stream error:', e);
      }
    }

    // Stream complete - show full content with translation
    this.hidePauseButton();
    
    console.log('[DEBUG] Stream complete. fullText:', fullText);
    console.log('[DEBUG] pendingTranslation before use:', this.pendingTranslation);
    
    if (fullText && !fullText.includes('[Error')) {
      const chineseTranslation = this.pendingTranslation || '';
      console.log('[DEBUG] chineseTranslation:', chineseTranslation);
      this.subtitle.setFinalSubtitle(fullText, chineseTranslation);
      this.subtitle.fullEnglishText = fullText;
      this.subtitle.fullChineseText = chineseTranslation;
      this.pendingTranslation = '';
      
      state.currentConversation.push({ role: 'assistant', content: fullText });
    }

    // Play accumulated audio
    if (this.currentStreamAudio.length > 0 && !this.isStreamPaused) {
      try {
        let fullAudioBase64 = '';
        for (let i = 0; i < this.currentStreamAudio.length; i++) {
          fullAudioBase64 += this.currentStreamAudio[i];
        }
        
        await this.audio.playAudioBase64(fullAudioBase64, () => {
          this.voiceWaveform.stop();
          this.setAiStatus('Ready to listen');
          this.nebula.setState('idle');
        });
      } catch (e) {
        console.warn('Audio playback failed:', e);
        this.voiceWaveform.stop();
      }
    } else {
      this.voiceWaveform.stop();
    }
  }

  togglePauseStream() {
    this.isStreamPaused = !this.isStreamPaused;
    this.updatePauseButton();
    
    if (this.isStreamPaused) {
      this.setAiStatus('Paused');
      this.voiceWaveform.stop();
    } else {
      this.setAiStatus('Speaking...');
      this.voiceWaveform.simulate();
    }
  }

  showPauseButton() {
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
      pauseBtn.style.display = 'flex';
      this.updatePauseButton();
    }
  }

  hidePauseButton() {
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
      pauseBtn.style.display = 'none';
    }
  }

  updatePauseButton() {
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
      pauseBtn.innerHTML = this.isStreamPaused 
        ? '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>';
      pauseBtn.title = this.isStreamPaused ? '继续' : '暂停';
    }
  }

  // Parse bilingual response from Omni model
  // Format: English text followed by Chinese translation in parentheses
  parseBilingualResponse(text) {
    if (!text) return { english: '', chinese: '' };
    
    // Find the last occurrence of text in parentheses (Chinese translation)
    // Pattern: match content before parentheses and content inside parentheses
    const lastParenIndex = text.lastIndexOf('(');
    const lastClosingParenIndex = text.lastIndexOf(')');
    
    if (lastParenIndex !== -1 && lastClosingParenIndex !== -1 && lastClosingParenIndex > lastParenIndex) {
      const english = text.substring(0, lastParenIndex).trim();
      const chinese = text.substring(lastParenIndex + 1, lastClosingParenIndex).trim();
      
      if (english && chinese) {
        return { english, chinese };
      }
    }
    
    // Fallback: try regex pattern with newline
    const match = text.match(/^([\s\S]*?)\n\s*\(([\s\S]+?)\)\s*$/);
    if (match) {
      return {
        english: match[1].trim(),
        chinese: match[2].trim()
      };
    }
    
    // Fallback: try regex pattern without newline requirement
    const parenthesesMatch = text.match(/^([\s\S]*?)\s*\(([\s\S]+?)\)\s*$/);
    if (parenthesesMatch) {
      return {
        english: parenthesesMatch[1].trim(),
        chinese: parenthesesMatch[2].trim()
      };
    }
    
    // If no pattern matches, return full text as English
    return {
      english: text.trim(),
      chinese: ''
    };
  }

  // ---------- UI Helpers ----------
  setAiStatus(text) {
    // Update status dot in persona chip
    const statusDot = document.getElementById('statusDot');
    if (statusDot) {
      statusDot.className = 'persona-status-dot';
      
      if (text.includes('Listen')) {
        statusDot.classList.add('listening');
      } else if (text.includes('Think') || text.includes('Process') || text.includes('Analyz')) {
        statusDot.classList.add('thinking');
      } else if (text.includes('Speak')) {
        statusDot.classList.add('speaking');
      }
    }
    
    // Keep compatibility with old status dot if it exists
    if (elements.statusDot) {
      elements.statusDot.className = 'status-dot';
      if (text.includes('Listen')) {
        elements.statusDot.classList.add('listening');
      } else if (text.includes('Think') || text.includes('Process') || text.includes('Analyz')) {
        elements.statusDot.classList.add('thinking');
      } else if (text.includes('Speak')) {
        elements.statusDot.classList.add('speaking');
      }
    }
  }

  closePanel() {
    elements.overlay.classList.remove('visible');
  }

  updateEndConversationBtn() {
    const btn = document.getElementById('endConversationBtn');
    if (btn) {
      // Button is now always visible, but visually indicate disabled state
      btn.style.display = 'flex';
      btn.style.opacity = state.hasConversation ? '1' : '0.4';
      btn.style.cursor = state.hasConversation ? 'pointer' : 'not-allowed';
      btn.title = state.hasConversation ? '结束对话保存日记' : '开始对话后可保存日记';
    }
  }

  endConversation() {
    if (state.currentConversation.length > 0) {
      diaryManager.currentConversation = [...state.currentConversation];
      diaryManager.showEndOverlay();
    }
  }

  startNewConversation() {
    state.currentConversation = [];
    state.hasConversation = false;
    state.sessionId = 'session_' + Date.now();
    this.updateEndConversationBtn();
  }
}

// ============================================
// Diary Manager
// ============================================
class DiaryManager {
  constructor() {
    this.notebooks = [];
    this.diaries = [];
    this.currentNotebook = null;
    this.currentConversation = [];
    this.selectedNotebookId = 'default';
    this.editingNotebookId = null;
    this.editingDiaryId = null;
    this.selectedColor = '#a0a0a0';
  }

  async loadNotebooks() {
    try {
      const res = await fetch('/api/notebooks');
      const data = await res.json();
      this.notebooks = data.notebooks || [];
      this.renderNotebookList();
      this.updateNotebookSelect();
    } catch (error) {
      console.error('Failed to load notebooks:', error);
    }
  }

  async loadDiaries(notebookId) {
    try {
      const url = notebookId 
        ? `/api/notebooks/${notebookId}/diaries`
        : '/api/diaries/all';
      const res = await fetch(url);
      const data = await res.json();
      this.diaries = data.diaries || [];
      this.renderDiaryList();
    } catch (error) {
      console.error('Failed to load diaries:', error);
    }
  }

  renderNotebookList() {
    const listEl = document.getElementById('diaryNotebookList');
    if (!listEl) return;

    if (this.notebooks.length === 0) {
      listEl.innerHTML = '<p class="empty-hint">暂无日记本</p>';
      return;
    }

    listEl.innerHTML = this.notebooks.map(notebook => `
      <div class="diary-notebook-item" data-id="${notebook.id}">
        <div class="diary-notebook-icon" style="background: ${notebook.color}20;">
          <svg viewBox="0 0 24 24" fill="none" stroke="${notebook.color}" stroke-width="1.5" width="20" height="20">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </div>
        <div class="diary-notebook-info">
          <span class="diary-notebook-name">${this.escapeHtml(notebook.name)}</span>
          <span class="diary-notebook-meta">
            ${notebook.note ? this.escapeHtml(notebook.note) + ' · ' : ''}${notebook.diaryCount || 0} 篇日记
          </span>
        </div>
        ${notebook.isDefault ? '<span class="diary-notebook-badge">默认</span>' : ''}
      </div>
    `).join('');

    listEl.querySelectorAll('.diary-notebook-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.id;
        this.openNotebookDetail(id);
      });
    });
  }

  updateNotebookSelect() {
    const selectEl = document.getElementById('diaryNotebookSelect');
    if (!selectEl) return;

    selectEl.innerHTML = this.notebooks.map(notebook => 
      `<option value="${notebook.id}">${this.escapeHtml(notebook.name)}</option>`
    ).join('');
  }

  renderDiaryList() {
    const listEl = document.getElementById('diaryList');
    if (!listEl) return;

    if (this.diaries.length === 0) {
      listEl.innerHTML = '<p class="empty-hint">暂无日记</p>';
      return;
    }

    listEl.innerHTML = this.diaries.map(diary => {
      const time = this.formatTime(diary.timestamp);
      
      return `
        <div class="diary-card" data-id="${diary.id}">
          <div class="diary-card-header">
            <div class="diary-card-emotion-dot" style="background: ${diary.emotionColor};"></div>
            <div class="diary-card-info">
              <div class="diary-card-title">${this.escapeHtml(diary.title)}</div>
              <div class="diary-card-time">${time}</div>
            </div>
            <div class="diary-card-actions">
              <button class="diary-card-edit-btn" data-id="${diary.id}" data-title="${this.escapeHtml(diary.title)}" title="编辑标题">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
              <button class="diary-card-delete-btn" data-id="${diary.id}" title="删除">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
              <svg class="diary-card-expand-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
          <div class="diary-card-content">
            <div class="diary-card-conversation">
              ${this.renderConversation(diary.conversation)}
            </div>
          </div>
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.diary-card-edit-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        const title = btn.dataset.title;
        this.showEditDiaryModal(id, title);
      });
    });

    listEl.querySelectorAll('.diary-card-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        this.deleteDiary(id);
      });
    });

    listEl.querySelectorAll('.diary-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.diary-card-edit-btn') && !e.target.closest('.diary-card-delete-btn')) {
          const isExpanding = !card.classList.contains('expanded');
          card.classList.toggle('expanded');

          if (isExpanding) {
            const content = card.querySelector('.diary-card-content');
            if (content) {
              requestAnimationFrame(() => {
                content.scrollTo({ top: 0, behavior: 'smooth' });
              });
            }
          }
        }
      });
    });
  }

  renderConversation(conversation) {
    if (!conversation || conversation.length === 0) return '';
    
    return conversation.map(msg => `
      <div class="diary-message diary-message-${msg.role}">
        ${this.escapeHtml(msg.content)}
      </div>
    `).join('');
  }

  formatTime(timestamp) {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    
    return `${year}年${month}月${day}日 ${hour}:${minute}`;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  showEndOverlay() {
    const overlay = document.getElementById('diaryEndOverlay');
    if (overlay) {
      overlay.classList.add('visible');
    }
  }

  hideEndOverlay() {
    const overlay = document.getElementById('diaryEndOverlay');
    if (overlay) {
      overlay.classList.remove('visible');
    }
  }

  showDropdown() {
    const dropdown = document.getElementById('diaryDropdown');
    if (dropdown) {
      dropdown.classList.add('visible');
    }
  }

  hideDropdown() {
    const dropdown = document.getElementById('diaryDropdown');
    if (dropdown) {
      dropdown.classList.remove('visible');
    }
  }

  openNotebookDetail(notebookId) {
    const notebook = this.notebooks.find(n => n.id === notebookId);
    if (!notebook) return;

    this.currentNotebook = notebook;
    this.hideDropdown();

    const panel = document.getElementById('diaryDetailPanel');
    const title = document.getElementById('diaryDetailTitle');
    const editBtn = document.getElementById('diaryEditNotebookBtn');
    const deleteBtn = document.getElementById('diaryDeleteNotebookBtn');

    if (title) title.textContent = notebook.name;
    if (panel) panel.classList.add('open');
    
    if (editBtn) editBtn.style.display = notebook.isDefault ? 'none' : 'flex';
    if (deleteBtn) deleteBtn.style.display = notebook.isDefault ? 'none' : 'flex';

    this.loadDiaries(notebookId);
  }

  closeNotebookDetail() {
    const panel = document.getElementById('diaryDetailPanel');
    if (panel) {
      panel.classList.remove('open');
    }
    this.currentNotebook = null;
  }

  showNotebookModal(editMode = false) {
    const modal = document.getElementById('diaryNotebookModal');
    const title = document.getElementById('diaryModalTitle');
    const nameInput = document.getElementById('diaryNotebookNameInput');
    const noteInput = document.getElementById('diaryNotebookNoteInput');

    if (modal) modal.classList.add('visible');
    
    if (editMode && this.currentNotebook) {
      if (title) title.textContent = '编辑日记本';
      if (nameInput) nameInput.value = this.currentNotebook.name;
      if (noteInput) noteInput.value = this.currentNotebook.note || '';
      this.editingNotebookId = this.currentNotebook.id;
      this.selectedColor = this.currentNotebook.color || '#a0a0a0';
    } else {
      if (title) title.textContent = '新建日记本';
      if (nameInput) nameInput.value = '';
      if (noteInput) noteInput.value = '';
      this.editingNotebookId = null;
      this.selectedColor = '#a0a0a0';
    }

    this.updateColorPicker();
  }

  hideNotebookModal() {
    const modal = document.getElementById('diaryNotebookModal');
    if (modal) {
      modal.classList.remove('visible');
    }
  }

  updateColorPicker() {
    const picker = document.getElementById('diaryColorPicker');
    if (!picker) return;

    picker.querySelectorAll('.diary-color-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.color === this.selectedColor);
    });
  }

  async saveNotebook() {
    const nameInput = document.getElementById('diaryNotebookNameInput');
    const noteInput = document.getElementById('diaryNotebookNoteInput');
    const name = nameInput?.value.trim();
    const note = noteInput?.value.trim();

    if (!name) {
      alert('请输入日记本名称');
      return;
    }

    try {
      let res;
      if (this.editingNotebookId) {
        res = await fetch(`/api/notebooks/${this.editingNotebookId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, note, color: this.selectedColor })
        });
      } else {
        res = await fetch('/api/notebooks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, note, color: this.selectedColor })
        });
      }

      const data = await res.json();
      if (data.success) {
        this.hideNotebookModal();
        await this.loadNotebooks();
        if (this.currentNotebook) {
          this.openNotebookDetail(this.currentNotebook.id);
        }
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('Save notebook error:', error);
      alert('保存失败，请重试');
    }
  }

  async deleteNotebook() {
    if (!this.currentNotebook || this.currentNotebook.isDefault) return;

    if (!confirm(`确定要删除「${this.currentNotebook.name}」吗？\n日记将移至默认日记本。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/notebooks/${this.currentNotebook.id}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        this.closeNotebookDetail();
        await this.loadNotebooks();
      } else {
        alert(data.error || '删除失败');
      }
    } catch (error) {
      console.error('Delete notebook error:', error);
      alert('删除失败，请重试');
    }
  }

  async generateDiary(conversation) {
    try {
      const res = await fetch('/api/diary/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation })
      });

      const data = await res.json();
      return {
        title: data.title || '一次温暖的对话',
        emotion: data.emotion || 'neutral',
        emotionColor: data.emotionColor || '#a0a0a0'
      };
    } catch (error) {
      console.error('Generate diary error:', error);
      return {
        title: '一次温暖的对话',
        emotion: 'neutral',
        emotionColor: '#a0a0a0'
      };
    }
  }

  async saveDiary(conversation) {
    const selectEl = document.getElementById('diaryNotebookSelect');
    const notebookId = selectEl?.value || 'default';

    const generated = await this.generateDiary(conversation);

    try {
      const res = await fetch('/api/diary/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generated.title,
          emotion: generated.emotion,
          emotionColor: generated.emotionColor,
          conversation: conversation,
          notebookId: notebookId,
          sessionId: state.sessionId
        })
      });

      const data = await res.json();
      if (data.success) {
        this.hideEndOverlay();
        await this.loadNotebooks();
        if (typeof app !== 'undefined' && app.startNewConversation) {
          app.startNewConversation();
        }
        return true;
      } else {
        alert(data.error || '保存失败');
        return false;
      }
    } catch (error) {
      console.error('Save diary error:', error);
      alert('保存失败，请重试');
      return false;
    }
  }

  showEditDiaryModal(diaryId, currentTitle) {
    this.editingDiaryId = diaryId;
    const modal = document.getElementById('diaryEditModal');
    const input = document.getElementById('diaryEditTitleInput');
    
    if (modal) modal.classList.add('visible');
    if (input) {
      input.value = currentTitle;
      input.focus();
    }
  }

  hideEditDiaryModal() {
    const modal = document.getElementById('diaryEditModal');
    if (modal) modal.classList.remove('visible');
    this.editingDiaryId = null;
  }

  async updateDiaryTitle() {
    const input = document.getElementById('diaryEditTitleInput');
    const title = input?.value.trim();

    if (!title) {
      alert('请输入日记标题');
      return;
    }

    if (!this.editingDiaryId) return;

    try {
      const res = await fetch(`/api/diary/${this.editingDiaryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title })
      });

      const data = await res.json();
      if (data.success) {
        this.hideEditDiaryModal();
        await this.loadNotebooks();
        if (this.currentNotebook) {
          await this.loadDiaries(this.currentNotebook.id);
        }
      } else {
        alert(data.error || '保存失败');
      }
    } catch (error) {
      console.error('Update diary error:', error);
      alert('保存失败，请重试');
    }
  }

  async deleteDiary(diaryId) {
    if (!confirm('确定要删除这篇日记吗？')) return;

    try {
      const res = await fetch(`/api/diary/${diaryId}`, {
        method: 'DELETE'
      });

      const data = await res.json();
      if (data.success) {
        await this.loadNotebooks();
        if (this.currentNotebook) {
          await this.loadDiaries(this.currentNotebook.id);
        }
      }
    } catch (error) {
      console.error('Delete diary error:', error);
    }
  }

  bindEvents() {
    const diaryBtn = document.getElementById('diaryBtn');
    const dropdown = document.getElementById('diaryDropdown');
    const addNotebookBtn = document.getElementById('diaryAddNotebookBtn');
    const backBtn = document.getElementById('diaryBackBtn');
    const editNotebookBtn = document.getElementById('diaryEditNotebookBtn');
    const deleteNotebookBtn = document.getElementById('diaryDeleteNotebookBtn');
    const modalClose = document.getElementById('diaryModalClose');
    const modalCancel = document.getElementById('diaryModalCancelBtn');
    const modalSave = document.getElementById('diaryModalSaveBtn');
    const colorPicker = document.getElementById('diaryColorPicker');
    const saveBtn = document.getElementById('diarySaveBtn');
    const discardBtn = document.getElementById('diaryDiscardBtn');
    const endOverlay = document.getElementById('diaryEndOverlay');

    if (diaryBtn) {
      diaryBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown?.classList.toggle('visible');
      });
    }

    document.addEventListener('click', (e) => {
      if (dropdown && !dropdown.contains(e.target) && e.target !== diaryBtn) {
        dropdown.classList.remove('visible');
      }
    });

    if (addNotebookBtn) {
      addNotebookBtn.addEventListener('click', () => {
        this.showNotebookModal(false);
      });
    }

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.closeNotebookDetail();
      });
    }

    if (editNotebookBtn) {
      editNotebookBtn.addEventListener('click', () => {
        this.showNotebookModal(true);
      });
    }

    if (deleteNotebookBtn) {
      deleteNotebookBtn.addEventListener('click', () => {
        this.deleteNotebook();
      });
    }

    if (modalClose) {
      modalClose.addEventListener('click', () => {
        this.hideNotebookModal();
      });
    }

    if (modalCancel) {
      modalCancel.addEventListener('click', () => {
        this.hideNotebookModal();
      });
    }

    if (modalSave) {
      modalSave.addEventListener('click', () => {
        this.saveNotebook();
      });
    }

    if (colorPicker) {
      colorPicker.addEventListener('click', (e) => {
        const btn = e.target.closest('.diary-color-btn');
        if (btn) {
          this.selectedColor = btn.dataset.color;
          this.updateColorPicker();
        }
      });
    }

    const editModalClose = document.getElementById('diaryEditModalClose');
    const editModalCancel = document.getElementById('diaryEditCancelBtn');
    const editModalSave = document.getElementById('diaryEditSaveBtn');
    const editModal = document.getElementById('diaryEditModal');

    if (editModalClose) {
      editModalClose.addEventListener('click', () => {
        this.hideEditDiaryModal();
      });
    }

    if (editModalCancel) {
      editModalCancel.addEventListener('click', () => {
        this.hideEditDiaryModal();
      });
    }

    if (editModalSave) {
      editModalSave.addEventListener('click', () => {
        this.updateDiaryTitle();
      });
    }

    if (editModal) {
      editModal.addEventListener('click', (e) => {
        if (e.target === editModal) {
          this.hideEditDiaryModal();
        }
      });
    }

    if (saveBtn) {
      saveBtn.addEventListener('click', () => {
        if (this.currentConversation.length > 0) {
          this.saveDiary(this.currentConversation);
        }
      });
    }

    if (discardBtn) {
      discardBtn.addEventListener('click', () => {
        this.hideEndOverlay();
        this.currentConversation = [];
      });
    }

    if (endOverlay) {
      endOverlay.addEventListener('click', (e) => {
        if (e.target === endOverlay) {
          this.hideEndOverlay();
        }
      });
    }
  }
}

// ============================================
// Initialize
// ============================================
const app = new IMoodApp();
const diaryManager = new DiaryManager();

document.addEventListener('DOMContentLoaded', () => {
  app.init();
  diaryManager.loadNotebooks();
  diaryManager.bindEvents();
  
  // 初始化音乐播放器（延迟加载）
  if (typeof musicPlayer !== 'undefined') {
    musicPlayer.init();
  }
  
  const pauseBtn = document.getElementById('pauseBtn');
  const expandBtn = document.getElementById('expandBtn');
  const endConversationBtn = document.getElementById('endConversationBtn');
  
  if (pauseBtn) {
    pauseBtn.addEventListener('click', () => app.togglePauseStream());
  }
  
  if (expandBtn) {
    expandBtn.addEventListener('click', () => app.subtitle.toggleExpand());
  }

  if (endConversationBtn) {
    endConversationBtn.addEventListener('click', () => {
      if (state.hasConversation) {
        app.endConversation();
      } else {
        // Show subtle hint that conversation is needed
        endConversationBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
          endConversationBtn.style.transform = '';
        }, 150);
      }
    });
  }
  
  // Music Player Event Listeners
  const musicBtn = document.getElementById('musicBtn');
  const musicPanelClose = document.getElementById('musicPanelClose');
  const musicPlayBtn = document.getElementById('musicPlayBtn');
  const musicPrevBtn = document.getElementById('musicPrevBtn');
  const musicNextBtn = document.getElementById('musicNextBtn');
  const musicVolume = document.getElementById('musicVolume');
  const musicProgress = document.getElementById('musicProgress');
  
  if (musicBtn) {
    musicBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      musicPlayer.togglePanel();
    });
  }
  
  if (musicPanelClose) {
    musicPanelClose.addEventListener('click', () => {
      musicPlayer.closePanel();
    });
  }
  
  if (musicPlayBtn) {
    musicPlayBtn.addEventListener('click', () => {
      musicPlayer.toggle();
    });
  }
  
  if (musicPrevBtn) {
    musicPrevBtn.addEventListener('click', () => {
      musicPlayer.prev();
    });
  }
  
  if (musicNextBtn) {
    musicNextBtn.addEventListener('click', () => {
      musicPlayer.next();
    });
  }
  
  if (musicVolume) {
    musicVolume.addEventListener('input', (e) => {
      musicPlayer.setVolume(parseFloat(e.target.value));
    });
  }
  
  if (musicProgress) {
    musicProgress.addEventListener('input', (e) => {
      const time = (e.target.value / 100) * musicPlayer.audio.duration;
      musicPlayer.seek(time);
    });
  }
  
  // Close music panel when clicking outside
  document.addEventListener('click', (e) => {
    const musicPanel = document.getElementById('musicPanel');
    if (musicPanel && musicPlayer.isPanelOpen) {
      if (!musicPanel.contains(e.target) && e.target.id !== 'musicBtn') {
        musicPlayer.closePanel();
      }
    }
  });
});
