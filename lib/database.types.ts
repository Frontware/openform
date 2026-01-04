export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Question types supported by the form builder
export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'dropdown'
  | 'checkboxes'
  | 'email'
  | 'phone'
  | 'number'
  | 'date'
  | 'rating'
  | 'opinion_scale'
  | 'yes_no'
  | 'file_upload'
  | 'url'
  | 'matrix'
  | 'ranking'

// Form status
export type FormStatus = 'draft' | 'published' | 'closed'

// Theme presets
export type ThemePreset = 
  | 'midnight'
  | 'ocean'
  | 'sunset'
  | 'forest'
  | 'lavender'
  | 'weladee'
  | 'minimal'
  | 'aurora'
  | 'cyberpunk'
  | 'desert'

export interface ThemeConfig {
  id: ThemePreset
  name: string
  primaryColor: string
  backgroundColor: string
  textColor: string
  accentColor: string
  fontFamily: string
}

// Question configuration
export interface QuestionConfig {
  id: string
  type: QuestionType
  title: string
  description?: string
  required: boolean
  // Type-specific options
  options?: string[] // For dropdown and checkboxes
  minValue?: number // For rating (1-5 stars) or opinion_scale (1-10)
  maxValue?: number
  allowedFileTypes?: string[] // For file_upload
  maxFileSize?: number // In MB
  placeholder?: string
  // Matrix question properties
  rows?: string[] // For matrix questions
  columns?: string[] // For matrix questions
  input_type?: 'radio' | 'checkbox' // For matrix questions
  allow_multiple_per_row?: boolean // For matrix questions
  // Ranking question properties
  items?: string[] // For ranking questions
  min_selections?: number | null // For ranking questions
  max_selections?: number | null // For ranking questions
  shuffle_items?: boolean // For ranking questions
}

// Database tables
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      forms: {
        Row: {
          id: string
          user_id: string
          title: string
          description: string | null
          slug: string
          status: FormStatus
          theme: ThemePreset
          questions: QuestionConfig[]
          thank_you_message: string
          force_captcha: boolean
          show_progress_bar: boolean
          allow_multiple_submissions: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          description?: string | null
          slug: string
          status?: FormStatus
          theme?: ThemePreset
          questions?: QuestionConfig[]
          thank_you_message?: string
          force_captcha?: boolean
          show_progress_bar?: boolean
          allow_multiple_submissions?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          slug?: string
          status?: FormStatus
          theme?: ThemePreset
          questions?: QuestionConfig[]
          thank_you_message?: string
          force_captcha?: boolean
          show_progress_bar?: boolean
          allow_multiple_submissions?: boolean
          updated_at?: string
        }
      }
      responses: {
        Row: {
          id: string
          form_id: string
          answers: Record<string, Json>
          submitted_at: string
        }
        Insert: {
          id?: string
          form_id: string
          answers: Record<string, Json>
          submitted_at?: string
        }
        Update: {
          answers?: Record<string, Json>
        }
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Form = Database['public']['Tables']['forms']['Row']
export type FormInsert = Database['public']['Tables']['forms']['Insert']
export type FormUpdate = Database['public']['Tables']['forms']['Update']
export type Response = Database['public']['Tables']['responses']['Row']
export type ResponseInsert = Database['public']['Tables']['responses']['Insert']

