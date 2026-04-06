'use client';

import React from 'react';
import { Dropdown } from 'antd';
import { GlobalOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/navigation';

const localeLabels: Record<string, { label: string; flag: string }> = {
  en: { label: 'English', flag: '🇺🇸' },
  'zh-CN': { label: '中文', flag: '🇨🇳' },
};

export const LanguageSwitcher: React.FC = () => {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('nav');

  const currentLocale = localeLabels[locale] || localeLabels['en'];

  const menuItems = Object.entries(localeLabels).map(([key, { label, flag }]) => ({
    key,
    label: (
      <span className="flex items-center gap-2">
        <span>{flag}</span>
        <span>{label}</span>
      </span>
    ),
  }));

  const handleLocaleChange = ({ key }: { key: string }) => {
    if (key !== locale) {
      router.replace(pathname, { locale: key });
    }
  };

  return (
    <Dropdown
      menu={{ items: menuItems, onClick: handleLocaleChange, selectedKeys: [locale] }}
      trigger={['click']}
      placement="bottomRight"
    >
      <button
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        aria-label={currentLocale.label}
      >
        <GlobalOutlined className="text-base" />
        <span className="hidden sm:inline">{currentLocale.flag}</span>
      </button>
    </Dropdown>
  );
};

export default LanguageSwitcher;
