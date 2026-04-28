/**
 * iMood Music Player Module
 * Non-intrusive music player with AI volume adjustment
 */

class MusicPlayer {
  constructor() {
    this.playlist = [];
    this.currentIndex = 0;
    this.audio = new Audio();
    this.isPlaying = false;
    this.volume = 0.7;
    this.originalVolume = 0.7;
    this.isPanelOpen = false;
    this.audioContext = null;
    this.analyser = null;
    this.waveformCanvas = null;
    this.waveformCtx = null;
    this.animationId = null;
    this.isAIPlaying = false;
    
    // 延迟初始化，避免阻塞页面加载
    this.initialized = false;
  }
  
  init() {
    if (this.initialized) return;
    this.initialized = true;
    
    this.audio.volume = this.volume;
    this.audio.preload = 'metadata';
    
    this.audio.addEventListener('ended', () => {
      this.next();
    });
    
    this.audio.addEventListener('timeupdate', () => {
      this.updateProgress();
    });
    
    this.audio.addEventListener('loadedmetadata', () => {
      this.updateDuration();
    });
    
    // 延迟加载播放列表，避免阻塞页面渲染
    setTimeout(() => this.loadPlaylist(), 1000);
  }
  
  async loadPlaylist() {
    try {
      const response = await fetch('/api/music/list');
      const data = await response.json();
      this.playlist = data.music || [];
      this.renderPlaylist();
    } catch (error) {
      console.error('Failed to load playlist:', error);
    }
  }
  
  play(index = null) {
    if (index !== null) {
      this.currentIndex = index;
    }
    
    if (this.playlist.length === 0) {
      console.warn('Playlist is empty');
      return;
    }
    
    const song = this.playlist[this.currentIndex];
    if (!song) return;
    
    this.audio.src = `/music/${song.filename}`;
    this.audio.play()
      .then(() => {
        this.isPlaying = true;
        this.updatePlayButton();
        this.initAudioVisualization();
        this.showWaveform();
        this.renderPlaylist();
      })
      .catch(error => {
        console.error('Failed to play:', error);
      });
  }
  
  pause() {
    this.audio.pause();
    this.isPlaying = false;
    this.updatePlayButton();
    this.hideWaveform();
  }
  
