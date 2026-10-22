(() => {
  "use strict";

  const MAX_BYTES = 20_000_000;
  const MAX_PIXELS = 16_000_000;
  const HASH_LENGTHS = Object.freeze({ crc32: 8, xxhash64: 16, md5: 32, xxhash128: 32 });
  const abortError = () => new DOMException("操作が取り消されました。", "AbortError");
  const fail = (message) => { throw new Error(message); };
  const ascii = (bytes, offset, size) => String.fromCharCode(...bytes.subarray(offset, offset + size));

  function checkDimensions(width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
      fail("画像の大きさを読み取れませんでした。");
    }
    if (width * height > MAX_PIXELS) fail("1600万画素を超える画像です。小さい画像を選んでください。");
    return { width, height };
  }

  function inspectImage(bytes) {
    const size = bytes.byteLength;
    const view = new DataView(bytes.buffer, bytes.byteOffset, size);
    if (size >= 24 && bytes[0] === 137 && ascii(bytes, 1, 7) === "PNG\r\n\x1a\n") {
      if (ascii(bytes, 12, 4) !== "IHDR") fail("PNGのヘッダーが壊れています。");
      const dimensions = checkDimensions(view.getUint32(16), view.getUint32(20));
      let offset = 8;
      while (offset + 12 <= size) {
        const length = view.getUint32(offset);
        const kind = ascii(bytes, offset + 4, 4);
        if (offset + length + 12 > size) fail("PNGファイルの一部が欠けています。");
        if (kind === "acTL") fail("アニメーションPNGには対応していません。静止画を選んでください。");
        offset += length + 12;
        if (kind === "IEND") break;
      }
      return { mime: "image/png", ...dimensions };
    }
    if (size >= 4 && bytes[0] === 255 && bytes[1] === 216) {
      let offset = 2;
      while (offset + 3 < size) {
        if (bytes[offset] !== 255) fail("JPEGのヘッダーを読み取れませんでした。");
        while (bytes[offset] === 255 && offset < size) offset += 1;
        const marker = bytes[offset++];
        if (marker === 217 || marker === 218) break;
        if (marker === 1 || (marker >= 208 && marker <= 215)) continue;
        if (offset + 2 > size) break;
        const length = view.getUint16(offset);
        if (length < 2 || offset + length > size) fail("JPEGファイルの一部が欠けています。");
        const isFrame = marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204;
        if (isFrame && length >= 7) {
          return { mime: "image/jpeg", ...checkDimensions(view.getUint16(offset + 5), view.getUint16(offset + 3)) };
        }
        offset += length;
      }
      fail("このJPEGの画像サイズを読み取れませんでした。");
    }
    if (size >= 20 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") {
      const declaredSize = view.getUint32(4, true) + 8;
      if (declaredSize > size) fail("WebPファイルの一部が欠けています。");
      let dimensions = null;
      let offset = 12;
      while (offset + 8 <= declaredSize) {
        const kind = ascii(bytes, offset, 4);
        const length = view.getUint32(offset + 4, true);
        const start = offset + 8;
        if (start + length > declaredSize) fail("WebPファイルの一部が欠けています。");
        if (kind === "ANIM" || kind === "ANMF" || (kind === "VP8X" && length >= 10 && (bytes[start] & 2))) {
          fail("アニメーションWebPには対応していません。静止画を選んでください。");
        }
        if (kind === "VP8X" && length >= 10) {
          const width = 1 + bytes[start + 4] + (bytes[start + 5] << 8) + (bytes[start + 6] << 16);
          const height = 1 + bytes[start + 7] + (bytes[start + 8] << 8) + (bytes[start + 9] << 16);
          dimensions = checkDimensions(width, height);
        } else if (!dimensions && kind === "VP8 " && length >= 10 && bytes[start + 3] === 157 && bytes[start + 4] === 1 && bytes[start + 5] === 42) {
          dimensions = checkDimensions(view.getUint16(start + 6, true) & 16383, view.getUint16(start + 8, true) & 16383);
        } else if (!dimensions && kind === "VP8L" && length >= 5 && bytes[start] === 47) {
          const width = 1 + bytes[start + 1] + ((bytes[start + 2] & 63) << 8);
          const height = 1 + (bytes[start + 2] >> 6) + (bytes[start + 3] << 2) + ((bytes[start + 4] & 15) << 10);
          dimensions = checkDimensions(width, height);
        }
        offset = start + length + (length % 2);
      }
      if (!dimensions) fail("このWebPの画像サイズを読み取れませんでした。");
      return { mime: "image/webp", ...dimensions };
    }
    fail("PNG・JPEG・WebPの静止画を選んでください。");
  }

  async function decodeImage(blob, objectUrl) {
    if (typeof createImageBitmap === "function") {
      try {
        return await createImageBitmap(blob, { imageOrientation: "from-image" });
      } catch (_) {
        // The image element also applies EXIF orientation on supported browsers.
      }
    }
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("画像を開けませんでした。ファイルが壊れていないか確認してください。"));
      image.src = objectUrl;
    });
  }

  function sampleColors(image) {
    const canvas = document.createElement("canvas");
    canvas.width = 16;
    canvas.height = 16;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return ["#ffad00", "#ff3964", "#2bcbb5"];
    context.drawImage(image, 0, 0, 16, 16);
    const data = context.getImageData(0, 0, 16, 16).data;
    const counts = new Map();
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 100) continue;
      const rgb = [data[i], data[i + 1], data[i + 2]].map((v) => Math.min(255, Math.round(v / 32) * 32));
      const key = rgb.join(",");
      const saturation = Math.max(...rgb) - Math.min(...rgb);
      const existing = counts.get(key);
      if (existing) existing.weight += saturation > 45 ? 3 : 1;
      else counts.set(key, { rgb, weight: saturation > 45 ? 3 : 1 });
    }
    const candidates = [...counts.values()].sort((a, b) => b.weight - a.weight);
    const chosen = [];
    for (const candidate of candidates) {
      if (chosen.every((other) => candidate.rgb.reduce((sum, v, i) => sum + Math.abs(v - other[i]), 0) > 85)) {
        chosen.push(candidate.rgb);
      }
      if (chosen.length === 6) break;
    }
    return chosen.length ? chosen.map((rgb) => `rgb(${rgb.join(",")})`) : ["#ffad00", "#ff3964", "#2bcbb5"];
  }

  function limitsFor(bytes, percentage) {
    if (!Number.isInteger(bytes) || bytes < 0 || !Number.isFinite(percentage) || percentage < 1 || percentage > 10) {
      throw new RangeError("ハッシュの入力容量と残りの高さを確認してください。");
    }
    const rawLimit = Math.floor(bytes * percentage / 100);
    const limit = Math.max(8, rawLimit);
    const allowed = Object.keys(HASH_LENGTHS).filter((algorithm) => HASH_LENGTHS[algorithm] <= limit);
    return { limit, rawLimit, minimum: rawLimit < 8, allowed, automatic: limit >= 32 ? "xxhash128" : limit >= 16 ? "xxhash64" : "crc32" };
  }

  function create({ workerSource } = {}) {
    let source = null;
    let epoch = 0;
    let destroyed = false;
    let worker = null;
    let workerUrl = null;
    let nextRequest = 0;
    const pending = new Map();
    const pendingByAlgorithm = new Map();

    function stopWorker(reason = abortError()) {
      if (worker) worker.terminate();
      worker = null;
      if (workerUrl) URL.revokeObjectURL(workerUrl);
      workerUrl = null;
      for (const request of pending.values()) {
        clearTimeout(request.timeout);
        request.reject(reason);
      }
      pending.clear();
      pendingByAlgorithm.clear();
    }

    function invalidate() {
      epoch += 1;
      stopWorker();
    }

    function disposeSource(value) {
      if (!value) return;
      URL.revokeObjectURL(value.info.objectUrl);
      if (typeof value.image.close === "function") value.image.close();
    }

    function assertCurrent(token, original) {
      if (destroyed || token !== epoch || (original && source !== original)) throw abortError();
    }

    async function loadFile(file) {
      if (destroyed) throw abortError();
      invalidate();
      const token = epoch;
      if (!(file instanceof Blob)) fail("画像ファイルを選んでください。");
      if (!file.size) fail("空のファイルは使えません。");
      if (file.size > MAX_BYTES) fail("20MBを超える画像です。小さい画像を選んでください。");
      const buffer = new Uint8Array(await file.arrayBuffer());
      assertCurrent(token);
      const header = inspectImage(buffer);
      const imageBlob = new Blob([buffer], { type: header.mime });
      const objectUrl = URL.createObjectURL(imageBlob);
      let image = null;
      try {
        image = await decodeImage(imageBlob, objectUrl);
        assertCurrent(token);
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        checkDimensions(width, height);
        const info = Object.freeze({
          width, height, bytes: file.size, name: file.name || "image.png", mime: header.mime,
          objectUrl, colors: sampleColors(image), originalFile: file
        });
        // A caller may have requested an old-image hash while decode was pending.
        stopWorker();
        const oldSource = source;
        source = { image, buffer, info, cache: new Map() };
        disposeSource(oldSource);
        return info;
      } catch (error) {
        URL.revokeObjectURL(objectUrl);
        if (image && typeof image.close === "function") image.close();
        throw error;
      }
    }

    async function makePNG(percentage) {
      if (!source) fail("先に画像を選んでください。");
      if (!Number.isFinite(percentage) || percentage <= 10 || percentage > 100) fail("PNGを作れるのは残り11〜100％です。");
      const token = epoch;
      const original = source;
      const width = original.info.width;
      const height = Math.max(1, Math.round(original.info.height * percentage / 100));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      try {
        const context = canvas.getContext("2d");
        if (!context) fail("画像の書き出しを開始できませんでした。");
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(original.image, 0, 0, width, height);
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob((result) => result ? resolve(result) : reject(new Error("PNGを作れませんでした。もう一度お試しください。")), "image/png");
        });
        assertCurrent(token, original);
        return { blob, width, height };
      } finally {
        canvas.width = 1;
        canvas.height = 1;
      }
    }

    function ensureWorker() {
      if (worker) return worker;
      if (typeof Worker !== "function" || typeof WebAssembly !== "object") fail("このブラウザーではハッシュ用のWeb WorkerまたはWebAssemblyを使えません。");
      if (typeof workerSource !== "string" || !workerSource.trim()) fail("ハッシュエンジンが含まれていません。");
      try {
        workerUrl = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
        const created = new Worker(workerUrl);
        worker = created;
        created.onmessage = ({ data }) => {
          if (worker !== created || !data) return;
          const request = pending.get(data.id);
          if (!request) return;
          clearTimeout(request.timeout);
          pending.delete(data.id);
          pendingByAlgorithm.delete(request.algorithm);
          if (data.type === "error") {
            request.reject(new Error(data.message || "ハッシュの計算に失敗しました。"));
            return;
          }
          if (data.type !== "result" || data.algorithm !== request.algorithm || typeof data.value !== "string" || data.value.length !== HASH_LENGTHS[request.algorithm] || !/^[0-9a-f]+$/.test(data.value)) {
            request.reject(new Error("ハッシュの計算結果を検証できませんでした。"));
            return;
          }
          if (request.epoch !== epoch || source !== request.source) {
            request.reject(abortError());
            return;
          }
          source.cache.set(request.algorithm, data.value);
          request.resolve(data.value);
        };
        created.onerror = (event) => {
          if (worker !== created) return;
          event.preventDefault();
          stopWorker(new Error("ハッシュエンジンを実行できませんでした。もう一度お試しください。"));
        };
        created.onmessageerror = () => {
          if (worker === created) stopWorker(new Error("ハッシュ結果を受け取れませんでした。もう一度お試しください。"));
        };
        const copy = source.buffer.slice().buffer;
        created.postMessage({ type: "init", buffer: copy }, [copy]);
        return created;
      } catch (error) {
        stopWorker(error);
        throw error;
      }
    }

    async function hash(algorithm) {
      if (!source || destroyed) fail("先に画像を選んでください。");
      if (!Object.prototype.hasOwnProperty.call(HASH_LENGTHS, algorithm)) fail("このハッシュ方式には対応していません。");
      if (source.cache.has(algorithm)) return source.cache.get(algorithm);
      if (pendingByAlgorithm.has(algorithm)) return pendingByAlgorithm.get(algorithm);
      const active = ensureWorker();
      const id = ++nextRequest;
      const result = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => stopWorker(new Error("ハッシュの計算が完了しませんでした。もう一度お試しください。")), 20000);
        pending.set(id, { resolve, reject, timeout, algorithm, epoch, source });
      });
      pendingByAlgorithm.set(algorithm, result);
      try {
        active.postMessage({ type: "hash", id, algorithm });
      } catch (error) {
        stopWorker(error);
      }
      return result;
    }

    function destroy() {
      invalidate();
      disposeSource(source);
      source = null;
      destroyed = true;
    }

    return Object.freeze({ loadFile, makePNG, hash, invalidate, destroy });
  }

  function formatBytes(bytes) {
    if (bytes < 1000) return `${bytes} B`;
    if (bytes < 1_000_000) return `${(bytes / 1000).toFixed(bytes < 10_000 ? 2 : 1)} KB`;
    return `${(bytes / 1_000_000).toFixed(2)} MB`;
  }

  function saveBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  window.PhysicalEngine = Object.freeze({ create, limitsFor, formatBytes, saveBlob, MAX_BYTES, MAX_PIXELS, HASH_LENGTHS });
})();
