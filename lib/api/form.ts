import { formClient } from "../grpc-client";
import { CreateFormRequest, UpdateFormRequest, ListFormsRequest, PublishFormRequest, GetFormStatsRequest } from "../proto/proto/form_pb";
import type { Form, Question, FormTheme, QuestionType, PaginationParams, FormStats, PaginationResponse } from "../types";

// Convert proto Form to app Form type
function fromProtoForm(proto: any): Form {
  return {
    id: proto.id,
    userId: proto.userId,
    title: proto.title,
    description: proto.description,
    theme: proto.theme as FormTheme,
    isPublished: proto.isPublished,
    isAcceptingResponses: proto.isAcceptingResponses,
    requireLogin: proto.requireLogin,
    allowMultipleSubmissions: proto.allowMultipleSubmissions,
    showProgressBar: proto.showProgressBar,
    customThankYouMessage: proto.customThankYouMessage,
    redirectUrl: proto.redirectUrl,
    settings: proto.settings,
    questions: proto.questions.map(fromProtoQuestion),
    createdAt: new Date(proto.createdAt),
    updatedAt: new Date(proto.updatedAt),
  };
}

function fromProtoQuestion(proto: any): Question {
  return {
    id: proto.id,
    formId: proto.formId,
    type: proto.type as QuestionType,
    label: proto.label,
    description: proto.description,
    placeholder: proto.placeholder,
    required: proto.required,
    orderIndex: proto.orderIndex,
    options: proto.options,
    validationRules: proto.validationRules,
    settings: proto.settings,
    createdAt: new Date(proto.createdAt),
    updatedAt: new Date(proto.updatedAt),
  };
}

function toProtoQuestion(q: Question): any {
  const proto = new CreateFormRequest();
  // ... map fields
  return proto;
}

// Form API functions

export async function createForm(data: {
  title: string;
  description?: string;
  theme: FormTheme;
  questions: Partial<Question>[];
}): Promise<Form> {
  const request = new CreateFormRequest();
  request.title = data.title;
  request.description = data.description || "";
  request.theme = data.theme;
  // ... map questions

  const response = await formClient.createForm(request);
  return fromProtoForm(response.form!);
}

export async function getForm(id: string, includeQuestions = true): Promise<Form> {
  const request = new GetFormRequest();
  request.id = id;
  request.includeQuestions = includeQuestions;

  const response = await formClient.getForm(request);
  return fromProtoForm(response.form!);
}

export async function updateForm(id: string, data: Partial<Form>): Promise<Form> {
  const request = new UpdateFormRequest();
  request.id = id;
  // ... map fields

  const response = await formClient.updateForm(request);
  return fromProtoForm(response.form!);
}

export async function deleteForm(id: string): Promise<void> {
  const request = new DeleteFormRequest();
  request.id = id;
  await formClient.deleteForm(request);
}

export async function listForms(params: PaginationParams = {}): Promise<{ forms: Form[] } & PaginationResponse> {
  const request = new ListFormsRequest();
  if (params.page) request.pagination = { page: params.page, pageSize: params.pageSize || 20 };

  const response = await formClient.listForms(request);
  return {
    forms: response.forms.map(fromProtoForm),
    total: response.pagination!.total,
    page: response.pagination!.page,
    pageSize: response.pagination!.pageSize,
    totalPages: response.pagination!.totalPages,
  };
}

export async function publishForm(id: string): Promise<Form> {
  const request = new PublishFormRequest();
  request.id = id;

  const response = await formClient.publishForm(request);
  return fromProtoForm(response.form!);
}

export async function getFormStats(id: string): Promise<FormStats> {
  const request = new GetFormStatsRequest();
  request.formId = id;

  const response = await formClient.getFormStats(request);
  return {
    totalResponses: response.stats!.totalResponses,
    completedResponses: response.stats!.completedResponses,
    partialResponses: response.stats!.partialResponses,
  };
}
