# 代码审查报告

> **审查日期**：2026-08-06
> **审查范围**：`azusa_front`（Vue 3 `<script setup>` + TypeScript + Vite + vue-router + Element Plus + Pinia + Markdown 渲染博客，GitHub Pages 部署），共 22 个源文件
> **审查方法**：全部 22 个文件逐一通读 + 对每个可疑点实际验证（`grep` 交叉引用、`public/article` 目录比对、`dist` 构建产物比对）

按严重程度排序（高 / 中 / 低），并覆盖六个维度：冗余与重复、僵尸代码、性能隐患、可读性与可维护性、健壮性、职责边界。

---

## 一、高优先级（影响功能或渲染正确性）

### 1. [BUG] `mdViewer.vue:32` 的 `$...$` 正则会误伤代码块

```ts
.replace(/\$\$(.*?)\$\$/gs, ...)   // 块公式
.replace(/\$(.*?)\$/g, ...)        // 行内公式
```

**问题**：公式转换跑在 **markdown 转 HTML 之前**，此时无法区分「数学公式里的 `$`」和「代码块 / 行内代码里的 `$`」。抽查 `public/article/md/`，多篇文档的代码/文本里含 `$`，`\$(.*?)\$` 会把中间内容当公式 base64 后交给 KaTeX 渲染——结果要么不渲染，要么整段错乱。

**严重度**：高。会造成部分内容丢失/错乱，且是"文章越多越容易触发"的隐性 bug。

**建议**：改用成熟方案。`marked` 的 `extensions` 或 `marked-katex-extension`，或至少用 marked 的 renderer 扩展只处理不在代码块内的 `$`（解析 token 流而非原始字符串）。这是最值得优先修的一项。

### 2. [BUG] `mdViewer.vue` 的处理顺序：`generate_h_id` 在 `katex2html` **之后**运行

**问题**：`onMounted` 中顺序是 `md2katex → md2html → fixImagePaths → katex2html → generate_h_id`。标题内的 `$` 公式在 `md2katex` 阶段被替换成 `{{katex_inline:...}}` 占位符，随后被 `katex2html` 还原成 HTML 塞进 `h1` 的 `innerHTML`，`generate_h_id` 再用正则 `<h[1-6]>` 去匹配——能出结果但整条管线是"正则套正则、占位符串占位符"，任何一个 md 里出现字面 `{{katex_block:...}}` 都会崩。

**附带问题**：`Buffer` 出现在渲染管线里，是浏览器里 `import {Buffer} from 'buffer'` polyfill，白白增加约 100KB 包体——用 `encodeURIComponent` / `btoa` 即可。

**建议**：用 marked 的扩展机制在 token 级别一次性完成「公式渲染 + 标题 id 生成 + 图片路径修复 + 代码高亮」，替换这四步字符串魔改。

### 3. [BUG] 路径拼接硬编码，与目录结构耦合脆弱

- `misc_pdf.vue:44` 写死 `'/article/pdf/' + pdfPath + '.pdf'`
- `mdViewer.vue:60` 写死 `${BASE_URL}article/assets/...`

**问题**：目前与 `public/article/` 目录能对上，但拼接逻辑（如 `path.replace(/^\//, '')` 配合 `BASE_URL`）很脆，将来部署到非 `/blog/` 的路径就会断。属于可维护性问题，建议在架构层面统一（见 #15）。

---

## 二、中优先级（性能与健壮性）

### 4. [内存泄漏 / 功能 bug] `Article/index.vue:15-22` 只在 `onMounted` 读一次路由参数

```ts
onMounted(async () => {
  const category = route.params.category;
  const name = route.params.name;
  fileName.value = `${category}/${name}`;
});
```

**问题**：文章详情页从 `/article/AI/强化学习` 切换到 `/article/AI/扩散模型` 时，**路由复用同一组件实例，`onMounted` 不会重新触发**，页面不刷新内容。用户必须整页刷新才能看下一篇文章。

**严重度**：中~高（交互层面确凿的 bug）。

**建议**：`fileName` 直接由 `route` 派生（`computed`），或 `watch(() => route.params, ...)`。同理 `mdViewer.vue` 的 `onMounted` 只加载一次，文件切换时内容不更新——两个组件要一起改。

### 5. [健壮性] `mdViewer.vue:104` `axios.get` 无错误处理

md 文件 404 时没有 try/catch，控制台报错且页面永远空白；也没有 loading 态。建议至少包裹 `try/catch` + 错误提示。

### 6. [冗余/性能] `BlogPage.vue` 把「完整 HTML 内容」作为 prop 传给 `OutlineGenerator`

