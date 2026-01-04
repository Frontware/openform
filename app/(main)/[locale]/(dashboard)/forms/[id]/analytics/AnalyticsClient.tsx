'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { analyticsClient } from '@/lib/grpc-client';
import { AnalyticsDashboard } from '@/components/analytics/analytics-dashboard';
import { LoadingSpinner } from '@/components/ui/loading';
import { ErrorMessage } from '@/components/ui/error';

export default function AnalyticsClient() {
  const params = useParams();
  // Read form ID from URL path if not in params (happens with static export)
  const formId = (params?.id as string) || (typeof window !== 'undefined' ? window.location.pathname.split('/').slice(-2)[0] : '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('7d');

  useEffect(() => {
    if (!formId || formId === '__dynamic__') return;
    loadAnalytics();
  }, [formId, timeRange]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      // Calculate date range
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
          startDate.setFullYear(2000); // All time
      }

      // Fetch all analytics data in parallel
      const [
        overviewStats,
        responseTrend,
        deviceBreakdown,
        completionFunnel,
        questionAnalytics,
        questionDropOff
      ] = await Promise.all([
        analyticsClient.getOverviewStats({
          formId,
          timeRange
        }),
        analyticsClient.getResponseTrend({
          formId,
          startDate: { seconds: BigInt(Math.floor(startDate.getTime() / 1000)), nanos: 0 },
          endDate: { seconds: BigInt(Math.floor(endDate.getTime() / 1000)), nanos: 0 }
        }),
        analyticsClient.getDeviceBreakdown({ formId }),
        analyticsClient.getCompletionFunnel({ formId }),
        analyticsClient.getQuestionAnalytics({ formId }),
        analyticsClient.getQuestionDropOff({ formId })
      ]);

      setAnalyticsData({
        overview: overviewStats.stats,
        trends: responseTrend.dataPoints,
        devices: deviceBreakdown.devices,
        funnel: completionFunnel.funnel,
        questions: questionAnalytics.questions,
        dropOff: questionDropOff.questions
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load analytics');
      console.error('Analytics error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading && formId !== '__dynamic__') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <ErrorMessage message={error} onRetry={loadAnalytics} />
      </div>
    );
  }

  if (!analyticsData) {
      return null;
  }

  return (
    <AnalyticsDashboard
      data={analyticsData}
      timeRange={timeRange}
      onTimeRangeChange={setTimeRange}
      formId={formId}
    />
  );
}