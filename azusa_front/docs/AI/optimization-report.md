# azusa_front 代码优化报告

> 依据 `docs/AI/review.md` 的审查标准（正确性、可维护性、性能、可读性、模块化、可测试性、向后兼容性）对 `src/` 全部源码、构建脚本与 Vite 配置进行审查后汇总。
>
> 审查日期：2026-09-30

## 总体评价

项目整体质量较好：Markdown 渲染管线分层清晰（生成时索引 / 标题索引 / 正文索引三层分离合理）；`mdViewer` 的 `loadId`、`MarkdownWordCount` 的 `requestId` 有正确的竞态防护；`ArticleNav`、`BackToTopButton`、qr-decoder 的事件监听 / rAF / `URL.revokeObjectURL` 清理规范；`HologramRenderer` 的 dispose 路径完整（geometry / material / texture / RT / renderer / RAF / ResizeObserver 均有清理）；深度服务有 WebGPU→WASM 双级回退。

主要问题集中在四类：**异步竞态防护不一致**（多处缺失）、**渲染管线未做 HTML 消毒**、**重复实现散落各处**（复制逻辑、占位符哨兵、背景 CSS）、**构建脚本与打包策略的隐患**（二进制损坏风险、three.js 未真正懒加载）。

---

## 一、高优先级问题（建议立即修复）

### 1.1 Markdown 渲染未消毒，存在 XSS 面

- **位置**：`src/components/mdViewer.vue:2, 79-114, 129`
- **问题**：渲染管线为 `marked(md)` → `tempDiv.innerHTML` → `v-html`，全程无 DOMPurify 消毒。marked 默认原样透传内联 HTML（`<img onerror=...>`、`<iframe>`）；同时 mermaid 配置 `securityLevel: 'loose'`，允许图表内嵌 HTML 与 click 回调，进一步扩大注入面。当前文章为仓库自带静态文件，实际可利用性低，但内容来源一旦变化（用户投稿、外部源）即成真实漏洞。
- **建议**：`md2html` 输出后用 DOMPurify 消毒（白名单保留 katex/mermaid 所需标签与 `data-*` 属性）；mermaid 改为 `securityLevel: 'strict'`（或至少 `'sandbox'`）。

### 1.2 多处异步竞态：旧结果可覆盖新结果

同一项目内 `mdViewer.vue:400-418`、`MarkdownWordCount.vue:19-31` 已有序号防竞态，但以下位置缺失，防御不一致：

| 位置 | 场景 |
| --- | --- |
| `src/components/GlobalSearch.vue:101-116` | `clearTimeout` 只能取消未触发的定时器；已发出的 `await searchContent(q)` 仍在飞，旧查询后 resolve 会覆盖新查询结果，并把 `loading` 错误置回 `false` |
| `src/views/Tool/tools/daily/qr-decoder.vue:129-161` | `isDecoding` 只禁用按钮，粘贴/拖拽/文件选择仍可并发触发 `processImage`，ZXing 回退路径耗时长，先返回的结果可能覆盖后选图片的结果 |
| `src/views/Luotianyi/sections/HolographicSection.vue:360-412` | 推理进行中可再次上传/拖拽/重试，两个 `estimateDepth`（WASM 下数秒至数十秒）并发，后完成者覆盖先完成者，用户可能看到旧图覆盖新图 |

- **建议**：统一采用递增请求序号（或 AbortController 语义），回调时校验序号最新且查询词未变再写入结果。

### 1.3 部署脚本可能损坏二进制产物

- **位置**：`scripts/strip-gh-false-positive.mjs:28-39`
- **问题**：注释 "catch → binary file" 是错的：`readFileSync(file, 'utf8')` 对二进制文件**不会抛错**，而是将非法字节解码为 U+FFFD。若图片 / wasm / 字体字节流中恰好含目标 32 位 hex 串，`content.includes(TARGET)` 命中后 `writeFileSync` 会把整个文件以 UTF-8 重编码写回，**破坏所有非 UTF-8 字节**，产物静默损坏。
- **建议**：只处理 `.js/.html/.css/.map/.json` 等文本扩展名；或按 Buffer 读入、用字节级替换。

