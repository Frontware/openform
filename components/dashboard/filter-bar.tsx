'use client'

import { useState } from 'react'
import { Search, ChevronDown, ChevronUp, X, SortAsc } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useTranslations } from 'next-intl'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface FilterBarProps {
  searchQuery: string
  onSearchChange: (query: string) => void
  statusFilter: 'all' | 'draft' | 'published' | 'closed'
  onStatusChange: (status: 'all' | 'draft' | 'published' | 'closed') => void
  sortBy: string
  onSortChange: (sort: string) => void
  resultCount: number
}

export function FilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  sortBy,
  onSortChange,
  resultCount,
}: FilterBarProps) {
  const t = useTranslations('dashboard.filters')
  const [isFilterExpanded, setIsFilterExpanded] = useState(true)

  const statusOptions = [
    { value: 'all', label: t('status.all') },
    { value: 'draft', label: t('status.draft') },
    { value: 'published', label: t('status.published') },
    { value: 'closed', label: t('status.closed') },
  ]

  const sortOptions = [
    { value: 'updated_at_desc', label: t('sort.newest') },
    { value: 'updated_at_asc', label: t('sort.oldest') },
    { value: 'title_asc', label: t('sort.az') },
    { value: 'title_desc', label: t('sort.za') },
    { value: 'response_count_desc', label: t('sort.mostResponses') },
    { value: 'response_count_asc', label: t('sort.fewestResponses') },
  ]

  const activeFilterCount = [searchQuery ? 1 : 0, statusFilter !== 'all' ? 1 : 0].reduce((a, b) => a + b, 0)

  return (
    <>
      {/* Collapsible Filter Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6 transition-all">

        {/* Collapse Toggle Bar */}
        <button
          onClick={() => setIsFilterExpanded(!isFilterExpanded)}
          className="w-full px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors border-b border-gray-100"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              {isFilterExpanded ? (
                <ChevronUp className="w-5 h-5 text-blue-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-blue-600" />
              )}
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-gray-900">
                {t('title')}
              </h3>
              <p className="text-xs text-gray-500">
                {isFilterExpanded ? t('collapse') : t('expand')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Show active filter count */}
            {activeFilterCount > 0 && (
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                {activeFilterCount} {t('active')}
              </span>
            )}
            <span className="text-sm text-gray-500">
              {isFilterExpanded ? t('collapse') : t('expand')}
            </span>
          </div>
        </button>

        {/* Expandable Filter Content */}
        <div
          className={`transition-all duration-300 ease-in-out ${
            isFilterExpanded
              ? 'max-h-[500px] opacity-100'
              : 'max-h-0 opacity-0 overflow-hidden'
          }`}
        >
          <div className="p-6 border-b border-gray-100">
            <div className="flex flex-col lg:flex-row gap-4">
              {/* Search Bar */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <Input
                  type="text"
                  placeholder={t('searchPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="w-full pl-12 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => onSearchChange('')}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2">
                {/* Sort Dropdown */}
                <div className="relative">
                  <Select value={sortBy} onValueChange={onSortChange}>
                    <SelectTrigger className="appearance-none pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer hover:bg-gray-100 transition-colors w-[180px]">
                      <SelectValue placeholder={t('sortBy')} />
                    </SelectTrigger>
                    <SelectContent>
                      {sortOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <SortAsc className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Status Tabs - Modern segmented control */}
            <div className="mt-6">
              <div className="inline-flex bg-gray-100 rounded-xl p-1 gap-1">
                {statusOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => onStatusChange(option.value as any)}
                    className={`relative px-6 py-2.5 rounded-lg font-medium text-sm transition-all ${
                      statusFilter === option.value
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Results Summary */}
          <div className="px-6 py-3 bg-gray-50 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {t('showing')} <span className="font-semibold text-gray-900">{resultCount} {resultCount === 1 ? t('form') : t('forms')}</span>
            </div>
            {searchQuery && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">{t('filteredBy')}</span>
                <div className="flex items-center gap-2 px-3 py-1 bg-white rounded-lg border border-gray-200">
                  <span className="text-sm font-medium text-gray-700">
                    &quot;{searchQuery}&quot;
                  </span>
                  <button
                    onClick={() => onSearchChange('')}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Summary When Collapsed */}
      {!isFilterExpanded && (
        <div className="mb-6 flex items-center gap-4 px-4 py-3 bg-white rounded-xl border border-gray-200">
          <span className="text-sm text-gray-600">
            {t('viewing')}: <span className="font-semibold text-gray-900">{statusOptions.find(o => o.value === statusFilter)?.label}</span>
          </span>
          {searchQuery && (
            <span className="text-sm text-gray-600">
              | {t('search')}: <span className="font-semibold text-gray-900">&quot;{searchQuery}&quot;</span>
            </span>
          )}
          <span className="text-sm text-gray-600">
            | {t('sortedBy')}: <span className="font-semibold text-gray-900">{sortOptions.find(o => o.value === sortBy)?.label}</span>
          </span>
          <span className="text-sm text-gray-600">
            | <span className="font-semibold text-gray-900">{resultCount} {resultCount === 1 ? t('form') : t('forms')}</span>
          </span>
        </div>
      )}
    </>
  )
}
