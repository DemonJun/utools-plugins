// 非 Windows 系统添加额外的 PATH
!utools.isWindows() && (process.env.PATH += ':/usr/local/bin:/usr/local/sbin:/opt/homebrew/bin')

const crypto = require('crypto')
const { exec } = require('child_process')
const util = require('util')
const execAsync = util.promisify(exec)

// 常量定义
const CONSTANTS = {
  ENCRYPTION_KEY: 'bitwarden-plugin-',
  CACHE_KEYS: {
    ENCRYPTION: 'encryption-key',
    SESSION: 'bitwarden-session',
    SETTINGS: 'bitwarden-settings'
  },
  SESSION_DURATION: 12 * 60 * 60 * 1000, // 12小时
  CACHE_UPDATE_INTERVAL: 5 * 60 * 1000,  // 5分钟
  DEFAULT_SERVER: 'https://vault.bitwarden.com',
  THEMES: {
    LIGHT: {
      background: '#f5f5f5',
      textColor: '#333',
      textSecondary: '#666',
      borderColor: '#eee',
      itemBackground: '#fff',
      errorBackground: '#fce8e6',
      errorColor: '#d93025',
      loadingColor: '#666',
      hoverBackground: '#f0f0f0'
    },
    DARK: {
      background: '#1e1e1e',
      textColor: '#e0e0e0',
      textSecondary: '#999',
      borderColor: '#333',
      itemBackground: '#2d2d2d',
      errorBackground: '#4a1f1b',
      errorColor: '#ff8a80',
      loadingColor: '#999',
      hoverBackground: '#383838'
    }
  }
}

// 加密密钥（使用固定的密钥加上 uTools 的 UUID）
const getEncryptionKey = () => {
  let key = window.utools.dbStorage.getItem(CONSTANTS.CACHE_KEYS.ENCRYPTION)
  if (!key) {
    key = CONSTANTS.ENCRYPTION_KEY + window.utools.getNativeId()
    window.utools.dbStorage.setItem(CONSTANTS.CACHE_KEYS.ENCRYPTION, key)
  }
  return key
}

// 存储工具
const storage = {
  get: (key) => window.utools.dbStorage.getItem(key),
  set: (key, value) => window.utools.dbStorage.setItem(key, value),
  remove: (key) => window.utools.dbStorage.removeItem(key)
}

// 加密工具
const cryptoUtils = {
  encrypt: (data) => {
    const algorithm = 'aes-256-cbc'
    const key = crypto.scryptSync(getEncryptionKey(), 'salt', 32)
    const iv = crypto.randomBytes(16)
    const cipher = crypto.createCipheriv(algorithm, key, iv)
    const jsonStr = JSON.stringify(data)
    let encrypted = cipher.update(jsonStr, 'utf8', 'base64')
    encrypted += cipher.final('base64')
    return JSON.stringify({
      iv: iv.toString('base64'),
      content: encrypted
    })
  },

  decrypt: (ciphertext) => {
    try {
      const algorithm = 'aes-256-cbc'
      const key = crypto.scryptSync(getEncryptionKey(), 'salt', 32)
      const { iv, content } = JSON.parse(ciphertext)
      const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'base64'))
      let decrypted = decipher.update(content, 'base64', 'utf8')
      decrypted += decipher.final('utf8')
      return JSON.parse(decrypted)
    } catch {
      return null
    }
  }
}

// 执行 bw 命令
const execBWCommand = async (command, env = {}) => {
  try {
    const { stdout, stderr } = await execAsync(command, {
      env: {
        ...process.env,
        ...env,
        ...(sessionCache.token ? { BW_SESSION: sessionCache.token } : {})
      }
    })
    return stdout.trim()
  } catch (error) {
    throw error
  }
}

// 从 uTools 存储加载会话缓存
const loadSessionCache = () => {
  try {
    const encryptedCache = window.utools.dbStorage.getItem('bitwarden-session')
    if (encryptedCache) {
      const cache = cryptoUtils.decrypt(encryptedCache)
      if (cache && cache.expires_at && Date.now() < cache.expires_at) {
        return cache
      }
    }
  } catch (error) {
  }
  return {
    token: null,
    expires_at: null,
    serverUrl: null
  }
}

