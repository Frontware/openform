'use client'

import React from 'react';
import { useTranslations } from 'next-intl';
import { OverviewStats } from './overview-stats';
import { ResponseTrendChart } from './response-trend-chart';
import { DeviceBreakdownChart } from './device-breakdown-chart';
import { CompletionFunnelChart } from './completion-funnel-chart';
import { QuestionAnalyticsSection } from './question-analytics-section';
import { ExportButton } from './export-button';

interface AnalyticsDashboardProps {
  data: any;
  timeRange: string;
  onTimeRangeChange: (range: string) => void;
  formId: string;
}

export function AnalyticsDashboard({
  data,
  timeRange,
  onTimeRangeChange,
  formId
}: AnalyticsDashboardProps) {
  const t = useTranslations('analytics');
  const { startDate, endDate } = calculateDateRange(timeRange);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('title')}</h1>
            <p className="text-gray-500 mt-1">{t('subtitle')}</p>
          </div>
          <div className="flex gap-3">
            <select
              value={timeRange}
              onChange={(e) => onTimeRangeChange(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 outline-none"
            >
              <option value="7d">{t('last7Days')}</option>
              <option value="30d">{t('last30Days')}</option>
              <option value="90d">{t('last90Days')}</option>
              <option value="all">{t('allTime')}</option>
            </select>
            <ExportButton
              formId={formId}
              startDate={startDate}
              endDate={endDate}
            />
          </div>
        </div>
      </div>

      {/* Overview Stats */}
      <OverviewStats stats={data.overview} />

      {/* Response Trends */}
      <div className="mt-8">
        <ResponseTrendChart data={data.trends} />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        <div className="lg:col-span-2">
          <CompletionFunnelChart funnel={data.funnel} />
        </div>
        <div>
          <DeviceBreakdownChart devices={data.devices} />
        </div>
      </div>

      {/* Question Analytics */}
      <div className="mt-8">
        <QuestionAnalyticsSection questions={data.questions} />
      </div>
    </div>
  );
}

function calculateDateRange(timeRange: string): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date();

  switch (timeRange) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    default:
      startDate.setFullYear(2000);
  }

  startDate.setHours(0, 0, 0, 0);

  return { startDate, endDate };
}


