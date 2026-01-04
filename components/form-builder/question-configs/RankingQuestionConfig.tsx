'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X, GripVertical, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { QuestionConfig } from '@/lib/database.types'
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
import { motion, AnimatePresence } from 'framer-motion'

interface RankingQuestionConfigProps {
  question: QuestionConfig
  onChange: (updates: Partial<QuestionConfig>) => void
}

// Sortable item component for ranking items
interface SortableRankingItemProps {
  id: string
  value: string
  index: number
  rank: number
  onUpdate: (value: string) => void
  onDelete: () => void
  canDelete: boolean
  label: string
}

function SortableRankingItem({ id, value, index, rank, onUpdate, onDelete, canDelete, label }: SortableRankingItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2 items-center ${isDragging ? 'opacity-50' : ''}`}
    >
      <button
        className="flex-shrink-0 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </button>
      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
        rank === 1 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'
      }`}>
        {rank === 1 ? <Trophy className="w-4 h-4" /> : rank}
      </div>
      <Input
        value={value}
        onChange={(e) => onUpdate(e.target.value)}
        placeholder={label}
        className="flex-1"
      />
      {canDelete && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onDelete}
          className="h-9 w-9 p-0"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </motion.div>
  )
}

export function RankingQuestionConfig({ question, onChange }: RankingQuestionConfigProps) {
  const t = useTranslations('form.rankingQuestion')

  const [items, setItems] = useState<string[]>(question.items || ['Option 1', 'Option 2', 'Option 3', 'Option 4'])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((_, i) => `item-${i}` === active.id)
        const newIndex = items.findIndex((_, i) => `item-${i}` === over.id)
        const newItems = arrayMove(items, oldIndex, newIndex)
        onChange({ items: newItems })
        return newItems
      })
    }
  }

  const updateItem = (index: number, value: string) => {
    const newItems = [...items]
    newItems[index] = value
    setItems(newItems)
    onChange({ items: newItems })
  }

  const deleteItem = (index: number) => {
    const newItems = items.filter((_, i) => i !== index)
    setItems(newItems)
    onChange({ items: newItems })
  }

  const addItem = () => {
    const newItems = [...items, `Option ${items.length + 1}`]
    setItems(newItems)
    onChange({ items: newItems })
  }

  return (
    <div className="space-y-6">
      {/* Items */}
      <div className="space-y-3">
        <Label>{t('items')}</Label>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={items.map((_, i) => `item-${i}`)} strategy={verticalListSortingStrategy}>
            <AnimatePresence>
              {items.map((item, i) => (
                <SortableRankingItem
                  key={`item-${i}`}
                  id={`item-${i}`}
                  value={item}
                  index={i}
                  rank={i + 1}
                  label={`Option ${i + 1}`}
                  onUpdate={(value) => updateItem(i, value)}
                  onDelete={() => deleteItem(i)}
                  canDelete={items.length > 2}
                />
              ))}
            </AnimatePresence>
          </SortableContext>
        </DndContext>
        <Button
          onClick={addItem}
          variant="outline"
          size="sm"
          className="w-full"
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
        <div>
          <Label htmlFor="shuffle-items">{t('shuffleItems')}</Label>
          <p className="text-xs text-gray-500">Randomize item order for respondents</p>
        </div>
        <Switch
          id="shuffle-items"
          checked={question.shuffle_items || false}
          onCheckedChange={(checked) => onChange({ shuffle_items: checked })}
        />
      </div>

      {/* Validation info */}
      <p className="text-xs text-gray-500">
        Minimum 2 items. Maximum 15 items. Drag items to set the default order.
      </p>
    </div>
  )
}
