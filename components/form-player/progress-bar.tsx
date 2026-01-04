'use client';

import React from 'react';

interface ProgressBarProps {
  currentQuestion: number;
  totalQuestions: number;
  theme?: {
    primaryColor?: string;
    accentColor?: string;
  };
  style?: 'linear' | 'circular';
}

export function ProgressBar({
  currentQuestion,
  totalQuestions,
  theme,
  style = 'linear',
}: ProgressBarProps) {
  const progress = ((currentQuestion + 1) / totalQuestions) * 100;
  const primaryColor = theme?.primaryColor || '#3b82f6';

  if (style === 'linear') {
    return (
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 shadow-sm">
        {/* Progress bar */}
        <div className="relative h-1.5">
          <div
            className="absolute top-0 left-0 h-full transition-all duration-500 ease-out"
            style={{
              width: `${progress}%`,
              backgroundColor: primaryColor,
            }}
          >
            {/* Shimmer effect */}
            <div className="absolute right-0 top-0 w-20 h-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
          </div>
        </div>

        {/* Question counter */}
        <div className="px-4 md:px-6 py-2.5 flex items-center justify-between">
          <div className="text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300">
            Question {currentQuestion + 1} of {totalQuestions}
          </div>
          <div className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400">
            {Math.round(progress)}% Complete
          </div>
        </div>
      </div>
    );
  }

  if (style === 'circular') {
    const radius = 32;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference * (1 - progress / 100);

    return (
      <div className="fixed top-4 right-4 md:top-6 md:right-6 z-50">
        <div className="relative w-16 h-16 md:w-20 md:h-20">
          <svg className="transform -rotate-90 w-full h-full">
            {/* Background circle */}
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="6"
              fill="transparent"
            />
            {/* Progress circle */}
            <circle
              cx="50%"
              cy="50%"
              r={radius}
              stroke={primaryColor}
              strokeWidth="6"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
              style={{
                transition: 'stroke-dashoffset 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </svg>
          {/* Percentage text */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-xs md:text-sm font-bold text-gray-700 dark:text-gray-300">
              {Math.round(progress)}%
            </div>
          </div>
        </div>
        {/* Question counter */}
        <div className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
          {currentQuestion + 1}/{totalQuestions}
        </div>
      </div>
    );
  }

  return null;
}
