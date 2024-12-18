<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import type { BitwardenServices } from '../types/services'

declare global {
  interface Window {
    services: BitwardenServices
  }
}

const settings = ref({
    clientId: '',
    clientSecret: '',
    serverUrl: '',
    masterPassword: ''
})

const errorMessage = ref('')
const showError = ref(false)
const showPassword = ref(false)
const isSaving = ref(false)
const statusMessage = ref('')
const showStatus = ref(false)
const statusType = ref('success')

// 显示通知
const showNotification = (message: string, type: 'success' | 'error') => {
    statusMessage.value = message
    statusType.value = type
    showStatus.value = true
    setTimeout(() => {
        showStatus.value = false
    }, 3000)
}

// 验证表单
const validateForm = () => {
    let isValid = true
    let errors = []

    // 验证 Client ID
    if (!settings.value.clientId.trim()) {
        errors.push('Client ID 不能为空')
        isValid = false
    } 
    
    // 验证 Client Secret
    if (!settings.value.clientSecret.trim()) {
        errors.push('Client Secret 不能为空')
        isValid = false
    }

    // 验证主密码
    if (!settings.value.masterPassword.trim()) {
        errors.push('主密码不能为空')
        isValid = false
    }

    // 验证服务器地址（如果有输入）
    if (settings.value.serverUrl.trim()) {
        try {
            new URL(settings.value.serverUrl)
        } catch {
            errors.push('请输入有效的服务器地址')
            isValid = false
        }
    }

    if (!isValid) {
        errorMessage.value = errors.join('，')
        showError.value = true
        setTimeout(() => {
            showError.value = false
        }, 3000)
    }

    return isValid
}

// 保存设置
const saveSettings = async () => {
    if (!validateForm() || isSaving.value) {
        return
    }

    isSaving.value = true
    try {
        await window.services.saveSettings(settings.value)
        showNotification('保存成功', 'success')
    } catch (error) {
        showNotification('保存失败：' + error.message, 'error')
    } finally {
        isSaving.value = false
    }
}

// 初始化时加载设置
const loadSettings = () => {
    settings.value = window.services.loadSettings()
}

onMounted(() => {
    loadSettings()
})
</script>

<template>
    <div class="page-container">
        <div class="settings-container">
            <div v-if="showError" class="notification error">
                {{ errorMessage }}
            </div>
            <div v-if="showStatus" class="notification" :class="statusType">
                {{ statusMessage }}
            </div>
            <div class="settings-form">
                <div class="form-item">
                    <label>服务器地址:</label>
                    <input 
                        v-model="settings.serverUrl" 
                        placeholder="可选，默认使用 Bitwarden 官方服务器"
                        :class="{ 'error': showError && errorMessage.includes('服务器地址') }"
                        :disabled="isSaving"
                    >
                </div>
                <div class="form-item">
                    <label>Client ID:</label>
                    <input 
                        v-model="settings.clientId" 
                        placeholder="请输入 API Client ID"
                        :class="{ 'error': showError && errorMessage.includes('Client ID') }"
                        :disabled="isSaving"
                    >
                </div>
                <div class="form-item">
                    <label>Client Secret:</label>
                    <div class="password-input-container">
                        <input 
                            v-model="settings.clientSecret" 
                            :type="showPassword ? 'text' : 'password'" 
                            placeholder="请输入 API Client Secret"
                            :class="{ 'error': showError && errorMessage.includes('Client Secret') }"
                            :disabled="isSaving"
                        >
                        <button 
                            class="toggle-password-btn" 
                            @click="showPassword = !showPassword"
                            type="button"
                            :title="showPassword ? '隐藏' : '显示'"
                            :disabled="isSaving"
                        >
                            <img 
                                :src="showPassword ? 'assets/images/eye-hide.svg' : 'assets/images/eye-show.svg'" 
                                :alt="showPassword ? '隐藏' : '显示'"
                                class="eye-icon"
                            >
                        </button>
                    </div>
                </div>
                <div class="form-item">
                    <label>主密码:</label>
                    <div class="password-input-container">
                        <input 
                            v-model="settings.masterPassword" 
                            :type="showPassword ? 'text' : 'password'" 
                            placeholder="请输入主密码"
                            :class="{ 'error': showError && errorMessage.includes('主密码') }"
                            :disabled="isSaving"
                        >
                        <button 
                            class="toggle-password-btn" 
                            @click="showPassword = !showPassword"
                            type="button"
                            :title="showPassword ? '隐藏' : '显示'"
                            :disabled="isSaving"
                        >
                            <img 
                                :src="showPassword ? 'assets/images/eye-hide.svg' : 'assets/images/eye-show.svg'" 
                                :alt="showPassword ? '隐藏' : '显示'"
                                class="eye-icon"
                            >
                        </button>
                    </div>
                </div>
                <button 
                    class="save-btn" 
                    @click="saveSettings"
                    :disabled="isSaving"
                >
                    {{ isSaving ? '保存中...' : '保存设置' }}
                </button>
            </div>
        </div>
    </div>
