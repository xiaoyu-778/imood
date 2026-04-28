// ============================================
// Heart Particles Visualizer
// Three.js GLSL Heart-shaped Particle System
// Monochrome Design System with Rose Accents
// ============================================

class HeartParticlesVisualizer {
  constructor(container) {
    console.log('[HeartParticles] Constructor called with container:', container);

    if (!container) {
      console.error('[HeartParticles] Container is null or undefined');
      return;
    }

    this.container = container;
    this.canvas = null;
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.particles = null;
    this.outlineParticles = null;   // 轮廓粒子层 (边缘)
    this.fillParticles = null;      // 主体填充层 (内部)
    this.detailParticles = null;    // 细节点缀层 (高光/过渡)
    this.ambientParticles = null;

    this.time = 0;
    this.intensity = 0.5;
    this.targetIntensity = 0.5;
    this.persona = 'samantha';

    // 三层粒子系统 - 总计约 40 万粒子
    this.totalParticles = 400000;
    this.outlineParticleCount = Math.floor(this.totalParticles * 0.30);   // 轮廓层 30%
    this.fillParticleCount = Math.floor(this.totalParticles * 0.60);      // 填充层 60%
    this.detailParticleCount = Math.floor(this.totalParticles * 0.10);    // 细节层 10%
    this.ambientParticleCount = 15000;
    this.isLight = false;
    this.isImageMode = false;
    
    // 扩散效果参数
    this.burstIntensity = 0;
    this.targetBurst = 0;
    this.isSpeaking = false;
    this.isTouching = false;

    if (typeof THREE === 'undefined') {
      console.warn('[HeartParticles] Three.js not loaded, skipping HeartParticlesVisualizer');
      return;
    }

    console.log('[HeartParticles] Three.js is available, proceeding with init');
    setTimeout(() => this.init(), 0);
  }

  init() {
    console.log('[HeartParticles] init() called');

    if (this.container.clientWidth === 0 || this.container.clientHeight === 0) {
      console.warn('[HeartParticles] Container has no size, deferring init');
      setTimeout(() => this.init(), 100);
      return;
    }

    const oldCanvas = this.container.querySelector('.nebula-canvas');
    if (oldCanvas) {
      oldCanvas.style.display = 'none';
    }

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'heart-canvas';
    this.canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:1;cursor:pointer;';
    this.container.appendChild(this.canvas);

    this.isLight = document.documentElement.getAttribute('data-theme') === 'light';

    this.initThree();
    this.createHeartParticles();
    this.createAmbientParticles();
    this.animate();
    this.bindEvents();

    window.addEventListener('resize', () => this.onResize());
    console.log('[HeartParticles] Initialization complete');
  }

