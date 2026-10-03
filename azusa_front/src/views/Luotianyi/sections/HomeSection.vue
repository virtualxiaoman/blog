<template>
  <LtySection title="关于洛天依">
    <p class="home-intro">
      主页内容占位。后续在这里放天依的简介、立绘、代表作品等，直接写在
      <code>&lt;LtySection&gt;</code> 标签内即可替换占位提示。
    </p>
  </LtySection>

  <LtySection title="最新动态">
    <div v-if="!latest.length" class="home-dyn-status">{{ error || '动态加载中…' }}</div>
    <template v-else>
      <ul class="home-dyn-list">
        <li v-for="item in latest" :key="item.key">
          <a class="home-dyn-item" :href="dynamicDetailHref(item.key)" target="_blank" rel="noopener">
            <span class="home-dyn-meta">
              <span class="home-dyn-badge">{{ item.typeLabel }}</span>
              <time>{{ item.date }}</time>
            </span>
            <span class="home-dyn-title">{{ item.title }}</span>
          </a>
        </li>
      </ul>
      <div class="home-dyn-more">
        <router-link class="home-dyn-more-link" :to="{ query: { tab: 'dynamic' } }">
          查看全部动态 →
        </router-link>
      </div>
    </template>
  </LtySection>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import LtySection from '../components/LtySection.vue';
import { dynamicDetailHref, fetchDynamicsIndex, type DynamicSummary } from '../dynamics-data';

const latest = ref<DynamicSummary[]>([]);
const error = ref('');

onMounted(async () => {
  try {
    latest.value = (await fetchDynamicsIndex()).latest;
  } catch {
    error.value = '动态加载失败，请刷新重试';
  }
});
</script>

<style scoped>
.home-intro {
  margin: 0;
  color: #3a3f45;
}

.home-dyn-status {
  padding: 12px 0;
  text-align: center;
  font-size: 14px;
  color: #7a8699;
}

.home-dyn-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.home-dyn-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 14px;
  border: 1px solid #e6eef6;
  border-radius: 10px;
  background: #fbfdff;
  text-decoration: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.home-dyn-item:hover {
  border-color: #66ccff;
  box-shadow: 0 4px 12px rgba(102, 204, 255, 0.2);
}

.home-dyn-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #9aa7b8;
}

.home-dyn-badge {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(102, 204, 255, 0.14);
  color: #3a8dbf;
  font-size: 12px;
}

.home-dyn-title {
  font-size: 14px;
  color: #3a3f45;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.home-dyn-more {
  margin-top: 12px;
  text-align: right;
}

.home-dyn-more-link {
  color: #3a8dbf;
  font-size: 13px;
  text-decoration: none;
}

.home-dyn-more-link:hover {
  color: #66ccff;
}
</style>
