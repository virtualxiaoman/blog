<template>
  <div class="color-tool">
    <h2 class="tool-title">颜色转换</h2>
    <p class="tool-desc">在 RGB 与十六进制（Hex）之间互相转换，实时预览色块。</p>

    <div class="input-row">
      <label class="input-label" for="color-input">颜色</label>
      <input
        id="color-input"
        v-model="input"
        class="color-input"
        placeholder="支持 #66CCFF、rgb(102, 204, 255)、rgb(102 204 255 / 80%)"
        @input="parseInput"
      />
    </div>

    <div class="preview-row">
      <div class="preview" :style="{ backgroundColor: previewColor }"></div>
      <span v-if="previewColor" class="preview-hex">{{ previewColor }}</span>
    </div>

    <div class="results">
      <div class="result-row">
        <span class="result-label">Hex</span>
        <input :value="hex" readonly class="result-value" />
        <button type="button" class="copy-btn" :class="{ copied: copiedHex }" @click="copy('hex')">
          {{ copiedHex ? '已复制' : '复制' }}
        </button>
      </div>
      <div class="result-row">
        <span class="result-label">RGB</span>
        <input :value="rgb" readonly class="result-value" />
        <button type="button" class="copy-btn" :class="{ copied: copiedRgb }" @click="copy('rgb')">
          {{ copiedRgb ? '已复制' : '复制' }}
        </button>
      </div>
    </div>

    <p v-if="error" class="error-msg">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { copyText } from '../../../../utils/clipboard';

const input = ref('');
const hex = ref('');
const rgb = ref('');
const error = ref('');
const previewColor = ref('');
const copiedHex = ref(false);
const copiedRgb = ref(false);

// 解析输入：hex（#xxx / #xxxxxx）或 rgb() / rgba()，统一转成 {r,g,b,a}
function parseColor(raw: string): { r: number; g: number; b: number; a: number } | null {
  const s = raw.trim();

  // #RGB / #RRGGBB / #RRGGBBAA
  const hexMatch = s.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hexMatch) {
    let h = hexMatch[1];
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return { r, g, b, a };
  }

  // rgb(r,g,b) / rgba(r,g,b,a) / rgb(r g b / a) / rgb(r g b a)
  const rgbMatch = s.match(
    /^rgba?\(\s*([\d.]+%?)\s*(?:[, ])\s*([\d.]+%?)\s*(?:[, ])\s*([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i
  );
  if (rgbMatch) {
    const conv = (v: string) => (v.endsWith('%') ? Math.round((parseFloat(v) / 100) * 255) : parseFloat(v));
    const r = conv(rgbMatch[1]);
    const g = conv(rgbMatch[2]);
    const b = conv(rgbMatch[3]);
    const a = rgbMatch[4] ? (rgbMatch[4].endsWith('%') ? parseFloat(rgbMatch[4]) / 100 : parseFloat(rgbMatch[4])) : 1;
    if ([r, g, b].some((v) => isNaN(v) || v < 0 || v > 255) || isNaN(a) || a < 0 || a > 1) return null;
    return { r, g, b, a };
  }
  return null;
}

function parseInput() {
  error.value = '';
  const c = parseColor(input.value);
  if (!c) {
    hex.value = '';
    rgb.value = '';
    previewColor.value = '';
    if (input.value.trim()) error.value = '无法识别的颜色格式';
    return;
  }
  const toHex = (v: number) => v.toString(16).padStart(2, '0').toUpperCase();
  // Hex 输出（含透明度时带 AA 位）
  hex.value =
    c.a >= 1 ? `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}` : `#${toHex(c.r)}${toHex(c.g)}${toHex(c.b)}${toHex(Math.round(c.a * 255))}`;
  // RGB 输出（含透明度用 rgba，否则 rgb）
  rgb.value =
    c.a >= 1 ? `rgb(${c.r}, ${c.g}, ${c.b})` : `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a.toFixed(2)})`;
  previewColor.value = `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
}

async function copy(target: 'hex' | 'rgb') {
  const value = target === 'hex' ? hex.value : rgb.value;
  if (!value) return;
  const ok = await copyText(value);
  if (!ok) return;
  if (target === 'hex') {
    copiedHex.value = true;
    setTimeout(() => (copiedHex.value = false), 1500);
  } else {
    copiedRgb.value = true;
    setTimeout(() => (copiedRgb.value = false), 1500);
  }
}
</script>

<style scoped>
.tool-title {
  margin: 0 0 6px;
  font-size: 24px;
  color: #1c3a4a;
}

.tool-desc {
  margin: 0 0 16px;
  color: #73767a;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.input-label {
  font-size: 14px;
  color: #555;
  white-space: nowrap;
}

.color-input {
  flex: 1;
  min-width: 0;
  padding: 9px 12px;
  border: 1px solid #dbeef7;
  border-radius: 8px;
  font-size: 14px;
  font-family: Consolas, 'Courier New', monospace;
  background: #fafdff;
  color: #333;
}

.color-input:focus {
  outline: none;
  border-color: #66ccff;
}

.preview-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.preview {
  width: 56px;
  height: 56px;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.5), 0 2px 6px rgba(0, 0, 0, 0.08);
}

.preview-hex {
  font-size: 14px;
  font-family: Consolas, 'Courier New', monospace;
  color: #1c3a4a;
}

.results {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.result-label {
  width: 36px;
  font-size: 13px;
  font-weight: 600;
  color: #409eff;
  flex-shrink: 0;
}

.result-value {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid #dbeef7;
  border-radius: 8px;
  font-size: 14px;
  font-family: Consolas, 'Courier New', monospace;
  background: #fafdff;
  color: #333;
}

.copy-btn {
  padding: 7px 16px;
  border: none;
  border-radius: 8px;
  background-color: #66ccff;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.copy-btn:hover {
  background-color: #4bbdf5;
}

.copy-btn.copied {
  background-color: #39c5bb;
}

.error-msg {
  margin: 12px 0 0;
  color: #d9534f;
  font-size: 13px;
}
</style>
