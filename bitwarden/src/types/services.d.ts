export interface SaveSettingsResult {
  success: boolean;
  message: string;
}

export interface Uri {
  uri: string;
  match?: any;
}

export interface VaultItem {
  id: string;
  name: string;
  login?: {
    username: string;
    password: string;
    uris?: Uri[];
  };
  notes?: string;
}

export interface BitwardenSettings {
  clientId: string;
  clientSecret: string;
  serverUrl: string;
  masterPassword: string;
}

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

export interface BitwardenServices {
  encrypt: (data: any) => string;
  decrypt: (encryptedData: string) => any;
  loadSettings: () => BitwardenSettings;
  saveSettings: (settings: BitwardenSettings) => Promise<SaveSettingsResult>;
  getVaultItems: () => Promise<VaultItem[]>;
  searchVault: (searchText: string) => Promise<VaultItem[]>;
  getTheme: () => Theme;
}

declare global {
  interface Window {
    services: BitwardenServices;
  }
} 