### 1.4 洛天依页切换标签销毁全息组件，WebGL context 反复创建/销毁

- **位置**：`src/views/Luotianyi/index.vue:25` + `src/views/Luotianyi/sections/HolographicSection.vue:230-235`
- **问题**：`<component :is>` 未包 `<KeepAlive>`，每次切换 tab 都卸载 HolographicSection：`dispose()` 触发 `forceContextLoss()`（`HologramRenderer.ts:477`），用户已加载的图片与 9 项调节参数全部丢失；反复创建/销毁 WebGL context 在部分浏览器会触发 "too many contexts" 警告。
- **建议**：`<component :is>` 外包 `<KeepAlive>`（可配 `include` 只缓存 HolographicSection），或把 renderer 生命周期提升到路由级。

### 1.5 three.js 未真正懒加载

- **位置**：`src/views/Luotianyi/lty.config.ts:7` → `HolographicSection.vue:164` → `HologramRenderer.ts:14`
- **问题**：`depthService.ts:13` 注释声称"本模块被 `import()` 时才拉取 three/transformers"，但实际上 three（约 600KB）通过静态 import 链被打进 /lty 路由 chunk，打开路由即加载，即使用户从不点开"全息"标签。
- **建议**：`lty.config.ts` 中对 HolographicSection 使用 `defineAsyncComponent(() => import(...))`；修正 depthService 的注释。

### 1.6 正文搜索匹配阶段重复小写化，性能浪费

- **位置**：`src/content-search.ts:100` → `src/utils/searchMatch.ts:64-66`；`src/search-index.ts:77` → `searchMatch.ts:29`
- **问题**：`scoreBody` 每次执行 `body.toLowerCase()`，索引约 220KB，每次 debounced 搜索对全部小节正文重新分配小写副本；`makeSnippet`（`content-search.ts:59-68`）再重复 `replace + toLowerCase`。标题索引侧同理。
- **建议**：索引加载/构建时一次性预存小写化文本（`bodiesLower`、`keywordsLower`），匹配阶段零分配。

### 1.7 text-processor 大文本性能与占位符数据损坏

- **位置**：`src/views/Tool/tools/text/text-processor.vue`
- **问题**：
  - **性能（212, 292, 342-374 行）**：`replaceOutput`（6 条全局正则管线）、`analyzeText`、三个 `logicalLines.split` 随每次按键同步重算；`measureEditor` 对测量容器**逐个子节点 `getBoundingClientRect()`**，每次调用强制同步布局（layout thrashing），几千行文本即几千次重排。计算无防抖、无规模上限。
  - **正确性（167-184, 200-207 行）**：`~!~CB~!~0~!~` 等固定占位符若与原文冲突，恢复阶段会把原文误替换为代码块/公式内容，造成数据损坏。同类问题见 `mdViewer.vue:56-63` 的 `~!~CB~!~` / `~!~IC~!~` 哨兵。
- **建议**：派生计算加 150–300ms 防抖；行号测量改为 `scrollHeight / lineHeight` 估算或仅测可视区域；超大文本设阈值降级；占位符混入随机串（如 `crypto.randomUUID()`）或恢复前校验原文不含哨兵前缀。

### 1.8 同一 Markdown 源被三个组件各自重复请求

- **位置**：`src/components/mdViewer.vue:407`、`src/components/markdown/MarkdownCopyButton.vue:32`、`src/components/markdown/MarkdownWordCount.vue:24`
- **问题**：打开一篇文章发出 3 次相同的 `axios.get(resolveMarkdownSource(source))`（正文渲染、复制全文、字数统计），`MarkdownCopyButton` 每次点击还会再请求一次。HTTP 缓存能缓解但不是保证。
- **建议**：新增带缓存的 `fetchMarkdown(source)`（`Map<url, Promise<string>>`），三处共用。