</template>

<style>
/* 全局样式 - 去掉滚动条 */
::-webkit-scrollbar {
    display: none;
}

.notification {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: 6px;
    z-index: 1000;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    animation: slideIn 0.3s ease-out;
}

.notification.error {
    background-color: var(--error-background);
    color: var(--error-color);
}

.notification.success {
    background-color: var(--item-background);
    color: var(--text-color);
    border: 1px solid var(--border-color);
}

@keyframes slideIn {
    from {
        transform: translate(-50%, -100%);
        opacity: 0;
    }
    to {
        transform: translate(-50%, 0);
        opacity: 1;
    }
}
</style>

<style scoped>
.page-container {
    height: 100%;
    width: 100%;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    background-color: var(--background-color);
    padding-top: 20px;
}

.settings-container {
    padding: 24px;
    width: 100%;
    max-width: 500px;
    background-color: var(--item-background);
}

.settings-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.form-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.form-item label {
    font-weight: 500;
    color: var(--text-color);
    font-size: 14px;
}

.form-item input {
    padding: 10px 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    font-size: 14px;
    color: var(--text-color);
    background-color: var(--background-color);
    transition: all 0.3s ease;
}

.form-item input.error {
    border-color: var(--error-color);
    background-color: var(--error-background);
}

.form-item input:focus {
    outline: none;
    border-color: #4CAF50;
    background-color: var(--item-background);
}

.form-item input.error:focus {
    border-color: var(--error-color);
    box-shadow: 0 0 0 2px rgba(217, 48, 37, 0.1);
}

.form-item input::placeholder {
    color: var(--text-secondary);
}

.save-btn {
    margin-top: 24px;
    padding: 12px 24px;
    background-color: #4CAF50;
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    transition: background-color 0.3s ease;
}

.save-btn:hover {
    background-color: #45a049;
}

.save-btn:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
}

.password-input-container {
    position: relative;
    display: flex;
    align-items: center;
}

.password-input-container input {
    flex: 1;
    padding-right: 40px;
}

.toggle-password-btn {
    position: absolute;
    right: 8px;
    width: 36px;
    height: 36px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    transition: color 0.3s ease;
}

.toggle-password-btn:hover {
    color: #4CAF50;
}

.toggle-password-btn:disabled {
    color: #cccccc;
    cursor: not-allowed;
}

.toggle-password-btn .mdi {
    font-size: 20px;
}

input:disabled {
    background-color: var(--background-color);
    cursor: not-allowed;
}

.eye-icon {
    width: 20px;
    height: 20px;
    opacity: 0.7;
    transition: opacity 0.3s ease;
}

.toggle-password-btn:hover .eye-icon {
    opacity: 1;
}
</style>