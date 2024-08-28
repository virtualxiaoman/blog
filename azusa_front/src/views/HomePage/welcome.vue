<template>
  <div class="welcome-section">
    <div class="welcome-content">
      <div class="blog-center-name">Azusa's blog</div>
    </div>
    <div class="scroll-down" @click="scrollToMain">
      <span>&#x25BC;</span>
    </div>
  </div>
</template>

<script setup>

const scrollToMain = () => {
  const mainPage = document.querySelector('.main-section');
  if (mainPage) {
    mainPage.scrollIntoView({ behavior: 'smooth' });
  }
};

</script>

<style scoped>
.welcome-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100vh;
  background-image: url('/BG_Shiroko.png');
  background-size: cover;
  background-position: center;
  color: white;
}

.welcome-content {
  text-align: center;
}

.blog-center-name {
  font-size: 3rem;
  font-weight: bold;
  /* 添加文字阴影，水平偏移量 垂直偏移量 模糊半径 阴影颜色 */
  text-shadow: 2px 2px 6px rgba(0, 0, 0, 0.5);
  margin-bottom: 20px;
  margin-left: 5px;
}

.scroll-down {
  position: absolute;
  bottom: 20px;
  cursor: pointer;
  font-size: 2rem;
  animation: bounce 2s infinite;
  color: white;
  opacity: 0.6;
  transition: opacity 0.3s ease-in-out;
}

.scroll-down:hover {
  opacity: 1;
}

@keyframes bounce {

  0%,
  20%,
  50%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.6;
  }

  40% {
    transform: translateY(-10px);
    opacity: 0.9;
  }

  60% {
    transform: translateY(-5px);
    opacity: 0.7;
  }
}
</style>