// 保存会话缓存到 uTools 存储
const saveSessionCache = (cache) => {
  try {
    const encryptedCache = cryptoUtils.encrypt(cache)
    window.utools.dbStorage.setItem('bitwarden-session', encryptedCache)
  } catch (error) {
  }
}

// 会话缓存
let sessionCache = loadSessionCache()

// 清除会话缓存
const clearSessionCache = () => {
  sessionCache = {
    token: null,
    expires_at: null,
    serverUrl: null
  }
  try {
    window.utools.dbStorage.removeItem('bitwarden-session')
  } catch (error) {
  }
}

// 密码库缓存
let vaultCache = {
  items: null,
  lastUpdate: null,
  isUpdating: false,
  isUnlocked: false
}

// 清除密码库缓存
const clearVaultCache = () => {
  vaultCache = {
    items: null,
    lastUpdate: null,
    isUpdating: false,
    isUnlocked: false
  }
}

// 标准化服务器地址
const normalizeServerUrl = (url) => {
  if (!url) return null
  url = url.trim()
  if (!url) return null
  
  // 确保有协议前缀
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  
  // 移除末尾的斜杠
  return url.replace(/\/+$/, '')
}

// 检查密码库状态
const checkVaultStatus = async () => {
  try {
    const status = await execBWCommand('bw status')
    const statusObj = JSON.parse(status)
    return statusObj.status
  } catch (error) {
    throw error
  }
}

// 获取会话令牌
const getSessionToken = async (settings) => {
  // 检查缓存的会话是否有效
  if (sessionCache.token && sessionCache.expires_at && Date.now() < sessionCache.expires_at) {
    try {
      const status = await checkVaultStatus()
      if (status === 'unlocked') {
        return sessionCache.token
      }
    } catch (error) {
    }
  }

  try {
    const normalizedNewUrl = normalizeServerUrl(settings.serverUrl)
    const normalizedCachedUrl = normalizeServerUrl(sessionCache.serverUrl)
    
    // 只有当服务器地址发生变化时才更新配置
    if (normalizedNewUrl !== normalizedCachedUrl) {
      try {
        await execBWCommand('bw logout')
      } catch (error) {
      }

      if (normalizedNewUrl) {
        await execBWCommand(`bw config server ${normalizedNewUrl}`)
      } else {
        // 如果新的 serverUrl 为空，但之前有配置，则重置为官方服务器
        if (normalizedCachedUrl) {
          await execBWCommand('bw config server https://vault.bitwarden.com')
        }
      }
      sessionCache.serverUrl = settings.serverUrl
    }

    // 检查当前状态
    const status = await checkVaultStatus()
    if (status === 'unauthenticated') {
      // 使用 API key 登录
      await execBWCommand('bw login --apikey', {
        BW_CLIENTID: settings.clientId,
        BW_CLIENTSECRET: settings.clientSecret
      })
    }
    
    // 检查主密码是否存在
    if (!settings.masterPassword) {
      throw new Error('主密码未设置')
    }
    
    // 获取会话密钥
    const sessionKey = await execBWCommand('bw unlock --passwordenv BW_PASSWORD --raw', {
      BW_PASSWORD: settings.masterPassword
    })

    // 缓存会话密钥，设置 12 小时过期
    sessionCache = {
      token: sessionKey,
      expires_at: Date.now() + 12 * 60 * 60 * 1000,
      serverUrl: settings.serverUrl
    }
    
    // 保存会话缓存
    saveSessionCache(sessionCache)

    return sessionKey
  } catch (error) {
    throw error
  }
}

