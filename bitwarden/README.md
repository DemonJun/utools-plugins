# uTools Bitwarden 插件

[![release](https://img.shields.io/badge/release-v1.0.0-blue.svg)](https://github.com/your-repo/releases)
[![downloads](https://img.shields.io/badge/downloads-0-green.svg)](https://github.com/your-repo/releases)

快速访问 Bitwarden 密码库的 uTools 插件

## 开发工具

| 工具 | 版本 | 下载 | 说明 |
|------|------|------|------|
| Node.js | v18+ | [下载](https://nodejs.org/) | 开发环境依赖 |
| Bitwarden CLI | latest | [下载](https://bitwarden.com/help/cli/) | 必需的命令行工具 |

## 插件功能

| 功能 | 说明 |
|------|------|
| 密码管理 | 支持密码和用户名快速复制、网站图标显示 |
| 数据安全 | 本地加密存储、主密码不上传、会话令牌自动过期 |
| 搜索功能 | 支持模糊搜索(名称、用户名、网址)、超级面板搜索 |
| 自定义服务器 | 支持自托管 Bitwarden 服务器 |
| 主题适配 | 自动适配系统浅色/深色主题 |

## 插件安装

请直接在 uTools 插件中心搜索安装

## 使用说明

1. 在 Bitwarden 网页端创建 API 密钥
2. 在插件设置中填入:
   - API Client ID
   - API Client Secret  
   - 主密码
   - 服务器地址(可选)
3. 使用关键词呼出:
   - `pass/密码`: 打开密码列表
   - `bws/设置`: 打开设置页面

## 注意事项

- 需要安装 Bitwarden CLI
- 仅支持登录类型的密码库项目
- 需要稳定的网络连接
- API 密钥具有高权限，请妥善保管 