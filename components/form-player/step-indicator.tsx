'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface StepIndicatorProps {
  currentQuestion: number;
  totalQuestions: number;
  theme?: {
    primaryColor?: string;
  };
}

export function StepIndicator({
  currentQuestion,
  totalQuestions,
  theme,
}: StepIndicatorProps) {
  const primaryColor = theme?.primaryColor || '#3b82f6';

  // Only show step indicator for 8 or fewer questions
  if (totalQuestions > 8) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700 shadow-sm py-4">
      <div className="max-w-4xl mx-auto px-4 md:px-6">
        <div className="flex items-center justify-between">
          {Array.from({ length: totalQuestions }).map((_, idx) => (
            <React.Fragment key={idx}>
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-sm md:text-base transition-all duration-300 ${
                    idx < currentQuestion
                      ? 'scale-100'
                      : idx === currentQuestion
                      ? 'scale-125 shadow-lg'
                      : 'scale-90'
                  }`}
                  style={{
                    backgroundColor:
                      idx <= currentQuestion ? primaryColor : 'rgba(0,0,0,0.1)',
                    color: idx <= currentQuestion ? 'white' : 'rgba(0,0,0,0.4)',
                  }}
                >
                  {idx < currentQuestion ? (
                    <Check className="w-4 h-4 md:w-5 md:h-5" strokeWidth={3} />
                  ) : (
                    idx + 1
                  )}
                </div>
                {/* Step label (hidden on mobile) */}
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2 hidden md:block">
                  Step {idx + 1}
                </div>
              </div>

              {/* Connector line */}
              {idx < totalQuestions - 1 && (
                <div
                  className={`h-0.5 flex-1 mx-1 md:mx-2 transition-all duration-300`}
                  style={{
                    backgroundColor:
                      idx < currentQuestion ? primaryColor : 'rgba(0,0,0,0.1)',
                  }}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}
