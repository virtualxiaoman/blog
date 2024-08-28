<template>
  <div>
    <MiscMD />
  </div>
  <div>
    <MiscPDF />
  </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';
import MiscMD from "./misc_md.vue";
import MiscPDF from "./misc_pdf.vue";

</script>
