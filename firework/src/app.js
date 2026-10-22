(() => {
  'use strict';

  const byId = (id) => document.getElementById(id);
  const memo = byId('memo');
  const stage = byId('stage');
  if (!memo || !stage) return;

  const root = document.documentElement;
  const viewport = window.visualViewport;
  let viewportFrame = 0;
  function updateViewportHeight() {
    viewportFrame = 0;
    const useVisualHeight = viewport && Number.isFinite(viewport.height) && viewport.height > 0
      && Number.isFinite(viewport.scale) && Math.abs(viewport.scale - 1) < 0.05;
    const height = Math.max(1, Math.round(useVisualHeight ? viewport.height : window.innerHeight));
    root.style.setProperty('--app-height', `${height}px`);
    root.dataset.compact = String(height <= 480);
  }
  function scheduleViewportHeight() {
    if (!viewportFrame) viewportFrame = window.requestAnimationFrame(updateViewportHeight);
  }
  window.addEventListener('resize', scheduleViewportHeight, { passive: true });
  window.addEventListener('orientationchange', scheduleViewportHeight, { passive: true });
  if (viewport) viewport.addEventListener('resize', scheduleViewportHeight, { passive: true });
  updateViewportHeight();

  const keys = {
    text: 'garbage2026.fire.memo.v1',
    preferences: 'garbage2026.fire.preferences.v1',
  };
  const defaults = { intensity: 'annoying', sound: true, volume: 0.35, paused: false };
  const allowedIntensities = ['lively', 'annoying', 'festival'];
  const settings = { ...defaults };
  const saveStatus = byId('save-status');
  const characterCount = byId('character-count');
  const editorStatus = byId('editor-status');
  const soundToggle = byId('sound-toggle');
  const soundLabel = byId('sound-label');
  const volumeControl = byId('volume');
  const pauseToggle = byId('pause-toggle');
  const pauseLabel = byId('pause-label');
  const exportButton = byId('export-button');
  const specButton = byId('spec-button');
  const specDialog = byId('spec-dialog');
  const specClose = byId('spec-close');
  let storageAvailable = true;
  let lastSavedText = null;
  let effectError = false;

  function updateSaveStatus(success) {
    storageAvailable = success;
    if (!saveStatus) return;
    const text = success ? '自動保存済み' : '自動保存できません';
    if (saveStatus.textContent !== text) saveStatus.textContent = text;
    saveStatus.dataset.state = success ? 'saved' : 'error';
  }

  try {
    const stored = localStorage.getItem(keys.text);
    if (stored !== null) {
      memo.value = stored;
      lastSavedText = stored;
    }
    const storedPreferences = localStorage.getItem(keys.preferences);
    if (storedPreferences !== null) {
      let parsed = null;
      try { parsed = JSON.parse(storedPreferences); } catch (_) { /* Keep safe defaults. */ }
      if (parsed && typeof parsed === 'object') {
        if (allowedIntensities.includes(parsed.intensity)) settings.intensity = parsed.intensity;
        if (typeof parsed.sound === 'boolean') settings.sound = parsed.sound;
        if (typeof parsed.paused === 'boolean') settings.paused = parsed.paused;
        if (Number.isFinite(parsed.volume)) settings.volume = Math.max(0, Math.min(1, parsed.volume));
      }
    }
  } catch (_) {
    updateSaveStatus(false);
  }

  let engine = null;
  try {
    engine = new window.FireworksEngine({ canvas: byId('fireworks'), stage });
  } catch (error) {
    effectError = true;
    console.error('Fireworks could not be initialized; the memo remains available.', error);
  }

  function callEngine(method, ...args) {
    if (!engine || typeof engine[method] !== 'function') return undefined;
    try {
      const result = engine[method](...args);
      if (result && typeof result.catch === 'function') result.catch(() => {});
      return result;
    } catch (error) {
      if (method !== 'unlockAudio' && !effectError) {
        effectError = true;
        console.error('A firework effect failed; the memo remains available.', error);
        updateEditorStatus();
      }
      return undefined;
    }
  }

  function persistText(text) {
    if (storageAvailable && text === lastSavedText) return;
    try {
      localStorage.setItem(keys.text, text);
      lastSavedText = text;
      updateSaveStatus(true);
    } catch (_) {
      updateSaveStatus(false);
    }
  }

  function persistPreferences() {
    try {
      localStorage.setItem(keys.preferences, JSON.stringify(settings));
    } catch (_) {
      updateSaveStatus(false);
    }
  }

  function updateEditorStatus() {
    if (!editorStatus) return;
    editorStatus.textContent = effectError
      ? '花火を表示できません · メモは使えます'
      : settings.paused ? '花火はおやすみ中' : '打ち上げ待機中';
  }

  function applySettings() {
    document.documentElement.dataset.intensity = settings.intensity;
    stage.dataset.paused = String(settings.paused);
    stage.dataset.sound = String(settings.sound);
    for (const button of document.querySelectorAll('#intensity-controls [data-intensity]')) {
      const selected = button.dataset.intensity === settings.intensity;
      button.setAttribute('aria-pressed', String(selected));
      button.classList.toggle('is-active', selected);
    }
    if (soundToggle) {
      soundToggle.setAttribute('aria-pressed', String(settings.sound));
      soundToggle.setAttribute('aria-label', settings.sound ? '音をオフにする' : '音をオンにする');
      soundToggle.title = settings.sound ? '音をオフにする' : '音をオンにする';
      soundToggle.dataset.enabled = String(settings.sound);
    }
    if (soundLabel) soundLabel.textContent = settings.sound ? '音 ON' : '音 OFF';
    if (volumeControl) {
      volumeControl.value = String(Math.round(settings.volume * 100));
      volumeControl.setAttribute('aria-valuetext', `${Math.round(settings.volume * 100)}%`);
      volumeControl.style.setProperty('--volume', `${Math.round(settings.volume * 100)}%`);
    }
    if (pauseToggle) {
      pauseToggle.setAttribute('aria-pressed', String(settings.paused));
      pauseToggle.setAttribute('aria-label', settings.paused ? '花火を再開する' : '花火を一時停止する');
      pauseToggle.title = settings.paused ? '花火を再開する' : '花火を一時停止する';
      pauseToggle.dataset.paused = String(settings.paused);
    }
    if (pauseLabel) pauseLabel.textContent = settings.paused ? '花火を再開' : '一時停止';
    callEngine('setIntensity', settings.intensity);
    callEngine('setSound', settings.sound);
    callEngine('setVolume', settings.volume);
    callEngine('setPaused', settings.paused || Boolean(specDialog && specDialog.open));
    updateEditorStatus();
  }

  let segmenter = null;
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    segmenter = new Intl.Segmenter('ja', { granularity: 'grapheme' });
  }
  const combiningMark = /\p{M}/u;
  const regionalIndicator = (point) => point >= 0x1f1e6 && point <= 0x1f1ff;
  const extendingPoint = (character, point) => combiningMark.test(character)
    || point === 0xfe0e || point === 0xfe0f || (point >= 0x1f3fb && point <= 0x1f3ff)
    || (point >= 0xe0020 && point <= 0xe007f);

  // This fallback also keeps ordinary emoji sequences and combining marks together.
  function* fallbackSegments(text) {
    let cluster = '';
    let joinNext = false;
    let regionalCount = 0;
    for (const character of text) {
      const point = character.codePointAt(0);
      const shouldJoin = !cluster || joinNext || point === 0x200d
        || extendingPoint(character, point)
        || (regionalIndicator(point) && regionalCount === 1)
        || (cluster === '\r' && character === '\n');
      if (!shouldJoin) {
        yield cluster;
        cluster = '';
        regionalCount = 0;
      }
      cluster += character;
      if (regionalIndicator(point)) regionalCount += 1;
      else if (!extendingPoint(character, point)) regionalCount = 0;
      joinNext = point === 0x200d;
    }
    if (cluster) yield cluster;
  }

  function segments(text) {
    return segmenter ? segmenter.segment(text)[Symbol.iterator]() : fallbackSegments(text);
  }

  function boundedGraphemeCount(text, limit = 12) {
    const iterator = segments(text);
    let count = 0;
    while (count < limit && !iterator.next().done) count += 1;
    return count;
  }

  let countRevision = 0;
  let countTimer = 0;
  function scheduleCharacterCount() {
    countRevision += 1;
    if (!characterCount || countTimer) return;
    countTimer = window.setTimeout(() => {
      countTimer = 0;
      const revision = countRevision;
      const iterator = segments(memo.value);
      let total = 0;
      function countChunk() {
        if (revision !== countRevision) {
          if (!countTimer) scheduleCharacterCount();
          return;
        }
        const started = performance.now();
        let result;
        do {
          result = iterator.next();
          if (!result.done) total += 1;
        } while (!result.done && performance.now() - started < 5);
        if (result.done) {
          characterCount.textContent = `${total.toLocaleString('ja-JP')}文字`;
        } else {
          window.setTimeout(countChunk, 0);
        }
      }
      countChunk();
    }, 80);
  }

  // Keep caret measurements out of the document's scrollable area, including inside an iframe.
  const mirrorHost = document.createElement('div');
  mirrorHost.setAttribute('aria-hidden', 'true');
  mirrorHost.setAttribute('inert', '');
  mirrorHost.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;'
    + 'overflow:hidden;visibility:hidden;pointer-events:none;contain:strict;';
  const mirror = document.createElement('div');
  mirror.className = 'caret-mirror';
  mirror.style.cssText = 'position:absolute;left:0;top:0;visibility:hidden;pointer-events:none;'
    + 'white-space:pre-wrap;overflow-wrap:break-word;overflow:visible;'
    + 'height:auto;min-height:0;max-height:none;box-sizing:border-box;'
    + 'border-style:solid;border-color:transparent;';
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirrorHost.appendChild(mirror);
  document.body.appendChild(mirrorHost);
  const mirrorProperties = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch',
    'lineHeight', 'letterSpacing', 'wordSpacing', 'textIndent', 'textAlign',
    'textTransform', 'direction', 'tabSize', 'wordBreak',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  ];
  let lastPointer = null;
  memo.addEventListener('pointerdown', (event) => {
    lastPointer = { x: event.clientX, y: event.clientY, time: performance.now() };
    callEngine('unlockAudio');
  });
  const specialKeys = new Set(['Insert', 'Home', 'PageUp', 'PageDown', 'End', 'Delete']);
  const specialKeyTimes = new Map();
  memo.addEventListener('keydown', (event) => {
    callEngine('unlockAudio');
    if (!specialKeys.has(event.key) || event.isComposing || event.keyCode === 229 || composing
      || settings.paused || document.hidden || (specDialog && specDialog.open)) return;
    const now = performance.now();
    const previous = specialKeyTimes.get(event.key) ?? -Infinity;
    if (now - previous < (event.repeat ? 220 : 120)) return;
    specialKeyTimes.set(event.key, now);
    const key = event.key;
    // The browser first performs its normal caret move, selection, scrolling, or deletion.
    window.requestAnimationFrame(() => {
      if (document.activeElement !== memo || composing || settings.paused || document.hidden
        || (specDialog && specDialog.open)) return;
      callEngine('specialKey', { key, ...caretPosition() });
    });
  });

  function caretPosition() {
    const area = memo.getBoundingClientRect();
    const scene = stage.getBoundingClientRect();
    const style = getComputedStyle(memo);
    const lineHeight = parseFloat(style.lineHeight) || (parseFloat(style.fontSize) || 20) * 1.7;
    const selection = memo.selectionDirection === 'backward' ? memo.selectionStart : memo.selectionEnd;
    let x = area.left - scene.left + area.width * 0.44;
    let y = area.top - scene.top + Math.min(area.height * 0.42, lineHeight * 3);

    if (selection <= 12000) {
      try {
        for (const property of mirrorProperties) mirror.style[property] = style[property];
        mirror.style.width = `${memo.clientWidth + (parseFloat(style.borderLeftWidth) || 0)
          + (parseFloat(style.borderRightWidth) || 0)}px`;
        mirror.textContent = memo.value.slice(0, selection);
        mirror.appendChild(marker);
        x = area.left - scene.left + marker.offsetLeft - memo.scrollLeft + 2;
        y = area.top - scene.top + marker.offsetTop - memo.scrollTop + lineHeight * 0.55;
      } catch (_) { /* A nearby point is sufficient if the mirror is unavailable. */ }
    } else if (lastPointer && performance.now() - lastPointer.time < 8000) {
      x = lastPointer.x - scene.left;
      y = lastPointer.y - scene.top;
    }

    const left = Math.max(10, area.left - scene.left + 12);
    const right = Math.max(left, Math.min(scene.width - 10, area.right - scene.left - 12));
    const top = Math.max(12, area.top - scene.top + 12);
    const bottom = Math.max(top, Math.min(scene.height - 12, area.bottom - scene.top - 12));
    return { x: Math.max(left, Math.min(right, x)), y: Math.max(top, Math.min(bottom, y)) };
  }

  function emitInput(kind, text) {
    if (settings.paused || (specDialog && specDialog.open) || document.hidden) return;
    const count = kind === 'delete' ? 1 : boundedGraphemeCount(text || '', 12);
    if (!count) return;
    callEngine('input', { ...caretPosition(), count, kind });
  }

  function actualChange(before, after, range) {
    if (range && range.start >= 0 && range.end >= range.start && range.end <= before.length) {
      const prefix = before.slice(0, range.start);
      const suffix = before.slice(range.end);
      if (after.length >= prefix.length + suffix.length
        && after.startsWith(prefix) && after.endsWith(suffix)) {
        return {
          inserted: after.slice(prefix.length, after.length - suffix.length),
          removed: before.slice(range.start, range.end),
        };
      }
    }
    let first = 0;
    const shorter = Math.min(before.length, after.length);
    while (first < shorter && before.charCodeAt(first) === after.charCodeAt(first)) first += 1;
    let oldEnd = before.length;
    let newEnd = after.length;
    while (oldEnd > first && newEnd > first
      && before.charCodeAt(oldEnd - 1) === after.charCodeAt(newEnd - 1)) {
      oldEnd -= 1;
      newEnd -= 1;
    }
    return { inserted: after.slice(first, newEnd), removed: before.slice(first, oldEnd) };
  }

  let lastValue = memo.value;
  let beforeInput = null;
  let composing = false;
  let composition = null;
  let pendingComposition = null;
  let compositionTimer = 0;
  let lastComposition = null;
  let pastedAt = -Infinity;

  function recordCurrentText() {
    lastValue = memo.value;
    persistText(lastValue);
    scheduleCharacterCount();
  }

  function flushComposition(finalValue) {
    if (!pendingComposition) return;
    window.clearTimeout(compositionTimer);
    compositionTimer = 0;
    const ended = pendingComposition;
    pendingComposition = null;
    if (typeof finalValue === 'string') ended.after = finalValue;
    const change = actualChange(ended.before, ended.after, ended.range);
    const committed = change.inserted || ended.data;
    if (committed && (ended.before !== ended.after || ended.data)) emitInput('type', committed);
    lastComposition = { after: ended.after, data: ended.data, time: performance.now() };
  }

  memo.addEventListener('beforeinput', (event) => {
    beforeInput = {
      value: memo.value,
      start: memo.selectionStart,
      end: memo.selectionEnd,
      inputType: event.inputType || '',
      time: performance.now(),
    };
    callEngine('unlockAudio');
  });

  memo.addEventListener('compositionstart', () => {
    flushComposition();
    composing = true;
    composition = {
      before: memo.value,
      range: { start: memo.selectionStart, end: memo.selectionEnd },
      data: '',
    };
    beforeInput = null;
    lastComposition = null;
  });

  memo.addEventListener('compositionend', (event) => {
    composing = false;
    const ended = composition || { before: lastValue, range: null };
    composition = null;
    ended.after = memo.value;
    ended.data = event.data || '';
    ended.time = performance.now();
    pendingComposition = ended;
    recordCurrentText();
    window.clearTimeout(compositionTimer);
    // Browsers differ in whether their final input is before or after compositionend.
    compositionTimer = window.setTimeout(() => flushComposition(), 0);
  });

  memo.addEventListener('paste', () => { pastedAt = performance.now(); });
  memo.addEventListener('drop', () => { pastedAt = performance.now(); });

  memo.addEventListener('input', (event) => {
    const now = performance.now();
    const snapshot = beforeInput && now - beforeInput.time < 1500 && beforeInput.value === lastValue
      ? beforeInput : null;
    beforeInput = null;
    const before = snapshot ? snapshot.value : lastValue;
    const after = memo.value;
    const type = event.inputType || (snapshot && snapshot.inputType) || '';
    const range = snapshot ? { start: snapshot.start, end: snapshot.end } : null;
    const wasPaste = type === 'insertFromPaste' || type === 'insertFromPasteAsQuotation'
      || type === 'insertFromDrop' || (now - pastedAt < 300 && type.startsWith('insert'));
    pastedAt = -Infinity;
    recordCurrentText();

    if (event.isComposing || composing) {
      if (!composition) composition = { before, range, data: '' };
      composition.data = event.data || composition.data;
      return;
    }

    if (pendingComposition) {
      const isFinalCompositionInput = type === 'insertFromComposition' || type === 'insertCompositionText'
        || after === pendingComposition.after
        || (type === 'insertText' && event.data === pendingComposition.data
          && now - pendingComposition.time < 100);
      if (isFinalCompositionInput) {
        pendingComposition.after = after;
        return;
      }
      flushComposition(before);
    }

    if (lastComposition && now - lastComposition.time < 150
      && (type === 'insertFromComposition' || type === 'insertCompositionText'
        || (after === lastComposition.after && event.data === lastComposition.data))) {
      return;
    }
    lastComposition = null;

    if (type === 'historyUndo' || type === 'historyRedo') return;
    const change = actualChange(before, after, range);
    if (wasPaste) {
      if (change.inserted) emitInput('paste', change.inserted);
      return;
    }
    if (type.startsWith('delete') || (!change.inserted && change.removed)) {
      if (change.removed) emitInput('delete', change.removed);
      return;
    }
    // A committed IME Enter does not insert a newline; only the actual text change can do so.
    if (change.inserted.includes('\n') || change.inserted.includes('\r')) {
      emitInput('newline', change.inserted);
    } else if (change.inserted) {
      emitInput('type', change.inserted);
    } else if (range && range.start !== range.end && typeof event.data === 'string'
      && type.startsWith('insert') && event.data) {
      emitInput('type', event.data);
    }
  });

  for (const button of document.querySelectorAll('#intensity-controls [data-intensity]')) {
    button.addEventListener('click', () => {
      if (!allowedIntensities.includes(button.dataset.intensity)) return;
      settings.intensity = button.dataset.intensity;
      applySettings();
      persistPreferences();
    });
  }

  if (soundToggle) soundToggle.addEventListener('click', () => {
    settings.sound = !settings.sound;
    applySettings();
    if (settings.sound) callEngine('unlockAudio');
    persistPreferences();
  });

  if (volumeControl) volumeControl.addEventListener('input', () => {
    const next = Number(volumeControl.value);
    settings.volume = Number.isFinite(next) ? Math.max(0, Math.min(1, next / 100)) : defaults.volume;
    volumeControl.setAttribute('aria-valuetext', `${Math.round(settings.volume * 100)}%`);
    volumeControl.style.setProperty('--volume', `${Math.round(settings.volume * 100)}%`);
    callEngine('setVolume', settings.volume);
    if (settings.sound) callEngine('unlockAudio');
    persistPreferences();
  });

  if (pauseToggle) pauseToggle.addEventListener('click', () => {
    settings.paused = !settings.paused;
    applySettings();
    if (settings.paused) callEngine('clear');
    persistPreferences();
  });

  if (exportButton) exportButton.addEventListener('click', () => {
    recordCurrentText();
    const date = new Date();
    const two = (number) => String(number).padStart(2, '0');
    const stamp = `${date.getFullYear()}${two(date.getMonth() + 1)}${two(date.getDate())}`
      + `-${two(date.getHours())}${two(date.getMinutes())}${two(date.getSeconds())}`;
    let url = null;
    try {
      const blob = new Blob([memo.value], { type: 'text/plain;charset=utf-8' });
      url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `花火メモ-${stamp}.txt`;
      anchor.hidden = true;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      exportButton.dataset.exported = 'true';
      window.setTimeout(() => { delete exportButton.dataset.exported; }, 1000);
    } catch (error) {
      console.error('The text file could not be exported.', error);
      if (editorStatus) editorStatus.textContent = '書出しを開始できませんでした。本文をコピーして保存できます。';
    } finally {
      if (url) window.setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  });

  const specSource = byId('spec-source');
  const specContent = byId('spec-content');
  if (specSource && specContent) {
    try {
      const original = JSON.parse(specSource.textContent);
      specContent.textContent = typeof original === 'string' ? original : specSource.textContent;
    } catch (_) {
      specContent.textContent = specSource.textContent;
    }
  }

  let specPreviousFocus = null;
  let backdropPointer = false;
  if (specButton && specDialog) specButton.addEventListener('click', () => {
    if (specDialog.open) return;
    specPreviousFocus = document.activeElement;
    flushComposition();
    specDialog.showModal();
    document.body.classList.add('spec-open');
    callEngine('setPaused', true);
    callEngine('clear');
    if (specClose) specClose.focus({ preventScroll: true });
  });
  if (specClose && specDialog) specClose.addEventListener('click', () => specDialog.close());
  if (specDialog) {
    const outsideDialog = (event) => {
      const rectangle = specDialog.getBoundingClientRect();
      return event.clientX < rectangle.left || event.clientX > rectangle.right
        || event.clientY < rectangle.top || event.clientY > rectangle.bottom;
    };
    specDialog.addEventListener('pointerdown', (event) => {
      backdropPointer = event.target === specDialog && outsideDialog(event);
    });
    specDialog.addEventListener('click', (event) => {
      if (backdropPointer && event.target === specDialog && outsideDialog(event)) specDialog.close();
      backdropPointer = false;
    });
    specDialog.addEventListener('close', () => {
      document.body.classList.remove('spec-open');
      callEngine('setPaused', settings.paused);
      if (specPreviousFocus && typeof specPreviousFocus.focus === 'function') {
        specPreviousFocus.focus({ preventScroll: true });
      }
      specPreviousFocus = null;
    });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      recordCurrentText();
      callEngine('clear');
    }
  });
  window.addEventListener('pagehide', () => {
    recordCurrentText();
    persistPreferences();
    callEngine('clear');
  });

  applySettings();
  persistText(memo.value);
  scheduleCharacterCount();
  // Diagnostics never rewrite the editor or synthesize input events.
  window.fireApp = Object.freeze({
    engine,
    getState: () => Object.freeze({
      text: memo.value,
      ...settings,
      saved: storageAvailable && lastSavedText === memo.value,
      composing,
      specOpen: Boolean(specDialog && specDialog.open),
      statistics: callEngine('getStats'),
    }),
  });
})();
