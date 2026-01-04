'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { QuestionConfig, ThemeConfig, Json } from '@/lib/database.types'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useTranslations } from 'next-intl'
import { motion } from 'framer-motion'
import { Star, Upload, Check, X, FileText, Image as ImageIcon, Loader2, AlertCircle, GripVertical, Trophy } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface FileUploadValue {
  name: string
  url: string
  type: string
  size?: number
}

interface FileUploadQuestionProps {
  question: QuestionConfig
  value: FileUploadValue | null
  onChange: (value: FileUploadValue | null) => void
  theme: ThemeConfig
}

function FileUploadQuestion({ question, value, onChange, theme }: FileUploadQuestionProps) {
  const t = useTranslations('formPlayer')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileSelect = useCallback(async (file: File) => {
    setUploadError(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        // If R2 is not configured, fall back to base64
        if (response.status === 503 && !result.configured) {
          // Fall back to base64 for local/demo usage
          const reader = new FileReader()
          reader.onload = () => {
            onChange({
              name: file.name,
              type: file.type,
              size: file.size,
              url: reader.result as string, // base64 data URL
            })
            setIsUploading(false)
          }
          reader.onerror = () => {
            setUploadError('Failed to read file')
            setIsUploading(false)
          }
          reader.readAsDataURL(file)
          return
        }
        
        throw new Error(result.error || 'Upload failed')
      }

      // Success - store the R2 URL
      onChange({
        name: result.file.name,
        type: result.file.type,
        size: result.file.size,
        url: result.url,
      })
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }, [onChange])

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) {
            handleFileSelect(file)
          }
          // Reset input so same file can be selected again
          e.target.value = ''
        }}
      />
      
      {value ? (
        <div 
          className="p-4 rounded-xl border-2 flex items-center gap-4"
          style={{ borderColor: theme.primaryColor }}
        >
          <div 
            className="w-12 h-12 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${theme.primaryColor}20` }}
          >
            {value.type?.startsWith('image/') ? (
              <ImageIcon className="w-6 h-6" style={{ color: theme.primaryColor }} />
            ) : (
              <FileText className="w-6 h-6" style={{ color: theme.primaryColor }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate" style={{ color: theme.textColor }}>
              {value.name}
            </p>
            {value.size && (
              <p className="text-sm opacity-50" style={{ color: theme.textColor }}>
                {(value.size / 1024).toFixed(1)} KB
              </p>
            )}
          </div>
          <button
            onClick={() => onChange(null)}
            className="p-2 rounded-lg transition-colors hover:opacity-70"
            style={{ color: theme.textColor }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      ) : isUploading ? (
        <div 
          className="w-full p-8 rounded-xl border-2 border-dashed flex flex-col items-center gap-3"
          style={{ 
            borderColor: theme.primaryColor,
            color: theme.textColor,
          }}
        >
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.primaryColor }} />
          <p className="font-medium">{t('uploading')}</p>
        </div>
      ) : (
        <div>
          <motion.button
            type="button"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => fileInputRef.current?.click()}
            className="w-full p-8 rounded-xl border-2 border-dashed flex flex-col items-center gap-3 transition-colors"
            style={{ 
              borderColor: uploadError ? '#EF4444' : `${theme.textColor}30`,
              color: theme.textColor,
            }}
          >
            <Upload className="w-8 h-8 opacity-50" />
            <div className="text-center">
              <p className="font-medium">{t('clickToUpload')}</p>
              <p className="text-sm opacity-50 mt-1">
                {t('imagesAndPdfsUpTo', { size: question.maxFileSize || 10 })}
              </p>
            </div>
          </motion.button>
          {uploadError && (
            <div className="mt-3 flex items-center gap-2 text-sm" style={{ color: '#EF4444' }}>
              <AlertCircle className="w-4 h-4" />
              <span>{uploadError}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Matrix Question Component
interface MatrixQuestionProps {
  question: QuestionConfig
  value: Json
  onChange: (value: Json) => void
  theme: ThemeConfig
}

function MatrixQuestion({ question, value, onChange, theme }: MatrixQuestionProps) {
  const rows = question.rows || ['Item 1', 'Item 2', 'Item 3']
  const columns = question.columns || ['Poor', 'Fair', 'Good', 'Excellent']
  const [responses, setResponses] = useState<Record<string, string>>(() => {
    if (value && typeof value === 'object' && 'matrix_responses' in value) {
      return (value as { matrix_responses: Record<string, string> }).matrix_responses || {}
    }
    return {}
  })

  useEffect(() => {
    onChange({ matrix_responses: responses })
  }, [responses])

  const handleSelect = (row: string, column: string) => {
    setResponses(prev => ({ ...prev, [row]: column }))
  }

  return (
    <div className="w-full max-w-4xl overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-3 text-left border-b-2"></th>
            {columns.map((col, i) => (
              <th key={i} className="p-3 text-center border-b-2 font-medium" style={{ color: theme.textColor }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-gray-50/50' : ''}>
              <td className="p-3 font-medium" style={{ color: theme.textColor }}>{row}</td>
              {columns.map((col, colIdx) => {
                const isSelected = responses[row] === col
                return (
                  <td key={colIdx} className="p-3 text-center">
                    <button
                      type="button"
                      onClick={() => handleSelect(row, col)}
                      className={`w-10 h-10 rounded-lg border-2 mx-auto flex items-center justify-center transition-all ${
                        isSelected ? 'border-white' : 'border-gray-300 hover:border-gray-400'
                      }`}
                      style={isSelected ? {
                        backgroundColor: theme.primaryColor,
                        borderColor: theme.primaryColor,
                      } : {}}
                    >
                      {isSelected && <Check className="w-5 h-5 text-white" />}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Ranking Question Component
interface RankingItem {
  id: string
  text: string
  rank: number
}

interface SortableRankingItemProps {
  id: string
  text: string
  rank: number
  theme: ThemeConfig
}

function SortableRankingItem({ id, text, rank, theme }: SortableRankingItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-4 p-4 bg-white rounded-xl border-2 ${
        isDragging ? 'border-blue-400 shadow-lg' : 'border-gray-200'
      }`}
    >
      <div {...attributes} {...listeners} className="cursor-grab">
        <GripVertical className="w-5 h-5 text-gray-400" />
      </div>
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
        style={{ backgroundColor: theme.primaryColor }}
      >
        {rank}
      </div>
      {rank === 1 && <Trophy className="w-5 h-5 text-yellow-500" />}
      <div className="flex-1 font-medium">{text}</div>
    </div>
  )
}

interface RankingQuestionProps {
  question: QuestionConfig
  value: Json
  onChange: (value: Json) => void
  theme: ThemeConfig
}

function RankingQuestion({ question, value, onChange, theme }: RankingQuestionProps) {
  const items = question.items || ['Option 1', 'Option 2', 'Option 3', 'Option 4']
  const [rankingItems, setRankingItems] = useState<RankingItem[]>(() => {
    if (value && typeof value === 'object' && 'rankings' in value) {
      const rankings = (value as { rankings: Array<{ item: string; rank: number }> }).rankings || []
      return rankings.map((r, i) => ({
        id: r.item,
        text: r.item,
        rank: r.rank,
      }))
    }
    return items.map((item, i) => ({ id: item, text: item, rank: i + 1 }))
  })

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  useEffect(() => {
    onChange({
      rankings: rankingItems.map((item) => ({ item: item.text, rank: item.rank })),
    })
  }, [rankingItems])

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setRankingItems((items) => {
        const oldIdx = items.findIndex((i) => i.id === active.id)
        const newIdx = items.findIndex((i) => i.id === over.id)
        const newItems = arrayMove(items, oldIdx, newIdx)
        return newItems.map((item, i) => ({ ...item, rank: i + 1 }))
      })
    }
  }

  return (
    <div className="w-full max-w-2xl space-y-4">
      <p className="text-sm text-gray-500 flex items-center gap-2">
        <GripVertical className="w-4 h-4" /> Drag to reorder by preference
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={rankingItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {rankingItems.map((item) => (
              <SortableRankingItem key={item.id} {...item} theme={theme} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  )
}

interface QuestionRendererProps {
  question: QuestionConfig
  value: Json
  onChange: (value: Json) => void
  theme: ThemeConfig
  error?: string
  onSubmit: (skipValidation?: boolean) => void
  onClearError?: () => void
}

export function QuestionRenderer({ 
  question, 
  value, 
  onChange, 
  theme,
  error,
  onSubmit,
  onClearError
}: QuestionRendererProps) {
  const t = useTranslations('formPlayer')
  const [isFocused, setIsFocused] = useState(false)

  const inputStyles = {
    borderColor: error ? '#EF4444' : isFocused ? theme.primaryColor : `${theme.textColor}30`,
    color: theme.textColor,
    backgroundColor: 'transparent',
  }

  switch (question.type) {
    case 'short_text':
    case 'email':
    case 'phone':
    case 'url':
    case 'number':
      return (
        <Input
          type={question.type === 'number' ? 'number' : question.type === 'email' ? 'email' : 'text'}
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={question.placeholder || t('typeYourAnswer')}
          className="text-xl md:text-2xl h-auto py-3 px-0 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:opacity-40"
          style={inputStyles}
          autoFocus
        />
      )

    case 'long_text':
      return (
        <Textarea
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={question.placeholder || t('typeYourAnswer')}
          className="text-lg md:text-xl min-h-[150px] p-4 border-2 rounded-xl bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:opacity-40 resize-none"
          style={inputStyles}
          autoFocus
        />
      )

    case 'date':
      return (
        <Input
          type="date"
          value={String(value || '')}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className="text-xl md:text-2xl h-auto py-3 px-0 border-0 border-b-2 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
          style={inputStyles}
          autoFocus
        />
      )

    case 'dropdown':
      return (
        <div className="space-y-3">
          {(question.options || []).map((option, index) => {
            const isSelected = value === option
            return (
              <motion.button
                key={index}
                type="button"
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange(option)
                  onClearError?.()
                  onSubmit(true)
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all"
                style={{
                  borderColor: isSelected ? theme.primaryColor : `${theme.textColor}20`,
                  backgroundColor: isSelected ? `${theme.primaryColor}10` : 'transparent',
                  color: theme.textColor,
                }}
              >
                <div 
                  className="w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
                  style={{ 
                    borderColor: isSelected ? theme.primaryColor : `${theme.textColor}40`,
                    backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                  }}
                >
                  {isSelected ? (
                    <Check className="w-4 h-4" style={{ color: theme.backgroundColor }} />
                  ) : (
                    <span className="text-sm font-medium" style={{ color: theme.textColor }}>
                      {String.fromCharCode(65 + index)}
                    </span>
                  )}
                </div>
                <span className="text-lg">{option}</span>
              </motion.button>
            )
          })}
        </div>
      )

    case 'checkboxes':
      const selectedValues = Array.isArray(value) ? value : []
      return (
        <div className="space-y-3">
          {(question.options || []).map((option, index) => {
            const isSelected = selectedValues.includes(option)
            return (
              <motion.button
                key={index}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  const newValues = isSelected
                    ? selectedValues.filter(v => v !== option)
                    : [...selectedValues, option]
                  onChange(newValues)
                }}
                className="w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all"
                style={{
                  borderColor: isSelected ? theme.primaryColor : `${theme.textColor}20`,
                  backgroundColor: isSelected ? `${theme.primaryColor}10` : 'transparent',
                  color: theme.textColor,
                }}
              >
                <div 
                  className="w-8 h-8 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors"
                  style={{ 
                    borderColor: isSelected ? theme.primaryColor : `${theme.textColor}40`,
                    backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                  }}
                >
                  {isSelected ? (
                    <Check className="w-4 h-4" style={{ color: theme.backgroundColor }} />
                  ) : (
                    <span className="text-sm font-medium" style={{ color: theme.textColor }}>
                      {String.fromCharCode(65 + index)}
                    </span>
                  )}
                </div>
                <span className="text-lg">{option}</span>
              </motion.button>
            )
          })}
          <p className="text-sm opacity-50 mt-2" style={{ color: theme.textColor }}>
            {t('selectAllThatApply')}
          </p>
        </div>
      )

    case 'yes_no':
      const yesNoOptions = [
        { label: t('yes'), value: 'Yes' },
        { label: t('no'), value: 'No' },
      ]
      return (
        <div className="flex gap-4">
          {yesNoOptions.map((option) => {
            const isSelected = value === option.value
            return (
              <motion.button
                key={option.value}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange(option.value)
                  onClearError?.()
                  onSubmit(true)
                }}
                className="flex-1 flex items-center justify-center gap-3 p-5 rounded-xl border-2 transition-all"
                style={{
                  borderColor: isSelected ? theme.primaryColor : `${theme.textColor}20`,
                  backgroundColor: isSelected ? `${theme.primaryColor}10` : 'transparent',
                  color: theme.textColor,
                }}
              >
                <div 
                  className="w-8 h-8 rounded-lg border-2 flex items-center justify-center shrink-0 transition-colors"
                  style={{ 
                    borderColor: isSelected ? theme.primaryColor : `${theme.textColor}40`,
                    backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                  }}
                >
                  {isSelected ? (
                    <Check className="w-4 h-4" style={{ color: theme.backgroundColor }} />
                  ) : (
                    <span className="text-sm font-medium" style={{ color: theme.textColor }}>
                      {option.label[0]}
                    </span>
                  )}
                </div>
                <span className="text-xl font-medium">{option.label}</span>
              </motion.button>
            )
          })}
        </div>
      )

    case 'rating':
      const maxRating = question.maxValue || 5
      const currentRating = typeof value === 'number' ? value : 0
      return (
        <div className="flex gap-2">
          {Array.from({ length: maxRating }).map((_, index) => {
            const starValue = index + 1
            const isActive = starValue <= currentRating
            return (
              <motion.button
                key={index}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => onChange(starValue)}
                className="p-1"
              >
                <Star
                  className="w-10 h-10 md:w-12 md:h-12 transition-colors"
                  fill={isActive ? theme.primaryColor : 'transparent'}
                  style={{ 
                    color: isActive ? theme.primaryColor : `${theme.textColor}30`,
                  }}
                />
              </motion.button>
            )
          })}
        </div>
      )

    case 'opinion_scale':
      const minScale = question.minValue || 1
      const maxScale = question.maxValue || 10
      const scaleValue = typeof value === 'number' ? value : null
      return (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: maxScale - minScale + 1 }).map((_, index) => {
            const num = minScale + index
            const isSelected = scaleValue === num
            return (
              <motion.button
                key={num}
                type="button"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  onChange(num)
                  onClearError?.()
                  onSubmit(true)
                }}
                className="w-12 h-12 md:w-14 md:h-14 rounded-xl border-2 flex items-center justify-center text-lg font-medium transition-all"
                style={{
                  borderColor: isSelected ? theme.primaryColor : `${theme.textColor}30`,
                  backgroundColor: isSelected ? theme.primaryColor : 'transparent',
                  color: isSelected ? theme.backgroundColor : theme.textColor,
                }}
              >
                {num}
              </motion.button>
            )
          })}
        </div>
      )

    case 'file_upload':
      return (
        <FileUploadQuestion
          question={question}
          value={value as unknown as FileUploadValue | null}
          onChange={(val) => onChange(val as unknown as Json)}
          theme={theme}
        />
      )

    case 'matrix':
      return (
        <MatrixQuestion
          question={question}
          value={value}
          onChange={onChange}
          theme={theme}
        />
      )

    case 'ranking':
      return (
        <RankingQuestion
          question={question}
          value={value}
          onChange={onChange}
          theme={theme}
        />
      )

    default:
      return (
        <p style={{ color: theme.textColor }} className="opacity-50">
          Unsupported question type: {question.type}
        </p>
      )
  }
}

