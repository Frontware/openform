'use client'

import { Search, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
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
  const statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'closed', label: 'Closed' },
  ]

  const sortOptions = [
    { value: 'updated_at_desc', label: 'Newest first' },
    { value: 'updated_at_asc', label: 'Oldest first' },
    { value: 'title_asc', label: 'A-Z' },
    { value: 'title_desc', label: 'Z-A' },
    { value: 'response_count_desc', label: 'Most responses' },
    { value: 'response_count_asc', label: 'Fewest responses' },
  ]

  return (
    <div className="space-y-4">
      {/* Search and Sort Row */}
      <div className="flex items-center gap-4">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search forms..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 bg-white border-slate-200 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>

        {/* Sort Dropdown */}
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-sm text-slate-600">{resultCount} form{resultCount !== 1 ? 's' : ''}</span>
          <Select value={sortBy} onValueChange={onSortChange}>
            <SelectTrigger className="w-[180px] border-slate-200 hover:border-blue-400 bg-white">
              <SelectValue placeholder="Sort by..." />
              <ChevronDown className="w-4 h-4 ml-2 opacity-50" />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        {statusOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => onStatusChange(option.value as any)}
            className={`px-4 py-2 text-sm font-medium transition-all border-b-2 -mb-px ${
              statusFilter === option.value
                ? 'text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}
