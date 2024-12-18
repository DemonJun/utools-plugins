<script lang="ts" setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import type { VaultItem } from '../types/services'

// 类型定义
interface CachedVaultItem extends VaultItem {
    cachedIconUrl?: string | null
    iconError?: boolean
}

// 加密工具
const useCrypto = () => {
    const encrypt = (data: any): string => {
        try {
            // 使用 services 中的加密函数
            return window.services.encrypt(data)
        } catch (err) {
            throw new Error('数据加密失败')
        }
    }
    
    const decrypt = (encryptedData: string): any => {
        try {
            // 使用 services 中的解密函数
            const decrypted = window.services.decrypt(encryptedData)
            if (decrypted === null) {
                throw new Error('解密失败')
            }
            return decrypted
        } catch (err) {
            throw new Error('数据解密失败')
        }
    }
    
    return { encrypt, decrypt }
}

// 状态管理
const items = ref<CachedVaultItem[]>([])
const searchText = ref('')
const loading = ref(false)
const error = ref('')
const isBackgroundUpdating = ref(false)
const isMac = ref(window.utools.isMacOS())
const copyMessage = ref('')
let copyMessageTimer: number | null = null

// 搜索相关逻辑
const useSearch = () => {
    // 检查字符串是否包含搜索字符串
    const findMatchingString = (str: string, searchStr: string) => {
        return str.includes(searchStr)
    }

    // 过滤后的列表
    const filteredItems = computed(() => {
        const trimmedSearch = searchText.value.trim()
        const filtered = !trimmedSearch 
            ? items.value 
            : items.value.filter(item => {
                const name = item.name.toLowerCase()
                const username = (item.login?.username || '').toLowerCase()
                const url = item.login?.uris?.[0]?.uri.toLowerCase() || ''
                const searchStr = trimmedSearch.toLowerCase()

                return findMatchingString(name, searchStr) || 
                       findMatchingString(username, searchStr) || 
                       findMatchingString(url, searchStr)
            })

        return filtered
    })

    return { filteredItems }
}

// 图标处理逻辑
const useIcon = () => {
    const getFaviconUrl = (item: CachedVaultItem) => {
        if (item.cachedIconUrl !== undefined || item.iconError) {
            return item.cachedIconUrl
        }

        if (!item.login?.uris?.length) {
            item.cachedIconUrl = null
            return null
        }

        try {
            const uri = new URL(item.login.uris[0].uri)
            const iconUrl = `https://icons.duckduckgo.com/ip3/${uri.hostname}.ico`
            item.cachedIconUrl = iconUrl
            return iconUrl
        } catch {
            item.cachedIconUrl = null
            return null
        }
    }

    const handleImageError = (event: Event, item: CachedVaultItem) => {
        const img = event.target as HTMLImageElement
        img.style.display = 'none'
        item.iconError = true
        item.cachedIconUrl = null
    }

    return { getFaviconUrl, handleImageError }
}

// 缓存管理
const useCache = () => {
    const CACHE_KEY = 'bitwarden-vault-items'
    const CACHE_VERSION = 'v2'
    const { encrypt, decrypt } = useCrypto()

    const loadFromCache = () => {
        const cacheVersion = window.utools.dbStorage.getItem('bitwarden-cache-version')
        if (cacheVersion !== CACHE_VERSION) {
            window.utools.dbStorage.removeItem(CACHE_KEY)
            window.utools.dbStorage.setItem('bitwarden-cache-version', CACHE_VERSION)
            return false
        }

        const encryptedData = window.utools.dbStorage.getItem(CACHE_KEY)
        if (!encryptedData) return false

        try {
            const decryptedData = decrypt(encryptedData)
            if (!decryptedData || !Array.isArray(decryptedData)) {
                throw new Error('缓存数据格式错误')
            }
            items.value = decryptedData as CachedVaultItem[]
            return true
        } catch (err) {
            window.utools.dbStorage.removeItem(CACHE_KEY)
            return false
        }
    }

    const saveToCache = (data: CachedVaultItem[]) => {
        try {
            const encryptedData = encrypt(data)
            window.utools.dbStorage.setItem(CACHE_KEY, encryptedData)
            window.utools.dbStorage.setItem('bitwarden-cache-version', CACHE_VERSION)
        } catch (err) {
            window.utools.dbStorage.removeItem(CACHE_KEY)
        }
    }

    return { loadFromCache, saveToCache }
}