**问题**：`updateContent` 把 `mdViewer` 渲染出的**整篇 HTML 字符串**赋给 `content`，再传给 `OutlineGenerator`，后者在 `computed` 里用正则重新解析标题。一份内容被 `DOMParser` + 正则反复解析，且每次路由切换都全量重建——"为了传 20 个标题，传了 200KB HTML"。

**建议**：`mdViewer` 里解析标题后直接通过事件把 `{text, level, id}[]` 数组抛给父组件，不要传整段 HTML。

### 7. [健壮性] `OutlineGenerator` 的滚动定位用 `includes` 匹配文本

`OutlineGenerator.vue:116-131` 遍历所有 h1-h6，用 `element.textContent.includes(content)` 找目标：

- 重复标题（两节都叫"总结"）会滚动到**第一个**，而非点击的那一个；
- 标题文本相似（"机器学习" 和 "机器学习实践"）时 `includes` 互相命中。

既然 `mdViewer` 已经给每个标题生成了唯一 `id`，大纲可以直接 `document.getElementById(id)` 定位，绕开文本匹配。

---

## 三、僵尸代码 / 死代码

### 8. [高] `mdComment.vue` 整个组件是空壳

`textarea` 绑定 `comment`，placeholder 自述"该功能的后端还没写。。发不了评论"，无提交逻辑，`comment` ref 从未被读取。首页每个文章页都会渲染这个空评论框。**删除或标注为 TODO 占位**。

### 9. [高] `HelloWorld.vue` 完全未使用

任何文件都没 `import` 它（已 `grep` 验证）。Vite 脚手架残留。**删除**。

### 10. [中] `mdViewer.vue:26` `headings` 对象写入后从未被读取

`generate_h_id` 往 `headings[id] = ...` 写，但全文没有任何地方读它。若标题 id 生成依赖它，应直接在 `mdViewer` 内部用；否则删掉。

### 11. [中] `misc_md.vue` 与 `misc_pdf.vue` 结构重复、文章列表与注册表不一致

- 两文件是同一套"按钮列表跳转"代码，可抽一个公共 `ArticleChoiceList` 组件；
- `misc_md.vue` 硬编码 6 篇文章，而 `articles.ts` 注册表 AI 分类有 10 篇、Others 有 5 篇——**两个地方维护文章清单必然不一致**；
- 首页 `blogpost.vue` 又硬编码了一组带"论文阅读"的列表，而 `articles.ts` 注册表里没有"论文阅读"。数据源分散，建议以 `articles.ts` 为唯一数据源，所有列表由它派生。

### 12. [低] 多处注释死块

- `OutlineGenerator.vue:25-68`：三份被注释掉的旧 `computed` 实现（约 40 行）；
- `misc_pdf.vue:27-37`：注释掉的旧 `navigateToPDF`；
- `BlogPage.vue:55-57`、`main.ts:9`、`style.css:14-92`：注释掉的调试/脚手架代码；
- `router/index.js:26` `console.log(routes)`、`router/index.js:27` `console.log(import.meta.env.BASE_URL)`：遗留日志，应删。

### 13. [低] `router/index.js` 中 `ArticleChoice` 非懒加载、代码风格不统一

- `misc.vue`（含两个子组件）是静态 import，其他页面都是动态 import；
- `router/index.js` 是 JS（`allowJs` 开着），其他是 TS；引号/分号不统一；
- `tsconfig.json` 里 `noUnusedLocals` / `noUnusedParameters` 被**显式关闭**（注释说"生命周期钩子可能不被使用"——这是误解，这俩选项不影响生命周期钩子，只是抓未用变量）。建议重新打开，能直接抓出 #10、#11 这类死代码。

### 14. [低] 未使用的依赖

- `remixicon`、`element-plus`、`pinia`：全项目未 import（已 `grep` 验证）；
- 唯一图标 `xminfo.vue:11` 是 `<i class="fab fa-github">`，`fab` 是 FontAwesome 类名，**remixicon 也渲染不出它**——这个图标实际上啥也不显示。删依赖或换成 remixicon 的 `ri-github-fill`；
- `misc_md.vue:16,19` 的 `useRouter` 已用，但 `misc.vue:11` 的 `useRouter` import 未被使用。

---

## 四、可读性 / 职责边界 / 架构

### 15. [中] 组件职责混乱：文章详情页组件层级太绕

