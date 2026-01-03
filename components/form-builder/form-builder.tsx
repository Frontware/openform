'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Form, QuestionConfig, ThemePreset, FormStatus } from '@/lib/database.types'
import { questionTypes, createDefaultQuestion } from '@/lib/questions'
import { themes, themeList } from '@/lib/themes'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { motion, AnimatePresence, Reorder } from 'framer-motion'
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Eye,
  Save,
  Globe,
  X,
  ExternalLink,
  Copy,
  Settings,
  Palette,
  FileText,
  Pencil,
} from 'lucide-react'
import Link from 'next/link'
import { QuestionEditor } from './question-editor'
import { FormPreview } from './form-preview'
import { formClient } from '@/lib/grpc-client'
import { FormTheme, QuestionType } from '@/lib/proto/proto/form_pb'
import { Struct, Value } from '@bufbuild/protobuf'

interface FormBuilderProps {
  form: Form
}

// Helpers to map UI types to Proto types
function mapThemeToProto(theme: string): FormTheme {
  switch (theme) {
    case 'minimal': return FormTheme.MINIMAL
    case 'midnight': return FormTheme.MIDNIGHT
    case 'ocean': return FormTheme.OCEAN
    case 'sunset': return FormTheme.SUNSET
    case 'forest': return FormTheme.FOREST
    case 'lavender': return FormTheme.LAVENDER
    default: return FormTheme.UNSPECIFIED // or default
  }
}

function mapQuestionTypeToProto(type: QuestionConfig['type']): QuestionType {
  switch (type) {
    case 'short_text': return QuestionType.SHORT_TEXT
    case 'long_text': return QuestionType.LONG_TEXT
    case 'dropdown': return QuestionType.DROPDOWN
    case 'checkboxes': return QuestionType.CHECKBOXES
    case 'email': return QuestionType.EMAIL
    case 'phone': return QuestionType.PHONE
    case 'number': return QuestionType.NUMBER
    case 'date': return QuestionType.DATE
    case 'rating': return QuestionType.RATING
    case 'opinion_scale': return QuestionType.OPINION_SCALE
    case 'yes_no': return QuestionType.YES_NO
    case 'file_upload': return QuestionType.FILE_UPLOAD
    case 'url': return QuestionType.URL
    default: return QuestionType.UNSPECIFIED
  }
}

// Helper to construct validation rules struct
function buildValidationRules(q: QuestionConfig): Struct {
  const rules: Record<string, any> = {}
  if (q.minValue !== undefined) rules['minValue'] = q.minValue
  if (q.maxValue !== undefined) rules['maxValue'] = q.maxValue
  if (q.maxFileSize !== undefined) rules['maxFileSize'] = q.maxFileSize
  if (q.allowedFileTypes) rules['allowedFileTypes'] = q.allowedFileTypes
  return Struct.fromJson(rules)
}

// Helper to construct options struct
function buildOptions(q: QuestionConfig): Struct {
  const opts: Record<string, any> = {}
  if (q.options) {
      opts['items'] = q.options
  }
  return Struct.fromJson(opts)
}


