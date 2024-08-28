<template>
    <div class="info-container">
        <div class="avatar">
            <img src="/avatar.jpg" alt="Avatar" />
        </div>
        <div class="name">virtual小满</div>
        <div class="signature">
            即使一切都是虚无，<br/>也不应该放弃抵抗
        </div>
        <a class="github-button" href="https://github.com/virtualxiaoman" target="_blank">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.1.1/css/all.min.css" />
            <i class="fab fa-github"></i> Follow Me
        </a>
    </div>
</template>

<script setup>
</script>

<style scoped>
.info-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 2rem;
}

.avatar img {
    width: 100px;
    height: 100px;
    border-radius: 50%;
}

.name {
    font-size: 26px;
    font-weight: bold;
    margin-top: 1rem;
}

.signature {
    font-size: 14px;
    color: #666;
    margin-top: 0.5rem;
}

.github-button {
    display: flex;
    align-items: center;
    background-color: #66ccff;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 5px;
    text-decoration: none;
    margin-top: 1rem;
}

.github-button i {
    margin-right: 0.5rem;
}

.github-button:hover {
    background-color: #409eff;
}
</style>