  initThree() {
    this.scene = new THREE.Scene();

    const size = Math.min(this.container.clientWidth, this.container.clientHeight);

    if (size === 0) {
      console.error('[HeartParticles] Cannot initialize with size 0');
      return;
    }

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    this.camera.position.z = 2.5;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      premultipliedAlpha: false
    });
    this.renderer.setSize(size, size);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
  }

  createHeartParticles() {
    // 创建三层粒子系统 - 自然、饱满、过渡、呼吸感
    this.createOutlineParticles();   // 轮廓层 30% - 边缘柔和羽化
    this.createFillParticles();      // 填充层 60% - 中心高亮主体
    this.createDetailParticles();    // 细节层 10% - 自然过渡
  }

  // 轮廓层 - 边缘柔和羽化 (30%)
  // 尺寸: 0.5-1px, 边缘亮度衰减, 透明度羽化
  createOutlineParticles() {
    const positions = new Float32Array(this.outlineParticleCount * 3);
    const aRandom = new Float32Array(this.outlineParticleCount * 4);
    const aLayer = new Float32Array(this.outlineParticleCount);

    for (let i = 0; i < this.outlineParticleCount; i++) {
      const p = this.sampleHeartShape(i, 'outline');
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      aRandom[i * 4] = Math.random();
      aRandom[i * 4 + 1] = Math.random();
      aRandom[i * 4 + 2] = Math.random();
      aRandom[i * 4 + 3] = Math.random();
      aLayer[i] = 0.0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(aRandom, 4));
    geometry.setAttribute('aLayer', new THREE.BufferAttribute(aLayer, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.5 },
        uBurst: { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uIsLight: { value: this.isLight ? 1.0 : 0.0 }
      },
      vertexShader: `
        attribute vec4 aRandom;
        attribute float aLayer;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uBurst;
        uniform float uPixelRatio;

        varying float vDepth;
        varying float vRand;
        varying float vDist;
        varying float vDistNorm;

        void main(){
          vec3 pos=position;
          float r=aRandom.x;
          float dist=length(pos);
          float distNorm=clamp(dist/0.5,0.,1.);
          
          // 呼吸感动画
          float expansion=1.+uIntensity*.2;
          float burstExpansion=1.+uBurst*0.2;
          pos*=expansion*burstExpansion;
          
          float heartbeat=1.+sin(uTime*2.5)*.012*(1.+uIntensity);
          pos*=heartbeat;
          
          float flowT=uTime*(.12+r*.08)+r*6.283;
          pos.x+=sin(flowT)*.006*uIntensity*r;
          pos.y+=cos(flowT*.5)*.005*uIntensity*r;

          vec4 mvPosition=modelViewMatrix*vec4(pos,1.);
          gl_Position=projectionMatrix*mvPosition;

          // 轮廓层: 边缘粒子更小
          float sizeBase=0.5+r*0.4;
          sizeBase*=(0.7+distNorm*0.3); // 边缘更小
          gl_PointSize=sizeBase*uPixelRatio/max(.3,-mvPosition.z);

          vDepth=-mvPosition.z;
          vRand=r;
          vDist=dist;
          vDistNorm=distNorm;
        }
      `,
      fragmentShader: `
        uniform float uIsLight;
        uniform float uTime;

        varying float vDepth;
        varying float vRand;
        varying float vDist;
        varying float vDistNorm;

        void main(){
          vec2 uv=gl_PointCoord-.5;
          float d=length(uv);
          if(d>.5) discard;

          float core=smoothstep(.5,.03,d);
          
          // 边缘柔和衰减：中心亮，边缘暗
          float brightness=1.0-vDistNorm*0.6;
          float alpha=core*brightness*(0.5-vDistNorm*0.3);
          
          // 边缘羽化：透明度随距离降低
          alpha=clamp(alpha,0.0,1.0);

          vec3 col;
          if(uIsLight>.5){
            // Light mode: 红色边缘羽化
            col=vec3(0.9,0.2,0.2)*brightness;
          }else{
            // Dark mode: 暖白边缘羽化
            col=vec3(0.95,0.92,0.9)*brightness;
          }

          // 微弱呼吸闪烁
          float breath=0.95+sin(uTime*1.5+vRand*6.28)*0.05;
          col*=breath;

          gl_FragColor=vec4(col,alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.outlineParticles = new THREE.Points(geometry, material);
    this.scene.add(this.outlineParticles);
  }

  // 填充层 - 中心高亮主体 (60%)
  // 尺寸: 1-1.5px, 中心高亮, 边缘柔和过渡
  createFillParticles() {
    const positions = new Float32Array(this.fillParticleCount * 3);
    const aRandom = new Float32Array(this.fillParticleCount * 4);
    const aLayer = new Float32Array(this.fillParticleCount);

    for (let i = 0; i < this.fillParticleCount; i++) {
      const p = this.sampleHeartShape(i, 'fill');
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      aRandom[i * 4] = Math.random();
      aRandom[i * 4 + 1] = Math.random();
      aRandom[i * 4 + 2] = Math.random();
      aRandom[i * 4 + 3] = Math.random();
      aLayer[i] = 1.0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(aRandom, 4));
    geometry.setAttribute('aLayer', new THREE.BufferAttribute(aLayer, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.5 },
        uBurst: { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uIsLight: { value: this.isLight ? 1.0 : 0.0 }
      },
      vertexShader: `
        attribute vec4 aRandom;
        attribute float aLayer;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uBurst;
        uniform float uPixelRatio;

        varying float vDepth;
        varying float vRand;
        varying float vDist;
        varying float vDistNorm;
        varying float vY;

        void main(){
          vec3 pos=position;
          float r=aRandom.x;
          float dist=length(pos);
          float distNorm=clamp(dist/0.5,0.,1.);
          
          // 呼吸感动画
          float expansion=1.+uIntensity*.3;
          float burstExpansion=1.+uBurst*0.3;
          pos*=expansion*burstExpansion;
          
          float heartbeat=1.+sin(uTime*2.5)*.018*(1.+uIntensity);
          pos*=heartbeat;
          
          float flowT=uTime*(.18+r*.12)+r*6.283;
          pos.x+=sin(flowT)*.01*uIntensity*r;
          pos.y+=cos(flowT*.65)*.008*uIntensity*r;

          vec4 mvPosition=modelViewMatrix*vec4(pos,1.);
          gl_Position=projectionMatrix*mvPosition;

          // 填充层: 中心大，边缘小
          float sizeBase=1.0+r*0.5;
          sizeBase*=(1.2-distNorm*0.4); // 中心更大
          gl_PointSize=sizeBase*uPixelRatio/max(.3,-mvPosition.z);

          vDepth=-mvPosition.z;
          vRand=r;
          vDist=dist;
          vDistNorm=distNorm;
          vY=pos.y;
        }
      `,
      fragmentShader: `
        uniform float uIsLight;
        uniform float uTime;
        uniform float uIntensity;

        varying float vDepth;
        varying float vRand;
        varying float vDist;
        varying float vDistNorm;
        varying float vY;

        void main(){
          vec2 uv=gl_PointCoord-.5;
          float d=length(uv);
          if(d>.5) discard;

          float core=smoothstep(.5,.06,d);
          float glow=smoothstep(.5,0.,d*d);
          
          // 中心到边缘亮度渐变：中心高亮，边缘柔和衰减
          float brightness=1.0-vDistNorm*0.45;
          float alphaBase=0.85-vDistNorm*0.25;
          float alpha=(core*alphaBase+glow*0.12*uIntensity)*brightness;
          alpha=clamp(alpha,0.0,1.0);

          vec3 col;
          if(uIsLight>.5){
            // Light mode: 红色主体
            vec3 centerColor=vec3(1.0,0.25,0.25);
            vec3 outerColor=vec3(0.85,0.15,0.15);
            col=mix(centerColor,outerColor,vDistNorm);
          }else{
            // Dark mode: 暖白主体，中心高亮
            vec3 centerColor=vec3(1.0,0.98,0.96); // 暖白高光
            vec3 outerColor=vec3(0.88,0.82,0.82); // 柔和过渡
            col=mix(centerColor,outerColor,vDistNorm);
            
            // 光影分层：上半部分高光，下半部分阴影
            if(vY>0.1){
              // 高光区
              col+=vec3(0.1,0.08,0.06)*vY*1.5;
            }else if(vY<-0.1){
              // 阴影区 - 偏冷灰
              col=mix(col,vec3(0.8,0.78,0.85),abs(vY)*0.25);
            }
          }

          // 呼吸感
          float breath=0.97+sin(uTime*1.8+vRand*6.28)*0.03;
          col*=breath;

          gl_FragColor=vec4(col,alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.fillParticles = new THREE.Points(geometry, material);
    this.scene.add(this.fillParticles);
  }

  // 细节层 - 自然过渡 (10%)
  // 尺寸: 1.5-2px, 柔和过渡, 呼吸感
  createDetailParticles() {
    const positions = new Float32Array(this.detailParticleCount * 3);
    const aRandom = new Float32Array(this.detailParticleCount * 4);
    const aLayer = new Float32Array(this.detailParticleCount);

    for (let i = 0; i < this.detailParticleCount; i++) {
      const p = this.sampleHeartShape(i, 'detail');
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      aRandom[i * 4] = Math.random();
      aRandom[i * 4 + 1] = Math.random();
      aRandom[i * 4 + 2] = Math.random();
      aRandom[i * 4 + 3] = Math.random();
      aLayer[i] = 2.0;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(aRandom, 4));
    geometry.setAttribute('aLayer', new THREE.BufferAttribute(aLayer, 1));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.5 },
        uBurst: { value: 0.0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uIsLight: { value: this.isLight ? 1.0 : 0.0 }
      },
      vertexShader: `
        attribute vec4 aRandom;
        attribute float aLayer;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uBurst;
        uniform float uPixelRatio;

        varying float vDepth;
        varying float vRand;
        varying float vDist;
        varying float vDistNorm;
        varying float vY;

        void main(){
          vec3 pos=position;
          float r=aRandom.x;
          float dist=length(pos);
          float distNorm=clamp(dist/0.5,0.,1.);
          
          // 呼吸感动画
          float expansion=1.+uIntensity*.25;
          float burstExpansion=1.+uBurst*0.25;
          pos*=expansion*burstExpansion;
          
          float heartbeat=1.+sin(uTime*2.5)*.015*(1.+uIntensity);
          pos*=heartbeat;
          
          float flowT=uTime*(.2+r*.1)+r*6.283;
          pos.x+=sin(flowT)*.012*uIntensity*r;
          pos.y+=cos(flowT*.7)*.01*uIntensity*r;

          vec4 mvPosition=modelViewMatrix*vec4(pos,1.);
          gl_Position=projectionMatrix*mvPosition;

          // 细节层: 最大最柔和
          float sizeBase=1.5+r*0.5;
          sizeBase*=(1.1-distNorm*0.3);
          gl_PointSize=sizeBase*uPixelRatio/max(.3,-mvPosition.z);

          vDepth=-mvPosition.z;
          vRand=r;
          vDist=dist;
          vDistNorm=distNorm;
          vY=pos.y;
        }
      `,
      fragmentShader: `
        uniform float uIsLight;
        uniform float uTime;

        varying float vDepth;
        varying float vRand;
        varying float vDist;
        varying float vDistNorm;
        varying float vY;

        void main(){
          vec2 uv=gl_PointCoord-.5;
          float d=length(uv);
          if(d>.5) discard;

          float core=smoothstep(.5,.08,d);
          float glow=smoothstep(.5,0.,d*d);
          
          // 细节层：最柔和，中心到边缘衰减
          float brightness=1.0-vDistNorm*0.5;
          float alpha=(core*0.35+glow*0.1)*brightness;
          alpha=clamp(alpha,0.0,0.6);

          vec3 col;
          if(uIsLight>.5){
            // Light mode: 淡粉过渡
            col=vec3(0.95,0.65,0.65)*brightness;
          }else{
            // Dark mode: 浅灰/淡粉过渡
            col=vec3(0.92,0.88,0.9)*brightness;
            
            // 高光点
            if(vY>0.25){
              col=vec3(1.0,0.98,0.96);
              alpha*=1.1;
            }
          }

          // 呼吸感
          float breath=0.95+sin(uTime*2.0+vRand*6.28)*0.05;
          col*=breath;

          gl_FragColor=vec4(col,alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.detailParticles = new THREE.Points(geometry, material);
    this.scene.add(this.detailParticles);
  }

  // 创建周围零散散布的环境粒子
  createAmbientParticles() {
    const positions = new Float32Array(this.ambientParticleCount * 3);
    const aRandom = new Float32Array(this.ambientParticleCount * 4);

    for (let i = 0; i < this.ambientParticleCount; i++) {
      // 在更大的范围内随机分布，形成零散散布效果
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.8 + Math.random() * 1.5; // 在心形外围 0.8-2.3 范围
      const height = (Math.random() - 0.5) * 1.5;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = Math.sin(angle) * radius;
      positions[i * 3 + 2] = height;
      
      aRandom[i * 4] = Math.random();
      aRandom[i * 4 + 1] = Math.random();
      aRandom[i * 4 + 2] = Math.random();
      aRandom[i * 4 + 3] = Math.random();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('aRandom', new THREE.BufferAttribute(aRandom, 4));

    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.5 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uIsLight: { value: this.isLight ? 1.0 : 0.0 }
      },
      vertexShader: `
        attribute vec4 aRandom;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uPixelRatio;

        varying float vRand;
        varying float vAlpha;

        void main(){
          vec3 pos=position;
          float r=aRandom.x;

          // Slow drifting motion
          float driftT=uTime*(.1+r*.1)+r*6.283;
          pos.x+=sin(driftT)*.15;
          pos.y+=cos(driftT*.7)*.12;
          pos.z+=sin(driftT*.5)*.1;

          // Gentle pulsing toward/away from center
          float pulse=1.+sin(uTime*.5+r*3.)*.1;
          pos*=pulse;

          vec4 mvPosition=modelViewMatrix*vec4(pos,1.);
          gl_Position=projectionMatrix*mvPosition;

          // Smaller size for ambient particles
          float sizeBase=(1.0+r)*0.8;
          gl_PointSize=sizeBase*uPixelRatio/max(.3,-mvPosition.z);

          vRand=r;
          // Fade based on distance from center
          float dist=length(pos);
          vAlpha=smoothstep(2.5,0.5,dist)*(0.3+r*.4);
        }
      `,
      fragmentShader: `
        uniform float uIsLight;
        uniform float uTime;

        varying float vRand;
        varying float vAlpha;

        void main(){
          vec2 uv=gl_PointCoord-.5;
          float d=length(uv);
          if(d>.5) discard;

          // Soft circular particle
          float alpha=vAlpha*smoothstep(.5,.1,d);
          
          // Color based on theme
          vec3 col;
          if(uIsLight>.5){
            // Light mode: pale pink ambient particles
            col=vec3(0.98,0.88,0.9); // pale pink
            col+=vec3(.02,.01,.015)*vRand;
          }else{
            // Dark mode: red ambient particles with varying brightness
            // vRand creates variation in brightness (0.3 to 1.0 range)
            float brightness=0.3+vRand*0.7;
            vec3 redBase=vec3(0.9,0.1,0.1); // base red
            col=redBase*brightness;
            // Add some variation to the red
            col+=vec3(.1,.02,.02)*vRand*brightness;
          }
          
          // Twinkle effect
          float twinkle=sin(uTime*2.+vRand*10.)*.5+.5;
          alpha*=0.6+twinkle*.4;

          gl_FragColor=vec4(col,alpha*.6);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });

    this.ambientParticles = new THREE.Points(geometry, material);
    this.scene.add(this.ambientParticles);
  }

  // 心形形状采样 - 支持三层粒子分层
  sampleHeartShape(index, layer = 'fill') {
    let x = 0, y = 0, z = 0;

    const t = Math.random() * Math.PI * 2;
    
    let r;
    if (layer === 'outline') {
      // 轮廓层：集中在边缘 (r接近1)
      r = 0.88 + Math.pow(Math.random(), 0.25) * 0.12;
    } else if (layer === 'detail') {
      // 细节层：随机分布在主体内部
      r = Math.pow(Math.random(), 0.6) * 0.7;
    } else {
      // 填充层：均匀分布在内部
      r = Math.pow(Math.random(), 0.5) * 0.85;
    }
    
    // 基础心形参数方程
    let hx = 16 * Math.pow(Math.sin(t), 3);
    let hy = 13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t);
    
    // 归一化并添加随机分布
    const scale = 0.035 * r;
    x = hx * scale;
    y = (hy - 5.0) * scale; // 上移 3.0 单位
    
    // Z轴深度 - 轮廓层更薄，填充层更厚
    let zDepth;
    if (layer === 'outline') {
      zDepth = 0.03;
    } else if (layer === 'detail') {
      zDepth = 0.06;
    } else {
      zDepth = 0.08;
    }
    z = this.gaussRand(0, zDepth) * (1 - r * 0.5);
    
    // 内部填充 - 只对填充层
    if (layer === 'fill' && Math.random() < 0.3) {
      const innerR = Math.random() * 0.6;
      const innerAngle = Math.random() * Math.PI * 2;
      x += Math.cos(innerAngle) * innerR * 0.15;
      y += Math.sin(innerAngle) * innerR * 0.12;
    }

    // 微抖动 - 轮廓更小
    const jitter = layer === 'outline' ? 0.005 : (layer === 'detail' ? 0.012 : 0.01);
    x += (Math.random() - 0.5) * jitter;
    y += (Math.random() - 0.5) * jitter;
    z += (Math.random() - 0.5) * jitter;

    return { x, y, z };
  }
    
  gaussRand(mean = 0, std = 1) {
    const u1 = Math.max(1e-10, Math.random());
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    return mean + std * z0;
  }

  bindEvents() {
    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isTouching = true;
      this.triggerBurst();
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.isTouching = false;
    });

    this.canvas.addEventListener('mousedown', () => {
      this.isTouching = true;
      this.triggerBurst();
    });

    this.canvas.addEventListener('mouseup', () => {
      this.isTouching = false;
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.isTouching = false;
    });
  }

  triggerBurst() {
    // Subtle burst effect - much weaker than before
    this.targetBurst = 0.25;
    setTimeout(() => {
      if (!this.isTouching && !this.isSpeaking) {
        this.targetBurst = 0;
      }
    }, 300);
  }

  setPersona(persona) {
    this.persona = persona;
    this.updateColors();
  }

  setState(newState) {
    switch (newState) {
      case 'idle':     
        this.targetIntensity = 0.3; 
        this.isSpeaking = false;
        this.targetBurst = 0;
        break;
      case 'listening':
        this.targetIntensity = 0.55; 
        this.isSpeaking = false;
        this.targetBurst = 0.25;
        break;
      case 'thinking': 
        this.targetIntensity = 0.4; 
        this.isSpeaking = false;
        this.targetBurst = 0.15;
        break;
      case 'speaking': 
        this.targetIntensity = 0.5; 
        this.isSpeaking = true;
        this.targetBurst = 0;  // No burst expansion during speaking
        break;
    }
  }

  updateColors() {
    this.isLight = document.documentElement.getAttribute('data-theme') === 'light';
    
    // 更新轮廓粒子层
    if (this.outlineParticles && this.outlineParticles.material.uniforms) {
      this.outlineParticles.material.uniforms.uIsLight.value = this.isLight ? 1.0 : 0.0;
    }
    
    // 更新填充粒子层
    if (this.fillParticles && this.fillParticles.material.uniforms) {
      this.fillParticles.material.uniforms.uIsLight.value = this.isLight ? 1.0 : 0.0;
    }
    
    // 更新细节粒子层
    if (this.detailParticles && this.detailParticles.material.uniforms) {
      this.detailParticles.material.uniforms.uIsLight.value = this.isLight ? 1.0 : 0.0;
    }
    
    // 更新环境粒子
    if (this.ambientParticles && this.ambientParticles.material.uniforms) {
      this.ambientParticles.material.uniforms.uIsLight.value = this.isLight ? 1.0 : 0.0;
    }
    
    // 更新图片粒子
    if (this.particles && this.particles.material.uniforms) {
      this.particles.material.uniforms.uIsLight.value = this.isLight ? 1.0 : 0.0;
    }
  }

  // 从图片创建粒子效果
  async createImageParticles(imageUrl) {
    console.log('[HeartParticles] Creating image particles from:', imageUrl);
    
    // 清除心形粒子（三层）
    if (this.outlineParticles) {
      this.scene.remove(this.outlineParticles);
      this.outlineParticles.geometry.dispose();
      this.outlineParticles.material.dispose();
      this.outlineParticles = null;
    }
    if (this.fillParticles) {
      this.scene.remove(this.fillParticles);
      this.fillParticles.geometry.dispose();
      this.fillParticles.material.dispose();
      this.fillParticles = null;
    }
    if (this.detailParticles) {
      this.scene.remove(this.detailParticles);
      this.detailParticles.geometry.dispose();
      this.detailParticles.material.dispose();
      this.detailParticles = null;
    }
    
    try {
      // 1. 加载图片
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
      await img.decode();
      
      // 2. 采样图片像素
      const sampleSize = 600; // 采样分辨率 - 高清模式
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = sampleSize;
      canvas.height = sampleSize;
      
      // 保持比例居中裁剪
      const scale = Math.max(sampleSize / img.width, sampleSize / img.height);
      const sw = sampleSize / scale;
      const sh = sampleSize / scale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2;
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);
      
      // 3. 提取像素数据
      const imageData = ctx.getImageData(0, 0, sampleSize, sampleSize);
      const pixels = imageData.data;
      
      // 4. 生成粒子位置和颜色
      const positions = [];
      const colors = [];
      const alphas = [];
      const randoms = [];
      
      for (let y = 0; y < sampleSize; y++) {
        for (let x = 0; x < sampleSize; x++) {
          const i = (y * sampleSize + x) * 4;
          const r = pixels[i] / 255;
          const g = pixels[i + 1] / 255;
          const b = pixels[i + 2] / 255;
          const a = pixels[i + 3] / 255;
          
          // 跳过透明或过暗像素
          if (a < 0.1 || (r + g + b) < 0.1) continue;
          
          // 映射到 3D 空间 (-1 到 1)
          const px = (x / sampleSize - 0.5) * 2;
          const py = (0.5 - y / sampleSize) * 2;
          const pz = (Math.random() - 0.5) * 0.15; // 轻微深度
          
          positions.push(px, py, pz);
          colors.push(r, g, b);
          alphas.push(a);
          randoms.push(Math.random(), Math.random(), Math.random(), Math.random());
        }
      }
      
      console.log('[HeartParticles] Generated', positions.length / 3, 'particles from image');
      
      // 5. 更新粒子系统
      this.updateImageParticleGeometry(positions, colors, alphas, randoms);
      
      // 标记当前为图片模式
      this.isImageMode = true;
      
    } catch (error) {
      console.error('[HeartParticles] Failed to create image particles:', error);
    }
  }

  // 更新图片粒子几何体
  updateImageParticleGeometry(positions, colors, alphas, randoms) {
    // 移除旧粒子
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
    }
    
    // 创建新几何体
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
    geometry.setAttribute('aRandom', new THREE.Float32BufferAttribute(randoms, 4));
    
    // 创建材质（支持自定义颜色和流动效果）
    const material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uIntensity: { value: 0.5 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uIsLight: { value: this.isLight ? 1.0 : 0.0 }
      },
      vertexShader: `
        attribute vec3 aColor;
        attribute float aAlpha;
        attribute vec4 aRandom;
        uniform float uTime;
        uniform float uIntensity;
        uniform float uPixelRatio;
        
        varying vec3 vColor;
        varying float vAlpha;
        varying float vRand;
        
        void main() {
          vColor = aColor;
          vAlpha = aAlpha;
          vRand = aRandom.x;
          
          vec3 pos = position;
          
          // 流动效果
          float flowT = uTime * (0.2 + vRand * 0.15);
          pos.x += sin(flowT + vRand * 6.283) * 0.015 * uIntensity;
          pos.y += cos(flowT * 0.8 + vRand * 6.283) * 0.015 * uIntensity;
          pos.z += sin(flowT * 0.5 + vRand * 6.283) * 0.01 * uIntensity;
          
          // 轻微呼吸效果
          float breathe = 1.0 + sin(uTime * 1.5 + vRand * 3.14) * 0.02;
          pos *= breathe;
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          gl_PointSize = (1.2 + vRand * 0.8) * uPixelRatio / max(0.3, -mvPosition.z);
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        varying float vAlpha;
        varying float vRand;
        
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          
          float alpha = vAlpha * smoothstep(0.5, 0.1, d);
          
          // 轻微闪烁
          float twinkle = 0.9 + sin(vRand * 100.0) * 0.1;
          
          gl_FragColor = vec4(vColor * twinkle, alpha * 0.85);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    });
    
    this.particles = new THREE.Points(geometry, material);
    this.scene.add(this.particles);
  }

  // 重置为心形
  resetToHeart() {
    console.log('[HeartParticles] Resetting to heart shape');
    
    // 移除图片粒子
    if (this.particles) {
      this.scene.remove(this.particles);
      this.particles.geometry.dispose();
      this.particles.material.dispose();
      this.particles = null;
    }
    
    // 移除轮廓粒子
    if (this.outlineParticles) {
      this.scene.remove(this.outlineParticles);
      this.outlineParticles.geometry.dispose();
      this.outlineParticles.material.dispose();
      this.outlineParticles = null;
    }
    
    // 移除填充粒子
    if (this.fillParticles) {
      this.scene.remove(this.fillParticles);
      this.fillParticles.geometry.dispose();
      this.fillParticles.material.dispose();
      this.fillParticles = null;
    }
    
    // 移除细节粒子
    if (this.detailParticles) {
      this.scene.remove(this.detailParticles);
      this.detailParticles.geometry.dispose();
      this.detailParticles.material.dispose();
      this.detailParticles = null;
    }
    
    // 标记非图片模式
    this.isImageMode = false;
    
    // 重新创建心形粒子
    this.createHeartParticles();
  }

  onResize() {
    const size = Math.min(this.container.clientWidth, this.container.clientHeight);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(size, size);
    
    // 更新轮廓粒子层
    if (this.outlineParticles && this.outlineParticles.material && this.outlineParticles.material.uniforms.uPixelRatio) {
      this.outlineParticles.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    }
    
    // 更新填充粒子层
    if (this.fillParticles && this.fillParticles.material && this.fillParticles.material.uniforms.uPixelRatio) {
      this.fillParticles.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    }
    
    // 更新细节粒子层
    if (this.detailParticles && this.detailParticles.material && this.detailParticles.material.uniforms.uPixelRatio) {
      this.detailParticles.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    }
    
    // 更新环境粒子
    if (this.ambientParticles && this.ambientParticles.material.uniforms.uPixelRatio) {
      this.ambientParticles.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    }
    
    // 更新图片粒子
    if (this.particles && this.particles.material && this.particles.material.uniforms.uPixelRatio) {
      this.particles.material.uniforms.uPixelRatio.value = Math.min(window.devicePixelRatio, 2);
    }
  }

  animate() {
    if (!this.renderer || !this.scene || !this.camera) {
      return;
    }

    this.time += 0.016;
    this.intensity += (this.targetIntensity - this.intensity) * 0.05;
    this.burstIntensity += (this.targetBurst - this.burstIntensity) * 0.08;

    const currentTheme = document.documentElement.getAttribute('data-theme') === 'light';
    if (currentTheme !== this.isLight) this.updateColors();

    // 更新轮廓粒子层
    if (this.outlineParticles && this.outlineParticles.material && this.outlineParticles.material.uniforms) {
      this.outlineParticles.material.uniforms.uTime.value = this.time;
      this.outlineParticles.material.uniforms.uIntensity.value = this.intensity;
      this.outlineParticles.material.uniforms.uBurst.value = this.burstIntensity;
      
      if (!this.isImageMode) {
        this.outlineParticles.rotation.y = Math.sin(this.time * 0.12) * 0.05;
        this.outlineParticles.rotation.z = Math.cos(this.time * 0.08) * 0.015;
      }
    }

    // 更新填充粒子层
    if (this.fillParticles && this.fillParticles.material && this.fillParticles.material.uniforms) {
      this.fillParticles.material.uniforms.uTime.value = this.time;
      this.fillParticles.material.uniforms.uIntensity.value = this.intensity;
      this.fillParticles.material.uniforms.uBurst.value = this.burstIntensity;
      
      if (!this.isImageMode) {
        this.fillParticles.rotation.y = Math.sin(this.time * 0.15) * 0.06;
        this.fillParticles.rotation.z = Math.cos(this.time * 0.1) * 0.02;
      }
    }

    // 更新细节粒子层
    if (this.detailParticles && this.detailParticles.material && this.detailParticles.material.uniforms) {
      this.detailParticles.material.uniforms.uTime.value = this.time;
      this.detailParticles.material.uniforms.uIntensity.value = this.intensity;
      this.detailParticles.material.uniforms.uBurst.value = this.burstIntensity;
      
      if (!this.isImageMode) {
        this.detailParticles.rotation.y = Math.sin(this.time * 0.18) * 0.07;
        this.detailParticles.rotation.z = Math.cos(this.time * 0.12) * 0.025;
      }
    }

    // 更新图片粒子
    if (this.particles && this.particles.material && this.particles.material.uniforms) {
      this.particles.material.uniforms.uTime.value = this.time;
      this.particles.material.uniforms.uIntensity.value = this.intensity;
    }

    // 更新环境粒子
    if (this.ambientParticles && this.ambientParticles.material.uniforms) {
      this.ambientParticles.material.uniforms.uTime.value = this.time;
      this.ambientParticles.rotation.y = this.time * 0.02;
      this.ambientParticles.rotation.z = this.time * 0.01;
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this.animate());
  }

  destroy() {
    window.removeEventListener('resize', this.onResize.bind(this));
    
    // 清除图片粒子
    if (this.particles) {
      this.particles.geometry.dispose();
      this.particles.material.dispose();
    }
    
    // 清除轮廓粒子
    if (this.outlineParticles) {
      this.outlineParticles.geometry.dispose();
      this.outlineParticles.material.dispose();
    }
    
    // 清除填充粒子
    if (this.fillParticles) {
      this.fillParticles.geometry.dispose();
      this.fillParticles.material.dispose();
    }
    
    // 清除细节粒子
    if (this.detailParticles) {
      this.detailParticles.geometry.dispose();
      this.detailParticles.material.dispose();
    }
    
    // 清除环境粒子
    if (this.ambientParticles) {
      this.ambientParticles.geometry.dispose();
      this.ambientParticles.material.dispose();
    }
    
    if (this.renderer) this.renderer.dispose();
    if (this.canvas && this.canvas.parentNode) this.canvas.remove();
  }
}

if (typeof window !== 'undefined') {
  window.HeartParticlesVisualizer = HeartParticlesVisualizer;
}