// uTools 相关功能
const useUTools = () => {
    const setupUToolsListener = () => {
        window.utools.onPluginEnter(({ type, payload }) => {
            updateInBackground()
            if (type === 'over') {
                searchText.value = String(payload)
            }
        })

        window.utools.removeSubInput()
        window.utools.setSubInput(({ text }) => {
            searchText.value = text ?? ''
        }, '搜索密码库...')
    }

    const copyToClipboard = async (text: string, type: 'username' | 'password') => {
        await window.utools.copyText(text)
        copyMessage.value = `已复制${type === 'username' ? '用户名' : '密码'}到剪贴板`
        if (copyMessageTimer) {
            clearTimeout(copyMessageTimer)
        }
        copyMessageTimer = window.setTimeout(() => {
            copyMessage.value = ''
        }, 2000)
    }

    return { setupUToolsListener, copyToClipboard }
}

// 数据加载与更新
const { loadFromCache, saveToCache } = useCache()
const { getFaviconUrl } = useIcon()

const updateInBackground = async () => {
    if (isBackgroundUpdating.value) return

    isBackgroundUpdating.value = true
    try {
        const newItems = await window.services.getVaultItems() as CachedVaultItem[]
        newItems.forEach(newItem => {
            const oldItem = items.value.find(item => item.id === newItem.id)
            if (oldItem) {
                newItem.cachedIconUrl = oldItem.cachedIconUrl
                newItem.iconError = oldItem.iconError
            }
        })
        items.value = newItems
        saveToCache(newItems)
    } catch (err) {
    } finally {
        isBackgroundUpdating.value = false
    }
}

const loadVaultItems = async () => {
    loading.value = true
    error.value = ''
    searchText.value = ''

    if (loadFromCache()) {
        loading.value = false
        updateInBackground()
        return
    }

    try {
        const newItems = await window.services.getVaultItems() as CachedVaultItem[]
        newItems.forEach(item => {
            if (item.cachedIconUrl === undefined && !item.iconError) {
                const result = getFaviconUrl(item)
                if (result === null) {
                    item.iconError = true
                }
            }
        })
        items.value = newItems
        saveToCache(newItems)
    } catch (err) {
        error.value = err.message
    } finally {
        loading.value = false
    }
}

// 工具函数
const isNearTop = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    return rect.top < 100
}

const formatUrl = (urlStr: string) => {
    try {
        const url = new URL(urlStr)
        return url.origin + url.pathname
    } catch {
        return urlStr
    }
}

// 组合功能
const { filteredItems } = useSearch()
const { handleImageError } = useIcon()
const { setupUToolsListener, copyToClipboard } = useUTools()

onMounted(() => {
    setupUToolsListener()
    loadVaultItems()
})
</script>

<template>
    <div class="list-container">
        <div class="progress-bar" :class="{ active: isBackgroundUpdating }"></div>
        <div v-if="error" class="error-message">
            {{ error }}
        </div>

        <div v-if="loading" class="loading">
            加载中...
        </div>

        <div v-else class="vault-list">
            <div v-for="(item, index) in filteredItems" :key="item.id" class="vault-item" ref="listItems"
                @click="copyToClipboard(item.login?.password || '', 'password')">
                <div class="item-icon">
                    <img v-if="getFaviconUrl(item)" :src="getFaviconUrl(item)" class="favicon"
                        @error="(e) => handleImageError(e, item)">
                    <div v-else class="circle-icon"></div>
                </div>
                <div class="item-content">
                    <div class="item-name">{{ item.name }}</div>
                    <div class="item-username">{{ item.login?.username }}</div>
                </div>
                <button class="copy-btn" @click.stop="copyToClipboard(item.login?.username || '', 'username')" title="复制用户名">
                    <div class="copy-icon"></div>
                </button>
                <div class="tooltip" v-if="item.login?.uris?.[0]?.uri"
                    :class="{ 'tooltip-bottom': $refs.listItems?.[index] && isNearTop($refs.listItems[index] as HTMLElement) }">
                    {{ formatUrl(item.login.uris[0].uri) }}
                </div>
            </div>
        </div>

        <div class="copy-message" v-if="copyMessage">
            {{ copyMessage }}
        </div>
    </div>
</template>

<style>
:root {
    color-scheme: light dark;
}

@media (prefers-color-scheme: light) {
    :root {
        --background-color: #f5f5f5;
        --text-color: #333;
        --text-secondary: #666;
        --border-color: #eee;
        --item-background: #fff;
        --error-background: #fce8e6;
        --error-color: #d93025;
        --loading-color: #666;
        --hover-background: #f0f0f0;
    }
}