### 1.9 color-converter 小数 RGB 生成非法 Hex

- **位置**：`src/views/Tool/tools/daily/color-converter.vue:76-81, 97-100`
- **问题**：`conv()` 用 `parseFloat` 解析（正则允许 `102.5`），校验只查 NaN 和 0–255 范围，未取整。`toHex(102.5)` 得到 `"66.8"`，输出 `#66.80000` 之类的非法颜色值。
- **建议**：解析后对 r/g/b `Math.round`（或拒绝小数输入）。

---

## 二、中优先级问题

### 2.1 正确性

| # | 位置 | 问题 | 建议 |
| --- | --- | --- | --- |
| 1 | `src/router/index.js:53-55` | `scrollBehavior` 无条件返回 `{ top: 0 }`，丢弃 `savedPosition`，浏览器前进/后退丢失列表滚动位置 | `return savedPosition ?? { top: 0 }` |
| 2 | `src/components/mdViewer.vue:67` | 行内公式正则 `/\$([^$\n]+)\$/g` 会把 "价格在 $100 到 $200 之间" 误判为公式 | 采用 Pandoc 规则：开 `$` 后非空白、闭 `$` 前非空白且后不接数字 |
| 3 | `src/components/mdViewer.vue:268-293` | `autoNumberHeadings` 对部分已编号文章编号错乱（跳过已编号标题但不同步计数器，出现两个 "1."） | 解析已有序号同步到 `counters[level]` 再清零下级 |
| 4 | `src/components/mdViewer.vue:117, 123, 337` | `mermaidRenderId`、`mermaidTexts`、`mdConverter`、`headingSeq` 为模块级可变状态，多实例并存时 A 文章的选区复制会还原出 B 文章的图表源码 | 移入组件实例或用 WeakMap 按实例隔离 |
| 5 | `src/views/Tool/tools/coding/format.vue:57-76, 109` | computed 内写副作用（修改 `error`），且与 watch 清错逻辑重复（watch 实为死代码） | `error` 并入 computed 返回值 `{ text, error }`，或改用 watch 驱动 |
| 6 | `src/views/Tool/tools/coding/format.vue:68` | YAML「压缩」模式输出的是 JSON，语义错误 | 用 flow 格式 YAML，或按钮改名为「转 JSON」 |
| 7 | `src/views/Tool/tools/coding/format.vue:79-106` | 自制 HTML 格式化/压缩破坏 `<pre>`、`<script>`、`<style>` 内容，去注释会误删 IE 条件注释 | 对 `pre/script/style/textarea` 内容做原样保护，或引入 js-beautify |
| 8 | `src/components/ArticleNav.vue:152` | `HOME_SPLASH_H = window.innerHeight` 在 setup 时一次性捕获，窗口 resize / 手机旋转后吸顶阈值失效 | `updateNavState` 内实时读取或监听 resize |
| 9 | `src/views/Luotianyi/components/hologram/HologramRenderer.ts:442-447` | `setOptions` 修改 quality 不重建 RenderTarget，档位缩放不生效（`scale` 被解构丢弃，直到下一次窗口 resize） | quality 变化时主动 `resize()` |
| 10 | `src/views/Luotianyi/components/hologram/HologramRenderer.ts:59-74, 533-539` | 渲染参数默认值双写且不一致（`maxParallax: 0.1` vs `uMaxShift: 0.07` 等），靠构造函数末尾 `applyOptions` 覆盖才"碰巧正确"；`MAX_CHROMA` 是第三处硬编码 | uniform 直接从 `DEFAULTS` 取值，`MAX_CHROMA` 单一来源导出 |
| 11 | `src/views/Luotianyi/components/hologram/depthService.ts:90-100` | pipeline 的 `progress_callback` 固化为首次调用者的闭包，后续调用方的进度回调不被调用 | 模块内维护 `currentProgress` 可变引用统一转发 |
| 12 | `src/utils/clipboard.ts:15-29` | `fallbackCopy` 忽略 `execCommand` 返回值，失败也报成功；iOS Safari 兼容性不足 | 返回 `execCommand` 结果，补 focus/选区处理 |
| 13 | `scripts/generate-articles.mjs:26-38` | 封面匹配大小写不一致：`scanCovers` 大小写不敏感收集，`coverFor` 小写精确匹配，`.JPG` 文件静默落到默认封面 | 预建 lowercase→原名映射 |

