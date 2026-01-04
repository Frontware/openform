# Instructions for AI Agent: Add Matrix & Ranking Question Types to Weladee Form

## Project Context
- **Repository:** https://github.com/Frontware/openform/tree/feature/grpc-migration
- **Documentation:** See CLAUDE.md for full project architecture
- **Current Question Types:** 13 types (short_text, long_text, dropdown, checkboxes, email, phone, number, date, rating, opinion_scale, yes_no, file_upload, url)
- **New Question Types:** Matrix and Ranking

---

## Objective

Add two new powerful question types to Weladee Form:

1. **Matrix Question** - Rate multiple items using the same scale (e.g., satisfaction survey)
2. **Ranking Question** - Drag-and-drop ordering of items by preference/priority

Both implementations must include:
- ✅ Database schema updates
- ✅ Protocol buffer definitions
- ✅ Backend validation logic
- ✅ Beautiful, modern UI components
- ✅ Form builder configuration
- ✅ Form player display
- ✅ Response storage and retrieval
- ✅ Export to CSV/JSON with proper formatting
- ✅ Multi-language support (EN/TH/FR)

---

## Part 1: Database Schema Updates

### Step 1.1: Update Question Type Enum

**File: `sql/schema/form_schema.sql`**

Add new question types to the enum:

```sql
-- Find the question_type enum and add new types
ALTER TYPE form.question_type ADD VALUE IF NOT EXISTS 'matrix';
ALTER TYPE form.question_type ADD VALUE IF NOT EXISTS 'ranking';
```

### Step 1.2: Data Storage Format

Matrix and ranking questions use existing JSONB fields (no migration needed).

**Matrix Question Settings (`form.questions.settings`):**
```json
{
  "rows": ["Product Quality", "Customer Service", "Delivery Speed"],
  "columns": ["Poor", "Fair", "Good", "Excellent"],
  "allow_multiple_per_row": false
}
```

**Matrix Answer (`form.answers.answer_choices`):**
```json
{
  "matrix_responses": {
    "Product Quality": "Good",
    "Customer Service": "Excellent",
    "Delivery Speed": "Fair"
  }
}
```

**Ranking Question Settings (`form.questions.settings`):**
```json
{
  "items": ["Feature A", "Feature B", "Feature C", "Feature D"],
  "min_selections": 3,
  "max_selections": null,
  "shuffle_items": false
}
```

**Ranking Answer (`form.answers.answer_choices`):**
```json
{
  "rankings": [
    { "item": "Feature C", "rank": 1 },
    { "item": "Feature A", "rank": 2 },
    { "item": "Feature B", "rank": 3 }
  ]
}
```

---

## Part 2: Protocol Buffer Updates

### Step 2.1: Update QuestionType Enum

**File: `proto/form.proto`**

```protobuf
enum QuestionType {
  QUESTION_TYPE_UNSPECIFIED = 0;
  QUESTION_TYPE_SHORT_TEXT = 1;
  QUESTION_TYPE_LONG_TEXT = 2;
  QUESTION_TYPE_DROPDOWN = 3;
  QUESTION_TYPE_CHECKBOXES = 4;
  QUESTION_TYPE_EMAIL = 5;
  QUESTION_TYPE_PHONE = 6;
  QUESTION_TYPE_NUMBER = 7;
  QUESTION_TYPE_DATE = 8;
  QUESTION_TYPE_RATING = 9;
  QUESTION_TYPE_OPINION_SCALE = 10;
  QUESTION_TYPE_YES_NO = 11;
  QUESTION_TYPE_FILE_UPLOAD = 12;
  QUESTION_TYPE_URL = 13;
  QUESTION_TYPE_MATRIX = 14;      // NEW
  QUESTION_TYPE_RANKING = 15;     // NEW
}
```

### Step 2.2: Regenerate

```bash
make proto
```

---

## Part 3: Backend Validation

### Step 3.1: Add Validation Functions

**File: `internal/gapi/rpc_form.go`**

Add these validation functions:

