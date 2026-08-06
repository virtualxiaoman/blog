<template>
  <div v-html="content" class="markdown-body" @click="onContentClick"></div>
</template>

<script setup lang="ts">
import {ref, watch} from 'vue';
import axios from 'axios';
import {marked} from 'marked';
import hljs from 'highlight.js/lib/common';
import "github-markdown-css";
import katex from 'katex';
import 'katex/dist/katex.min.css';
import {Buffer} from 'buffer';

const props = defineProps({
  fileName: {
    type: String,
    required: true,
  },
});
const emit = defineEmits(['contentLoaded']);


const content = ref('');
// 大纲的键是id，值是标题文本加上递增的i
const headings: Record<string, string> = {};

// 第一步，把markdown中的数学公式转换为base64编码。
// 先保护代码块（fenced code block）与行内代码——其中的 $ 是代码而不是公式，
// 替换完公式后再把代码原样还原，避免公式正则误伤代码内容。
function md2katex(md: string) {
  // 1. 保护 fenced code block，整块暂存，用哨兵占位
  const codeBlocks: string[] = [];
  let processed = md.replace(/```[\s\S]*?```/g, (block) => {
    codeBlocks.push(block);
    return `~!~CB~!~${codeBlocks.length - 1}~!~`;
  });
  // 2. 保护行内代码（fenced block 已被占位，不会被这里误匹配）
  const inlineCodes: string[] = [];
  processed = processed.replace(/`[^`\n]+`/g, (code) => {
    inlineCodes.push(code);
    return `~!~IC~!~${inlineCodes.length - 1}~!~`;
  });
  // 3. 替换公式（此时代码已被保护）
  processed = processed.replace(/\$\$([\s\S]+?)\$\$/g, (_, p1) => {
    return `{{katex_block:${Buffer.from(p1).toString('base64')}}}`;
  }).replace(/\$([^$\n]+)\$/g, (_, p1) => {
    return `{{katex_inline:${Buffer.from(p1).toString('base64')}}}`;
  });
  // 4. 还原行内代码与代码块
  processed = processed.replace(/~!~IC~!~(\d+)~!~/g, (_, i) => inlineCodes[+i]);
  processed = processed.replace(/~!~CB~!~(\d+)~!~/g, (_, i) => codeBlocks[+i]);
  return processed;
}

// 第二步，把md转化为html
async function md2html(md: string) {
  const html = await marked(md);
  // 手动处理代码高亮
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  tempDiv.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightElement(block as HTMLElement);
  });
  return tempDiv.innerHTML;
}

// 将文章内相对路径的图片（assets/xxx/...）重写为带 base 前缀的绝对路径，
// 使图片在本地（/）和 GitHub Pages（/blog/）下都能正确加载
function fixArticleImagePaths(html: string) {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  tempDiv.querySelectorAll('img').forEach((img) => {
    const src = img.getAttribute('src') || '';
    // 只处理 assets/ 开头的相对路径，跳过 http(s)、//、#、data: 和 / 开头的地址
    if (/^(\.\/)?assets\//.test(src)) {
      const rest = src.replace(/^(\.\/)?assets\//, '');
      img.setAttribute('src', `${import.meta.env.BASE_URL}article/assets/${rest}`);
    }
    // 文章内图片启用懒加载与异步解码，避免长文章一次性加载全部大图
    img.setAttribute('loading', 'lazy');
    img.setAttribute('decoding', 'async');
  });
  return tempDiv.innerHTML;
}

// 第三步，替换html中的数学公式
function katex2html(html: string) {
  let processedContent = html.replace(/{{katex_block:(.*?)}}/g, (_, p1) => {
    return katex.renderToString(Buffer.from(p1, 'base64').toString(), {
      throwOnError: false,
      displayMode: true
    });
  }).replace(/{{katex_inline:(.*?)}}/g, (_, p1) => {
    return katex.renderToString(Buffer.from(p1, 'base64').toString(), {
      throwOnError: false
    });
  });
  return processedContent;
}

// 第四步，为h标签生成id
function generate_h_id(html: string, i: number) {
  // 替换renderedContent中的h标签，并生成id
  let processedContent = html.replace(/<(h[1-6])>(.*?)<\/\1>/gi, (_, p1, p2) => {
    const id = generateUniqueId(p2.trim(), i++);  // 生成id
    headings[id] = p2.trim();  // 记录原始内容和生成的id
    return `<${p1} id="${id}">${p2}</${p1}>`;
  });
  return processedContent;
}

// 定义一个函数来生成唯一的id
function generateUniqueId(text: string, i: number) {
  const sanitizedText = text.replace(/[^a-zA-Z0-9一-龥]+/g, ''); // 替换所有非字母数字字符为下划线
  return `${sanitizedText}_${i}`;
}

// 处理文章内的页内锚点链接（如 [流形](#manifold-comment)）：
// hash 路由下 href="#xxx" 会被浏览器当作整个 hash 的变化，被 Vue Router 当成
// 路由路径（#/manifold-comment）而跳转失败。这里拦截纯锚点点击，
// 改为 scrollIntoView 平滑滚动，不改变路由。
function onContentClick(event: MouseEvent) {
  // 放行修饰键点击与非左键点击，保留用户"新标签页打开"等意图
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const anchor = (event.target as Element | null)?.closest?.('a[href^="#"]');
  if (!anchor) return;
  const href = anchor.getAttribute('href') || '';
  if (href.startsWith('#/')) return;  // 路由链接交给 Vue Router
  const id = href.slice(1);
  if (!id) {
    // href="#" 视为回到页面顶部
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// fileName 形如 "AI/强化学习"，对应的 md 文件在 article/md/<分类>/<文章名>.md。
// 用 watch 而非 onMounted：路由复用组件实例时（从一篇切到另一篇）能自动重新加载。
let loadId = 0;  // 请求序号，用于丢弃过期响应

async function loadContent(fileName: string) {
  const id = ++loadId;
  content.value = '';
  emit('contentLoaded', '');  // 先清空旧内容，避免短暂显示上一篇文章

  try {
    const md_url = `${import.meta.env.BASE_URL}article/md/${fileName}.md`;
    const response = await axios.get(md_url);
    if (id !== loadId) return;  // 已有更新的请求发出，丢弃本次结果

    const mdWithPlaceholders = md2katex(response.data);
    let renderedContent = await md2html(mdWithPlaceholders);
    renderedContent = fixArticleImagePaths(renderedContent);  // 修复文章内图片路径
    renderedContent = katex2html(renderedContent);

    let i = 0;  // 用于生成递增序列的变量
    let processedContent = generate_h_id(renderedContent, i);  // 替换renderedContent中的h标签，并生成id
    if (id !== loadId) return;  // await 之后再次检查竞态

    content.value = processedContent;
    emit('contentLoaded', processedContent);  // 触发 contentLoaded 事件并传递渲染后的内容
  } catch (error) {
    if (id !== loadId) return;
    content.value = '';
    emit('contentLoaded', '');
    console.error('加载文章失败：', fileName, error);
  }
}

watch(() => props.fileName, (name) => { loadContent(name); }, { immediate: true });


</script>

<style scoped>
/* .markdown-body {
    padding: 20px;
    border: 1px solid #e1e4e8;
} */
</style>
