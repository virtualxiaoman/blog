<template>
    <div v-html="content" class="markdown-body"></div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { marked } from 'marked';
import hljs from 'highlight.js';
import "github-markdown-css";
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Buffer } from 'buffer';

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

// 第一步，把markdown中的数学公式转换为base64编码
function md2katex(md: string) {
    let mdWithPlaceholders = md.replace(/\$\$(.*?)\$\$/gs, (match, p1) => {
        return `{{katex_block:${Buffer.from(p1).toString('base64')}}}`;
    }).replace(/\$(.*?)\$/g, (match, p1) => {
        return `{{katex_inline:${Buffer.from(p1).toString('base64')}}}`;
    });
    return mdWithPlaceholders;
}

// 第二步，把md转化为heml
async function md2html(md: string) {
    // 注释掉的方法无法处理高亮代码块
    // let renderedContent = marked(md, {
    //     highlight: (code: string) => hljs.highlightAuto(code).value,
    //     renderer: new marked.Renderer(),
    // });
    // return renderedContent;
    const html = await marked(md);
    // 手动处理代码高亮
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    tempDiv.querySelectorAll('pre code').forEach((block) => {
        hljs.highlightBlock(block as HTMLElement);
    });
    return tempDiv.innerHTML;
}

// 第三步，替换html中的数学公式
function katex2html(html: string) {
    let processedContent = html.replace(/{{katex_block:(.*?)}}/g, (match, p1) => {
        return katex.renderToString(Buffer.from(p1, 'base64').toString(), {
            throwOnError: false,
            displayMode: true
        });
    }).replace(/{{katex_inline:(.*?)}}/g, (match, p1) => {
        return katex.renderToString(Buffer.from(p1, 'base64').toString(), {
            throwOnError: false
        });
    });
    return processedContent;
}

// 第四步，为h标签生成id
function generate_h_id(html: string, i: number) {
    // 替换renderedContent中的h标签，并生成id
    let processedContent = html.replace(/<(h[1-6])>(.*?)<\/\1>/gi, (match, p1, p2) => {
        const id = generateUniqueId(p2.trim(), i++);  // 生成id
        headings[id] = p2.trim();  // 记录原始内容和生成的id
        return `<${p1} id="${id}">${p2}</${p1}>`;
    });
    return processedContent;
}

// 定义一个函数来生成唯一的id
function generateUniqueId(text: string, i: number) {
    const sanitizedText = text.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, ''); // 替换所有非字母数字字符为下划线
    return `${sanitizedText}_${i}`;
}

onMounted(async () => {
    console.log("mdViewer.vue", props.fileName);
    const md_url = `/md_article/${props.fileName}.md`;
    const response = await axios.get(md_url);
    console.log("mdViewer.vue", response.data);

    const mdWithPlaceholders = md2katex(response.data);
    let renderedContent = await md2html(mdWithPlaceholders);
    renderedContent = katex2html(renderedContent);

    let i = 0;  // 用于生成递增序列的变量
    let processedContent = generate_h_id(renderedContent, i);  // 替换renderedContent中的h标签，并生成id

    content.value = processedContent;
    console.log("mdViewer.vue: processedContent", processedContent);
    emit('contentLoaded', processedContent);  // 触发 contentLoaded 事件并传递渲染后的内容
});


</script>

<style scoped>
/* .markdown-body {
    padding: 20px;
    border: 1px solid #e1e4e8;
} */
</style>
