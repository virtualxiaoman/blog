<template>
    <div>
        <textarea v-model="comment" placeholder="Write your comment in Markdown...该功能的后端还没写。。发不了评论。"></textarea>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const comment = ref('');

</script>

<style scoped>
textarea {
    width: 70%;
    height: 150px;
    margin-bottom: 10px;
    padding: 10px;
    border: 1px solid #e1e4e8;
    display: block;
    margin-left: auto;
    margin-right: auto;
}

.markdown-body {
    padding: 10px;
    border: 1px solid #e1e4e8;
}
</style>