import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['en', 'th', 'fr'],
  defaultLocale: 'en',
  localePrefix: 'as-needed'
});