### 2.2 资源泄漏与生命周期

| # | 位置 | 问题 | 建议 |
| --- | --- | --- | --- |
| 1 | `src/components/GlobalSearch.vue:174-191` | 滚动定位的递归 `setTimeout` 轮询（最多 5 秒）不可取消，`close()` / 连续跳转 / 组件卸载后仍空转并对新页面 DOM 执行 `scrollIntoView` | 保存 timer id，在 `close()` / `onBeforeUnmount` 清理 |
| 2 | `src/views/Luotianyi/components/hologram/HologramRenderer.ts:361-369` | 未监听 `webglcontextlost`，context 丢失后 RAF 空转黑屏，无恢复/提示 | 注册 lost/restored 监听，lost 时停止循环并通知调用方 |
| 3 | `src/views/Luotianyi/components/hologram/HologramRenderer.ts:482-510` | 动画循环无条件每帧两遍全量渲染（POM 光线步进最多 48 步），画布滚出视口仍持续消耗 GPU | IntersectionObserver 离屏暂停；或 `idleSway: 0` 时 dirty-flag 按需渲染 |
| 4 | `src/views/Luotianyi/sections/HolographicSection.vue:452, 469` | `createImageBitmap` 不可用时同一图片 `loadImg` 两次（两次 objectURL + 两次解码） | 复用第一次加载的 `img` |
| 5 | `src/components/mdViewer.vue:422-427` | 文章加载失败仅 `console.error` 并置空内容，用户看到空白页无任何提示 | 渲染用户可见的错误提示或向上 emit 错误事件 |

### 2.3 重复逻辑与模块化

| # | 位置 | 问题 | 建议 |
| --- | --- | --- | --- |
| 1 | 5 个工具文件（review-template.vue:89-94、color-converter.vue:107-119、format.vue:111-118、qr-decoder.vue:223-232、text-processor.vue:215-222） | 「copyText → 置 true → setTimeout(1500) 置回」复制反馈逻辑重复 5 份，且连续快速点击时前一次的 timer 会提前复位后一次的状态 | 抽 `useCopyFeedback()` composable（内部保存 timer 句柄，重复触发先 clearTimeout），顺带收敛魔法数字 1500 |
| 2 | `src/components/mdViewer.vue:154-176` vs `src/utils/clipboard.ts` | 剪贴板复制逻辑重复实现且行为不一致（util 版返回 boolean，组件内版无返回值） | 删除组件内实现，统一 import util |
| 3 | `src/views/Tool/tools/text/text-processor.vue`（665 行） | 单文件职责过多（替换管线、去换行、字数统计、自研行号测量引擎）；模板中三个「行号 + textarea + 测量器」块几乎完全重复 | 抽 `LinedTextarea.vue` 子组件（模板量减约 2/3）；正则管线抽为 `utils/` 纯函数以便单元测试 |
| 4 | `src/components/OutlineGenerator.vue:26` 依赖 `mdViewer.vue:243-252` | 大纲用正则反向解析另一组件拼出的 HTML 字符串，输出格式任何微调都会静默弄坏大纲 | `mdViewer` 解析阶段产出结构化 `headings[]` 通过 `contentLoaded` 事件一并 emit |
| 5 | `src/utils/searchMatch.ts:51-74` | `scoreTitle`/`scoreBody` 逐行重复（仅评分常量不同），`matchesQuery` 是第三份拷贝 | 抽 `scoreText(text, query, weights)` 私有函数 |
| 6 | list.vue:20-22、misc.vue:24-26、Tool/index.vue:46-48、detail.vue:50-52 | 同一段三行渐变背景 CSS 逐字复制 4 次；`page-title`/`page-sub` 样式也重复；全部使用 `-webkit-` 前缀写法无标准语法兜底 | 抽全局样式 / CSS 变量；补标准 `radial-gradient` 语法 |
| 7 | `src/views/Luotianyi/sections/HolographicSection.vue:253-270` | 视差映射系数（1.15、0.02、0.1、1.2、0.3）散落在 UI 组件中，与渲染器语义强耦合（`uMaxShift` 钳制必须略大于 `pointerStrength`）却无注释 | 收敛为具名配置 `holoControls.config.ts` |