export function FormBuilder({ form: initialForm }: FormBuilderProps) {
  const router = useRouter()
  
  const [form, setForm] = useState(initialForm)
  const [questions, setQuestions] = useState<QuestionConfig[]>(
    (initialForm.questions as QuestionConfig[]) || []
  )
  const [originalQuestions, setOriginalQuestions] = useState<QuestionConfig[]>(
    (initialForm.questions as QuestionConfig[]) || []
  )
  const [deletedQuestionIds, setDeletedQuestionIds] = useState<Set<string>>(new Set())

  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [showPublishDialog, setShowPublishDialog] = useState(false)
  const [showAddQuestion, setShowAddQuestion] = useState(false)
  const [activeTab, setActiveTab] = useState('questions')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const selectedQuestion = questions.find(q => q.id === selectedQuestionId)

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    console.log('[handleSave] Starting save process...')
    console.log('[handleSave] Form ID:', form.id)
    console.log('[handleSave] Questions:', questions)
    console.log('[handleSave] Original questions:', originalQuestions)
    try {
      // 1. Update Form Metadata
      console.log('[handleSave] Calling updateForm...')
      const updateResult = await formClient.updateForm({
        id: form.id,
        title: form.title,
        description: form.description || undefined,
        theme: mapThemeToProto(form.theme),
        customThankYouMessage: form.thank_you_message,
        forceCaptcha: form.force_captcha,
      })
      console.log('[handleSave] updateForm result:', updateResult)

      // 2. Delete removed questions
      for (const id of deletedQuestionIds) {
          try {
              await formClient.deleteQuestion({ id })
          } catch (e) {
              console.error("Failed to delete question", id, e)
          }
      }
      setDeletedQuestionIds(new Set())

      // 3. Update or Create questions
      const newQuestionsState: QuestionConfig[] = []

      console.log('[handleSave] Processing questions...')

      for (const [index, q] of questions.entries()) {
        const isExisting = originalQuestions.some(oq => oq.id === q.id)
        console.log(`[handleSave] Question ${index}: id=${q.id}, isExisting=${isExisting}, title=${q.title}`)

        if (isExisting) {
            // Update
            console.log(`[handleSave] Updating question ${q.id}...`)
            await formClient.updateQuestion({
                id: q.id,
                type: mapQuestionTypeToProto(q.type),
                label: q.title,
                description: q.description,
                placeholder: q.placeholder,
                required: q.required,
                orderIndex: index,
                options: buildOptions(q),
                validationRules: buildValidationRules(q)
            })
            newQuestionsState.push(q)
        } else {
            // Create
            console.log(`[handleSave] Creating new question for form ${form.id}...`)
            const res = await formClient.createQuestion({
                formId: form.id,
                type: mapQuestionTypeToProto(q.type),
                label: q.title,
                description: q.description,
                placeholder: q.placeholder,
                required: q.required,
                orderIndex: index,
                options: buildOptions(q),
                validationRules: buildValidationRules(q)
            })
            console.log('[handleSave] createQuestion result:', res)
            // Update ID to the real server ID
            if (res.question) {
                newQuestionsState.push({ ...q, id: res.question.id })
            } else {
                newQuestionsState.push(q) // Fallback if failed?
            }
        }
      }

      setQuestions(newQuestionsState)
      setOriginalQuestions(newQuestionsState) // Sync baseline
      
      toast.success('Form saved')
      setHasUnsavedChanges(false)
    } catch (error) {
      console.error('[handleSave] Error saving form:', error)
      console.error('[handleSave] Error name:', error instanceof Error ? error.name : 'unknown')
      console.error('[handleSave] Error message:', error instanceof Error ? error.message : String(error))
      console.error('[handleSave] Error stack:', error instanceof Error ? error.stack : 'no stack')
      toast.error('Failed to save form')
    } finally {
      setIsSaving(false)
    }
  }, [form, questions, deletedQuestionIds, originalQuestions])

  const handlePublish = async () => {
    if (questions.length === 0) {
      toast.error('Add at least one question before publishing')
      return
    }

    setIsSaving(true)
    try {
        if (form.status === 'published') {
            await formClient.updateForm({
                id: form.id,
                isPublished: false
            })
            setForm({ ...form, status: 'draft' })
            toast.success('Form unpublished')
        } else {
            await formClient.publishForm({ id: form.id })
            setForm({ ...form, status: 'published' })
            toast.success('Form published!')
        }
        setShowPublishDialog(false)
    } catch (error) {
        toast.error('Failed to update status')
    } finally {
        setIsSaving(false)
    }
  }

  const addQuestion = (type: QuestionConfig['type']) => {
    const newQuestion = createDefaultQuestion(type)
    setQuestions([...questions, newQuestion])
    setSelectedQuestionId(newQuestion.id)
    setShowAddQuestion(false)
    setHasUnsavedChanges(true)
  }

  const updateQuestion = (id: string, updates: Partial<QuestionConfig>) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, ...updates } : q
    ))
    setHasUnsavedChanges(true)
  }

  const deleteQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id))
    // Track if it was a server-persisted question
    if (originalQuestions.some(oq => oq.id === id)) {
        setDeletedQuestionIds(prev => new Set(prev).add(id))
    }
    
    if (selectedQuestionId === id) {
      setSelectedQuestionId(null)
    }
    setHasUnsavedChanges(true)
  }

  const handleReorder = (newOrder: QuestionConfig[]) => {
    setQuestions(newOrder)
    setHasUnsavedChanges(true)
  }

  const copyFormLink = () => {
    const link = `${window.location.origin}/f/${form.slug}`
    navigator.clipboard.writeText(link)
    toast.success('Link copied to clipboard')
  }

  const currentTheme = themes[form.theme as ThemePreset] || themes.minimal

  return (
    <div className="h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <Separator orientation="vertical" className="h-6" />
          <div className="group relative flex items-center">
            <Input
              value={form.title}
              onChange={(e) => {
                setForm({ ...form, title: e.target.value })
                setHasUnsavedChanges(true)
              }}
              className="text-lg font-semibold border-0 border-b-2 border-transparent bg-transparent rounded-none focus-visible:ring-0 focus-visible:border-blue-500 hover:border-slate-300 px-1 pr-7 max-w-xs transition-colors"
              placeholder="Untitled Form"
            />
            <Pencil className="w-3.5 h-3.5 text-slate-400 absolute right-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-0 transition-opacity pointer-events-none" />
          </div>
          {form.status === 'published' && (
            <Badge className="bg-emerald-100 text-emerald-700">Published</Badge>
          )}
          {form.status === 'draft' && (
            <Badge variant="secondary">Draft</Badge>
          )}
          {form.status === 'closed' && (
            <Badge variant="secondary" className="bg-amber-100 text-amber-700">Closed</Badge>
          )}
          {hasUnsavedChanges && (
            <span className="text-sm text-slate-500">Unsaved changes</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {form.status === 'published' && (
            <>
              <Button variant="outline" size="sm" onClick={copyFormLink}>
                <Copy className="w-4 h-4 mr-2" />
                Copy link
              </Button>
              <Link href={`/f/${form.slug}`} target="_blank">
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View
                </Button>
              </Link>
            </>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleSave}
            disabled={isSaving}
          >
            <Save className="w-4 h-4 mr-2" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
          <Button
            size="sm"
            onClick={() => setShowPublishDialog(true)}
            className={form.status === 'published' 
              ? 'bg-amber-500 hover:bg-amber-600' 
              : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20'
            }
          >
            <Globe className="w-4 h-4 mr-2" />
            {form.status === 'published' ? 'Unpublish' : 'Publish'}
          </Button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col overflow-hidden">
            <div className="shrink-0 p-2 border-b border-slate-100">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="questions" className="text-xs">
                  <FileText className="w-3 h-3 mr-1" />
                  Questions
                </TabsTrigger>
                <TabsTrigger value="design" className="text-xs">
                  <Palette className="w-3 h-3 mr-1" />
                  Design
                </TabsTrigger>
                <TabsTrigger value="settings" className="text-xs">
                  <Settings className="w-3 h-3 mr-1" />
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="questions" className="flex-1 flex flex-col mt-0 overflow-hidden data-[state=inactive]:hidden">
              <div className="shrink-0 p-4 border-b border-slate-100">
                <Button 
                  onClick={() => setShowAddQuestion(true)}
                  className="w-full bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Question
                </Button>
              </div>
              
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {questions.length === 0 ? (
                    <div className="text-center py-8 px-4">
                      <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                      <p className="text-sm text-slate-500">No questions yet</p>
                      <p className="text-xs text-slate-400 mt-1">Add your first question to get started</p>
                    </div>
                  ) : (
                    <Reorder.Group axis="y" values={questions} onReorder={handleReorder}>
                      <AnimatePresence>
                        {questions.map((question, index) => (
                          <Reorder.Item key={question.id} value={question}>
                            <motion.div
                              layout
                              initial={{ opacity: 0, y: -10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95 }}
                              className={`
                                group p-3 rounded-lg cursor-pointer mb-2 border transition-all
                                ${selectedQuestionId === question.id 
                                  ? 'bg-blue-50 border-blue-200' 
                                  : 'bg-white border-slate-100 hover:border-slate-200'
                                }
                              `}
                              onClick={() => setSelectedQuestionId(question.id)}
                            >
                              <div className="flex items-start gap-2">
                                <div className="mt-1 cursor-grab active:cursor-grabbing">
                                  <GripVertical className="w-4 h-4 text-slate-300" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-slate-400">
                                      {index + 1}
                                    </span>
                                    <span className="text-xs text-slate-400 capitalize">
                                      {question.type.replace('_', ' ')}
                                    </span>
                                    {question.required && (
                                      <span className="text-xs text-red-500">*</span>
                                    )}
                                  </div>
                                  <p className="text-sm font-medium text-slate-900 truncate">
                                    {question.title || 'Untitled question'}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="opacity-0 group-hover:opacity-100 h-7 w-7 p-0"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    deleteQuestion(question.id)
                                  }}
                                >
                                  <Trash2 className="w-4 h-4 text-slate-400 hover:text-red-500" />
                                </Button>
                              </div>
                            </motion.div>
                          </Reorder.Item>
                        ))}
                      </AnimatePresence>
                    </Reorder.Group>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="design" className="flex-1 mt-0 overflow-auto data-[state=inactive]:hidden">
              <div className="p-4 space-y-6">
                <div>
                  <Label className="text-sm font-medium mb-3 block">Theme</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {themeList.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => {
                          setForm({ ...form, theme: theme.id })
                          setHasUnsavedChanges(true)
                        }}
                        className={`
                          p-3 rounded-lg border-2 transition-all text-left
                          ${form.theme === theme.id 
                            ? 'border-blue-500 ring-2 ring-blue-200' 
                            : 'border-slate-200 hover:border-slate-300'
                          }
                        `}
                      >
                        <div 
                          className="w-full h-8 rounded mb-2"
                          style={{ backgroundColor: theme.backgroundColor }}
                        >
                          <div 
                            className="w-1/2 h-full rounded-l flex items-center justify-center"
                            style={{ backgroundColor: theme.primaryColor }}
                          />
                        </div>
                        <span className="text-xs font-medium text-slate-700">{theme.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="flex-1 mt-0 overflow-auto data-[state=inactive]:hidden">
              <div className="p-4 space-y-6">
                <div>
                  <Label htmlFor="slug" className="text-sm font-medium">Form URL</Label>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-sm text-slate-500">/f/</span>
                    <Input
                      id="slug"
                      value={form.slug}
                      onChange={(e) => {
                        const slug = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')
                        setForm({ ...form, slug })
                        setHasUnsavedChanges(true)
                      }}
                      className="flex-1"
                      placeholder="my-form"
                      disabled // Disabled because backend doesn't support slug update yet
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description" className="text-sm font-medium">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description || ''}
                    onChange={(e) => {
                      setForm({ ...form, description: e.target.value })
                      setHasUnsavedChanges(true)
                    }}
                    className="mt-2"
                    placeholder="Optional form description..."
                    rows={3}
                  />
                </div>

                <div>
                  <Label htmlFor="thank_you" className="text-sm font-medium">Thank You Message</Label>
                  <Textarea
                    id="thank_you"
                    value={form.thank_you_message}
                    onChange={(e) => {
                      setForm({ ...form, thank_you_message: e.target.value })
                      setHasUnsavedChanges(true)
                    }}
                    className="mt-2"
                    placeholder="Thank you for your response!"
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between py-3 border-t border-slate-100">
                  <div className="flex-1">
                    <Label htmlFor="force-captcha" className="text-sm font-medium cursor-pointer">
                      Force CAPTCHA
                    </Label>
                    <p className="text-xs text-slate-500 mt-1">
                      Require invisible reCAPTCHA verification to prevent bot submissions
                    </p>
                  </div>
                  <Switch
                    id="force-captcha"
                    checked={form.force_captcha || false}
                    onCheckedChange={(checked) => {
                      setForm({ ...form, force_captcha: checked })
                      setHasUnsavedChanges(true)
                    }}
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </aside>

        {/* Preview / Editor area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Question Editor */}
          {selectedQuestion && (
            <div className="w-96 bg-white border-r border-slate-200 overflow-auto">
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-medium">Edit Question</h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedQuestionId(null)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <QuestionEditor
                question={selectedQuestion}
                onUpdate={(updates) => updateQuestion(selectedQuestion.id, updates)}
                onDelete={() => deleteQuestion(selectedQuestion.id)}
              />
            </div>
          )}

          {/* Preview */}
          <div className="flex-1 overflow-auto bg-slate-100 p-8">
            <div className="max-w-2xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden mb-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border-b border-slate-200">
                  <Eye className="w-4 h-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-600">Preview</span>
                </div>
                <div 
                  className="min-h-[500px]"
                  style={{ 
                    backgroundColor: currentTheme.backgroundColor,
                    fontFamily: currentTheme.fontFamily 
                  }}
                >
                  <FormPreview 
                    questions={questions}
                    theme={currentTheme}
                    selectedQuestionId={selectedQuestionId}
                    onSelectQuestion={setSelectedQuestionId}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Add Question Dialog */}
      <Dialog open={showAddQuestion} onOpenChange={setShowAddQuestion}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add Question</DialogTitle>
            <DialogDescription>
              Choose a question type to add to your form
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-3 gap-3 py-4">
            {questionTypes.map((qt) => (
              <button
                key={qt.type}
                onClick={() => addQuestion(qt.type)}
                className="p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50 transition-all text-left group"
              >
                <qt.icon className="w-6 h-6 text-slate-400 group-hover:text-blue-600 mb-2" />
                <p className="font-medium text-sm text-slate-900">{qt.label}</p>
                <p className="text-xs text-slate-500 mt-1">{qt.description}</p>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Publish Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form.status === 'published' ? 'Unpublish form?' : 'Publish form?'}
            </DialogTitle>
            <DialogDescription>
              {form.status === 'published' 
                ? 'This will make your form inaccessible to respondents. Existing responses will be kept.'
                : 'Your form will be accessible at:'
              }
            </DialogDescription>
          </DialogHeader>
          {form.status !== 'published' && (
            <div className="p-3 bg-slate-50 rounded-lg">
              <code className="text-sm text-blue-600">
                {typeof window !== 'undefined' ? window.location.origin : ''}/f/{form.slug}
              </code>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPublishDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePublish}
              disabled={isSaving}
              className={form.status === 'published' 
                ? 'bg-amber-500 hover:bg-amber-600' 
                : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20'
              }
            >
              {isSaving ? 'Saving...' : form.status === 'published' ? 'Unpublish' : 'Publish'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
