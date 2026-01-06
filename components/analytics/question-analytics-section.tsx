'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslations } from 'next-intl';

export function QuestionAnalyticsSection({ questions }: { questions: any[] }) {
  const t = useTranslations('analytics');
  
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-gray-900">{t('questionAnalytics')}</h2>

      {questions.map((question) => (
        <QuestionAnalyticsCard key={question.questionId} question={question} />
      ))}
    </div>
  );
}

function QuestionAnalyticsCard({ question }: { question: any }) {
  const t = useTranslations('analytics');
  
  const renderChart = () => {
    switch (question.questionType) {
      case 'single_choice':
      case 'multiple_choice':
      case 'dropdown':
        return <ChoiceQuestionChart stats={question.choiceStats || []} />;
      case 'rating':
        return question.npsStats ?
          <NPSChart stats={question.npsStats} /> :
          <RatingChart stats={question.ratingStats || []} />;
      default:
        return <div className="text-gray-500 py-8 text-center border border-dashed rounded-lg">{t('noVisualization')}</div>;
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-base font-semibold text-gray-900">{question.questionLabel}</h3>
          <span className="text-sm text-gray-500">
            {Number(question.responseCount)} {(Number(question.responseCount) <= 1 ? t('response') : t('responses')).toLowerCase()}
          </span>
        </div>
        <span className="inline-block px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full">
          {question.questionType.replace('_', ' ')}
        </span>
      </div>

      {renderChart()}
    </div>
  );
}

function ChoiceQuestionChart({ stats }: { stats: any[] }) {
  const data = stats.map(s => ({
    name: s.choice,
    value: Number(s.count),
    percentage: s.percentage
  }));

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
          <XAxis type="number" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" stroke="#9ca3af" width={100} fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="value" fill="#06B6D4" radius={[0, 8, 8, 0]} barSize={30} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RatingChart({ stats }: { stats: any[] }) {
  const data = stats.map(s => ({
    name: '⭐'.repeat(s.rating),
    value: Number(s.count)
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
          <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
          <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
            }}
          />
          <Bar dataKey="value" fill="#4F46E5" radius={[8, 8, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function NPSChart({ stats }: { stats: any }) {
  const segments = [
    { name: 'Detractors', value: Number(stats.detractors), color: '#EF4444' },
    { name: 'Passives', value: Number(stats.passives), color: '#F59E0B' },
    { name: 'Promoters', value: Number(stats.promoters), color: '#10B981' }
  ];

  const total = segments.reduce((acc, s) => acc + s.value, 0);

  return (
    <div>
      <div className="mb-6 text-center">
        <div className="inline-block">
          <div className="text-5xl font-bold text-indigo-600 mb-2">{Number(stats.npsScore).toFixed(1)}</div>
          <div className="text-sm text-gray-500">Net Promoter Score</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {segments.map((segment) => (
          <div
            key={segment.name}
            className="text-center p-4 rounded-lg"
            style={{ backgroundColor: `${segment.color}10` }}
          >
            <div className="text-2xl font-bold mb-1" style={{ color: segment.color }}>
              {segment.value}
            </div>
            <div className="text-xs font-medium text-gray-600 mb-1">{segment.name}</div>
            <div className="text-xs text-gray-500">
              ({total > 0 ? ((segment.value / total) * 100).toFixed(1) : 0}%)
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
