<template>
    <div class="home-page">
        <div class="home-header">
            <h1>WebCAD</h1>
            <p>选择一个示例开始</p>
        </div>
        <div class="card-container">
            <div class="demo-card" @click="navigateTo('/template')">
                <div class="card-icon">🔧</div>
                <h2>webcad-template</h2>
                <p>webcad-template</p>
            </div>
            <div class="demo-card" @click="navigateTo('/lightguide')">
                <div class="card-icon">🏗️</div>
                <h2>LightGuide</h2>
                <p>钢构装配激光投影系统完整五步前端</p>
            </div>
            <div class="demo-card" @click="navigateTo('/lightguide-cad')">
                <div class="card-icon">📐</div>
                <h2>LightGuide CAD</h2>
                <p>独立 WebCAD 视图调试页</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();

const navigateTo = (path: string) => {
    router.push(path);
};
</script>

<style scoped>
.home-page {
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
}

.home-header {
    text-align: center;
    margin-bottom: 4rem;
}

.home-header h1 {
    font-size: 4rem;
    font-weight: 700;
    margin: 0 0 1rem 0;
    letter-spacing: -0.02em;
}

.home-header p {
    font-size: 1.5rem;
    opacity: 0.9;
    margin: 0;
}

.card-container {
    display: flex;
    gap: 2rem;
    padding: 0 2rem;
}

.demo-card {
    background: rgba(255, 255, 255, 0.95);
    border-radius: 1rem;
    padding: 3rem 2.5rem;
    width: 280px;
    cursor: pointer;
    transition: all 0.3s ease;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    color: #333;
}

.demo-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.card-icon {
    font-size: 4rem;
    margin-bottom: 1rem;
    text-align: center;
}

.demo-card h2 {
    font-size: 1.8rem;
    margin: 0 0 0.5rem 0;
    font-weight: 600;
}

.demo-card p {
    font-size: 1rem;
    color: #666;
    margin: 0;
    line-height: 1.5;
}
</style>

