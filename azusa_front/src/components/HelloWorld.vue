<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ msg: string }>()  // defineProps的作用是定义props的类型，这样在模板中就可以使用props了，props是一个对象，里面包含了msg属性

const count = ref(0)
</script>

<template>
  <h1>{{ msg }}</h1>

  <div class="card">
    <button type="button" @click="count++">count is {{ count }}</button>
  </div>
</template>

<style scoped>

</style>
