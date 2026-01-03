'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Globe, Check } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const languages = [
  { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧' },
  { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭' },
  { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷' },
] as const;

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('nav');

  const currentLanguage = languages.find((lang) => lang.code === locale);

  const changeLanguage = (newLocale: string) => {
    // Get the current pathname and replace locale segment
    const segments = pathname.split('/');
    const localeIndex = languages.findIndex((l) => l.code === segments[1]);
    
    let newPath: string;
    if (localeIndex !== -1) {
      // Replace existing locale in path
      segments[1] = newLocale;
      newPath = segments.join('/');
    } else {
      // Add locale prefix
      newPath = `/${newLocale}${pathname}`;
    }

    // Store language preference in cookie
    document.cookie = `NEXT_LOCALE=${newLocale}; path=/; max-age=31536000`;

    // Navigate to the new locale path
    router.push(newPath);
    router.refresh();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-gray-100 transition-colors w-full text-left">
          <Globe className="h-4 w-4 text-gray-600" />
          <div className="flex flex-col items-start">
            <span className="text-xs text-gray-500">{t('language')}</span>
            <span className="text-sm font-medium text-gray-700">
              {currentLanguage?.flag} {currentLanguage?.nativeName}
            </span>
          </div>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b">
          {t('changeLanguage')}
        </div>
        {languages.map((language) => (
          <DropdownMenuItem
            key={language.code}
            onClick={() => changeLanguage(language.code)}
            className="flex items-center justify-between cursor-pointer py-3"
          >
            <span className="flex items-center gap-3">
              <span className="text-xl">{language.flag}</span>
              <div className="flex flex-col">
                <span className="text-sm font-medium">{language.nativeName}</span>
                <span className="text-xs text-gray-500">{language.name}</span>
              </div>
            </span>
            {locale === language.code && (
              <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center">
                <Check className="h-3.5 w-3.5 text-blue-600" />
              </div>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
