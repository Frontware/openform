import { routing } from '@/i18n/routing'
import { SettingsClient } from './SettingsClient'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function SettingsPage() {
  return <SettingsClient />
}