@media (prefers-color-scheme: dark) {
    :root {
        --background-color: #1e1e1e;
        --text-color: #e0e0e0;
        --text-secondary: #999;
        --border-color: #333;
        --item-background: #2d2d2d;
        --error-background: #4a1f1b;
        --error-color: #ff8a80;
        --loading-color: #999;
        --hover-background: #383838;
    }
}
</style>

<style scoped>
.list-container {
    height: 100%;
    display: flex;
    flex-direction: column;
    background-color: var(--background-color);
    color: var(--text-color);
    position: relative;
}

.progress-bar {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 2px;
    background: linear-gradient(to right, transparent, rgba(255, 75, 75, 0.5), transparent);
    transform: translateX(-100%);
    opacity: 0;
    transition: opacity 0.3s;
}

.progress-bar.active {
    opacity: 0.8;
    animation: progress-animation 3s infinite linear;
}

@keyframes progress-animation {
    0% {
        transform: translateX(-100%);
    }

    50% {
        transform: translateX(100%);
    }

    50.1% {
        transform: translateX(100%);
    }

    100% {
        transform: translateX(-100%);
    }
}

.vault-list {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}

.vault-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    gap: 12px;
    cursor: pointer;
    transition: background-color 0.2s;
    position: relative;
    padding-left: 36px;
}

.vault-item:hover {
    background-color: var(--hover-background);
}

.item-icon {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.7;
}

.item-icon img {
    width: 16px;
    height: 16px;
}

.item-content {
    flex: 1;
    min-width: 0;
}

.item-name {
    color: var(--text-color);
    font-size: 14px;
    margin-bottom: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.item-username {
    color: var(--text-secondary);
    font-size: 12px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.copy-btn {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.2s;
}

.vault-item:hover .copy-btn {
    opacity: 0.7;
}

.copy-btn:hover {
    opacity: 1 !important;
}

.copy-btn:hover .copy-icon::before {
    opacity: 0.6;
}

.copy-btn:hover .copy-icon::after {
    opacity: 1;
}

.copy-icon {
    width: 14px;
    height: 16px;
    position: relative;
    border: none;
    margin-left: 6px;
}

.copy-icon::before,
.copy-icon::after {
    content: '';
    position: absolute;
    border-radius: 2px;
    background-color: var(--text-color);
}

.copy-icon::before {
    width: 12px;
    height: 14px;
    left: 2px;
    top: 2px;
    opacity: 0.4;
}

.copy-icon::after {
    width: 12px;
    height: 14px;
    left: 0;
    top: 0;
    opacity: 0.8;
}

.error-message {
    color: var(--error-color);
    padding: 12px;
    background: var(--error-background);
    border-radius: 4px;
    margin: 16px;
}

.loading {
    text-align: center;
    color: var(--loading-color);
    padding: 20px;
}

.circle-icon {
    width: 16px;
    height: 16px;
    background-color: var(--text-secondary);
    border-radius: 50%;
    opacity: 0.7;
}

.favicon {
    width: 16px;
    height: 16px;
    border-radius: 2px;
}

.tooltip {
    position: absolute;
    left: 50%;
    bottom: 100%;
    transform: translateX(-50%);
    padding: 6px 12px;
    background-color: var(--item-background);
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 12px;
    color: var(--text-color);
    white-space: normal;
    word-break: break-all;
    max-width: min(300px, calc(100vw - 40px));
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.2s;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    margin-bottom: 10px;
    text-align: center;
    line-height: 1.4;
}

.tooltip-bottom {
    bottom: auto;
    top: 100%;
    margin-bottom: 0;
    margin-top: 10px;
}

.tooltip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: var(--item-background);
}

.tooltip::before {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 7px solid transparent;
    border-top-color: var(--border-color);
}

.tooltip-bottom::after {
    top: auto;
    bottom: 100%;
    border-top-color: transparent;
    border-bottom-color: var(--item-background);
}

.tooltip-bottom::before {
    top: auto;
    bottom: 100%;
    border-top-color: transparent;
    border-bottom-color: var(--border-color);
}

.vault-item:hover .tooltip {
    opacity: 1;
}

.copy-message {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--item-background);
    color: var(--text-color);
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 14px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border: 1px solid var(--border-color);
    z-index: 1000;
    animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translate(-50%, 10px);
    }
    to {
        opacity: 1;
        transform: translate(-50%, 0);
    }
}
</style>