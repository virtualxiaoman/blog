/**
 * 全息 2.5D 渲染器（Three.js）。
 *
 * 两遍渲染：
 *   Pass 1 → 内部降低分辨率 WebGLRenderTarget：
 *            光线步进 POM（从相机位置沿视线搜索首个表面交点，线性搜索 + 二分细化，
 *            真实遮挡），按交点采样原图（带 RGB 色差），输出颜色 + 覆盖度。
 *   Pass 2 → 全屏合成：扫描线、滚带、噪点闪烁、暗角、基于深度梯度的轮廓辉光，
 *            预乘 alpha 输出到画布（画布透明，露出 CSS 暗色舞台）。
 *
 * 输入交互：画布上指针/触摸驱动视差 + 无输入时的呼吸漂浮，指数阻尼平滑。
 */

import * as THREE from 'three';
import { DataUtils } from 'three';

export interface HologramImageData {
  width: number;
  height: number;
  /** RGBA 像素（顶部行在前，与 depth 同尺寸） */
  rgba: Uint8ClampedArray;
  /** 归一化深度 [0,1]，1=最近，与 rgba 同尺寸 */
  depth: Float32Array;
}

export interface HologramOptions {
  /** 视差最大幅度（uv 单位） */
  maxParallax?: number;
  /** 指针全幅移动对应的视差幅度 */
  pointerStrength?: number;
  /** 无输入时呼吸漂浮幅度 */
  idleSway?: number;
  /** RGB 色差强度（uv 单位） */
  chroma?: number;
  /** 轮廓辉光强度 */
  glow?: number;
  /** 扫描线强度 */
  scanline?: number;
  /** 噪点闪烁强度 */
  noise?: number;
  /** 暗角强度 */
  vignette?: number;
  /** 全息整体不透明度 */
  opacity?: number;
  /** 整体饱和度，1 为原始强度 */
  saturation?: number;
  /** 色温，-1 偏冷、0 不调整、1 偏暖 */
  temperature?: number;
  /** 整体亮度，0 不调整 */
  brightness?: number;
  /** 色相偏移（度），0 不调整 */
  hue?: number;
  /** 内部渲染分辨率与步数档位 */
  quality?: 'auto' | 'high' | 'balanced' | 'mobile';
}

type Quality = Required<HologramOptions>['quality'];

const DEFAULTS: Required<HologramOptions> = {
  maxParallax: 0.1,
  pointerStrength: 0.08,
  idleSway: 0.018,
  chroma: 0.0035,
  glow: 0.65,
  scanline: 0.12,
  noise: 0.05,
  vignette: 0.45,
  opacity: 0.92,
  saturation: 1,
  temperature: 0,
  brightness: 0,
  hue: 0,
  quality: 'auto',
};

const VERTEX = /* glsl */ `
varying vec2 vUv;
void main() {
  // PlaneGeometry(2,2)：顶点为 position.y=-y，故顶部顶点(位置 y=+1)的 uv.y=1，
  // 底部 uv.y=0。纹理数据顶部行在前(flipY=false，v=0 为第 0 行)。
  // 翻转 v，让图片顶部(数据第 0 行)出现在屏幕顶部。
  vUv = vec2(uv.x, 1.0 - uv.y);
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

/** Pass 1：光线步进 POM 视差 + 色差采样图片 */
const FRAGMENT_POM = /* glsl */ `
precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uImage;      // RGBA 原图（sRGB）
uniform sampler2D uDepth;      // R 半浮点深度，1=最近
uniform vec2 uParallax;        // 平滑后的相机视差偏移（uv 单位，已含强度）
uniform float uMaxShift;       // 视差钳制幅度
uniform float uChroma;         // 色差（uv 单位）
uniform vec2 uCanvasSize;      // 内部渲染尺寸（像素）
uniform vec2 uImageSize;       // 图片纹理尺寸（像素）
uniform float uMaxSteps;       // 线性搜索最大步数
uniform float uMinSteps;       // 线性搜索最小步数（视差小时减少开销）
uniform float uOpacity;        // 全息不透明度
uniform int uDebug;            // 0=正常，1=原图直出（绕开 POM），2=深度灰度

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

