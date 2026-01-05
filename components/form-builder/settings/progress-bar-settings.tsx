'use client';

import React from 'react';
import { BarChart3, Circle, List, XCircle } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';

type ProgressBarStyle = 'none' | 'linear' | 'steps' | 'circular';

interface ProgressBarSettingsProps {
  value: ProgressBarStyle;
  onChange: (value: ProgressBarStyle) => void;
}

export function ProgressBarSettings({ value, onChange }: ProgressBarSettingsProps) {
  const t = useTranslations('formBuilder');

  const options: Array<{
    value: ProgressBarStyle;
    label: string;
    description: string;
    icon: React.ReactNode;
    preview: string;
  }> = [
    {
      value: 'none',
      label: t('progressBarNone'),
      description: t('progressBarNoneDesc'),
      icon: <XCircle className="w-5 h-5" />,
      preview: '❌',
    },
    {
      value: 'linear',
      label: t('progressBarLinear'),
      description: t('progressBarLinearDesc'),
      icon: <BarChart3 className="w-5 h-5" />,
      preview: '━━━━━━━━━━',
    },
    {
      value: 'steps',
      label: t('progressBarSteps'),
      description: t('progressBarStepsDesc'),
      icon: <List className="w-5 h-5" />,
      preview: '① ━ ② ━ ③',
    },
    {
      value: 'circular',
      label: t('progressBarCircular'),
      description: t('progressBarCircularDesc'),
      icon: <Circle className="w-5 h-5" />,
      preview: '⭕ 60%',
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-base font-semibold text-gray-900 dark:text-gray-100">
          {t('progressBarStyle')}
        </Label>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          {t('progressBarStyleDesc')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`relative p-4 rounded-xl border-2 transition-all text-left ${
              value === option.value
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-400 shadow-md scale-105'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm'
            }`}
          >
            {/* Selected indicator */}
            {value === option.value && (
              <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 dark:bg-blue-400 rounded-full flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}

            {/* Icon and preview */}
            <div className="flex items-center gap-3 mb-2 min-w-0">
              <div className={`${value === option.value ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'} flex-shrink-0`}>
                {option.icon}
              </div>
              <div className="text-2xl truncate">{option.preview}</div>
            </div>

            {/* Label and description */}
            <div>
              <div
                className={`font-semibold mb-1 ${
                  value === option.value ? 'text-blue-900 dark:text-blue-100' : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {option.label}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{option.description}</div>
            </div>
          </button>
        ))}
      </div>

      {/* Live Preview */}
      {value !== 'none' && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
            {t('livePreview')}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
            {value === 'linear' && (
              <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm overflow-hidden">
                {/* Progress bar */}
                <div className="relative h-1.5 w-full">
                  <div
                    className="absolute top-0 left-0 h-full transition-all duration-500 ease-out w-3/5 bg-blue-500 dark:bg-blue-400 overflow-hidden"
                  >
                    {/* Shimmer effect */}
                    <div className="absolute right-0 top-0 w-20 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
                  </div>
                </div>

                {/* Question counter */}
                <div className="px-4 py-2 flex items-center justify-between">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    Question 3 of 5
                  </div>
                  <div className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    60% Complete
                  </div>
                </div>
              </div>
            )}
            {value === 'steps' && (
              <div className="flex items-center justify-center gap-2">
                {[1, 2, 3, 4, 5].map((step) => (
                  <React.Fragment key={step}>
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        step <= 3
                          ? 'bg-blue-500 dark:bg-blue-400 text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {step < 3 ? '✓' : step}
                    </div>
                    {step < 5 && (
                      <div
                        className={`h-0.5 w-8 ${
                          step < 3 ? 'bg-blue-500 dark:bg-blue-400' : 'bg-gray-200 dark:bg-gray-700'
                        }`}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
            {value === 'circular' && (
              <div className="flex justify-center">
                <div className="relative w-16 h-16">
                  <svg className="transform -rotate-90 w-full h-full">
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="rgba(0,0,0,0.1)"
                      strokeWidth="4"
                      fill="transparent"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke="#3b82f6"
                      strokeWidth="4"
                      fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 28}`}
                      strokeDashoffset={`${2 * Math.PI * 28 * 0.4}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center text-sm font-bold">
                    60%
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
