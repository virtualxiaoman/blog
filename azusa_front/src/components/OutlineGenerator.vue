<template>
    <div>
        <ul>
            <li v-for="header in headers" :key="header.id">
                    <p @click="scrollToHeading(header.text)" :class="`header-${header.level}`">{{ header.text }}</p>
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
console.log("OutlineGenerator.vue");
console.log("OutlineGenerator.vue", props.content);

// const headers = computed(() => {
//     const headersArray = [];
//     const regex = /<h([1-6])(?:\s[^>]*)? id="(.+?)">(.+?)<\/h\1>/g;
//     let match;
//     while ((match = regex.exec(props.content)) !== null) {
//         headersArray.push({
//             id: match[2],
//             text: match[3],
//             level: match[1],
//         });
//     }
//     return headersArray;
// });

// const headers = computed(() => {
//     const headersArray = [];
//     const regex = /<h([1-6])(?:\s[^>]*)?>(.+?)<\/h\1>/g;
//     let match;
//     console.log("OutlineGenerator.vue", "1111111111");
//     while ((match = regex.exec(props.content)) !== null) {
//         headersArray.push({
//             text: match[3],
//             level: match[1],
//         });
//         console.log("OutlineGenerator.vue", match[3]);
//     }
//     return headersArray;
// });
// const headers = computed(() => {
//     const headersArray = [];
//     let i = 0; // 用于生成递增序列的变量
//     const regex = /<h([1-6])(?:\s[^>]*)?>(.+?)<\/h\1>/g;
//     let match;
//     while ((match = regex.exec(props.content)) !== null) {
//         const id = `header-${match[1]}-${i++}`; // 生成id
//         headersArray.push({
//             text: match[2].trim(),  // 使用 match[2] 来获取标题文本
//             level: parseInt(match[1]), // 将字符串转换为数字
//             id: id, // 添加id属性
//         });
//         console.log("OutlineGenerator.vue", match[2]);
//     }
//     return headersArray;
// });
const headers = computed(() => {
    const headersArray = [];
    // let i = 0; // 用于生成递增序列的变量
    // 正则表达式匹配h1到h6标签，同时捕获id属性和标题文本
    const regex = /<h([1-6])\s+id="([^"]+)">(.*?)<\/h\1>/gi;
    let match;
    while ((match = regex.exec(props.content)) !== null) {
        const level = parseInt(match[1]); // 将字符串转换为数字，表示标题级别
        const id = match[2]; // 捕获id属性
        const text = extractTextBeforeColor(decodeHtmlEntities(match[3].trim()));  // decodeURIComponent解码标题文本
        headersArray.push({
            text: text, // 标题文本
            level: level, // 标题级别
            id: id, // id属性
        });
        console.log("OutlineGenerator.vue", text);
    }
    return headersArray;
});

// 解码HTML实体
function decodeHtmlEntities(html: string):string {
    const parser = new DOMParser();
    const dom = parser.parseFromString(html, 'text/html');
    if (!dom.body.textContent) {
        return '';
    }
    else {
        return dom.body.textContent;
    }
}

// 解码带有颜色的LaTeX文本
function extractTextBeforeColor(text: string): string {
    const colorPattern = /\\color\{[^}]*\}/;  // 匹配 \color{...} 的正则表达式
    const match = text.match(colorPattern);
    
    if (match) {
        // 返回 \color{...} 之前的内容
        return text.substring(0, match.index);
    }
    
    // 如果没有匹配到 \color{...}，返回原始文本
    return text;
}

// 找到包含特定文本的元素
const findElementByContent = (content: string) => {
  // 获取所有包含特定文本的元素
  const elements = document.querySelectorAll('h1, h2, h3, h4, h5, h6') // 选择器
  
  for (let element of elements) {
    // 检查element的textContent是否是null，如果是null，就跳过这个element
    if (!element.textContent) {
      continue
    }
    if (element.textContent.includes(content)) {
      return element
    }
  }
  
  return null
}

// 滚动到包含特定文本的标题
const scrollToHeading = (content: string) => {
  const targetElement = findElementByContent(content)
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: 'smooth' })
  } else {
    console.warn('Element not found!')
  }
}


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


.header-1:hover, .header-2:hover, .header-3:hover, .header-4:hover, .header-5:hover, .header-6:hover {
    background-color: #f0f0f0;
}

</style>