// 画布 uv → 图片 uv（contain 适配）；落在图片外时坐标超出 [0,1]
vec2 containUv(vec2 uv, vec2 canvasSize, vec2 imageSize) {
  float cAspect = canvasSize.x / canvasSize.y;
  float iAspect = imageSize.x / imageSize.y;
  vec2 fit = cAspect > iAspect
    ? vec2(iAspect / cAspect, 1.0)
    : vec2(1.0, cAspect / iAspect);
  return (uv - 0.5) / fit + 0.5;
}

void main() {
  vec2 iuv = containUv(vUv, uCanvasSize, uImageSize);

  // 图片边缘羽化（约 0.002 uv，避免硬边锯齿）
  float feather = 0.002;
  float inside = smoothstep(0.0, feather, iuv.x) * smoothstep(0.0, feather, iuv.y)
               * (1.0 - smoothstep(1.0 - feather, 1.0, iuv.x))
               * (1.0 - smoothstep(1.0 - feather, 1.0, iuv.y));
  vec2 iuvC = clamp(iuv, 0.0005, 0.9995);

  // 深度调试视图
  if (uDebug == 2) {
    float d = texture2D(uDepth, iuvC).r;
    float a = inside * uOpacity;
    gl_FragColor = vec4(vec3(d) * a, a);
    return;
  }

  // uv 映射调试视图：R=iuv.x，G=iuv.y（应线性）
  if (uDebug == 3) {
    vec2 g = iuvC;
    vec3 m = vec3(g.x, g.y, 0.0);
    gl_FragColor = vec4(m, 1.0);
    return;
  }

  // 恒等映射调试视图：直接按 vUv 采样纹理，验证纹理内容
  if (uDebug == 4) {
    gl_FragColor = vec4(texture2D(uImage, vUv).rgb, 1.0);
    return;
  }
  if (uDebug == 5) {
    gl_FragColor = vec4(vec3(texture2D(uDepth, vUv).r), 1.0);
    return;
  }
  // uv 属性视图：R=vUv.x，G=vUv.y
  if (uDebug == 6) {
    gl_FragColor = vec4(vec3(vUv.x, vUv.y, 0.0), 1.0);
    return;
  }
  // gl_FragCoord 视图：R=x/W，G=y/H（Fragment 在 RT 中的实际位置）
  if (uDebug == 7) {
    gl_FragColor = vec4(vec3(gl_FragCoord.xy / uCanvasSize, 0.0), 1.0);
    return;
  }

  // 相机在图片 uv 空间的位置 = 像素 + 视差；表面高度 h ∈ [0,1] 朝相机隆起，
  // 从相机向该像素平面方向搜索首个表面交点，得到真实遮挡。
  vec2 eyeUv = iuvC + uParallax;
  vec2 dir = iuvC - eyeUv;               // 视线方向（沿 uv）
  float travel = length(dir);
  vec2 hitUv = iuvC;
  bool hit = false;

  if (uDebug == 0 && travel >= 1e-4) {
    // 步数随视差大小自适应：静止时开销低，大幅移动时更精确
    float steps = clamp(mix(uMinSteps, uMaxSteps, travel / 0.1), uMinSteps, uMaxSteps);
    float dith = (hash21(gl_FragCoord.xy) - 0.5) / steps; // 去带状
    float t = dith;
    float prevT = 0.0;
    for (int i = 0; i < 64; i++) {
      if (t >= 1.0) break;
      vec2 curUv = mix(eyeUv, iuvC, clamp(t, 0.0, 1.0));
      float rayH = 1.0 - t;              // 光线当前高度
      float surfH = texture2D(uDepth, curUv).r; // 该 uv 的表面高度
      if (surfH >= rayH) {
        // 命中：二分细化交点
        float tLo = prevT;
        float tHi = t;
        for (int j = 0; j < 6; j++) {
          float tm = (tLo + tHi) * 0.5;
          vec2 mUv = mix(eyeUv, iuvC, tm);
          float mH = texture2D(uDepth, mUv).r;
          if (mH >= 1.0 - tm) tHi = tm;
          else tLo = tm;
        }
        hitUv = mix(eyeUv, iuvC, (tLo + tHi) * 0.5);
        hit = true;
        break;
      }
      prevT = t;
      t += 1.0 / steps;
    }
  }

  // 钳制位移幅度，防深度断层处看穿/撕裂
  vec2 finalUv = hit ? clamp(hitUv, iuvC - uMaxShift, iuvC + uMaxShift) : iuvC;

  // 采样原图（带 RGB 色差）
  vec3 col;
  if (uDebug == 1) {
    col = texture2D(uImage, iuvC).rgb;
  } else {
    col.r = texture2D(uImage, vec2(finalUv.x + uChroma, finalUv.y)).r;
    col.g = texture2D(uImage, finalUv).g;
    col.b = texture2D(uImage, vec2(finalUv.x - uChroma, finalUv.y)).b;
  }
  float alpha = texture2D(uImage, finalUv).a;

  // 合成：半透明全息 + 覆盖度（外部/透明区露出舞台）
  float a = alpha * uOpacity * inside;
  gl_FragColor = vec4(col, a);
}
`;

/** Pass 2：全屏合成全息美学叠加 */
const FRAGMENT_COMPOSITE = /* glsl */ `
precision highp float;
precision highp sampler2D;

