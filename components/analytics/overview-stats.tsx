'use client'

import { Eye, Users, CheckCircle, Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface StatCardProps {
  title: string;
  value: string;
  change: string;
  icon: React.ComponentType<any>;
  trend: 'up' | 'down' | 'neutral';
}

function StatCard({ title, value, change, icon: Icon, trend }: StatCardProps) {
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';
  const bgColor = trend === 'up' ? 'bg-green-50' : trend === 'down' ? 'bg-red-50' : 'bg-blue-50';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${bgColor}`}>
          <Icon className={`w-5 h-5 ${trendColor}`} />
        </div>
        <span className={`text-sm font-medium ${trendColor}`}>
          {change}
        </span>
      </div>
      <div className="text-2xl font-bold text-gray-900 mb-1">{value}</div>
      <div className="text-sm text-gray-500">{title}</div>
    </div>
  );
}

export function OverviewStats({ stats }: { stats: any }) {
  const t = useTranslations('analytics');
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getTrend = (change: string) => {
    if (!change) return 'neutral';
    if (change.startsWith('+')) return 'up';
    if (change.startsWith('-')) return 'down';
    return 'neutral';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title={t('totalViews')}
        value={Number(stats.totalViews).toLocaleString()}
        change={stats.viewsChange || "0%"}
        icon={Eye}
        trend={getTrend(stats.viewsChange)}
      />
      <StatCard
        title={t('totalResponses')}
        value={Number(stats.totalResponses).toLocaleString()}
        change={stats.responsesChange || "0%"}
        icon={Users}
        trend={getTrend(stats.responsesChange)}
      />
      <StatCard
        title={t('completionRate')}
        value={`${Number(stats.completionRate).toFixed(1)}%`}
        change={stats.completionRateChange || "0%"}
        icon={CheckCircle}
        trend={getTrend(stats.completionRateChange)}
      />
      <StatCard
        title={t('avgTime')}
        value={formatTime(stats.avgCompletionTimeSeconds)}
        change={stats.avgTimeChange || "0s"}
        icon={Clock}
        trend={getTrend(stats.avgTimeChange)}
      />
    </div>
  );
}