### 2.4 构建与工程化

| # | 位置 | 问题 | 建议 |
| --- | --- | --- | --- |
| 1 | `vite.config.ts:13-69` | 自定义 public 复制插件与 `mode === 'production'` 强耦合，非 production 构建（如 `--mode staging`）时 Vite 自带复制与插件手动复制同时生效，public 资源被 emit 两次；递归 `readFileSync` 对大资源不友好 | 以 `config.publicDir === false`（`configResolved` 钩子）判断是否启用手动复制 |
| 2 | `src/router/index.js` | 全项目唯一 .js 文件，路由表失去类型检查 | 改为 `index.ts`，routes 标注 `RouteRecordRaw[]` |
| 3 | `src/articles.ts:67, 75`、`src/content-search.ts:92`、`scripts/generate-articles.mjs` | 文章路径未做 URL 编码，生成脚本对文件名零校验；含 `/`、`#`、`?`、`%` 的文件名会导致路由与索引拆分静默错乱 | 生成脚本加白名单校验（`/^[^\/#?%]+$/`），或拼接处统一 `encodeURIComponent` |
| 4 | `src/content-search.ts:124-130` | 正文搜索只有每篇上限无总量上限，默认 20 × N 篇可返回数百条 | 增加 `limit` 总量参数 |
| 5 | `src/views/Tool/detail.vue:58` | 右侧留白 10% 小于固定导航栏宽 14%（其它页面均为 16%），窄视口下工具卡片右缘被导航压住 | 统一为 16% 或抽公共布局常量 |

---

## 三、低优先级问题

### 3.1 正确性 / 边界情况

