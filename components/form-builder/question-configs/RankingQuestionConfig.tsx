'use client'

import { useTranslations } from 'next-intl'
import { Plus, X, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { QuestionConfig } from '@/lib/database.types'

interface RankingQuestionConfigProps {
  question: QuestionConfig
  onChange: (updates: Partial<QuestionConfig>) => void
}

export function RankingQuestionConfig({ question, onChange }: RankingQuestionConfigProps) {
  const t = useTranslations('form.rankingQuestion')

  const items = question.items || ['Option 1', 'Option 2', 'Option 3', 'Option 4']

  const updateItems = (newItems: string[]) => onChange({ items: newItems })

  return (
    <div className="space-y-6">
      {/* Items */}
      <div className="space-y-3">
        <Label>{t('items')}</Label>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <GripVertical className="w-4 h-4 text-gray-400 mt-2 flex-shrink-0 cursor-grab" />
            <Input
              value={item}
              onChange={(e) => {
                const newItems = [...items]
                newItems[i] = e.target.value
                updateItems(newItems)
              }}
              placeholder={`Option ${i + 1}`}
            />
            {items.length > 2 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateItems(items.filter((_, idx) => idx !== i))}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
        <Button
          onClick={() => updateItems([...items, `Option ${items.length + 1}`])}
          variant="outline"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('addItem')}
        </Button>
      </div>

      {/* Min/Max Selections */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="min-selections">{t('minSelections')}</Label>
          <Input
            id="min-selections"
            type="number"
            min={1}
            max={items.length}
            placeholder="Optional"
            value={question.min_selections ?? ''}
            onChange={(e) => {
              onChange({
                min_selections: e.target.value ? parseInt(e.target.value) : null,
              })
            }}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="max-selections">{t('maxSelections')}</Label>
          <Input
            id="max-selections"
            type="number"
            min={1}
            max={items.length}
            placeholder="Optional"
            value={question.max_selections ?? ''}
            onChange={(e) => {
              onChange({
                max_selections: e.target.value ? parseInt(e.target.value) : null,
              })
            }}
          />
        </div>
      </div>

      {/* Shuffle Items */}
      <div className="flex items-center justify-between">
        <Label htmlFor="shuffle-items">{t('shuffleItems')}</Label>
        <Switch
          id="shuffle-items"
          checked={question.shuffle_items || false}
          onCheckedChange={(checked) => onChange({ shuffle_items: checked })}
        />
      </div>

      {/* Validation info */}
      <p className="text-xs text-gray-500">
        Minimum 2 items. Maximum 15 items.
      </p>
    </div>
  )
}
