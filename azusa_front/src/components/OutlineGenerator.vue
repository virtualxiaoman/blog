<template>
  <div>
    <ul>
      <li v-for="header in headers" :key="header.id">
        <p @click="scrollToHeading(header.id)" :class="`header-${header.level}`">{{ header.text }}</p>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
  content: {
    type: String,
    required: true,
  },
});

// 从渲染后的 HTML 中解析标题，生成大纲数据
const headers = computed(() => {
  const headersArray = [];
  // 正则表达式匹配h1到h6标签，同时捕获id属性和标题文本
  const regex = /<h([1-6])\s+id="([^"]+)">(.*?)<\/h\1>/gi;
  let match;
  while ((match = regex.exec(props.content)) !== null) {
    const level = parseInt(match[1]); // 将字符串转换为数字，表示标题级别
    const id = match[2]; // 捕获id属性
    const text = extractTextBeforeColor(decodeHtmlEntities(match[3].trim()));
    headersArray.push({
      text,
      level,
      id,
    });
  }
  return headersArray;
});

// 解码HTML实体
function decodeHtmlEntities(html: string): string {
  const parser = new DOMParser();
  const dom = parser.parseFromString(html, 'text/html');
  if (!dom.body.textContent) {
    return '';
  }
  return dom.body.textContent;
}

// 去掉标题中的 \color{...} 前缀（KaTeX 颜色命令不参与标题文本）
function extractTextBeforeColor(text: string): string {
  const colorPattern = /\\color\{[^}]*\}/;
  const match = text.match(colorPattern);
  if (match) {
    return text.substring(0, match.index);
  }
  return text;
}

// 滚动到标题 id 对应的元素
const scrollToHeading = (id: string) => {
  const targetElement = document.getElementById(id);
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: 'smooth' });
  } else {
    console.warn('Element not found:', id);
  }
};
</script>

<style scoped>
ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

li {
  margin: 0;
}

p {
  text-decoration: none;
  color: #D81B60;
  margin: 0;
}

.header-1 {
  font-size: 1em;
  font-weight: bold;
  margin: 10px 0px 10px 0px;
  transition: background-color 0.3s ease;
}

.header-2 {
  color: #E91E63;
  font-size: 0.83em;
  margin: 6px 0px 6px 1em;
  transition: background-color 0.3s ease;
}

.header-3 {
  color: #F06292;
  font-size: 0.67em;
  margin: 3px 0px 3px 2em;
  transition: background-color 0.3s ease;
}

.header-4 {
  color: #F48FB1;
  font-size: 0.5em;
  margin: 2px 0px 2px 3em;
  transition: background-color 0.3s ease;
}

.header-5 {
  color: #000000;
  font-size: 0.42em;
  margin: 1px 0px 1px 4em;
  transition: background-color 0.3s ease;
}

.header-6 {
  color: #000000;
  font-size: 0.33em;
  margin: 0px 0px 0px 5em;
  transition: background-color 0.3s ease;
}

.header-1:hover,
.header-2:hover,
.header-3:hover,
.header-4:hover,
.header-5:hover,
.header-6:hover {
  background-color: #f0f0f0;
}
</style>