数据流：`Article/index.vue` 读路由 → `BlogPage.vue` 拼 `displayName` + 等 `contentLoaded` 事件 → `mdViewer.vue` 内部 `axios` 拉 md → 四步字符串管线渲染 → emit 整篇 HTML → `BlogPage` → `OutlineGenerator` 再解析。中间层 `BlogPage` 只做了传话（`updateContent` + 一个 `contentReady` flag）。

**建议**：
- 合并职责：`mdViewer` 直接暴露内容（标题数组 + HTML），`BlogPage` 里两个子组件共享；或 `Article/index.vue` 直接管这些；
- `BlogPage` 里 `watch(fileName)` 拆 `displayName` 属过度设计——`fileName` 是路由给的，直接用 `fileName.split('/').pop()` 即可；
- `/article/` 前缀建议收敛成一个 `src/utils/paths.ts` 集中管理。

### 16. [中] 路由与目录结构散乱

`views/Article/` 下有 `index.vue`（详情页）+ `misc.vue`（选择页）+ `misc_md.vue` + `misc_pdf.vue`（子组件），子组件和页面同级混放；`components/` 下又有 `BlogPage.vue`（页面级容器）。建议 `views/` 只放路由级页面，子组件下沉 `components/` 或对应目录。`router/index.js` 是 `.js` 而项目标称 TS，可统一成 `.ts`。

### 17. [低] `articles.ts` 与 `blogpost.vue` 的封面图片数据源重复

首页封面列表（`blogpost.vue` 8 条硬编码 `{标题, 封面图, 跳转}`）与 `articles.ts` 注册表重复。图在 `public/article/cover/` 下，文件名与文章名不完全一致（`深度学习.jpeg` vs `深度学习实践.jpg`），导致封面没法自动派生。建议注册表条目带上 `cover` 字段（缺省时用 `cover/<文章名>.jpg` 兜底），首页、文章选择页都从注册表派生，删掉两处硬编码列表。

### 18. [低] 命名/一致性

- 组件名混用：`mdComment.vue`、`mdViewer.vue`、`OutlineGenerator.vue`（PascalCase）与 `BlogPage.vue:11,14` 的别名 `MarkdownViewer` / `MarkdownComment` 混用。组件文件统一 `MarkdownViewer.vue` / `MarkdownComment.vue` 即可；
- `md2katex` / `md2html` / `katex2html` / `generate_h_id`（snake_case + 缩写）与项目其他 camelCase 不一致；
- `generateUniqueId` 用 `_${i}` 后缀但 `i` 只在调用处递增——`mdViewer.vue:112` 传 `let i = 0`，`generate_h_id` 内部 `i++` 是**局部自增，没用**（每次替换 id 都叫 `xxx_0`，唯一性依赖标题文本本身）。

---

## 五、性能专项小结

- ✅ **没有**大数据量 `v-for`（最大列表是 `misc_md` 的 6 项）；
- ✅ **没有**在模板/`computed` 里反复创建新对象导致子组件无谓重绘（`headers` computed 在 `props.content` 不变时只算一次）；
- ⚠️ **有一处真实的功能性内存泄漏**：见 #4——组件实例因路由复用而不更新，`onMounted` 里的 `axios` 请求与 `BlogPage` 的整篇 HTML 状态在切换文章时**不会重置**，旧内容残留；
- ⚠️ `katex` + `highlight.js` + `buffer` polyfill 全量打进首包（详情页是懒加载的，只有详情页才需要），首页不需要 KaTeX。当前架构下影响有限，列低优先级；
- ⚠️ `mdViewer` 的 `tempDiv` 每篇 `md2html` / `fixArticleImagePaths` 各建一个 DOM 容器，内容大时是双份全量 DOM，可随 token 级重构一起优化。

---

## 六、修复优先级建议

| 优先级 | 事项 | 涉及文件 |
|---|---|---|
| 1（必修，功能 bug） | 公式正则误伤代码块；文章切换不刷新 | `mdViewer.vue`、`Article/index.vue` |
| 2 | 删除空壳组件 + 未用文件（评论框、HelloWorld、死代码注释块） | `mdComment.vue`、`HelloWorld.vue` |
| 3 | 以 `articles.ts` 为唯一文章数据源，删 `misc_md` / `blogpost` 硬编码列表；抽公共选择列表组件 | `misc_md.vue`、`blogpost.vue`、`misc.vue` |
| 4 | `mdViewer` 重构：marked token 级管线，事件只传标题数组 | `mdViewer.vue`、`BlogPage.vue`、`OutlineGenerator.vue` |
| 5 | 清理未用依赖、统一命名/风格、重开 `noUnusedLocals` | `package.json`、`tsconfig.json`、各文件 |