```go
func validateMatrixQuestion(settings map[string]interface{}) error {
    rows, ok := settings["rows"].([]interface{})
    if !ok || len(rows) < 2 {
        return status.Error(codes.InvalidArgument, "matrix must have at least 2 rows")
    }
    if len(rows) > 20 {
        return status.Error(codes.InvalidArgument, "matrix cannot have more than 20 rows")
    }
    
    columns, ok := settings["columns"].([]interface{})
    if !ok || len(columns) < 2 {
        return status.Error(codes.InvalidArgument, "matrix must have at least 2 columns")
    }
    if len(columns) > 10 {
        return status.Error(codes.InvalidArgument, "matrix cannot have more than 10 columns")
    }
    
    return nil
}

func validateRankingQuestion(settings map[string]interface{}) error {
    items, ok := settings["items"].([]interface{})
    if !ok || len(items) < 2 {
        return status.Error(codes.InvalidArgument, "ranking must have at least 2 items")
    }
    if len(items) > 15 {
        return status.Error(codes.InvalidArgument, "ranking cannot have more than 15 items")
    }
    
    if minSel, ok := settings["min_selections"].(float64); ok {
        if minSel < 1 || minSel > float64(len(items)) {
            return status.Error(codes.InvalidArgument, "invalid min_selections")
        }
    }
    
    return nil
}
```

Add validation calls in `CreateQuestion`:

```go
switch req.Type {
case pb.QuestionType_QUESTION_TYPE_MATRIX:
    if err := validateMatrixQuestion(settingsMap); err != nil {
        return nil, err
    }
case pb.QuestionType_QUESTION_TYPE_RANKING:
    if err := validateRankingQuestion(settingsMap); err != nil {
        return nil, err
    }
}
```

---

## Part 4: Frontend Type Definitions

### Step 4.1: Update Question Types

**File: `lib/questions.ts`**

```typescript
export const QUESTION_TYPES = {
  // ... existing types ...
  MATRIX: 'matrix',
  RANKING: 'ranking',
} as const;

export interface MatrixQuestionSettings {
  rows: string[];
  columns: string[];
  allow_multiple_per_row?: boolean;
}

export interface RankingQuestionSettings {
  items: string[];
  min_selections?: number | null;
  max_selections?: number | null;
  shuffle_items?: boolean;
}

export const QUESTION_TYPE_INFO = {
  // ... existing types ...
  matrix: {
    label: 'Matrix/Grid',
    description: 'Rate multiple items using the same scale',
    icon: 'Grid3x3',
    defaultSettings: {
      rows: ['Item 1', 'Item 2', 'Item 3'],
      columns: ['Poor', 'Fair', 'Good', 'Excellent'],
      allow_multiple_per_row: false,
    },
  },
  ranking: {
    label: 'Ranking',
    description: 'Order items by preference',
    icon: 'ArrowUpDown',
    defaultSettings: {
      items: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      min_selections: null,
      max_selections: null,
      shuffle_items: false,
    },
  },
};
```

---

## Part 5: Add Translations

**File: `messages/en.json`**

```json
{
  "questionTypes": {
    "matrix": "Matrix/Grid",
    "ranking": "Ranking"
  },
  "formBuilder": {
    "matrixRows": "Rows",
    "matrixColumns": "Columns",
    "matrixAddRow": "Add row",
    "matrixAddColumn": "Add column",
    "rankingItems": "Items to rank",
    "rankingAddItem": "Add item"
  },
  "formPlayer": {
    "rankingDragToReorder": "Drag to reorder"
  }
}
```

**File: `messages/th.json`**

```json
{
  "questionTypes": {
    "matrix": "ตารางเมทริกซ์",
    "ranking": "จัดอันดับ"
  },
  "formBuilder": {
    "matrixRows": "แถว",
    "matrixColumns": "คอลัมน์",
    "matrixAddRow": "เพิ่มแถว",
    "matrixAddColumn": "เพิ่มคอลัมน์",
    "rankingItems": "รายการที่จะจัดอันดับ",
    "rankingAddItem": "เพิ่มรายการ"
  },
  "formPlayer": {
    "rankingDragToReorder": "ลากเพื่อจัดเรียง"
  }
}
```

**File: `messages/fr.json`**

```json
{
  "questionTypes": {
    "matrix": "Matrice",
    "ranking": "Classement"
  },
  "formBuilder": {
    "matrixRows": "Lignes",
    "matrixColumns": "Colonnes",
    "matrixAddRow": "Ajouter ligne",
    "matrixAddColumn": "Ajouter colonne",
    "rankingItems": "Éléments à classer",
    "rankingAddItem": "Ajouter élément"
  },
  "formPlayer": {
    "rankingDragToReorder": "Glisser pour réorganiser"
  }
}
```

