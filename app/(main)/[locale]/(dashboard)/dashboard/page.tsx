import { routing } from '@/i18n/routing'
import { DashboardClient } from './DashboardClient'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function DashboardPage() {
  return <DashboardClient />
}
