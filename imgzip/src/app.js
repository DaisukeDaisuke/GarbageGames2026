(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const ui = {
    app: $("app"), surface: $("app-surface"), stage: $("stage"), image: $("press-image"),
    slider: $("height-slider"), value: $("height-value"), reduction: $("reduction-value"),
    press: $("press-button"), pressLabel: $("press-button-label"), reset: $("reset-button"),
    choose: $("choose-file"), sample: $("sample-button"), input: $("file-input"),
    sourceName: $("source-name"), sourceDetail: $("source-detail"),
    state: $("live-state"), caption: $("stage-caption"), ratio: $("stage-ratio"),
    target: $("target-label"), pressure: $("pressure-value"), pressureFill: $("pressure-fill"),
    word: $("impact-word"), effects: $("effects"), hashBlock: $("hash-block"),
    hashKicker: $("hash-kicker"), stageHash: $("stage-hash"), result: $("result-panel"),
    badge: $("result-badge"), main: $("result-main"), detail: $("result-detail"),
    save: $("save-button"), saveLabel: $("save-label"), hashDetails: $("hash-details"),
    method: $("hash-method"), budget: $("hash-budget"), copy: $("copy-button"),
    notice: $("notice"), announcement: $("announcement"), drop: $("drop-overlay"),
    sound: $("sound-toggle"), soundLabel: $("sound-label"), motion: $("motion-toggle"),
    dialog: $("spec-dialog"), spec: $("spec-text"),
  };
  const presets = [...document.querySelectorAll("[data-height]")];
  const names = { crc32: "CRC32", md5: "MD5", xxhash64: "xxHash64", xxhash128: "xxHash128" };
  const exact = (n) => n.toLocaleString("ja-JP");
  const engine = PhysicalEngine.create({ workerSource: JSON.parse($("hash-worker-source").textContent) });
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  let reduced = media.matches;
  let soundEnabled = true;
  let source = null;
  let state = "loading";
  let output = null;
  let revision = 0;
  let animation = 0;
  let impactTimer = 0;
  let copyTimer = 0;
  let currentHeight = 100;
  let plateGap = 18;
  let dragDepth = 0;

  class PressAudio {
    constructor() { this.context = null; this.master = null; this.motor = null; this.motorGain = null; }
    unlock() {
      if (!soundEnabled) return;
      try {
        if (!this.context) {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (!AudioContext) return;
          this.context = new AudioContext();
          this.master = this.context.createGain();
          this.master.gain.value = 0.22;
          this.master.connect(this.context.destination);
        }
        if (this.context.state === "suspended") this.context.resume().catch(() => {});
      } catch (_) { this.context = null; }
    }
    start() {
      this.stop();
      this.unlock();
      if (!soundEnabled || !this.context) return;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      const filter = this.context.createBiquadFilter();
      oscillator.type = "sawtooth";
      oscillator.frequency.value = 46;
      filter.type = "lowpass";
      filter.frequency.value = 250;
      gain.gain.setValueAtTime(0, this.context.currentTime);
      gain.gain.linearRampToValueAtTime(0.16, this.context.currentTime + 0.16);
      oscillator.connect(filter).connect(gain).connect(this.master);
      oscillator.onended = () => { oscillator.disconnect(); filter.disconnect(); gain.disconnect(); };
      oscillator.start();
      this.motor = oscillator;
      this.motorGain = gain;
    }
    pressure(r) {
      if (!this.motor || !this.context) return;
      this.motor.frequency.setTargetAtTime(46 + (100 - r) * 1.25, this.context.currentTime, 0.035);
      this.motorGain.gain.setTargetAtTime(0.13 + (100 - r) * 0.002, this.context.currentTime, 0.04);
    }
    tone(frequency, duration, type = "sine", volume = 0.35) {
      if (!soundEnabled || !this.context) return;
      const now = this.context.currentTime;
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.67, now + duration);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      oscillator.connect(gain).connect(this.master);
      oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(now);
      oscillator.stop(now + duration + 0.01);
    }
    creak() { this.tone(192, 0.36, "triangle", 0.32); this.tone(277, 0.22, "sawtooth", 0.11); }
    pop() {
      if (!soundEnabled || !this.context) return;
      const count = Math.ceil(this.context.sampleRate * 0.16);
      const buffer = this.context.createBuffer(1, count, this.context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < count; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / count, 3);
      const noise = this.context.createBufferSource();
      const gain = this.context.createGain();
      const filter = this.context.createBiquadFilter();
      gain.gain.value = 0.65;
      filter.type = "lowpass";
      filter.frequency.value = 1200;
      noise.buffer = buffer;
      noise.connect(filter).connect(gain).connect(this.master);
      noise.onended = () => { noise.disconnect(); filter.disconnect(); gain.disconnect(); };
      noise.start();
      this.tone(85, 0.17, "sine", 0.7);
    }
    metal() { this.tone(1150, 0.2, "sine", 0.45); this.tone(1687, 0.13, "sine", 0.15); }
    stop() {
      if (!this.motor || !this.context) return;
      const now = this.context.currentTime;
      try {
        this.motorGain.gain.cancelScheduledValues(now);
        this.motorGain.gain.setTargetAtTime(0.001, now, 0.025);
        this.motor.stop(now + 0.12);
      } catch (_) { /* An already stopped motor has no remaining sound. */ }
      this.motor = null;
      this.motorGain = null;
    }
    mute() { this.stop(); if (this.master) this.master.gain.value = soundEnabled ? 0.22 : 0; }
  }
  const audio = new PressAudio();

  function busy() { return state === "running" || state === "waiting" || state === "loading"; }
  function announce(message) { ui.announcement.textContent = message; }
  function notice(message) { ui.notice.textContent = message || ""; ui.notice.hidden = !message; }
  function setState(next) {
    state = next;
    ui.app.dataset.state = next;
    const locked = busy();
    ui.press.disabled = locked || !source;
    ui.choose.disabled = locked;
    ui.sample.disabled = locked;
    ui.input.disabled = locked;
    ui.slider.disabled = locked;
    presets.forEach((button) => { button.disabled = locked; });
    ui.method.disabled = locked;
    ui.reset.disabled = !source;
    ui.save.disabled = !output || (state !== "png" && state !== "hash");
    ui.copy.disabled = state !== "hash";
    ui.press.classList.toggle("processing", next === "running" || next === "waiting");
    ui.stage.classList.toggle("working", next === "running" || next === "waiting");
    if (next === "loading") ui.pressLabel.textContent = "読込中…";
    else if (next === "waiting") ui.pressLabel.textContent = "計算中…";
    else if (next !== "running") ui.pressLabel.textContent = "圧縮する";
  }
  function setHeight(r, gap = plateGap) {
    currentHeight = r;
    plateGap = gap;
    const imageHeight = parseFloat(ui.stage.style.getPropertyValue("--image-height")) || 180;
    const floor = parseFloat(getComputedStyle(ui.stage).getPropertyValue("--floor"));
    ui.stage.style.setProperty("--squish", String(r / 100));
    ui.stage.style.setProperty("--plate-bottom", `${floor + imageHeight * r / 100 + gap}px`);
    ui.ratio.textContent = `${Math.round(r)}%`;
    ui.pressure.innerHTML = `${String(Math.round(100 - r)).padStart(2, "0")}<span>%</span>`;
    ui.pressureFill.style.height = `${100 - r}%`;
  }
  function resize() {
    if (!source) return;
    const mobile = ui.stage.clientWidth < 580 && window.innerWidth <= 600;
    const floor = parseFloat(getComputedStyle(ui.stage).getPropertyValue("--floor"));
    const maxHeight = Math.max(20, ui.stage.clientHeight - floor - (mobile ? 105 : 136));
    const maxWidth = Math.max(20, ui.stage.clientWidth - (mobile ? 146 : 164));
    const scale = Math.min(maxWidth / source.width, maxHeight / source.height);
    ui.stage.style.setProperty("--image-width", `${source.width * scale}px`);
    ui.stage.style.setProperty("--image-height", `${source.height * scale}px`);
    ui.stage.style.setProperty("--target-height", `${source.height * scale * Number(ui.slider.value) / 100}px`);
    setHeight(currentHeight, plateGap);
  }
  function setTarget(r) {
    ui.slider.value = String(r);
    ui.slider.style.setProperty("--fill", `${100 - r}%`);
    ui.slider.setAttribute("aria-valuetext", `残り${r}パーセント`);
    ui.value.innerHTML = `${r}<span>%</span>`;
    ui.reduction.textContent = `−${100 - r}%`;
    ui.target.textContent = `${r}%`;
    const imageHeight = parseFloat(ui.stage.style.getPropertyValue("--image-height")) || 180;
    ui.stage.style.setProperty("--target-height", `${imageHeight * r / 100}px`);
    presets.forEach((button) => {
      const selected = Number(button.dataset.height) === r;
      button.classList.toggle("selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    ui.stage.classList.remove("has-result");
  }
  function stopVisuals() {
    cancelAnimationFrame(animation);
    animation = 0;
    clearTimeout(impactTimer);
    clearTimeout(copyTimer);
    ui.word.classList.remove("pop");
    ui.word.textContent = "";
    ui.effects.replaceChildren();
    ui.surface.style.removeProperty("--shake-x");
    ui.surface.style.removeProperty("--shake-y");
    document.querySelector(".moving-plate").style.removeProperty("transform");
    audio.stop();
    ui.drop.hidden = true;
    dragDepth = 0;
  }
  function clearResult() {
    output = null;
    ui.hashBlock.hidden = true;
    ui.stageHash.textContent = "";
    ui.hashDetails.hidden = true;
    ui.stage.classList.remove("hash-mode", "has-result");
    ui.result.classList.remove("complete", "hash-result");
    ui.copy.textContent = "コピー";
    ui.saveLabel.textContent = "PNGを保存";
    ui.badge.textContent = "プレス待ち";
    ui.main.textContent = source ? `${exact(source.width)} × ${exact(source.height)} px` : "準備中…";
    ui.detail.textContent = source ? `原画像 ${PhysicalEngine.formatBytes(source.bytes)}（${exact(source.bytes)} B）` : "画像を読み込んでいます";
  }
  function ready() {
    clearResult();
    setHeight(100, window.innerWidth <= 600 ? 14 : 18);
    ui.state.textContent = "READY";
    ui.caption.textContent = "画像を圧縮できます。";
    setState("ready");
    resize();
  }
  function reset() {
    revision += 1;
    stopVisuals();
    engine.invalidate();
    notice("");
    ready();
    announce("原画像に戻しました。");
  }
  async function loadFile(file) {
    if (!file) return;
    const ticket = ++revision;
    stopVisuals();
    engine.invalidate();
    clearResult();
    setState("loading");
    notice("");
    try {
      const loaded = await engine.loadFile(file);
      if (ticket !== revision) return;
      source = loaded;
      ui.image.src = source.objectUrl;
      ui.image.alt = `${source.name}のプレビュー`;
      ui.sourceName.textContent = source.name === "sample.png" ? "内蔵サンプル · つぶされ待ち" : source.name;
      ui.sourceName.title = source.name;
      ui.sourceDetail.textContent = `${exact(source.width)} × ${exact(source.height)} px · ${PhysicalEngine.formatBytes(source.bytes)}`;
      ready();
      announce(`画像を読み込みました。${source.width}×${source.height}ピクセル。`);
    } catch (error) {
      if (ticket !== revision || error.name === "AbortError") return;
      ready();
      notice(error.message || "画像を読み込めませんでした。もう一度画像を選んでください。");
    } finally { if (ticket === revision) ui.input.value = ""; }
  }
  function sampleFile() {
    const data = JSON.parse($("sample-source").textContent);
    const bytes = Uint8Array.from(atob(data.slice(data.indexOf(",") + 1)), (letter) => letter.charCodeAt(0));
    return new File([bytes], "sample.png", { type: "image/png" });
  }
  function impact(word) {
    clearTimeout(impactTimer);
    ui.word.classList.remove("pop");
    ui.word.textContent = word;
    void ui.word.offsetWidth;
    ui.word.classList.add("pop");
    impactTimer = setTimeout(() => ui.word.classList.remove("pop"), 670);
  }
  function particleOrigin() {
    const app = ui.app.getBoundingClientRect();
    const image = ui.image.getBoundingClientRect();
    return { x: image.left - app.left + image.width / 2, y: image.bottom - app.top - Math.max(2, image.height / 2), app };
  }
  function appendParticle(particle) {
    if (ui.effects.childElementCount >= 24) return;
    ui.effects.appendChild(particle);
    particle.addEventListener("animationend", (event) => { if (event.target === particle) particle.remove(); });
  }
  function ink() {
    const origin = particleOrigin();
    const targets = [...document.querySelectorAll(".ink-target"), ui.slider, ui.result].map((element) => element.getBoundingClientRect());
    const count = 12 + Math.floor(Math.random() * 5);
    const offset = Math.floor(Math.random() * targets.length);
    for (let i = 0; i < count; i++) {
      const target = targets[(i + offset) % targets.length];
      const x = target.left - origin.app.left + (0.1 + Math.random() * 0.8) * target.width;
      const y = target.top - origin.app.top + (0.12 + Math.random() * 0.76) * target.height;
      const drop = document.createElement("i");
      drop.className = "particle ink";
      drop.style.left = `${origin.x}px`;
      drop.style.top = `${origin.y}px`;
      drop.style.setProperty("--color", source.colors[i % source.colors.length]);
      drop.style.setProperty("--size", `${11 + Math.random() * 20}px`);
      drop.style.setProperty("--dx", `${x - origin.x}px`);
      drop.style.setProperty("--dy", `${y - origin.y}px`);
      drop.style.setProperty("--turn", `${Math.random() * 360}deg`);
      appendParticle(drop);
    }
  }
  function letters() {
    const origin = particleOrigin();
    const glyphs = "0a1b2c3d4e5f";
    for (let i = 0; i < 8; i++) {
      const fragment = document.createElement("i");
      fragment.className = "particle glyph-particle";
      const letter = document.createElement("span");
      letter.textContent = glyphs[Math.floor(Math.random() * glyphs.length)];
      fragment.appendChild(letter);
      fragment.style.left = `${origin.x + (Math.random() - 0.5) * 80}px`;
      fragment.style.top = `${origin.y}px`;
      fragment.style.setProperty("--color", source.colors[i % source.colors.length]);
      fragment.style.setProperty("--dx", `${(Math.random() - 0.5) * 160}px`);
      fragment.style.setProperty("--dy", `${25 + Math.random() * 35}px`);
      fragment.style.setProperty("--turn", `${(Math.random() - 0.5) * 80}deg`);
      appendParticle(fragment);
    }
  }
  function shake(r, decay = 1) {
    if (r > 50) return;
    const amplitude = (reduced ? 0.35 : 2 + (50 - r) / 49 * 4) * decay;
    ui.surface.style.setProperty("--shake-x", `${(Math.random() * 2 - 1) * amplitude}px`);
    ui.surface.style.setProperty("--shake-y", `${(Math.random() * 2 - 1) * amplitude}px`);
  }
  function finishPNG(result, r) {
    output = { kind: "png", ...result, r };
    setHeight(result.height / source.height * 100, 0);
    ui.result.classList.add("complete");
    ui.badge.textContent = `残り ${r}%`;
    ui.main.textContent = `${exact(result.width)} × ${exact(result.height)} px`;
    ui.detail.textContent = `PNG · ${PhysicalEngine.formatBytes(result.blob.size)}（${exact(result.blob.size)} B）`;
    ui.caption.textContent = r === 100 ? "原寸でプレス完了。" : "しっかり、ぺちゃんこ。";
    ui.state.textContent = "COMPRESSED";
    ui.stage.classList.add("has-result");
    setState("png");
    announce(`圧縮完了。${result.width}×${result.height}ピクセル、${result.blob.size}バイトのPNGを保存できます。`);
  }
  function finishHash(digest, algorithm, r, limits) {
    const blob = new Blob([digest], { type: "text/plain;charset=utf-8" });
    output = { kind: "hash", blob, digest, algorithm, r, limits };
    ui.stage.classList.add("hash-mode", "has-result");
    ui.hashBlock.hidden = false;
    ui.hashKicker.textContent = "これが、最終形態。";
    ui.stageHash.textContent = digest;
    ui.result.classList.add("complete", "hash-result");
    ui.badge.textContent = "圧縮の、その先";
    ui.main.textContent = digest;
    ui.detail.textContent = `${names[algorithm]} · ${digest.length}文字 = ${blob.size} B · 画像寸法なし`;
    ui.saveLabel.textContent = "ハッシュを保存";
    ui.hashDetails.hidden = false;
    for (const option of ui.method.options) option.disabled = !limits.allowed.includes(option.value);
    ui.method.value = algorithm;
    ui.budget.textContent = `入力 ${exact(source.bytes)} B / 上限 L=${exact(limits.limit)}文字${limits.minimum ? " / 最小8Bに到達" : ""}`;
    ui.caption.textContent = "画像だったものです。";
    ui.state.textContent = "LIMIT BREAK";
    setState("hash");
    announce(`${names[algorithm]}への変換完了。${digest.length}文字、${blob.size}バイト。`);
  }
  function failure(error) {
    stopVisuals();
    ready();
    ui.pressLabel.textContent = "再試行";
    notice(`${error.message || "計算に失敗しました。"} 「再試行」でやり直せます。`);
  }
  async function press() {
    if (busy() || !source) return;
    const ticket = ++revision;
    stopVisuals();
    engine.invalidate();
    notice("");
    clearResult();
    const target = Number(ui.slider.value);
    const limits = target <= 10 ? PhysicalEngine.limitsFor(source.bytes, target) : null;
    const algorithm = limits ? limits.automatic : null;
    setHeight(100, window.innerWidth <= 600 ? 14 : 18);
    setState("running");
    ui.pressLabel.textContent = "接触中…";
    ui.state.textContent = "PRESSING";
    ui.caption.textContent = "加圧中";
    audio.start();
    const calculation = (limits ? engine.hash(algorithm) : engine.makePNG(target)).then(
      (value) => ({ value }), (error) => ({ error })
    );
    const start = performance.now();
    const initialGap = plateGap;
    const crossed = new Set();
    let previous = 100;
    function crossThresholds(r) {
      for (const boundary of [50, 25, 10]) {
        if (previous > boundary && r <= boundary && !crossed.has(boundary)) {
          crossed.add(boundary);
          if (boundary === 50) {
            impact("ミシッ。");
            audio.creak();
            ui.pressLabel.textContent = "加圧中…";
          } else if (boundary === 25) {
            impact("ブシャッ！");
            ink();
            audio.pop();
          } else {
            letters();
            ui.stage.classList.add("hash-mode");
            ui.hashBlock.hidden = false;
            ui.hashKicker.textContent = "もはや、画像ではない。";
            ui.stageHash.textContent = "計算中…";
            impact("限界突破");
            audio.metal();
          }
        }
      }
      previous = r;
    }
    function frame(now) {
      if (ticket !== revision) return;
      const elapsed = now - start;
      if (elapsed < 250) {
        const t = elapsed / 250;
        setHeight(100, initialGap * Math.pow(1 - t, 3));
      } else {
        const t = Math.min(1, (elapsed - 250) / 1000);
        const smooth = t * t * (3 - 2 * t);
        const r = t === 1 ? target : 100 + (target - 100) * smooth;
        setHeight(r, 0);
        crossThresholds(r);
        audio.pressure(r);
        if (elapsed < 1250) {
          ui.pressLabel.textContent = "加圧中…";
          shake(r);
        } else {
          const settle = Math.min(1, (elapsed - 1250) / 350);
          shake(r, 1 - settle);
          const dip = (reduced ? 0.3 : 2) * Math.sin(settle * Math.PI) * (1 - settle);
          document.querySelector(".moving-plate").style.transform = `translateY(${dip}px)`;
        }
      }
      if (elapsed < 1600) animation = requestAnimationFrame(frame);
      else finalize();
    }
    async function finalize() {
      animation = 0;
      audio.stop();
      ui.surface.style.removeProperty("--shake-x");
      ui.surface.style.removeProperty("--shake-y");
      document.querySelector(".moving-plate").style.removeProperty("transform");
      setState("waiting");
      const result = await calculation;
      if (ticket !== revision) return;
      if (result.error) { if (result.error.name !== "AbortError") failure(result.error); return; }
      if (limits) finishHash(result.value, algorithm, target, limits);
      else { finishPNG(result.value, target); audio.metal(); }
    }
    animation = requestAnimationFrame(frame);
  }
  async function changeMethod() {
    if (state !== "hash" || !output) return;
    const prior = output;
    const algorithm = ui.method.value;
    if (!prior.limits.allowed.includes(algorithm) || prior.algorithm === algorithm) return;
    const ticket = ++revision;
    output = null;
    clearTimeout(copyTimer);
    ui.copy.textContent = "コピー";
    ui.main.textContent = "計算中…";
    ui.stageHash.textContent = "計算中…";
    ui.detail.textContent = `${names[algorithm]}を計算しています`;
    setState("waiting");
    notice("");
    try {
      const digest = await engine.hash(algorithm);
      if (ticket === revision) finishHash(digest, algorithm, prior.r, prior.limits);
    } catch (error) { if (ticket === revision && error.name !== "AbortError") failure(error); }
  }
  function save() {
    if (!output || (state !== "png" && state !== "hash")) return;
    const stem = source.name.replace(/\.[^.]*$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 96) || "image";
    const suffix = output.kind === "hash" ? `-${output.algorithm}.txt` : ".png";
    PhysicalEngine.saveBlob(output.blob, `${stem}-physical-r${output.r}${suffix}`);
    announce("保存ファイルを作成しました。");
  }
  async function copyHash() {
    if (state !== "hash" || !output) return;
    const digest = output.digest;
    const ticket = revision;
    try {
      if (navigator.clipboard && window.isSecureContext) {
        try { await navigator.clipboard.writeText(digest); }
        catch (_) { if (ticket !== revision) return; legacyCopy(digest); }
      } else legacyCopy(digest);
      if (ticket !== revision) return;
      ui.copy.textContent = "コピー済";
      announce("ハッシュをコピーしました。");
      copyTimer = setTimeout(() => { if (ticket === revision) ui.copy.textContent = "コピー"; }, 2200);
    } catch (_) { if (ticket === revision) notice("コピーできませんでした。結果の文字列を選択してコピーするか、ハッシュを保存してください。"); }
  }
  function legacyCopy(text) {
    const field = document.createElement("textarea");
    field.value = text;
    field.style.cssText = "position:fixed;left:0;top:0;width:1px;height:1px;opacity:0";
    field.setAttribute("readonly", "");
    document.body.appendChild(field);
    field.select();
    let copied = false;
    try { copied = document.execCommand("copy"); }
    finally { field.remove(); ui.copy.focus(); }
    if (!copied) throw new Error("copy");
  }
  function updateMotion() {
    ui.app.classList.toggle("reduced", reduced);
    ui.motion.setAttribute("aria-pressed", String(reduced));
    ui.motion.setAttribute("aria-label", reduced ? "通常の演出にする" : "演出を軽減");
    ui.motion.title = reduced ? "通常の演出にする" : "演出を軽減";
  }

  ui.slider.addEventListener("input", () => setTarget(Number(ui.slider.value)));
  presets.forEach((button) => button.addEventListener("click", () => setTarget(Number(button.dataset.height))));
  ui.press.addEventListener("click", press);
  ui.reset.addEventListener("click", reset);
  ui.choose.addEventListener("click", () => ui.input.click());
  ui.input.addEventListener("change", () => loadFile(ui.input.files[0]));
  ui.sample.addEventListener("click", () => { setTarget(20); loadFile(sampleFile()); });
  ui.save.addEventListener("click", save);
  ui.method.addEventListener("change", changeMethod);
  ui.copy.addEventListener("click", copyHash);
  ui.motion.addEventListener("click", () => { reduced = !reduced; updateMotion(); });
  media.addEventListener("change", (event) => { reduced = event.matches; updateMotion(); });
  ui.sound.addEventListener("click", () => {
    soundEnabled = !soundEnabled;
    ui.sound.setAttribute("aria-pressed", String(soundEnabled));
    ui.sound.setAttribute("aria-label", soundEnabled ? "効果音をオフにする" : "効果音をオンにする");
    ui.soundLabel.textContent = soundEnabled ? "音 ON" : "音 OFF";
    audio.mute();
    if (soundEnabled) {
      audio.unlock();
      if (state === "running") audio.start();
    }
  });
  for (const type of ["dragenter", "dragover", "dragleave", "drop"]) {
    document.addEventListener(type, (event) => {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types).includes("Files")) return;
      event.preventDefault();
      if (type === "dragover") event.dataTransfer.dropEffect = busy() ? "none" : "copy";
      if (type === "dragenter") { dragDepth += 1; if (!busy()) ui.drop.hidden = false; }
      if (type === "dragleave") { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) ui.drop.hidden = true; }
      if (type === "drop") {
        dragDepth = 0;
        ui.drop.hidden = true;
        if (busy()) return;
        if (event.dataTransfer.files.length !== 1) { notice("一度に投入できる画像は1枚です。"); return; }
        loadFile(event.dataTransfer.files[0]);
      }
    });
  }
  $("spec-button").addEventListener("click", () => {
    if (!ui.spec.textContent) ui.spec.textContent = JSON.parse($("spec-source").textContent);
    ui.dialog.showModal();
  });
  $("spec-close").addEventListener("click", () => ui.dialog.close());
  ui.dialog.addEventListener("click", (event) => {
    if (event.target !== ui.dialog) return;
    const bounds = ui.dialog.getBoundingClientRect();
    if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) ui.dialog.close();
  });
  new ResizeObserver(resize).observe(ui.stage);
  window.addEventListener("pagehide", () => { revision += 1; stopVisuals(); engine.invalidate(); });
  window.addEventListener("pageshow", (event) => { if (event.persisted) reset(); });
  setTarget(20);
  updateMotion();
  loadFile(sampleFile());
})();
