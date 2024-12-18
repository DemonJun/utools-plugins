<script setup lang="ts">
import { ref, provide, onMounted } from 'vue'
import List from './components/List.vue'
import Settings from './components/Settings.vue'

const route = ref('')

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

// 主题管理
const theme = ref<Theme>(window.services.getTheme())

onMounted(() => {
    // 初始化主题
    theme.value = window.services.getTheme()
    
    // 注册插件进入事件，处理路由
    window.utools.onPluginEnter((action) => {
        route.value = action.code
        theme.value = window.services.getTheme()
    })
})

// 提供主题给所有子组件
provide('theme', theme)
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
        <List v-if="route === 'pass'" />
    </div>
</template>

<style>
.app {
    height: 100vh;
    width: 100vw;
}
</style>

