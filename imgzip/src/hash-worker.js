/* hash-wasm 4.12.0's four UMD bundles are prepended by build.sh. */
(() => {
  "use strict";
  let input = null;
  let generation = 0;
  const cache = new Map();
  const lengths = { crc32: 8, md5: 32, xxhash64: 16, xxhash128: 32 };

  async function calculate(algorithm, bytes) {
    const api = self.hashwasm;
    if (!api || typeof api[algorithm] !== "function") {
      throw new Error("ハッシュエンジンを開始できませんでした。");
    }
    const value = algorithm === "xxhash64" || algorithm === "xxhash128"
      ? await api[algorithm](bytes, 0, 0)
      : await api[algorithm](bytes);
    if (typeof value !== "string" || value.length !== lengths[algorithm] || !/^[0-9a-f]+$/.test(value)) {
      throw new Error("ハッシュの計算結果を検証できませんでした。");
    }
    return value;
  }

  self.onmessage = async ({ data }) => {
    if (!data || typeof data !== "object") return;
    if (data.type === "init") {
      generation += 1;
      input = new Uint8Array(data.buffer);
      cache.clear();
      return;
    }
    if (data.type !== "hash") return;
    const token = generation;
    const { id, algorithm } = data;
    try {
      if (!input || !Object.prototype.hasOwnProperty.call(lengths, algorithm)) {
        throw new Error("元画像またはハッシュ方式を確認してください。");
      }
      let calculation = cache.get(algorithm);
      if (!calculation) {
        calculation = calculate(algorithm, input);
        cache.set(algorithm, calculation);
        calculation.catch(() => {
          if (token === generation) cache.delete(algorithm);
        });
      }
      const value = await calculation;
      if (token === generation) self.postMessage({ type: "result", id, algorithm, value });
    } catch (error) {
      if (token === generation) self.postMessage({ type: "error", id, message: error.message || "ハッシュの計算に失敗しました。" });
    }
  };
})();
