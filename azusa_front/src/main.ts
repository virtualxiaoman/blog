import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'; // 导入路由配置

const app = createApp(App);
app.use(router); // 使用路由
app.mount('#app');
// createApp(App).mount('#app')  // 挂载App组件到#app元素上，这样App组件就会被渲染到页面上