// 后台更新密码库
const updateVaultItemsInBackground = async (settings) => {
  if (vaultCache.isUpdating) return
  
  try {
    vaultCache.isUpdating = true
    
    // 确保密码库已解锁
    await getSessionToken(settings)
    const status = await checkVaultStatus()
    if (status !== 'unlocked') {
      throw new Error('密码库未解锁')
    }
    
    // 同步密码库
    await execBWCommand('bw sync')

    // 获取密码库列表
    const itemsJson = await execBWCommand('bw list items')
    const items = JSON.parse(itemsJson)
    
    // 更新缓存
    vaultCache.items = items
      .filter(item => item.type === 1)
      .map(item => {
        const login = item.login || {}
        return {
          id: item.id,
          name: item.name,
          login: {
            username: login.username || '',
            password: login.password || '',
            uris: login.uris || []
          },
          notes: item.notes || ''
        }
      })
    vaultCache.lastUpdate = Date.now()
    vaultCache.isUnlocked = true
    
  } catch (error) {
    vaultCache.items = null
    vaultCache.lastUpdate = null
    vaultCache.isUnlocked = false
  } finally {
    vaultCache.isUpdating = false
  }
}

// 通过 window 对象向渲染进程注入 nodejs 能力
window.services = {
  encrypt: cryptoUtils.encrypt,
  decrypt: cryptoUtils.decrypt,

  // 获取当前主题
  getTheme() {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    return isDark ? CONSTANTS.THEMES.DARK : CONSTANTS.THEMES.LIGHT
  },

  loadSettings() {
    try {
      const encryptedSettings = storage.get(CONSTANTS.CACHE_KEYS.SETTINGS)
      if (encryptedSettings) {
        const settings = cryptoUtils.decrypt(encryptedSettings)
        if (settings) {
          return settings
        }
      }
      return {
        clientId: '',
        clientSecret: '',
        serverUrl: '',
        masterPassword: ''
      }
    } catch (error) {
      window.utools.showNotification('加载配置失败：' + error.message)
      return {
        clientId: '',
        clientSecret: '',
        serverUrl: '',
        masterPassword: ''
      }
    }
  },

  // 验证 Bitwarden 登录凭据
  async verifyBitwardenLogin(settings) {
    try {
      // 尝试获取会话令牌
      await getSessionToken(settings)
      return {
        success: true,
        message: '验证成功'
      }
    } catch (error) {
      
      // 解析错误信息
      let errorMessage = '验证失败'
      if (error.message.includes('Unauthorized')) {
        errorMessage = 'API Key 无效'
      } else if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
        errorMessage = '无法连接到服务器'
      } else {
        errorMessage = error.message
      }

      return {
        success: false,
        message: errorMessage
      }
    }
  },

  // 保存设置
  async saveSettings(settings) {
    try {
      clearSessionCache()
      clearVaultCache()

      const encryptedSettings = cryptoUtils.encrypt(settings)
      window.utools.dbStorage.setItem('bitwarden-settings', encryptedSettings)
      
      return {
        success: true,
        message: '保存成功'
      }
    } catch (error) {
      return {
        success: false,
        message: error.message
      }
    }
  },

  // 获取密码库列表
  async getVaultItems() {
    try {
      const settings = this.loadSettings()
      
      // 如果有缓存，先返回缓存
      if (vaultCache.items) {
        // 如果缓存超过5分钟，触发后台更新
        if (!vaultCache.isUpdating && (!vaultCache.lastUpdate || Date.now() - vaultCache.lastUpdate > 5 * 60 * 1000)) {
          updateVaultItemsInBackground(settings)
        }
        return vaultCache.items
      }

      // 如果没有缓存，同步获取数据
      await getSessionToken(settings)
      
      // 同步密码库
      await execBWCommand('bw sync')

      // 获取密码库列表
      const itemsJson = await execBWCommand('bw list items')
      const items = JSON.parse(itemsJson)
      
      // 更新缓存
      vaultCache.items = items
        .filter(item => item.type === 1)
        .map(item => {
          const login = item.login || {}
          return {
            id: item.id,
            name: item.name,
            login: {
              username: login.username || '',
              password: login.password || '',
              uris: login.uris || []
            },
            notes: item.notes || ''
          }
        })
      vaultCache.lastUpdate = Date.now()
      vaultCache.isUnlocked = true
      
      return vaultCache.items
    } catch (error) {
      throw error
    }
  }
}
