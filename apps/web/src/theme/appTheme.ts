import { theme, type ThemeConfig } from 'antd';

export const appTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#3b82f6',
    colorInfo: '#3b82f6',
    colorSuccess: '#35c783',
    colorWarning: '#e7ad45',
    colorError: '#ef6372',
    colorBgBase: '#080d14',
    colorBgContainer: '#0d141e',
    colorBgElevated: '#172230',
    colorBorder: '#283748',
    colorBorderSecondary: '#1b2735',
    colorText: '#edf2f7',
    colorTextSecondary: '#a5b1c0',
    colorTextTertiary: '#748397',
    borderRadius: 6,
    borderRadiusSM: 4,
    borderRadiusLG: 8,
    controlHeight: 32,
    fontFamily: 'Inter, "Segoe UI", sans-serif',
  },
  components: {
    Button: { controlHeightLG: 40, fontWeight: 600, primaryShadow: 'none' },
    Card: { colorBgContainer: '#0d141e' },
    Drawer: { colorBgElevated: '#111a26' },
    Input: { activeBorderColor: '#3b82f6', hoverBorderColor: '#60a5fa' },
    Select: {
      optionSelectedBg: 'rgba(59, 130, 246, 0.16)',
      optionActiveBg: '#172230',
    },
    Dropdown: {
      colorBgElevated: '#111a26',
    },
    Tag: {
      borderRadiusSM: 4,
    },
    Tooltip: {
      colorBgSpotlight: '#172230',
      colorTextLightSolid: '#edf2f7',
    },
    Layout: { bodyBg: '#080d14', headerBg: '#0b111a', siderBg: '#0d141e' },
    Menu: {
      darkItemBg: '#0d141e',
      darkItemColor: '#a5b1c0',
      darkItemHoverBg: '#172230',
      darkItemSelectedBg: 'rgba(59, 130, 246, 0.12)',
      darkItemSelectedColor: '#60a5fa',
      itemBorderRadius: 4,
    },
    Modal: {
      contentBg: '#111a26',
      footerBg: '#111a26',
      headerBg: '#111a26',
    },
    Table: {
      headerBg: '#111a26',
      headerColor: '#a5b1c0',
      borderColor: '#1b2735',
      rowHoverBg: '#172230',
    },
    Tabs: { itemSelectedColor: '#60a5fa', inkBarColor: '#3b82f6' },
  },
};