<template>
    <div class="clearfix">
        <div class="left-content">
            <OutlineGenerator v-if="contentReady" :content="content" />
        </div>
        <div class="main-content">
            <div class="main-title">
                {{ fileName }}
            </div>
            <div class="main-md">
                <MarkdownViewer :fileName="fileName" @contentLoaded="updateContent" />
            </div>
            <div class="main-comment">
                <MarkdownComment />
            </div>
        </div>
        <div class="right-content">
        </div>
    </div>
</template>



<script setup lang="ts">
import { ref, watch } from 'vue';
import MarkdownViewer from './mdViewer.vue';
import OutlineGenerator from './OutlineGenerator.vue';
import MarkdownComment from './mdComment.vue';

const props = defineProps({
    fileName: {
        type: String,
        required: true,
    },
});

const content = ref('');
const contentReady = ref(false);

function updateContent(newContent: string) {
    content.value = newContent;
    contentReady.value = !!newContent; // 确保 contentReady 在内容被加载时才为 true
}

// watch(content, (newContent) => {
//     contentReady.value = !!newContent; // 监控 content 的变化并更新 contentReady
// });


// console.log("BlogPage.vue", props.fileName);
</script>



<style scoped>
.clearfix {
    display: flex;
    background-image: -webkit-radial-gradient(-20% 140%, ellipse, rgba(102, 204, 255, .2) 30%, rgba(178, 216, 232, .3) 50%),
        -webkit-radial-gradient(60% 40%, ellipse, rgba(57, 197, 187, 0.3) 10%, rgba(44, 70, 76, 0.1) 60%),
        -webkit-linear-gradient(-45deg, rgba(102, 204, 255, .3) -10%, rgba(178, 216, 232, .4) 80%);
}

.left-content {
    padding-left: 0.6%;
    padding-right: 1%;
    width: 14%;

    position: fixed;
    overflow-y: scroll;
    height: 100%;
}

.left-content::-webkit-scrollbar {
    /* width: 0; */
    background: transparent;
}

.right-content {
    padding-left: 1%;
    padding-right: 1%;
    width: 14%;

    position: fixed;
    right: 0;
    overflow-y: auto;
    height: 100%;
}

.right-content::-webkit-scrollbar {
    /* width: 0; */
    background: transparent;
}

.main-content {
    padding-left: 3%;
    padding-right: 3%;
    margin-left: 14%;
    margin-right: 14%;

    background-color: #ffffff;
    width: 72%;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.main-title {
    font-size: 48px;
    font-weight: bold;
    color: #409EFF;
    text-align: center;
    margin-top: 15px;
    margin-bottom: 30px;
    text-shadow: 2px 2px 4px rgba(102, 204, 255, 0.5);
    animation: fadeIn 2s ease-in-out;
}

.main-md {
    margin-bottom: 50px;
}

.main-comment {
    margin-bottom: 30px;
}
</style>
