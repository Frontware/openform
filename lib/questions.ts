import {
  AlignLeft,
  ArrowUpDown,
  Calendar,
  CheckSquare,
  Gauge,
  Grid3x3,
  Hash,
  Link,
  List,
  LucideIcon,
  Mail,
  Phone,
  Star,
  ThumbsUp,
  Type,
  Upload
} from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { QuestionConfig, QuestionType } from './database.types'

export interface QuestionTypeInfo {
  type: QuestionType
  label: string
  description: string
  icon: LucideIcon
  defaultConfig: Partial<QuestionConfig>
}

export const questionTypes: QuestionTypeInfo[] = [
  {
    type: 'short_text',
    label: 'Short Text',
    description: 'A single line text input',
    icon: Type,
    defaultConfig: {
      placeholder: 'Type your answer here...',
    },
  },
  {
    type: 'long_text',
    label: 'Long Text',
    description: 'A multi-line text area',
    icon: AlignLeft,
    defaultConfig: {
      placeholder: 'Type your answer here...',
    },
  },
  {
    type: 'dropdown',
    label: 'Dropdown',
    description: 'Select one option from a list',
    icon: List,
    defaultConfig: {
      options: ['Option 1', 'Option 2', 'Option 3'],
    },
  },
  {
    type: 'checkboxes',
    label: 'Checkboxes',
    description: 'Select multiple options from a list',
    icon: CheckSquare,
    defaultConfig: {
      options: ['Option 1', 'Option 2', 'Option 3'],
    },
  },
  {
    type: 'email',
    label: 'Email',
    description: 'An email address input',
    icon: Mail,
    defaultConfig: {
      placeholder: 'info@weladee.com',
    },
  },
  {
    type: 'phone',
    label: 'Phone',
    description: 'A phone number input',
    icon: Phone,
    defaultConfig: {
      placeholder: '+6625592308',
    },
  },
  {
    type: 'number',
    label: 'Number',
    description: 'A numeric input',
    icon: Hash,
    defaultConfig: {
      placeholder: '0',
    },
  },
  {
    type: 'date',
    label: 'Date',
    description: 'A date picker',
    icon: Calendar,
    defaultConfig: {},
  },
  {
    type: 'rating',
    label: 'Rating',
    description: 'A star rating (1-5)',
    icon: Star,
    defaultConfig: {
      minValue: 1,
      maxValue: 5,
    },
  },
  {
    type: 'opinion_scale',
    label: 'Opinion Scale',
    description: 'A numeric scale (1-10)',
    icon: Gauge,
    defaultConfig: {
      minValue: 1,
      maxValue: 10,
    },
  },
  {
    type: 'yes_no',
    label: 'Yes / No',
    description: 'A simple yes or no choice',
    icon: ThumbsUp,
    defaultConfig: {},
  },
  {
    type: 'file_upload',
    label: 'File Upload',
    description: 'Upload images or PDFs',
    icon: Upload,
    defaultConfig: {
      allowedFileTypes: ['image/*', 'application/pdf'],
      maxFileSize: 10, // MB
    },
  },
  {
    type: 'url',
    label: 'Website URL',
    description: 'A URL input',
    icon: Link,
    defaultConfig: {
      placeholder: 'https://example.com',
    },
  },
  {
    type: 'matrix',
    label: 'Matrix/Grid',
    description: 'Rate multiple items using the same scale',
    icon: Grid3x3,
    defaultConfig: {
      rows: ['Item 1', 'Item 2', 'Item 3'],
      columns: ['Poor', 'Fair', 'Good', 'Excellent'],
      allow_multiple_per_row: false,
    },
  },
  {
    type: 'ranking',
    label: 'Ranking',
    description: 'Order items by preference',
    icon: ArrowUpDown,
    defaultConfig: {
      items: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      min_selections: null,
      max_selections: null,
      shuffle_items: false,
    },
  },
]

export function getQuestionTypeInfo(type: QuestionType): QuestionTypeInfo | undefined {
  return questionTypes.find(qt => qt.type === type)
}

export function createDefaultQuestion(type: QuestionType): QuestionConfig {
  const typeInfo = getQuestionTypeInfo(type)
  const id = uuidv4()
  
  return {
    id,
    type,
    title: '',
    description: '',
    required: false,
    ...typeInfo?.defaultConfig,
  }
}

