// Form Types
export type FormTheme =
  | "FORM_THEME_MINIMAL"
  | "FORM_THEME_MIDNIGHT"
  | "FORM_THEME_OCEAN"
  | "FORM_THEME_SUNSET"
  | "FORM_THEME_FOREST"
  | "FORM_THEME_LAVENDER"
  | "FORM_THEME_WELADEE";

export type QuestionType =
  | "QUESTION_TYPE_SHORT_TEXT"
  | "QUESTION_TYPE_LONG_TEXT"
  | "QUESTION_TYPE_DROPDOWN"
  | "QUESTION_TYPE_CHECKBOXES"
  | "QUESTION_TYPE_EMAIL"
  | "QUESTION_TYPE_PHONE"
  | "QUESTION_TYPE_NUMBER"
  | "QUESTION_TYPE_DATE"
  | "QUESTION_TYPE_RATING"
  | "QUESTION_TYPE_OPINION_SCALE"
  | "QUESTION_TYPE_YES_NO"
  | "QUESTION_TYPE_FILE_UPLOAD"
  | "QUESTION_TYPE_URL";

export type ProgressBarStyle = 'none' | 'linear' | 'steps' | 'circular';

export interface Form {
  id: string;
  userId: string;
  title: string;
  description: string;
  theme: FormTheme;
  isPublished: boolean;
  isAcceptingResponses: boolean;
  requireLogin: boolean;
  allowMultipleSubmissions: boolean;
  progressBarStyle: ProgressBarStyle;
  customThankYouMessage: string;
  redirectUrl: string;
  settings: Record<string, any>;
  questions: Question[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Question {
  id: string;
  formId: string;
  type: QuestionType;
  label: string;
  description: string;
  placeholder: string;
  required: boolean;
  orderIndex: number;
  options: Record<string, any>;
  validationRules: Record<string, any>;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// Response Types
export interface Response {
  id: string;
  formId: string;
  respondentUserId?: string;
  respondentEmail?: string;
  respondentName?: string;
  completed: boolean;
  submittedAt?: Date;
  createdAt: Date;
  answers: Answer[];
}

export interface Answer {
  id: string;
  responseId: string;
  questionId: string;
  answerText?: string;
  answerNumber?: number;
  answerDate?: string;
  answerTime?: string;
  answerChoices?: Record<string, any>;
  answerFileUrl?: string;
  createdAt: Date;
}

// Pagination Types
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginationResponse {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Stats Types
export interface FormStats {
  totalResponses: number;
  completedResponses: number;
  partialResponses: number;
}

// User Types
export interface User {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

// File Upload Types
export interface FileUpload {
  id: string;
  formId: string;
  questionId: string;
  responseId?: string;
  filename: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  s3Key: string;
  s3Url: string;
  createdAt: Date;
}

// Auth Types
export interface AuthToken {
  access_token: string;
  refresh_token?: string;
  expires_at: number;
  user?: User;
}