---

## Part 6: Form Builder Components

### Step 6.1: Matrix Configuration

**File: `components/form-builder/question-configs/MatrixQuestionConfig.tsx`** (NEW)

```tsx
'use client';

import { Plus, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function MatrixQuestionConfig({ settings, onChange }) {
  const rows = settings.rows || ['Item 1', 'Item 2'];
  const columns = settings.columns || ['Poor', 'Fair', 'Good'];

  const updateRows = (newRows) => onChange({ ...settings, rows: newRows });
  const updateColumns = (newCols) => onChange({ ...settings, columns: newCols });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Rows (Items to rate)</Label>
        {rows.map((row, i) => (
          <div key={i} className="flex gap-2">
            <GripVertical className="w-4 h-4 text-gray-400 mt-2" />
            <Input
              value={row}
              onChange={(e) => {
                const newRows = [...rows];
                newRows[i] = e.target.value;
                updateRows(newRows);
              }}
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
          <Plus className="w-4 h-4 mr-2" /> Add row
        </Button>
      </div>

      <div className="space-y-3">
        <Label>Columns (Rating scale)</Label>
        {columns.map((col, i) => (
          <div key={i} className="flex gap-2">
            <GripVertical className="w-4 h-4 text-gray-400 mt-2" />
            <Input
              value={col}
              onChange={(e) => {
                const newCols = [...columns];
                newCols[i] = e.target.value;
                updateColumns(newCols);
              }}
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
          <Plus className="w-4 h-4 mr-2" /> Add column
        </Button>
      </div>
    </div>
  );
}
```

### Step 6.2: Ranking Configuration

**File: `components/form-builder/question-configs/RankingQuestionConfig.tsx`** (NEW)

```tsx
'use client';

import { Plus, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function RankingQuestionConfig({ settings, onChange }) {
  const items = settings.items || ['Option 1', 'Option 2', 'Option 3'];

  const updateItems = (newItems) => onChange({ ...settings, items: newItems });

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label>Items to rank</Label>
        {items.map((item, i) => (
          <div key={i} className="flex gap-2">
            <GripVertical className="w-4 h-4 text-gray-400 mt-2" />
            <Input
              value={item}
              onChange={(e) => {
                const newItems = [...items];
                newItems[i] = e.target.value;
                updateItems(newItems);
              }}
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
          <Plus className="w-4 h-4 mr-2" /> Add item
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Min selections</Label>
          <Input
            type="number"
            min={1}
            max={items.length}
            placeholder="Optional"
            value={settings.min_selections || ''}
            onChange={(e) =>
              onChange({
                ...settings,
                min_selections: e.target.value ? parseInt(e.target.value) : null,
              })
            }
          />
        </div>
        <div>
          <Label>Max selections</Label>
          <Input
            type="number"
            min={1}
            max={items.length}
            placeholder="Optional"
            value={settings.max_selections || ''}
            onChange={(e) =>
              onChange({
                ...settings,
                max_selections: e.target.value ? parseInt(e.target.value) : null,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
```

---

## Part 7: Form Player Components

### Step 7.1: Install Dependencies

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Step 7.2: Matrix Display

