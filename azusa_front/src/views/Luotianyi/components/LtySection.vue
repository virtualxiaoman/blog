<template>
  <section class="lty-section">
    <h2 class="lty-section-title">{{ title }}</h2>
    <div class="lty-section-body">
      <!-- 默认插槽：板块的实际内容；未填写时显示占位提示 -->
      <slot>
        <div class="lty-placeholder">
          <p class="lty-placeholder-text">{{ placeholder }}</p>
        </div>
      </slot>
    </div>
  </section>
</template>

<script setup lang="ts">
withDefaults(
  defineProps<{
    /** 板块标题 */
    title: string;
    /** 未填写内容时显示的占位提示（后续补内容后不再出现） */
    placeholder?: string;
  }>(),
  { placeholder: '占位内容，待补充' }
);
</script>

<style scoped>
.lty-section {
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid rgba(102, 204, 255, 0.22);
  border-radius: 16px;
  padding: 22px 26px;
  box-shadow: 0 4px 16px rgba(120, 160, 200, 0.12);
}

.lty-section-title {
  margin: 0 0 14px;
  padding-left: 12px;
  border-left: 4px solid #b39ddb;
  font-size: 20px;
  font-weight: 700;
  line-height: 1.4;
  color: #6b5aa8;
}

.lty-section-body {
  font-size: 15px;
  line-height: 1.8;
  color: #3a3f45;
}

.lty-placeholder {
  border: 2px dashed #d3dce6;
  border-radius: 10px;
  padding: 28px 20px;
  text-align: center;
}

.lty-placeholder-text {
  margin: 0;
  color: #8a9199;
  font-size: 14px;
}
</style>
