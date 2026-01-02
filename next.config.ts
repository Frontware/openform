import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n.ts');

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  distDir: 'internal/embed/dist',
  images: {
    unoptimized: true,
  },
};

export default withNextIntl(nextConfig);