**File: `components/form-player/questions/MatrixQuestion.tsx`** (NEW)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function MatrixQuestion({ question, value, onChange, theme }) {
  const { rows, columns } = question.settings;
  const [responses, setResponses] = useState(value?.matrix_responses || {});

  useEffect(() => {
    onChange({ matrix_responses: responses });
  }, [responses]);

  const handleSelect = (row, column) => {
    setResponses({ ...responses, [row]: column });
  };

  return (
    <div className="w-full max-w-4xl overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="p-3 text-left border-b-2"></th>
            {columns.map((col, i) => (
              <th key={i} className="p-3 text-center border-b-2 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIdx) => (
            <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-gray-50/50' : ''}>
              <td className="p-3 font-medium">{row}</td>
              {columns.map((col, colIdx) => (
                <td key={colIdx} className="p-3 text-center">
                  <button
                    type="button"
                    onClick={() => handleSelect(row, col)}
                    className={cn(
                      'w-10 h-10 rounded-lg border-2 mx-auto flex items-center justify-center transition-all',
                      responses[row] === col
                        ? 'border-blue-600 bg-blue-600 text-white scale-110'
                        : 'border-gray-300 hover:border-gray-400'
                    )}
                    style={
                      responses[row] === col
                        ? { backgroundColor: theme.primaryColor, borderColor: theme.primaryColor }
                        : {}
                    }
                  >
                    {responses[row] === col && <Check className="w-5 h-5" />}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

### Step 7.3: Ranking Display

**File: `components/form-player/questions/RankingQuestion.tsx`** (NEW)

```tsx
'use client';

import { useState, useEffect } from 'react';
import { GripVertical, Trophy } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function SortableItem({ id, text, rank, theme }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
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
  );
}

export function RankingQuestion({ question, value, onChange, theme }) {
  const { items: originalItems } = question.settings;
  const [items, setItems] = useState(() =>
    (value?.rankings || originalItems.map((item, i) => ({ item, rank: i + 1 }))).map((r) => ({
      id: r.item,
      text: r.item,
      rank: r.rank,
    }))
  );

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    onChange({
      rankings: items.map((item) => ({ item: item.text, rank: item.rank })),
    });
  }, [items]);

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIdx = items.findIndex((i) => i.id === active.id);
        const newIdx = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIdx, newIdx);
        return newItems.map((item, i) => ({ ...item, rank: i + 1 }));
      });
    }
  };

  return (
    <div className="w-full max-w-2xl space-y-4">
      <p className="text-sm text-gray-500 flex items-center gap-2">
        <GripVertical className="w-4 h-4" /> Drag to reorder by preference
      </p>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {items.map((item) => (
              <SortableItem key={item.id} {...item} theme={theme} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

---

## Part 8: Integration

### Step 8.1: Register in Form Builder

**File: `components/form-builder/form-builder.tsx`**

```typescript
import { MatrixQuestionConfig } from './question-configs/MatrixQuestionConfig';
import { RankingQuestionConfig } from './question-configs/RankingQuestionConfig';

// In question config renderer:
case 'matrix':
  return <MatrixQuestionConfig settings={q.settings} onChange={(s) => updateQuestion(q.id, { settings: s })} />;
case 'ranking':
  return <RankingQuestionConfig settings={q.settings} onChange={(s) => updateQuestion(q.id, { settings: s })} />;
```

### Step 8.2: Register in Form Player

**File: `components/form-player/form-player.tsx`**

```typescript
import { MatrixQuestion } from './questions/MatrixQuestion';
import { RankingQuestion } from './questions/RankingQuestion';

// In question renderer:
case 'matrix':
  return <MatrixQuestion question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} theme={theme} />;
case 'ranking':
  return <RankingQuestion question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} theme={theme} />;
```

---

## Part 9: Export Handling

**File: `internal/utils/export.go`**

Add CSV formatting:

```go
func formatMatrixAnswerCSV(answerChoices map[string]interface{}) string {
    responses := answerChoices["matrix_responses"].(map[string]interface{})
    var parts []string
    for row, val := range responses {
        parts = append(parts, fmt.Sprintf("%s: %s", row, val))
    }
    return strings.Join(parts, "; ")
}

func formatRankingAnswerCSV(answerChoices map[string]interface{}) string {
    rankings := answerChoices["rankings"].([]interface{})
    var parts []string
    for _, r := range rankings {
        rankMap := r.(map[string]interface{})
        parts = append(parts, fmt.Sprintf("#%d: %s", int(rankMap["rank"].(float64)), rankMap["item"]))
    }
    return strings.Join(parts, "; ")
}
```

---

## Testing Checklist

### Matrix:
- ✅ Add/remove rows (min 2, max 20)
- ✅ Add/remove columns (min 2, max 10)
- ✅ Select answers for each row
- ✅ Required validation works
- ✅ CSV export shows "Row: Value" format
- ✅ Responsive on mobile

### Ranking:
- ✅ Add/remove items (min 2, max 15)
- ✅ Drag to reorder items
- ✅ Rank numbers update correctly
- ✅ Trophy icon on #1
- ✅ CSV export shows "#1: Item" format
- ✅ Touch support on mobile

---

## Summary

This adds two professional question types:
- **Matrix**: Perfect for satisfaction surveys, feature ratings
- **Ranking**: Ideal for priority/preference ordering

Both include validation, beautiful UI, proper data storage, and export support.