<script setup lang="ts">
import { ref, provide, onMounted } from 'vue'
import Settings from './components/Settings.vue'
import Pass from './components/Pass.vue'

const route = ref('')
const enterAction = ref({})

// 主题类型定义
interface Theme {
    background: string
    textColor: string
    textSecondary: string
    borderColor: string
    itemBackground: string
    errorBackground: string
    errorColor: string
    loadingColor: string
    hoverBackground: string
}

// 主题配置
const themes = {
    light: {
        background: '#f5f5f5',
        textColor: '#333333',
        textSecondary: '#666666',
        borderColor: '#e0e0e0',
        itemBackground: '#ffffff',
        errorBackground: '#fce8e6',
        errorColor: '#d93025',
        loadingColor: '#666666',
        hoverBackground: '#f0f0f0'
    },
    dark: {
        background: '#1e1e1e',
        textColor: '#e0e0e0',
        textSecondary: '#999999',
        borderColor: '#333333',
        itemBackground: '#2d2d2d',
        errorBackground: '#4a1f1b',
        errorColor: '#ff8a80',
        loadingColor: '#999999',
        hoverBackground: '#383838'
    }
} as const

// 主题管理
const theme = ref<Theme>(window.services.getTheme())

onMounted(() => {
    // 初始化主题
    theme.value = window.services.getTheme()
    
    // 注册插件进入事件，处理路由
    window.utools.onPluginEnter((action) => {
        route.value = action.code
        enterAction.value = action
        theme.value = window.services.getTheme()
    })
    
    // 注册插件退出事件
    window.utools.onPluginOut(() => {
        route.value = ''
    })
})

// 提供主题给所有子组件
provide('theme', theme)
// 提供路由状态给子组件
provide('route', route)
provide('enterAction', enterAction)
</script>

<template>
    <div class="app" :style="{
        '--background-color': theme.background,
        '--text-color': theme.textColor,
        '--text-secondary': theme.textSecondary,
        '--border-color': theme.borderColor,
        '--item-background': theme.itemBackground,
        '--error-background': theme.errorBackground,
        '--error-color': theme.errorColor,
        '--loading-color': theme.loadingColor,
        '--hover-background': theme.hoverBackground
    }">
        <Settings v-if="route === 'settings'" />
        <Pass v-if="route === 'pass'" />
    </div>
</template>

<style scoped>
.page-container {
    height: 100vh;
    width: 100vw;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: var(--background-color);
    overflow: hidden;
    padding: 0;
}

.settings-container {
    width: 100%;
    max-width: 500px;
    margin: 20px;
    padding: 24px;
    background-color: var(--item-background);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.settings-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
    max-height: calc(100vh - 88px); /* 减去上下margin和padding */
    overflow: hidden;
}
</style>

