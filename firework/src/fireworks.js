(function () {
  'use strict';

  const TAU = Math.PI * 2;
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const random = (low, high) => low + Math.random() * (high - low);
  const PALETTES = [
    ['#fff2b2', '#ffcc48', '#ff7547'],
    ['#ffd4ef', '#ff6fbf', '#cf54ff'],
    ['#d9fff4', '#72ffd6', '#41bddb'],
    ['#fff9e0', '#ffe17a', '#e79443'],
    ['#d8e8ff', '#a2baff', '#9b6fff'],
    ['#fff1ce', '#ff9572', '#ff507e']
  ];
  const PROFILES = {
    lively: { particles: 55, radius: 0.27, maximum: 1300, shells: 1, finale: 5 },
    annoying: { particles: 88, radius: 0.38, maximum: 2200, shells: 2, finale: 7 },
    festival: { particles: 125, radius: 0.48, maximum: 3000, shells: 3, finale: 8 }
  };
  const COMBO_COLORS = ['#c861ff', '#ff963f', '#ff4fae', '#45e7ff'];
  const COMBO_WINDOW = 2.4;
  const SPECIAL_KEYS = new Set(['Insert', 'Home', 'PageUp', 'PageDown', 'End', 'Delete']);

  class FireworksSound {
    constructor() {
      this.context = null;
      this.master = null;
      this.compressor = null;
      this.noise = null;
      this.enabled = true;
      this.volume = 0.35;
      this.voices = new Set();
      this.lastTick = -Infinity;
      this.lastBoom = -Infinity;
      this.suspended = false;
    }

    unlock() {
      if (!this.enabled || this.suspended) return Promise.resolve(false);
      try {
        if (!this.context) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return Promise.resolve(false);
          this.context = new AudioContext();
          this.master = this.context.createGain();
          this.master.gain.value = this.volume * 0.62;
          this.compressor = this.context.createDynamicsCompressor();
          this.compressor.threshold.value = -17;
          this.compressor.knee.value = 12;
          this.compressor.ratio.value = 12;
          this.compressor.attack.value = 0.003;
          this.compressor.release.value = 0.18;
          this.master.connect(this.compressor);
          this.compressor.connect(this.context.destination);
          this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
          const data = this.noise.getChannelData(0);
          let previous = 0;
          for (let i = 0; i < data.length; i += 1) {
            previous = (previous + random(-0.085, 0.085)) / 1.018;
            data[i] = previous * 4;
          }
        }
        if (this.context.state === 'running') return Promise.resolve(true);
        return this.context.resume().then(() => this.context.state === 'running').catch(() => false);
      } catch (_) {
        return Promise.resolve(false);
      }
    }

    setEnabled(enabled) {
      this.enabled = Boolean(enabled);
      if (!this.enabled) this.stop();
      this.updateGain();
    }

    setVolume(volume) {
      this.volume = clamp(Number(volume) || 0, 0, 1);
      this.updateGain();
    }

    updateGain() {
      if (!this.context || !this.master) return;
      const volume = this.enabled && !this.suspended ? this.volume * 0.62 : 0;
      try {
        const now = this.context.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setTargetAtTime(volume, now, 0.02);
      } catch (_) { /* Audio failure never interrupts editing. */ }
    }

    setSuspended(suspended) {
      this.suspended = Boolean(suspended);
      if (this.suspended) this.stop();
      this.updateGain();
    }

    ready() {
      return this.enabled && !this.suspended && this.volume > 0 && this.context &&
        this.context.state === 'running' && this.voices.size < 14;
    }

    voice(source, gain, nodes, duration) {
      const entry = { source, nodes: [source, gain, ...nodes] };
      this.voices.add(entry);
      source.onended = () => {
        this.voices.delete(entry);
        for (const node of entry.nodes) {
          try { node.disconnect(); } catch (_) { /* Already disconnected. */ }
        }
      };
      source.start();
      source.stop(this.context.currentTime + duration);
    }

    tick(large) {
      if (!this.ready()) return;
      const now = this.context.currentTime;
      if (now - this.lastTick < 0.042) return;
      this.lastTick = now;
      try {
        const oscillator = this.context.createOscillator();
        const gain = this.context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(large ? 920 : random(1300, 2100), now);
        oscillator.frequency.exponentialRampToValueAtTime(large ? 1900 : 650, now + 0.085);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(large ? 0.13 : 0.065, now + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.105);
        oscillator.connect(gain);
        gain.connect(this.master);
        this.voice(oscillator, gain, [], 0.12);
      } catch (_) { /* Browser audio limits do not affect the canvas. */ }
    }

    boom(large) {
      if (!this.ready()) return;
      const now = this.context.currentTime;
      if (now - this.lastBoom < 0.052) return;
      this.lastBoom = now;
      try {
        const oscillator = this.context.createOscillator();
        const lowGain = this.context.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(large ? 112 : 150, now);
        oscillator.frequency.exponentialRampToValueAtTime(34, now + 0.32);
        lowGain.gain.setValueAtTime(0.0001, now);
        lowGain.gain.exponentialRampToValueAtTime(large ? 0.75 : 0.36, now + 0.008);
        lowGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.43);
        oscillator.connect(lowGain);
        lowGain.connect(this.master);
        this.voice(oscillator, lowGain, [], 0.46);

        if (this.voices.size >= 14) return;
        const noise = this.context.createBufferSource();
        const filter = this.context.createBiquadFilter();
        const gain = this.context.createGain();
        noise.buffer = this.noise;
        noise.playbackRate.value = random(0.85, 1.2);
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(large ? 1300 : 1800, now);
        filter.frequency.exponentialRampToValueAtTime(380, now + 0.5);
        filter.Q.value = 0.55;
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.exponentialRampToValueAtTime(large ? 0.55 : 0.22, now + 0.008);
        gain.gain.exponentialRampToValueAtTime(0.02, now + 0.14);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.master);
        this.voice(noise, gain, [filter], 0.68);
      } catch (_) { /* Sound is optional; input is not. */ }
    }

    stop() {
      for (const entry of this.voices) {
        try { entry.source.stop(); } catch (_) { /* Ended source. */ }
        for (const node of entry.nodes) {
          try { node.disconnect(); } catch (_) { /* Already disconnected. */ }
        }
      }
      this.voices.clear();
    }

    destroy() {
      this.stop();
      if (this.context) this.context.close().catch(() => {});
      this.context = null;
    }
  }

  class FireworksEngine {
    constructor({ canvas, stage, onBurst }) {
      this.canvas = canvas;
      this.stage = stage;
      this.context = canvas.getContext('2d', { alpha: true });
      this.onBurst = typeof onBurst === 'function' ? onBurst : null;
      this.intensity = 'annoying';
      this.profile = PROFILES.annoying;
      this.paused = false;
      this.destroyed = false;
      this.inView = true;
      this.particles = [];
      this.rockets = [];
      this.queue = [];
      this.halos = [];
      this.labels = [];
      this.heat = 0;
      this.quality = 1;
      this.slowFrames = 0;
      this.goodFrames = 0;
      this.lastTime = 0;
      this.raf = 0;
      this.width = 1;
      this.height = 1;
      this.dpr = 1;
      this.bursts = 0;
      this.sequence = 0;
      this.combo = 0;
      this.lastComboAt = -Infinity;
      this.comboTimer = 0;
      this.comboColor = -1;
      this.turboUntil = 0;
      this.lastSpecialAt = new Map();
      this.specials = 0;
      this.spriteCache = new Map();
      this.sound = new FireworksSound();
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.reducedMotion = this.motionQuery.matches;
      this.tick = this.tick.bind(this);
      this.resize = this.resize.bind(this);
      this.handleVisibility = () => {
        const suspended = document.hidden || !this.inView || this.paused;
        this.sound.setSuspended(suspended);
        if (suspended) this.clear();
      };
      this.handleMotion = (event) => { this.reducedMotion = event.matches; };
      if (this.motionQuery.addEventListener) {
        this.motionQuery.addEventListener('change', this.handleMotion);
      }
      document.addEventListener('visibilitychange', this.handleVisibility);
      window.addEventListener('resize', this.resize, { passive: true });
      if ('ResizeObserver' in window) {
        this.resizeObserver = new ResizeObserver(this.resize);
        this.resizeObserver.observe(stage);
      }
      if ('IntersectionObserver' in window) {
        this.intersectionObserver = new IntersectionObserver((entries) => {
          this.inView = entries.some((entry) => entry.isIntersecting && entry.intersectionRatio > 0);
          this.handleVisibility();
        });
        this.intersectionObserver.observe(stage);
      }
      this.resize();
      this.handleVisibility();
    }

    resize() {
      if (this.destroyed) return;
      const rect = this.stage.getBoundingClientRect();
      this.width = Math.max(1, rect.width);
      this.height = Math.max(1, rect.height);
      const pixelLimit = Math.sqrt(2500000 / (this.width * this.height));
      this.dpr = clamp(Math.min(window.devicePixelRatio || 1, this.quality < 0.65 ? 1.25 : 1.8, pixelLimit), 0.75, 2);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      if (this.context) this.context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (this.hasWork()) this.ensureFrame();
    }

    setIntensity(intensity) {
      if (!Object.prototype.hasOwnProperty.call(PROFILES, intensity)) return;
      this.intensity = intensity;
      this.profile = PROFILES[intensity];
      if (this.particles.length > this.profile.maximum) {
        this.particles.splice(0, this.particles.length - this.profile.maximum);
      }
    }

    setPaused(paused) {
      this.paused = Boolean(paused);
      this.handleVisibility();
    }

    setSound(enabled) { this.sound.setEnabled(enabled); }
    setVolume(volume) { this.sound.setVolume(volume); }
    unlockAudio() { return this.sound.unlock(); }

    canRun() {
      return !this.destroyed && !this.paused && !document.hidden && this.inView && Boolean(this.context);
    }

    hasWork() {
      return this.particles.length || this.rockets.length || this.queue.length || this.halos.length || this.labels.length;
    }

    ensureFrame() {
      if (!this.raf && this.canRun()) this.raf = requestAnimationFrame(this.tick);
    }

    addLabel(label) {
      const type = label.type || 'burst';
      label.type = type;
      if (type !== 'burst') {
        this.labels = this.labels.filter((entry) => entry.type !== type);
      } else {
        const bursts = this.labels.filter((entry) => entry.type === 'burst');
        if (bursts.length >= 2) this.labels.splice(this.labels.indexOf(bursts[0]), 1);
      }
      this.labels.push(label);
      while (this.labels.length > 4) {
        const burst = this.labels.findIndex((entry) => entry.type === 'burst');
        this.labels.splice(burst >= 0 ? burst : 0, 1);
      }
    }

    resetCombo(cancelTurbo = false) {
      window.clearTimeout(this.comboTimer);
      this.comboTimer = 0;
      this.combo = 0;
      this.lastComboAt = -Infinity;
      if (cancelTurbo) this.turboUntil = 0;
    }

    recordCombo(now) {
      if (now - this.lastComboAt > COMBO_WINDOW) this.resetCombo();
      this.combo += 1;
      this.lastComboAt = now;
      window.clearTimeout(this.comboTimer);
      this.comboTimer = window.setTimeout(() => this.resetCombo(), COMBO_WINDOW * 1000);
      if (this.combo >= 10) {
        this.comboColor = (this.comboColor + 1 + Math.floor(random(0, 3))) % COMBO_COLORS.length;
        this.addLabel({
          type: 'combo', text: this.combo + 'コンボ！', color: COMBO_COLORS[this.comboColor],
          x: this.width * random(0.37, 0.63), y: this.height * random(0.46, 0.68),
          born: now, life: 0.78, tilt: this.reducedMotion ? 0 : random(-0.11, 0.09)
        });
      }
      if (this.combo >= 30 && this.combo % 30 === 0) {
        this.turboUntil = now + 8;
        this.addLabel({
          type: 'turbo', text: 'ターボ！', color: '#ff963f',
          x: this.width * 0.5, y: this.height * 0.31,
          born: now, life: 1.1, tilt: this.reducedMotion ? 0 : -0.05
        });
      }
    }

    input({ x, y, count = 1, kind = 'type' } = {}) {
      if (!this.canRun()) return;
      const confirmed = kind === 'type' || kind === 'newline' || kind === 'paste';
      if ((!confirmed && kind !== 'delete') || (confirmed && !(Number(count) > 0))) return;
      const now = performance.now() / 1000;
      if (confirmed) this.recordCombo(now);
      const turbo = now < this.turboUntil;
      const safeX = clamp(Number.isFinite(x) ? x : this.width * 0.35, 18, Math.max(18, this.width - 18));
      const safeY = clamp(Number.isFinite(y) ? y : this.height * 0.38, 20, Math.max(20, this.height - 20));
      const palette = PALETTES[this.sequence % PALETTES.length];
      this.sequence += 1;
      this.heat = clamp(this.heat + (kind === 'newline' ? 0.32 : 0.12), 0, 1);
      this.spark(safeX, safeY, palette, now, kind === 'delete');
      if (kind === 'delete') {
        this.ensureFrame();
        return;
      }
      const large = kind === 'newline';
      this.sound.tick(large);
      let total = large ? this.profile.finale : kind === 'paste' ? Math.min(4, this.profile.shells + 1) :
        1 + (this.heat > 0.42 && this.profile.shells > 1 ? 1 : 0) +
        (this.heat > 0.82 && this.profile.shells > 2 ? 1 : 0);
      if (turbo) total += large ? 2 : 1;
      total = Math.min(total, large ? 10 : 5);
      if (this.reducedMotion && !large) total = Math.min(total, turbo ? 3 : 2);
      const graphemes = clamp(Number(count) || 1, 1, 24);
      const emphasis = (kind === 'paste' ? 1.1 : Math.min(1.18, 1 + Math.log2(graphemes) * 0.035))
        * (turbo ? 1.15 : 1);
      const limit = large ? 28 : 22;
      if (this.queue.length + total > limit) {
        this.queue.splice(0, Math.min(this.queue.length, this.queue.length + total - limit));
      }
      for (let i = 0; i < total; i += 1) {
        const marginX = Math.min(95, this.width * 0.18);
        const marginY = Math.min(90, this.height * 0.24);
        let targetX;
        let targetY;
        if (large) {
          const fraction = (i + 0.55) / total;
          targetX = this.width * (0.12 + fraction * 0.76) + random(-35, 35);
          targetY = this.height * (i % 2 === 0 ? random(0.27, 0.43) : random(0.45, 0.65));
        } else {
          targetX = safeX + random(-this.width * 0.19, this.width * 0.25);
          targetY = safeY + random(-this.height * 0.27, this.height * 0.08);
          if (i > 0) targetX += this.width * (i % 2 ? 0.16 : -0.16);
        }
        targetX = clamp(targetX, marginX, Math.max(marginX, this.width - marginX));
        targetY = clamp(targetY, marginY, Math.max(marginY, this.height - marginY));
        this.queue.push({
          at: now + i * (large ? (turbo ? 0.055 : 0.105) : (turbo ? 0.035 : 0.075)),
          x: safeX + random(-8, 8),
          y: safeY + 14,
          targetX,
          targetY,
          palette: PALETTES[(this.sequence + i + (large ? 2 : 0)) % PALETTES.length],
          kind,
          large,
          turbo,
          first: i === 0,
          style: (this.sequence + i) % 5,
          emphasis
        });
      }
      this.ensureFrame();
    }

    specialKey({ key, x, y } = {}) {
      if (!this.canRun() || !SPECIAL_KEYS.has(key)) return false;
      const now = performance.now() / 1000;
      const previous = this.lastSpecialAt.get(key);
      if (previous !== undefined && now - previous < 0.1) return false;
      this.lastSpecialAt.set(key, now);
      this.specials += 1;
      const centerX = clamp(Number.isFinite(x) ? x : this.width * 0.5, 24, Math.max(24, this.width - 24));
      const centerY = clamp(Number.isFinite(y) ? y : this.height * 0.45, 28, Math.max(28, this.height - 28));
      const total = Math.round((this.reducedMotion ? 48 : 92) * this.quality);
      this.reserveParticles(total);
      for (let i = 0; i < total; i += 1) {
        let particle;
        const fraction = i / total;
        if (key === 'Insert') {
          const angle = TAU * fraction;
          const speed = i % 2 ? 340 : 185;
          particle = this.particle(centerX, centerY, Math.cos(angle) * speed, Math.sin(angle) * speed,
            i % 2 ? '#c861ff' : '#45e7ff', now, random(0.65, 1.15), 2.5, 0, 1.2, 'star');
        } else if (key === 'Home' || key === 'End') {
          const direction = key === 'Home' ? -1 : 1;
          const startX = this.width * (direction < 0 ? random(0.48, 0.95) : random(0.05, 0.52));
          particle = this.particle(startX, clamp(centerY + random(-42, 42), 12, this.height - 12),
            direction * random(450, 850), random(-25, 25), direction < 0 ? '#45e7ff' : '#ff963f',
            now, random(0.5, 1), random(1.3, 2.8), 0, 0.55, 'willow');
        } else if (key === 'PageUp') {
          particle = this.particle(this.width * random(0.08, 0.92), this.height * random(0.75, 0.98),
            random(-55, 55), -random(390, 740), i % 2 ? '#72ffd6' : '#d9fff4',
            now, random(0.85, 1.35), random(1.4, 2.8), 45, 0.45, 'willow');
        } else if (key === 'PageDown') {
          particle = this.particle(this.width * random(-0.05, 0.9), this.height * random(0.01, 0.25),
            random(95, 210), random(290, 520), i % 2 ? '#ff4fae' : '#ffe17a',
            now, random(0.85, 1.3), random(1.5, 2.8), 145, 0.15, 'willow');
        } else {
          const angle = TAU * fraction;
          const radius = random(45, Math.min(145, Math.max(50, this.height * 0.34)));
          particle = this.particle(centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius,
            0, 0, i % 2 ? '#ff4fae' : '#c861ff', now, random(0.55, 0.9), 2, 0, 0, 'vortex');
          particle.targetX = centerX;
          particle.targetY = centerY;
          particle.orbitAngle = angle;
          particle.orbitRadius = radius;
        }
        this.pushParticle(particle);
      }
      if (key === 'Insert') {
        this.halos.push({ x: centerX, y: centerY, born: now, life: 0.55, radius: 145, color: '#c861ff', type: 'burst' });
      }
      if (this.halos.length > 16) this.halos.splice(0, this.halos.length - 16);
      if (key === 'Delete') this.sound.boom(false);
      else this.sound.tick(key === 'Insert');
      this.ensureFrame();
      return true;
    }

    reserveParticles(total) {
      const maximum = Math.round(this.profile.maximum * Math.max(0.65, this.quality));
      if (this.particles.length + total > maximum) {
        this.particles.splice(0, Math.min(this.particles.length, this.particles.length + total - maximum));
      }
    }

    pushParticle(particle) {
      const maximum = Math.round(this.profile.maximum * Math.max(0.65, this.quality));
      if (this.particles.length >= maximum) return;
      this.particles.push(particle);
    }

    particle(x, y, vx, vy, color, now, life, size, gravity, drag, style) {
      return {
        x, y, px: x, py: y, ox: x, oy: y, vx, vy, color,
        born: now, life, size, gravity, drag, style,
        flicker: random(0, TAU), split: false
      };
    }

    spark(x, y, palette, now, inward) {
      const total = this.reducedMotion ? 9 : 17;
      this.reserveParticles(total);
      for (let i = 0; i < total; i += 1) {
        const angle = random(0, TAU);
        const speed = random(35, 185);
        const distance = inward ? random(12, 34) : 0;
        const direction = inward ? -1 : 1;
        this.pushParticle(this.particle(
          x + Math.cos(angle) * distance, y + Math.sin(angle) * distance,
          Math.cos(angle) * speed * direction, Math.sin(angle) * speed * direction,
          palette[i % 3], now, inward ? 0.22 : random(0.18, 0.38),
          random(1, 2.4), inward ? 0 : 85, 4, 'spark'
        ));
      }
      if (!inward) this.halos.push({ x, y, born: now, life: 0.18, radius: 28, color: palette[1], type: 'touch' });
      if (this.halos.length > 16) this.halos.splice(0, this.halos.length - 16);
    }

    launch(shell, now) {
      const duration = shell.turbo ? (shell.large ? 0.055 : random(0.045, 0.08)) :
        (shell.large ? 0.09 : random(0.08, 0.16));
      this.rockets.push({ ...shell, born: now, duration, px: shell.x, py: shell.y });
      if (this.rockets.length > 14) this.rockets.shift();
    }

    burst(shell, now) {
      this.bursts += 1;
      const minimum = Math.min(this.width, this.height);
      const baseRadius = Math.min(340, Math.max(90, minimum * this.profile.radius));
      const radius = baseRadius * (shell.large ? random(1.12, 1.42) : random(0.83, 1.12)) * shell.emphasis;
      const population = Math.round(this.profile.particles * this.quality * (shell.large ? 1.3 : 1) * (shell.turbo ? 1.2 : 1));
      const spaceNeeded = population + Math.round(population * 0.35);
      this.reserveParticles(spaceNeeded);
      const golden = shell.style === 3;
      const palette = golden ? PALETTES[3] : shell.palette;
      const speed = radius * (shell.turbo ? 2.9 : 2.5);
      const life = shell.large ? random(1.5, 2.1) : random(1.25, 1.8);
      for (let i = 0; i < population; i += 1) {
        let angle = TAU * i / population + random(-0.024, 0.024);
        let distance = random(0.7, 1);
        if (shell.style === 0) distance = Math.sqrt(Math.random());
        if (shell.style === 1) distance = i % 3 === 0 ? random(0.42, 0.53) : random(0.93, 1);
        if (shell.style === 2) distance = i % 5 === 0 ? random(0.4, 0.65) : random(0.82, 1);
        if (golden) { angle = random(0, TAU); distance = random(0.56, 1); }
        if (shell.style === 4) {
          angle = Math.round(angle / (TAU / 12)) * (TAU / 12) + random(-0.018, 0.018);
          distance = random(0.32, 1);
        }
        const particle = this.particle(
          shell.targetX, shell.targetY,
          Math.cos(angle) * speed * distance,
          Math.sin(angle) * speed * distance * (golden ? 0.83 : 1),
          i % 9 === 0 ? palette[0] : palette[1 + i % 2],
          now, life * random(0.72, 1.12), random(1.1, shell.large ? 2.7 : 2.2),
          golden ? 105 : 64, golden ? 1.75 : 2.5,
          golden ? 'willow' : shell.style === 2 && i % 8 === 0 ? 'split' : 'star'
        );
        this.pushParticle(particle);
      }
      for (let i = 0; i < Math.round(population * 0.28); i += 1) {
        const angle = random(0, TAU);
        const velocity = speed * random(0.12, 0.48);
        this.pushParticle(this.particle(
          shell.targetX, shell.targetY, Math.cos(angle) * velocity, Math.sin(angle) * velocity,
          palette[0], now, random(0.38, 0.9), random(0.75, 1.8), 45, 3.3, 'spark'
        ));
      }
      this.halos.push({
        x: shell.targetX, y: shell.targetY, born: now,
        life: shell.large ? 0.55 : 0.43, radius: radius * 1.25,
        color: palette[1], type: 'burst'
      });
      if (this.halos.length > 16) this.halos.shift();
      if (shell.large && shell.first && !this.reducedMotion) {
        this.addLabel({
          type: 'burst',
          x: this.width * random(0.38, 0.62), y: this.height * random(0.38, 0.57),
          born: now, life: 0.9, color: palette[1], tilt: random(-0.12, 0.07),
          text: ['たまや！', 'ドーン！', 'いい改行。'][Math.floor(random(0, 3))]
        });
      }
      this.sound.boom(shell.large);
      if (this.onBurst) {
        try { this.onBurst({ kind: shell.kind, x: shell.targetX, y: shell.targetY, radius }); } catch (_) { /* UI callbacks are isolated. */ }
      }
    }

    sprite(color) {
      if (this.spriteCache.has(color)) return this.spriteCache.get(color);
      const sprite = document.createElement('canvas');
      sprite.width = 32;
      sprite.height = 32;
      const context = sprite.getContext('2d');
      const gradient = context.createRadialGradient(16, 16, 0, 16, 16, 16);
      gradient.addColorStop(0, '#ffffff');
      gradient.addColorStop(0.12, color);
      gradient.addColorStop(0.35, color + '99');
      gradient.addColorStop(1, color + '00');
      context.fillStyle = gradient;
      context.fillRect(0, 0, 32, 32);
      this.spriteCache.set(color, sprite);
      return sprite;
    }

    clearCanvas() {
      if (!this.context) return;
      const context = this.context;
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.globalCompositeOperation = 'source-over';
      context.globalAlpha = 1;
      context.shadowBlur = 0;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
      context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      context.beginPath();
      context.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    tick(timestamp) {
      this.raf = 0;
      if (!this.canRun()) { this.clear(); return; }
      const now = timestamp / 1000;
      const elapsed = this.lastTime ? now - this.lastTime : 1 / 60;
      const dt = clamp(elapsed, 0.001, 0.042);
      this.lastTime = now;
      if (elapsed > 0.034 && elapsed < 0.2) {
        this.slowFrames += 1;
        this.goodFrames = 0;
        if (this.slowFrames >= 10 && this.quality > 0.48) {
          this.quality = Math.max(0.48, this.quality - 0.12);
          this.slowFrames = 0;
          if (this.quality < 0.65) this.resize();
        }
      } else if (elapsed < 0.022) {
        this.goodFrames += 1;
        this.slowFrames = Math.max(0, this.slowFrames - 1);
        if (this.goodFrames > 240) {
          this.quality = Math.min(1, this.quality + 0.06);
          this.goodFrames = 0;
        }
      }
      this.heat = Math.max(0, this.heat - dt * 0.3);
      for (let i = this.queue.length - 1; i >= 0; i -= 1) {
        if (this.queue[i].at <= now) {
          const shell = this.queue.splice(i, 1)[0];
          if (now - shell.at < 1.2) this.launch(shell, now);
        }
      }
      const context = this.context;
      this.clearCanvas();
      context.globalCompositeOperation = 'lighter';

      for (let i = this.rockets.length - 1; i >= 0; i -= 1) {
        const rocket = this.rockets[i];
        const progress = clamp((now - rocket.born) / rocket.duration, 0, 1);
        const ease = 1 - Math.pow(1 - progress, 1.6);
        const x = rocket.x + (rocket.targetX - rocket.x) * ease;
        const y = rocket.y + (rocket.targetY - rocket.y) * ease - Math.sin(progress * Math.PI) * 18;
        context.globalAlpha = 0.85;
        context.strokeStyle = rocket.palette[1];
        context.lineWidth = rocket.large ? 2.4 : 1.6;
        context.beginPath();
        context.moveTo(rocket.px, rocket.py);
        context.lineTo(x, y);
        context.stroke();
        context.drawImage(this.sprite(rocket.palette[0]), x - 8, y - 8, 16, 16);
        rocket.px = x;
        rocket.py = y;
        if (progress >= 1) {
          this.rockets.splice(i, 1);
          this.burst(rocket, now);
        }
      }

      for (let i = this.halos.length - 1; i >= 0; i -= 1) {
        const halo = this.halos[i];
        const progress = Math.max(0, (now - halo.born) / halo.life);
        if (progress >= 1) { this.halos.splice(i, 1); continue; }
        const radius = halo.radius * (halo.type === 'touch' ? 0.3 + progress : 0.22 + progress * 0.8);
        context.globalAlpha = (1 - progress) * (halo.type === 'touch' ? 0.55 : 0.22);
        const gradient = context.createRadialGradient(halo.x, halo.y, 0, halo.x, halo.y, radius);
        gradient.addColorStop(0, halo.color);
        gradient.addColorStop(0.22, halo.color + 'aa');
        gradient.addColorStop(1, halo.color + '00');
        context.fillStyle = gradient;
        context.beginPath();
        context.arc(halo.x, halo.y, radius, 0, TAU);
        context.fill();
        context.globalAlpha = Math.pow(1 - progress, 2) * 0.65;
        context.lineWidth = halo.type === 'touch' ? 1.5 : 2;
        context.strokeStyle = halo.color;
        context.beginPath();
        context.arc(halo.x, halo.y, radius * 0.74, 0, TAU);
        context.stroke();
      }

      const currentCount = this.particles.length;
      const offspring = [];
      for (let i = currentCount - 1; i >= 0; i -= 1) {
        const particle = this.particles[i];
        const age = Math.max(0, now - particle.born);
        if (age >= particle.life || particle.y > this.height + 65 || particle.x < -100 || particle.x > this.width + 100) {
          const last = this.particles.pop();
          if (i < this.particles.length) this.particles[i] = last;
          continue;
        }
        particle.ox = particle.px;
        particle.oy = particle.py;
        particle.px = particle.x;
        particle.py = particle.y;
        const progress = age / particle.life;
        if (particle.style === 'vortex') {
          const radius = particle.orbitRadius * Math.pow(1 - progress, 1.7);
          const angle = particle.orbitAngle + progress * 4;
          particle.x = particle.targetX + Math.cos(angle) * radius;
          particle.y = particle.targetY + Math.sin(angle) * radius;
        } else {
          const drag = Math.exp(-particle.drag * dt);
          particle.vx *= drag;
          particle.vy = particle.vy * drag + particle.gravity * dt;
          particle.x += particle.vx * dt;
          particle.y += particle.vy * dt;
        }
        const alpha = Math.pow(1 - progress, particle.style === 'willow' ? 0.65 : 0.9);
        const glimmer = progress > 0.48 ? 0.65 + Math.sin(age * 32 + particle.flicker) * 0.35 : 1;
        context.globalAlpha = alpha * glimmer;
        context.strokeStyle = particle.color;
        context.lineWidth = particle.size * (1 - progress * 0.5);
        context.beginPath();
        const trail = particle.style === 'willow' ? 3.5 : 1.8;
        context.moveTo(particle.x - (particle.x - particle.ox) * trail, particle.y - (particle.y - particle.oy) * trail);
        context.lineTo(particle.x, particle.y);
        context.stroke();
        const glowSize = particle.size * (this.quality < 0.65 ? 4 : 6);
        if (this.quality > 0.58 || i % 2 === 0) {
          context.drawImage(this.sprite(particle.color), particle.x - glowSize / 2, particle.y - glowSize / 2, glowSize, glowSize);
        }
        if (particle.style === 'split' && !particle.split && progress > 0.32) {
          particle.split = true;
          for (let j = 0; j < 5; j += 1) {
            const angle = TAU * j / 5 + particle.flicker;
            offspring.push(this.particle(
              particle.x, particle.y, particle.vx * 0.4 + Math.cos(angle) * 55,
              particle.vy * 0.4 + Math.sin(angle) * 55,
              particle.color, now, random(0.45, 0.75), 1, 65, 2.7, 'spark'
            ));
          }
        }
      }
      for (const particle of offspring) this.pushParticle(particle);

      context.globalCompositeOperation = 'source-over';
      for (let i = this.labels.length - 1; i >= 0; i -= 1) {
        if (now - this.labels[i].born >= this.labels[i].life) this.labels.splice(i, 1);
      }
      const orderedLabels = this.labels.slice().sort((left, right) =>
        (left.type === 'turbo' ? 2 : left.type === 'combo' ? 1 : 0) -
        (right.type === 'turbo' ? 2 : right.type === 'combo' ? 1 : 0));
      for (const label of orderedLabels) {
        const progress = Math.max(0, (now - label.born) / label.life);
        const isCombo = label.type === 'combo';
        const isTurbo = label.type === 'turbo';
        const appear = this.reducedMotion ? 1 : clamp(progress / (isTurbo ? 0.09 : 0.12), 0, 1);
        let size = Math.min(isTurbo ? 156 : isCombo ? 130 : 112,
          this.width * (isTurbo ? 0.23 : isCombo ? 0.18 : 0.14), this.height * 0.33);
        context.save();
        context.font = '900 ' + size + 'px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
        size *= Math.min(1, this.width * 0.88 / Math.max(1, context.measureText(label.text).width));
        const halfWidth = Math.min(this.width * 0.44, size * label.text.length * 0.5);
        const labelX = clamp(label.x, halfWidth + 8, Math.max(halfWidth + 8, this.width - halfWidth - 8));
        context.translate(labelX, label.y - (this.reducedMotion ? 0 : progress * 22));
        context.rotate(label.tilt);
        const scale = this.reducedMotion ? 1 : 0.88 + appear * 0.12;
        context.scale(scale, scale);
        context.globalAlpha = (0.5 + appear * 0.5) * Math.pow(1 - progress, isTurbo ? 0.35 : 0.65);
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.font = '900 ' + size + 'px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
        context.lineJoin = 'round';
        context.strokeStyle = '#0a0b17';
        context.lineWidth = Math.max(5, size * 0.095);
        context.strokeText(label.text, 0, 0);
        context.fillStyle = isCombo || isTurbo ? label.color : '#fff9df';
        context.shadowColor = label.color;
        context.shadowBlur = isTurbo ? 30 : isCombo ? 23 : 18;
        context.fillText(label.text, 0, 0);
        if (isTurbo) {
          context.shadowBlur = 0;
          context.strokeStyle = '#fff1b8';
          context.lineWidth = Math.max(1, size * 0.013);
          context.strokeText(label.text, 0, 0);
        }
        context.restore();
      }
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      if (this.hasWork()) this.ensureFrame();
      else {
        this.lastTime = 0;
        this.heat = 0;
        this.clearCanvas();
      }
    }

    clear() {
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.lastTime = 0;
      this.heat = 0;
      this.resetCombo(true);
      this.lastSpecialAt.clear();
      this.particles.length = 0;
      this.rockets.length = 0;
      this.queue.length = 0;
      this.halos.length = 0;
      this.labels.length = 0;
      this.sound.stop();
      this.clearCanvas();
    }

    getStats() {
      const now = performance.now() / 1000;
      if (now - this.lastComboAt > COMBO_WINDOW) this.resetCombo();
      return {
        particles: this.particles.length,
        queued: this.queue.length,
        rockets: this.rockets.length,
        voices: this.sound.voices.size,
        quality: this.quality,
        bursts: this.bursts,
        combo: this.combo,
        turbo: now < this.turboUntil,
        turboSeconds: Math.max(0, this.turboUntil - now),
        specials: this.specials,
        paused: this.paused,
        running: Boolean(this.raf)
      };
    }

    destroy() {
      this.clear();
      this.destroyed = true;
      this.sound.destroy();
      document.removeEventListener('visibilitychange', this.handleVisibility);
      window.removeEventListener('resize', this.resize);
      if (this.motionQuery.removeEventListener) {
        this.motionQuery.removeEventListener('change', this.handleMotion);
      }
      if (this.resizeObserver) this.resizeObserver.disconnect();
      if (this.intersectionObserver) this.intersectionObserver.disconnect();
      this.spriteCache.clear();
    }
  }

  window.FireworksEngine = FireworksEngine;
})();
