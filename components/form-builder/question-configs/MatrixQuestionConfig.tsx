'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, X, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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

interface MatrixQuestionConfigProps {
  question: QuestionConfig
  onChange: (updates: Partial<QuestionConfig>) => void
}

// Sortable item component for rows/columns
interface SortableItemProps {
  id: string
  value: string
  index: number
  onUpdate: (value: string) => void
  onDelete: () => void
  canDelete: boolean
  label: string
}

function SortableItem({ id, value, index, onUpdate, onDelete, canDelete, label }: SortableItemProps) {
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
      className={`flex gap-2 ${isDragging ? 'opacity-50' : ''}`}
    >
      <button
        className="mt-2 flex-shrink-0 cursor-grab active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
      </button>
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

export function MatrixQuestionConfig({ question, onChange }: MatrixQuestionConfigProps) {
  const t = useTranslations('form.matrixQuestion')

  const [rows, setRows] = useState<string[]>(question.rows || ['Item 1', 'Item 2', 'Item 3'])
  const [columns, setColumns] = useState<string[]>(question.columns || ['Poor', 'Fair', 'Good', 'Excellent'])
  const [inputType, setInputType] = useState<'radio' | 'checkbox'>(question.input_type || 'radio')

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const handleRowDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setRows((items) => {
        const oldIndex = items.findIndex((_, i) => `row-${i}` === active.id)
        const newIndex = items.findIndex((_, i) => `row-${i}` === over.id)
        const newRows = arrayMove(items, oldIndex, newIndex)
        onChange({ rows: newRows })
        return newRows
      })
    }
  }

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.findIndex((_, i) => `col-${i}` === active.id)
        const newIndex = items.findIndex((_, i) => `col-${i}` === over.id)
        const newColumns = arrayMove(items, oldIndex, newIndex)
        onChange({ columns: newColumns })
        return newColumns
      })
    }
  }

  const updateRow = (index: number, value: string) => {
    const newRows = [...rows]
    newRows[index] = value
    setRows(newRows)
    onChange({ rows: newRows })
  }

  const deleteRow = (index: number) => {
    const newRows = rows.filter((_, i) => i !== index)
    setRows(newRows)
    onChange({ rows: newRows })
  }

  const addRow = () => {
    const newRows = [...rows, `Item ${rows.length + 1}`]
    setRows(newRows)
    onChange({ rows: newRows })
  }

  const updateColumn = (index: number, value: string) => {
    const newColumns = [...columns]
    newColumns[index] = value
    setColumns(newColumns)
    onChange({ columns: newColumns })
  }

  const deleteColumn = (index: number) => {
    const newColumns = columns.filter((_, i) => i !== index)
    setColumns(newColumns)
    onChange({ columns: newColumns })
  }

  const addColumn = () => {
    const newColumns = [...columns, `Option ${columns.length + 1}`]
    setColumns(newColumns)
    onChange({ columns: newColumns })
  }

  return (
    <div className="space-y-6">
      {/* Input Type Selector */}
      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="input-type">Input Type</Label>
          <p className="text-xs text-gray-500">Choose radio buttons or checkboxes</p>
        </div>
        <Select value={inputType} onValueChange={(value: 'radio' | 'checkbox') => {
          setInputType(value)
          onChange({ input_type: value })
        }}>
          <SelectTrigger id="input-type" className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="radio">Radio (Single)</SelectItem>
            <SelectItem value="checkbox">Checkbox (Multiple)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Allow Multiple Per Row (for checkbox mode) */}
      {inputType === 'checkbox' && (
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="allow-multiple">Allow Multiple Per Row</Label>
            <p className="text-xs text-gray-500">Users can select multiple options per row</p>
          </div>
          <Switch
            id="allow-multiple"
            checked={question.allow_multiple_per_row || false}
            onCheckedChange={(checked) => onChange({ allow_multiple_per_row: checked })}
          />
        </div>
      )}

      {/* Rows */}
      <div className="space-y-3">
        <Label>{t('rows')}</Label>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleRowDragEnd}>
          <SortableContext items={rows.map((_, i) => `row-${i}`)} strategy={verticalListSortingStrategy}>
            <AnimatePresence>
              {rows.map((row, i) => (
                <SortableItem
                  key={`row-${i}`}
                  id={`row-${i}`}
                  value={row}
                  index={i}
                  label={`Row ${i + 1}`}
                  onUpdate={(value) => updateRow(i, value)}
                  onDelete={() => deleteRow(i)}
                  canDelete={rows.length > 2}
                />
              ))}
            </AnimatePresence>
          </SortableContext>
        </DndContext>
        <Button
          onClick={addRow}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('addRow')}
        </Button>
      </div>

      {/* Columns */}
      <div className="space-y-3">
        <Label>{t('columns')}</Label>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleColumnDragEnd}>
          <SortableContext items={columns.map((_, i) => `col-${i}`)} strategy={verticalListSortingStrategy}>
            <AnimatePresence>
              {columns.map((col, i) => (
                <SortableItem
                  key={`col-${i}`}
                  id={`col-${i}`}
                  value={col}
                  index={i}
                  label={`Column ${i + 1}`}
                  onUpdate={(value) => updateColumn(i, value)}
                  onDelete={() => deleteColumn(i)}
                  canDelete={columns.length > 2}
                />
              ))}
            </AnimatePresence>
          </SortableContext>
        </DndContext>
        <Button
          onClick={addColumn}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('addColumn')}
        </Button>
      </div>

      {/* Validation info */}
      <p className="text-xs text-gray-500">
        Minimum 2 rows and 2 columns. Maximum 20 rows and 10 columns.
      </p>
    </div>
  )
}
