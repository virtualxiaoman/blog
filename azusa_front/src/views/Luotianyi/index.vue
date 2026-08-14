<template>
  <div class="luotianyi-page">
    <ArticleNav />
    <div class="luotianyi-content">
      <h1 class="page-title">洛天依</h1>
      <p class="page-sub">中文虚拟歌手 · VOCALOID 声库</p>

      <section class="tianyi-intro">
        <p>
          洛天依（Luo Tianyi）是由上海禾念信息科技有限公司开发、基于 VOCALOID 3 语音合成引擎的中文虚拟歌手，
          声库音源由配音演员山新提供。2012 年正式出道以来，凭借清亮温柔的嗓音和活泼可爱的形象，
          成为国内人气最高的虚拟歌姬之一。
        </p>
      </section>

      <section class="tianyi-section">
        <h2>角色档案</h2>
        <ul class="profile-list">
          <li><span>生日</span>7 月 12 日（巨蟹座）</li>
          <li><span>身高</span>156cm</li>
          <li><span>声库</span>VOCALOID 3 中文声库</li>
          <li><span>音源</span>山新</li>
          <li><span>代表色</span>天依蓝</li>
        </ul>
      </section>

      <section class="tianyi-section">
        <h2>代表作品（占位）</h2>
        <ul class="song-list">
          <li>《权御天下》</li>
          <li>《普通Disco》</li>
          <li>《达拉崩吧》</li>
          <li>《万神纪》</li>
        </ul>
      </section>

      <section class="tianyi-section">
        <h2>关于本页面</h2>
        <p class="placeholder-note">
          这里是占位内容，后续会补充天依的图片、音乐、演唱会等内容。如果你有想放的东西，随时告诉我。
        </p>
      </section>
    </div>
  </div>
</template>

<script setup>
import ArticleNav from '../../components/ArticleNav.vue';
</script>

<style scoped>
.luotianyi-page {
  min-height: 100vh;
  background-image: -webkit-radial-gradient(-20% 140%, ellipse, rgba(179, 157, 219, .25) 30%, rgba(236, 173, 158, .25) 50%),
    -webkit-radial-gradient(60% 40%, ellipse, rgba(57, 197, 187, 0.15) 10%, rgba(44, 70, 76, 0.08) 60%),
    -webkit-linear-gradient(-45deg, rgba(179, 157, 219, .35) -10%, rgba(213, 232, 211, .45) 80%);
}

.luotianyi-content {
  margin-left: 6%;
  margin-right: 16%; /* 给右侧固定导航栏让位 */
  padding: 40px 0 80px;
}

.page-title {
  margin: 0;
  font-size: 40px;
  font-weight: bold;
  color: #409eff;
  text-shadow: 2px 2px 4px rgba(102, 204, 255, 0.5);
}

.page-sub {
  margin: 10px 0 32px;
  color: #73767a;
}

.tianyi-intro {
  background: rgba(255, 255, 255, 0.75);
  border-left: 4px solid #b39ddb;
  border-radius: 10px;
  padding: 18px 22px;
  line-height: 1.9;
  color: #3a3f45;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.tianyi-section h2 {
  margin: 32px 0 14px;
  font-size: 20px;
  color: #9b8cd6;
  border-bottom: 2px solid rgba(179, 157, 219, 0.4);
  padding-bottom: 6px;
}

.profile-list,
.song-list {
  list-style: none;
  margin: 0;
  padding: 12px 18px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.profile-list li {
  display: flex;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px dashed #e6eef4;
}

.profile-list li span {
  min-width: 52px;
  font-weight: 600;
  color: #9b8cd6;
}

.song-list li {
  padding: 8px 0;
  border-bottom: 1px dashed #e6eef4;
}

.profile-list li:last-child,
.song-list li:last-child {
  border-bottom: none;
}

.placeholder-note {
  color: #73767a;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.6);
  border-radius: 10px;
  padding: 14px 18px;
}
</style>
