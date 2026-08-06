<template>
  <div>
    <h2>选择PDF文章</h2>
    <ul>
      <li v-for="pdf in pdfs" :key="pdf.name">
        <!-- 每个按钮会导航到对应的PDF文章页面 -->
        <button @click="navigateToPDF(pdf.name)">
          {{ pdf.label }}
        </button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
// 定义PDF文章列表
const pdfs = [
  { name: '代码基础.pdf', label: '代码基础' },
  { name: '数学基础.pdf', label: '数学基础' },
  { name: '数据分析-Code.pdf', label: '数据分析-Code' },
  { name: '数据处理-Code.pdf', label: '数据处理-Code' },
  { name: '机器学习.pdf', label: '机器学习' },
];

function navigateToPDF(pdfName: string) {
  // 在新标签页中打开 article/pdf/<名称>.pdf
  if (pdfName.endsWith('.pdf')) {
    const pdfPath = pdfName.slice(0, -4);
    window.open(`${import.meta.env.BASE_URL}article/pdf/${pdfPath}.pdf`, '_blank', 'noopener');
  } else {
    console.error('文章名必须以.pdf结尾');
  }
}

</script>

<style scoped>
ul {
  list-style-type: none;
  padding: 0;
}
li {
  margin-bottom: 1rem;
}
button {
  padding: 0.5rem 1rem;
  border: 1px solid #ffcc66;
  border-radius: 4px;
  background-color: rgba(255, 204, 102, 0.2);
  cursor: pointer;
}
</style>