  toggle() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }
  
  next() {
    if (this.playlist.length === 0) return;
    
    this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
    this.play();
  }
  
  prev() {
    if (this.playlist.length === 0) return;
    
    this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
    this.play();
  }
  
  setVolume(value) {
    this.volume = Math.max(0, Math.min(1, value));
    this.originalVolume = this.volume;
    
    if (!this.isAIPlaying) {
      this.audio.volume = this.volume;
    }
    
    this.updateVolumeUI();
  }
  
  adjustVolumeForAI(isAIPlaying) {
    this.isAIPlaying = isAIPlaying;
    
    if (isAIPlaying && this.isPlaying) {
      this.audio.volume = this.volume * 0.3;
    } else if (this.isPlaying) {
      this.audio.volume = this.volume;
    }
  }
  
  seek(time) {
    if (this.audio.duration) {
      this.audio.currentTime = time;
    }
  }
  
  getCurrentSong() {
    return this.playlist[this.currentIndex];
  }
  
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
  
  updateProgress() {
    const progress = (this.audio.currentTime / this.audio.duration) * 100 || 0;
    const progressBar = document.getElementById('musicProgress');
    const currentTimeEl = document.getElementById('musicCurrentTime');
    const durationEl = document.getElementById('musicDuration');
    
    if (progressBar) {
      progressBar.value = progress;
    }
    
    if (currentTimeEl) {
      currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
    }
    
    if (durationEl && this.audio.duration) {
      durationEl.textContent = this.formatTime(this.audio.duration);
    }
  }
  
  updateDuration() {
    const durationEl = document.getElementById('musicDuration');
    if (durationEl && this.audio.duration) {
      durationEl.textContent = this.formatTime(this.audio.duration);
      
      const song = this.getCurrentSong();
      if (song && !song.duration) {
        this.updateSongDuration(this.audio.duration);
      }
    }
  }
  
  async updateSongDuration(duration) {
    const song = this.getCurrentSong();
    if (!song) return;
    
    try {
      await fetch(`/api/music/${song.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duration })
      });
      
      const index = this.playlist.findIndex(s => s.id === song.id);
      if (index !== -1) {
        this.playlist[index].duration = duration;
      }
    } catch (error) {
      console.error('Failed to update song duration:', error);
    }
  }
  
  updatePlayButton() {
    const playBtn = document.getElementById('musicPlayBtn');
    if (playBtn) {
      playBtn.innerHTML = this.isPlaying 
        ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    }
    
    const musicBtn = document.getElementById('musicBtn');
    if (musicBtn) {
      musicBtn.classList.toggle('playing', this.isPlaying);
    }
  }
  
  updateVolumeUI() {
    const volumeSlider = document.getElementById('musicVolume');
    if (volumeSlider) {
      volumeSlider.value = this.volume;
    }
  }
  
  initAudioVisualization() {
    if (this.audioContext) return;
    
    try {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      const source = this.audioContext.createMediaElementSource(this.audio);
      source.connect(this.analyser);
      this.analyser.connect(this.audioContext.destination);
    } catch (error) {
      console.error('Failed to initialize audio visualization:', error);
    }
  }
  
  showWaveform() {
    if (!this.waveformCanvas) {
      this.createWaveformCanvas();
    }
    
    if (this.waveformCanvas) {
      this.waveformCanvas.style.opacity = '1';
      this.startWaveformAnimation();
    }
  }
  
  hideWaveform() {
    if (this.waveformCanvas) {
      this.waveformCanvas.style.opacity = '0';
      this.stopWaveformAnimation();
    }
  }
  
  createWaveformCanvas() {
    const inputArea = document.querySelector('.input-area');
    if (!inputArea) return;
    
    this.waveformCanvas = document.createElement('canvas');
    this.waveformCanvas.id = 'musicWaveform';
    this.waveformCanvas.className = 'music-waveform';
    this.waveformCanvas.style.cssText = `
      position: absolute;
      top: -6px;
      left: 0;
      width: 100%;
      height: 6px;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      z-index: 5;
    `;
    
    inputArea.style.position = 'relative';
    inputArea.insertBefore(this.waveformCanvas, inputArea.firstChild);
    
    this.waveformCtx = this.waveformCanvas.getContext('2d');
    this.resizeWaveformCanvas();
    
    window.addEventListener('resize', () => this.resizeWaveformCanvas());
  }
  
  resizeWaveformCanvas() {
    if (!this.waveformCanvas) return;
    
    const inputArea = document.querySelector('.input-area');
    if (inputArea) {
      this.waveformCanvas.width = inputArea.clientWidth;
      this.waveformCanvas.height = 6;
    }
  }
  
  startWaveformAnimation() {
    if (!this.analyser || !this.waveformCtx) return;
    
    const draw = () => {
      if (!this.isPlaying) {
        this.stopWaveformAnimation();
        return;
      }
      
      this.animationId = requestAnimationFrame(draw);
      
      const bufferLength = this.analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      this.analyser.getByteFrequencyData(dataArray);
      
      const ctx = this.waveformCtx;
      const width = this.waveformCanvas.width;
      const height = this.waveformCanvas.height;
      
      ctx.clearRect(0, 0, width, height);
      
      const isLight = document.documentElement.getAttribute('data-theme') === 'light';
      const barColor = isLight ? '100, 100, 100' : '160, 160, 160';
      
      const barCount = 50;
      const barWidth = width / barCount;
      
      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor((i / barCount) * bufferLength * 0.7);
        const value = dataArray[dataIndex] / 255;
        const barHeight = value * height;
        
        ctx.fillStyle = `rgba(${barColor}, ${0.3 + value * 0.7})`;
        ctx.fillRect(
          i * barWidth,
          height - barHeight,
          barWidth - 1,
          barHeight
        );
      }
    };
    
    draw();
  }
  
  stopWaveformAnimation() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
    
    if (this.waveformCtx && this.waveformCanvas) {
      this.waveformCtx.clearRect(0, 0, this.waveformCanvas.width, this.waveformCanvas.height);
    }
  }
  
  renderPlaylist() {
    const playlistEl = document.getElementById('musicPlaylist');
    if (!playlistEl) return;
    
    if (this.playlist.length === 0) {
      playlistEl.innerHTML = '<p class="music-empty-hint">暂无音乐</p>';
      return;
    }
    
    playlistEl.innerHTML = this.playlist.map((song, index) => `
      <div class="music-item ${index === this.currentIndex && this.isPlaying ? 'active' : ''}" 
           onclick="musicPlayer.play(${index})">
        <span class="music-item-icon">${index === this.currentIndex && this.isPlaying ? '▶' : '○'}</span>
        <span class="music-item-title">${song.title}</span>
        <span class="music-item-artist">${song.artist}</span>
      </div>
    `).join('');
  }
  
  togglePanel() {
    const panel = document.getElementById('musicPanel');
    if (!panel) return;
    
    this.isPanelOpen = !this.isPanelOpen;
    panel.classList.toggle('active', this.isPanelOpen);
    
    if (this.isPanelOpen) {
      this.renderPlaylist();
      this.updatePlayButton();
      this.updateVolumeUI();
      
      const currentSong = this.getCurrentSong();
      if (currentSong) {
        const titleEl = document.getElementById('musicCurrentTitle');
        const artistEl = document.getElementById('musicCurrentArtist');
        
        if (titleEl) titleEl.textContent = currentSong.title;
        if (artistEl) artistEl.textContent = currentSong.artist;
      }
    }
  }
  
  closePanel() {
    const panel = document.getElementById('musicPanel');
    if (panel) {
      this.isPanelOpen = false;
      panel.classList.remove('active');
    }
  }
}

const musicPlayer = new MusicPlayer();

window.musicPlayer = musicPlayer;