varying vec2 vUv;

uniform sampler2D uScene;      // Pass 1 结果
uniform sampler2D uDepth;      // 深度（用于轮廓辉光）
uniform vec2 uCanvasSize;      // 画布像素尺寸
uniform vec2 uImageSize;       // 图片尺寸
uniform float uTime;           // 秒
uniform float uScanline;       // 扫描线强度
uniform float uNoise;          // 噪点闪烁强度
uniform float uVignette;       // 暗角强度
uniform float uGlow;           // 轮廓辉光强度
uniform float uSaturation;     // 整体饱和度，1 为原始强度
uniform float uTemperature;    // 色温，-1 偏冷、1 偏暖
uniform float uBrightness;     // 整体亮度，0 不调整
uniform float uHue;            // 色相偏移（度）
uniform float uDebugFlat;      // 调试扁平模式（跳过叠加）

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

vec2 containUv(vec2 uv, vec2 canvasSize, vec2 imageSize) {
  float cAspect = canvasSize.x / canvasSize.y;
  float iAspect = imageSize.x / imageSize.y;
  vec2 fit = cAspect > iAspect
    ? vec2(iAspect / cAspect, 1.0)
    : vec2(1.0, cAspect / iAspect);
  return (uv - 0.5) / fit + 0.5;
}