- `src/views/Luotianyi/sections/HolographicSection.vue:57, 646-649`：粒子 `--po` CSS 变量从未设置，动画覆盖内联 opacity，`particles` 配置里的 `opacity` 字段是死代码。改为内联绑定 `'--po': p.opacity`。
- `src/views/Luotianyi/sections/HolographicSection.vue:508-515`：`resetStage` 不释放图像/深度纹理（1536² 半浮点纹理约 13MB+），"返回"后仍占 GPU 内存。`clearImage()` 内同时 dispose 纹理。
- `src/components/markdown/BackToTopButton.vue:40-45` + `MarkdownDocumentPage.vue:24-27`：阅读进度环不随 lazy 图片加载后的高度变化更新。用 ResizeObserver 观察容器。
- `src/views/Article/index.vue:17-19`：`route.params` 未处理 `string | string[]` 数组类型（detail.vue:34-35 已处理，两文件风格不一致）。
- `src/components/GlobalSearch.vue:20`：搜索结果 `:key` 包含索引和 snippet，每次输入全量重建 DOM。key 只用稳定标识 `${item.type}-${item.path}-${item.sec}`。
- `src/components/OutlineGenerator.vue:42-49`：`decodeHtmlEntities` 每个标题新建一次 DOMParser。模块级复用单个解析元素。
- `src/utils/textStats.ts:57-59`：`spaces` 不含 Tab/全角空格；emoji 把 U+FE0F 变体选择符单独计数。改用 `/[ \t　]/g` 与 `\p{Extended_Pictographic}`。
- `scripts/generate-articles.mjs:73-76, 185-189`：围栏状态机对 ` ``` ` 与 `~~~` 混合围栏会误判。记录开场围栏字符，只在同字符时闭合。
- `src/views/Article/misc_pdf.vue:27-29`：扩展名先 `slice(0, -4)` 再拼回的无意义往返。

### 3.2 一致性 / 可维护性

- `src/views/Article/misc_pdf.vue:17-23`：PDF 列表硬编码 5 项，与 MD 文章 / 工具的自动注册机制不一致。用 `import.meta.glob` 自动发现。
- `src/components/BlogPost.vue:26-38`：首页硬编码 `articlesByCategory('AI')`，新增分类不上首页；`desc: a.name` 让描述与标题渲染两遍同样文字。
- `src/views/HomePage/welcome.vue:16`：用 `document.querySelector('.main-section')` 跨组件隐式耦合，class 重命名即静默失效。改用稳定锚点 id 或父组件 ref 编排。
- `src/views/Luotianyi/sections/SongPromotionSection.vue:2`：标题用英文 slug `song_promotion`，与其他板块中文标题不一致，直接暴露给用户。
- `src/views/Luotianyi/sections/HolographicSection.vue:526`：魔法数字 `164`（`calc(100dvh - 164px)`）与父级 padding 隐式耦合。提取为 CSS 自定义属性。
- `src/tools.ts:41` vs `search-index.ts:88`：两处 `localeCompare` 一处未指定 locale 一处指定 'zh'，排序口径不统一。
- `src/articles.ts:9` 与 `scripts/generate-articles.mjs:15`：`DEFAULT_COVER` 常量双写。单一来源（由生成文件输出）。
- `src/articles.ts:33-47`：`findCategory`/`coverFile` 每次 O(n) 线性扫描，列表渲染中形成 O(n²)。模块加载时预建 `Map`。
- `src/views/Luotianyi/index.vue:46-55`：font-face 注入的 DOM 副作用写在 setup 中。移到模块顶层或 `onMounted`。
- `mdViewer.vue:534`、`ArticleNav.vue:486`、`MarkdownDocumentPage.vue:207`：`</style>` 之后存在游离的字面 `\n` 字符，应删除。

### 3.3 错误处理 / 用户反馈

- `src/components/markdown/MarkdownCopyButton.vue:30-44`：每次点击重新发请求且 catch 完全静默，复制失败无任何反馈。
- `src/views/Tool/tools/daily/review-template.vue:89-95`：复制失败无反馈（qr-decoder 有，体验不一致）。
- `src/views/Tool/tools/daily/review-template.vue:40, 56-59`：仅拉一个静态 txt 却引入完整 axios，且未禁用 JSON 智能解析（内容恰好是合法 JSON 时会被解析成对象）。改用原生 `fetch().then(r => r.text())` 或 `responseType: 'text'`。
- `scripts/generate-articles.mjs:116-123` vs `218-232`：`headingsFor` 静默吞错返回 `[]`，`writeContentIndex` 对同一文件重复读取且错位时 throw，两种错误处理哲学并存。`headingsFor` 至少 `console.warn`；md 内容读一次传给两个提取函数。
- `src/components/mdViewer.vue:128-129`：`mermaid.initialize` 每次渲染重复调用（全局单例副作用）。模块级守卫只初始化一次。
- `src/components/mdViewer.vue:179-187`：`showCopied` 的 setTimeout 无句柄管理，连续点击叠加多个定时器。

### 3.4 性能 / 配置

- `src/views/Luotianyi/components/hologram/depthService.ts:57`：ONNX runtime 锁定 dev 每日构建版（`1.26.0-dev.20260416-b7804b056c`），CDN 稳定性弱，且"与 package-lock 保持一致"仅靠注释约束。换正式 release 或构建时注入版本。
- `src/views/Luotianyi/components/hologram/depthService.ts:216`：推理不可取消，组件卸载后 WASM 下数十秒的推理继续占用资源。
- `src/views/Luotianyi/components/hologram/depthService.ts:65-68`：模型与 runtime 常驻内存无卸载 API（可接受，建议注释说明是有意的进程级缓存）。
- `src/views/Luotianyi/components/hologram/HologramRenderer.ts:368`：`preserveDrawingBuffer: true` 生产环境常驻（注释自述仅为调试）。改为 `import.meta.env.DEV`。
- `src/views/Luotianyi/components/hologram/depthService.ts:289-313`：`boxBlur1D` 朴素窗口求和 + 每次调用分配两个全尺寸 Float32Array（约 9MB×2）。滑动窗口 + 复用 scratch buffer（优先级低）。
- `src/views/Tool/tools/daily/qr-decoder.vue:234`：`paste` 监听挂在 window 且无目标过滤。加 `event.target` 过滤或挂到 drop-zone 容器。
- `text-processor.vue:389`：watch 依赖冗余（`unwrapMode` 变化必然引起 `unwrapOutput` 变化），精简为 `watch(input, ...)`。
- `text-processor.vue:14, 26, 78, 90, 122, 134`：`v-for` 用数组 index 作 key。

---

## 四、建议的修复路线图

**第一批（安全 + 数据正确性，改动小、收益大）**

1. mdViewer 渲染管线接入 DOMPurify，mermaid 提至 `strict`（1.1）
2. 修复 `strip-gh-false-positive.mjs` 二进制损坏风险（1.3）
3. color-converter 小数取整（1.9）
4. 占位符哨兵随机化（text-processor + mdViewer）（1.7）
5. format.vue 的 computed 副作用与 YAML 压缩语义（2.1-5/6/7）

**第二批（竞态与生命周期，统一模式推广）**

6. GlobalSearch / qr-decoder / HolographicSection 统一请求序号防竞态（1.2）
7. `<KeepAlive>` 缓存 HolographicSection + three.js 真正懒加载（1.4、1.5）
8. `webglcontextlost` 监听、离屏暂停渲染、quality 切换重建 RT（2.2-2/3，2.1-9）
9. 滚动定位轮询定时器清理（2.2-1）

**第三批（性能与去重，结构性改善）**

10. 搜索索引预小写化 + `scoreText` 合并（1.6，2.3-5）
11. `fetchMarkdown` 共享缓存（1.8）
12. text-processor 拆分 `LinedTextarea.vue` + 正则管线抽纯函数 + 防抖（1.7，2.3-3）
13. `useCopyFeedback()` composable 收敛 5 处复制反馈（2.3-1）
14. 共享渐变背景样式、路由 TS 化、`savedPosition` 滚动恢复（2.3-6，2.4-2/1）

**第四批（低优先级打磨）**：第 3 节各项，可随相关文件改动顺带处理。

---

## 五、值得保留的良好实践

- `mdViewer` 的 `loadId` 双检查、`MarkdownWordCount` 的 `requestId`——竞态防护的正确范例，应向其他异步点推广。
- `ArticleNav` 与 `BackToTopButton` 的事件监听、rAF 清理（含 `cancelAnimationFrame`）。
- qr-decoder 的资源清理（`URL.revokeObjectURL`、`bitmap.close()`）、ZXing 动态 import、识别结果的 `http(s)` 协议白名单。
- mermaid 动态 import 按需加载；`onContentClick` 事件委托解决 v-html 重建 DOM 的监听器丢失。
- `HologramRenderer` 完整的 dispose 路径与每帧零分配的渲染循环。
- 深度服务的 WebGPU→WASM 双级回退、模型下载前的用户确认与进度反馈。
