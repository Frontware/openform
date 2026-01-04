'use client'

import { useTranslations } from 'next-intl'
import { Plus, X, GripVertical } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { QuestionConfig } from '@/lib/database.types'

interface MatrixQuestionConfigProps {
  question: QuestionConfig
  onChange: (updates: Partial<QuestionConfig>) => void
}

export function MatrixQuestionConfig({ question, onChange }: MatrixQuestionConfigProps) {
  const t = useTranslations('form.matrixQuestion')

  const rows = question.rows || ['Item 1', 'Item 2', 'Item 3']
  const columns = question.columns || ['Poor', 'Fair', 'Good', 'Excellent']

  const updateRows = (newRows: string[]) => onChange({ rows: newRows })
  const updateColumns = (newCols: string[]) => onChange({ columns: newCols })

  return (
    <div className="space-y-6">
      {/* Rows */}
      <div className="space-y-3">
        <Label>{t('rows')}</Label>
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <GripVertical className="w-4 h-4 text-gray-400 mt-2 flex-shrink-0 cursor-grab" />
            <Input
              value={row}
              onChange={(e) => {
                const newRows = [...rows]
                newRows[i] = e.target.value
                updateRows(newRows)
              }}
              placeholder={`Row ${i + 1}`}
            />
            {rows.length > 2 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateRows(rows.filter((_, idx) => idx !== i))}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
        <Button
          onClick={() => updateRows([...rows, `Item ${rows.length + 1}`])}
          variant="outline"
          size="sm"
        >
          <Plus className="w-4 h-4 mr-2" /> {t('addRow')}
        </Button>
      </div>

      {/* Columns */}
      <div className="space-y-3">
        <Label>{t('columns')}</Label>
        {columns.map((col, i) => (
          <div key={i} className="flex gap-2">
            <GripVertical className="w-4 h-4 text-gray-400 mt-2 flex-shrink-0 cursor-grab" />
            <Input
              value={col}
              onChange={(e) => {
                const newCols = [...columns]
                newCols[i] = e.target.value
                updateColumns(newCols)
              }}
              placeholder={`Column ${i + 1}`}
            />
            {columns.length > 2 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => updateColumns(columns.filter((_, idx) => idx !== i))}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        ))}
        <Button
          onClick={() => updateColumns([...columns, `Option ${columns.length + 1}`])}
          variant="outline"
          size="sm"
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