// RGB / HSV 转换只用于最后的整体调色；保持原始 alpha 合成逻辑不变。
vec3 rgb2hsv(vec3 c) {
  vec4 k = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, k.wz), vec4(c.gb, k.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
void main() {
  // pass1 渲染进 framebuffer（gl_FragCoord 底部起点），pass2 采样该纹理时
  // 需要翻转 v，否则画面上下颠倒。
  vec4 scene = texture2D(uScene, vec2(vUv.x, 1.0 - vUv.y));

  // 调试扁平模式：跳过所有叠加/辉光，直出 pass1 结果
  if (uDebugFlat > 0.5) {
    gl_FragColor = vec4(scene.rgb * scene.a, scene.a);
    return;
  }

  // 扫描线：缓慢滚动的细横条
  float scanlines = 1.0 - uScanline
    * (0.5 + 0.5 * sin(vUv.y * uCanvasSize.y * 0.25 + uTime * 1.6));
  // 大范围明暗滚带（全息投影的流光感）
  float band = 0.5 + 0.5 * sin(uTime * 0.8 + vUv.y * 10.0 + vUv.x * 5.0);
  float bandMask = 1.0 - 0.5 * uScanline * band;

  // 噪点闪烁：整体亮度低频扰动
  float n = hash21(gl_FragCoord.xy + fract(uTime * 12.0) * 997.0);
  float flicker = 1.0 - uNoise * (n * 2.0 - 1.0);

  // 暗角：中心亮、边缘暗，像投影光锥
  float d = distance(vUv, vec2(0.5));
  float vignette = 1.0 - uVignette * smoothstep(0.35, 0.85, d);

  // 轮廓辉光：深度梯度大的地方（剪影边缘）泛青蓝光
  vec2 iuv = clamp(containUv(vUv, uCanvasSize, uImageSize), 0.0, 1.0);
  float dv = texture2D(uDepth, iuv).r;
  float edge = fwidth(dv);
  vec3 glowCol = vec3(0.35, 0.85, 1.0) * smoothstep(0.03, 0.2, edge) * uGlow;

  vec3 rgb = scene.rgb * scanlines * bandMask * flicker * vignette + glowCol * scene.a;
  float a = scene.a;

  // 用户可选的整体调色：色相 / 饱和度以 HSV 处理，色温和亮度再做轻量修正。
  vec3 hsv = rgb2hsv(max(rgb, vec3(0.0)));
  hsv.x = fract(hsv.x + uHue / 360.0);
  hsv.y = clamp(hsv.y * uSaturation, 0.0, 1.0);
  rgb = hsv2rgb(hsv);
  rgb *= vec3(1.0 + uTemperature * 0.16, 1.0 + uTemperature * 0.035, 1.0 - uTemperature * 0.16);
  rgb += vec3(uBrightness * 0.35);
  rgb = clamp(rgb, 0.0, 1.0);

  // 预乘 alpha：半透明像素与暗色舞台正确混合（避免亮边）
  gl_FragColor = vec4(rgb * a, a);
}
`;

export class HologramRenderer {
  private readonly canvas: HTMLCanvasElement;
  private options: Required<HologramOptions>;

  private renderer: THREE.WebGLRenderer;
  private scene1: THREE.Scene;
  private scene2: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private quad: THREE.PlaneGeometry;
  private mat1: THREE.ShaderMaterial;
  private mat2: THREE.ShaderMaterial;
  private rt: THREE.WebGLRenderTarget | null = null;

  private imageTex: THREE.DataTexture | null = null;
  private depthTex: THREE.DataTexture | null = null;

  private lastTime = 0;
  private elapsed = 0;
  private raf = 0;
  private running = false;

  // 视差状态（指针 + 呼吸）
  private pointer = { x: 0.5, y: 0.5 };
  private currentParallax = { x: 0, y: 0 };
  private hasImage = false;

  private resizeObserver: ResizeObserver | null = null;
  private disposeResize: () => void = () => {};

  constructor(canvas: HTMLCanvasElement, options: HologramOptions = {}) {
    this.canvas = canvas;
    this.options = { ...DEFAULTS, ...options };

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: false,
      preserveDrawingBuffer: true, // 允许 readPixels 读回（调试/测试用，开销可忽略）
    });
    this.renderer.setClearColor(0x000000, 0);
    // 输出不做 sRGB 编码：整条链路 sRGB 字节直通画布（配合图片纹理 NoColorSpace）
    this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad = new THREE.PlaneGeometry(2, 2);

    this.scene1 = new THREE.Scene();
    this.mat1 = this.makePomMaterial();
    this.scene1.add(new THREE.Mesh(this.quad, this.mat1));

    this.scene2 = new THREE.Scene();
    this.mat2 = this.makeCompositeMaterial();
    this.scene2.add(new THREE.Mesh(this.quad, this.mat2));

    this.applyOptions(this.options);
    this.bindInput();
    this.bindResize();
  }

  // ---------- 对外 API ----------

  setImage(image: HologramImageData): void {
    this.hasImage = true;

    // 原图纹理（sRGB，顶部行在前）
    if (this.imageTex) this.imageTex.dispose();
    const imgArr = new Uint8Array(image.rgba.buffer, image.rgba.byteOffset, image.rgba.byteLength);
    this.imageTex = new THREE.DataTexture(imgArr, image.width, image.height, THREE.RGBAFormat, THREE.UnsignedByteType);
    // 保持 sRGB 字节直通：DataTexture(typed-array) + SRGBColorSpace 在本机
    // 驱动上会损坏上传内容，故不交给 GPU 做 sRGB 解码，改由输出端直出。
    this.imageTex.colorSpace = THREE.NoColorSpace;
    this.imageTex.minFilter = THREE.LinearFilter;
    this.imageTex.magFilter = THREE.LinearFilter;
    this.imageTex.generateMipmaps = false;
    this.imageTex.needsUpdate = true;

    // 深度纹理（半浮点，保持精度）
    if (this.depthTex) this.depthTex.dispose();
    const depthHalf = new Uint16Array(image.depth.length);
    for (let i = 0; i < image.depth.length; i++) {
      depthHalf[i] = DataUtils.toHalfFloat(image.depth[i]);
    }
    this.depthTex = new THREE.DataTexture(depthHalf, image.width, image.height, THREE.RedFormat, THREE.HalfFloatType);
    this.depthTex.minFilter = THREE.LinearFilter;
    this.depthTex.magFilter = THREE.LinearFilter;
    this.depthTex.generateMipmaps = false;
    this.depthTex.needsUpdate = true;

    this.mat1.uniforms.uImage.value = this.imageTex;
    this.mat1.uniforms.uDepth.value = this.depthTex;
    this.mat1.uniforms.uImageSize.value.set(image.width, image.height);
    this.mat2.uniforms.uDepth.value = this.depthTex;
    this.mat2.uniforms.uImageSize.value.set(image.width, image.height);

    if (!this.running) {
      this.running = true;
      this.lastTime = 0;
      this.raf = requestAnimationFrame(this.animate);
    }
  }

  clearImage(): void {
    this.hasImage = false;
    this.running = false;
    cancelAnimationFrame(this.raf);
    const gl = this.renderer.getContext();
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  /** 动态调整选项（如控制条滑块），立即生效 */
  setOptions(partial: HologramOptions): void {
    // 关键：必须回写 this.options —— 动画循环里的视差目标(pointerStrength/idleSway/maxParallax)
    // 读的是 this.options，不更新的话滑块只改 uniform 不起作用。
    this.options = { ...this.options, ...partial };
    this.applyOptions(this.options);
  }

  /** 调试视图：normal 正常 / raw 原图直出 / depth 深度灰度 / uv uv映射 / img 恒等图片 / dep 恒等深度 / uvattr uv属性 / frag gl_FragCoord */
  setDebug(mode: 'normal' | 'raw' | 'depth' | 'uv' | 'img' | 'dep' | 'uvattr' | 'frag'): void {
    const map: Record<string, number> = {
      normal: 0,
      raw: 1,
      depth: 2,
      uv: 3,
      img: 4,
      dep: 5,
      uvattr: 6,
      frag: 7,
    };
    this.mat1.uniforms.uDebug.value = map[mode] ?? 0;
    // 非 normal 时 pass2 跳过叠加，便于直读 pass1 结果
    this.mat2.uniforms.uDebugFlat.value = mode === 'normal' ? 0 : 1;
  }

  dispose(): void {
    this.clearImage();
    this.unbindInput();
    this.disposeResize();
    this.quad.dispose();
    this.mat1.dispose();
    this.mat2.dispose();
    if (this.imageTex) this.imageTex.dispose();
    if (this.depthTex) this.depthTex.dispose();
    if (this.rt) this.rt.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }

  // ---------- 渲染循环 ----------

  private readonly animate = (now: number): void => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.animate);

    if (this.lastTime === 0) this.lastTime = now;
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.elapsed += dt;
    const t = this.elapsed;

    // 目标视差 = 指针驱动 + 呼吸漂浮，再钳制
    const { pointerStrength, idleSway, maxParallax } = this.options;
    const px = (this.pointer.x - 0.5) * 2 * pointerStrength + Math.sin(t * 0.55) * idleSway;
    const py = (this.pointer.y - 0.5) * 2 * pointerStrength + Math.cos(t * 0.4) * idleSway * 0.7;
    const mag = Math.hypot(px, py);
    const scale = mag > maxParallax ? maxParallax / mag : 1;
    const tx = px * scale;
    const ty = py * scale;

    // 指数阻尼平滑
    const k = 1 - Math.exp(-dt * 5);
    this.currentParallax.x += (tx - this.currentParallax.x) * k;
    this.currentParallax.y += (ty - this.currentParallax.y) * k;

    this.mat1.uniforms.uParallax.value.set(this.currentParallax.x, this.currentParallax.y);
    this.mat2.uniforms.uTime.value = t;

    this.render();
  };

  private render(): void {
    if (!this.rt) return;
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(this.scene1, this.camera);
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene2, this.camera);
  }

  // ---------- 材质 ----------

  private makePomMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT_POM,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uImage: { value: null },
        uDepth: { value: null },
        uParallax: { value: new THREE.Vector2(0, 0) },
        uMaxShift: { value: 0.07 },
        uChroma: { value: 0.0035 },
        uCanvasSize: { value: new THREE.Vector2(1, 1) },
        uImageSize: { value: new THREE.Vector2(1, 1) },
        uMaxSteps: { value: 44 },
        uMinSteps: { value: 8 },
        uOpacity: { value: 0.92 },
        uDebug: { value: 0 },
      },
    });
  }

  private makeCompositeMaterial(): THREE.ShaderMaterial {
    return new THREE.ShaderMaterial({
      vertexShader: VERTEX,
      fragmentShader: FRAGMENT_COMPOSITE,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        uScene: { value: null },
        uDepth: { value: null },
        uCanvasSize: { value: new THREE.Vector2(1, 1) },
        uImageSize: { value: new THREE.Vector2(1, 1) },
        uTime: { value: 0 },
        uScanline: { value: 0.18 },
        uNoise: { value: 0.05 },
        uVignette: { value: 0.45 },
        uGlow: { value: 0.65 },
        uSaturation: { value: 1 },
        uTemperature: { value: 0 },
        uBrightness: { value: 0 },
        uHue: { value: 0 },
        uDebugFlat: { value: 0 },
      },
    });
  }

  private applyOptions(o: Required<HologramOptions>): void {
    this.mat1.uniforms.uMaxShift.value = o.maxParallax;
    this.mat1.uniforms.uChroma.value = o.chroma;
    this.mat1.uniforms.uOpacity.value = o.opacity;
    this.mat2.uniforms.uScanline.value = o.scanline;
    this.mat2.uniforms.uNoise.value = o.noise;
    this.mat2.uniforms.uVignette.value = o.vignette;
    this.mat2.uniforms.uGlow.value = o.glow;
    this.mat2.uniforms.uSaturation.value = o.saturation;
    this.mat2.uniforms.uTemperature.value = o.temperature;
    this.mat2.uniforms.uBrightness.value = o.brightness;
    this.mat2.uniforms.uHue.value = o.hue;

    const { steps } = this.stepsForQuality(o.quality);
    this.mat1.uniforms.uMaxSteps.value = steps;
  }

  /** 各档位的 POM 步数（POM 是主要开销） */
  private stepsForQuality(q: Quality): { steps: number; scale: number } {
    switch (q) {
      case 'high':
        return { steps: 48, scale: 1 };
      case 'balanced':
        return { steps: 40, scale: 0.75 };
      case 'mobile':
        return { steps: 26, scale: 0.5 };
      default:
        // auto：按画布尺寸自动，目标内部分辨率约 1024
        return { steps: 44, scale: 1 };
    }
  }

  // ---------- 尺寸 ----------

  private bindResize(): void {
    const el = this.canvas;
    const update = () => this.resize();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(update);
      this.resizeObserver.observe(el);
    } else {
      window.addEventListener('resize', update);
    }
    this.disposeResize = () => {
      this.resizeObserver?.disconnect();
      window.removeEventListener('resize', update);
    };
    this.resize();
  }

  private resize(): void {
    const el = this.canvas;
    const clientW = el.clientWidth || 1;
    const clientH = el.clientHeight || 1;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(clientW, clientH, false);

    const bufW = Math.round(clientW * dpr);
    const bufH = Math.round(clientH * dpr);

    // 内部渲染分辨率：按档位缩放，并封顶 2048
    let scale = this.options.quality === 'auto'
      ? Math.max(0.5, Math.min(1, 1024 / Math.max(bufW, bufH)))
      : this.stepsForQuality(this.options.quality).scale;
    scale = Math.min(scale, 2048 / Math.max(bufW, bufH, 1));
    const rw = Math.max(1, Math.round(bufW * scale));
    const rh = Math.max(1, Math.round(bufH * scale));

    if (this.rt && this.rt.width === rw && this.rt.height === rh) {
      // 尺寸未变，仅更新 uniform
      this.mat1.uniforms.uCanvasSize.value.set(rw, rh);
      this.mat2.uniforms.uCanvasSize.value.set(bufW, bufH);
      return;
    }
    if (this.rt) this.rt.dispose();
    this.rt = new THREE.WebGLRenderTarget(rw, rh, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: false,
      stencilBuffer: false,
    });
    this.mat1.uniforms.uCanvasSize.value.set(rw, rh);
    this.mat2.uniforms.uCanvasSize.value.set(bufW, bufH);
    this.mat2.uniforms.uScene.value = this.rt.texture;
  }

  // ---------- 输入 ----------

  private onPointerMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = rect.width > 0 ? (e.clientX - rect.left) / rect.width : 0.5;
    this.pointer.y = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5;
  };

  private onPointerLeave = (): void => {
    this.pointer.x = 0.5;
    this.pointer.y = 0.5;
  };

  private bindInput(): void {
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerleave', this.onPointerLeave);
  }

  private unbindInput(): void {
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerleave', this.onPointerLeave);
  }
}
