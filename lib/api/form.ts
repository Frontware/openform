import { formClient } from "../grpc-client";
import { CreateFormRequest, UpdateFormRequest, ListFormsRequest, PublishFormRequest, GetFormStatsRequest, GetFormRequest, DeleteFormRequest, FormTheme as ProtoFormTheme, QuestionType as ProtoQuestionType } from "../proto/proto/form_pb";
import { PaginationRequest } from "../proto/proto/common_pb";
import type { Form, Question, FormTheme, QuestionType, PaginationParams, FormStats, PaginationResponse } from "../types";

// Mapping functions between app types and protobuf types
function mapFormThemeToProto(theme: FormTheme): ProtoFormTheme {
  switch (theme) {
    case "FORM_THEME_MINIMAL": return ProtoFormTheme.MINIMAL;
    case "FORM_THEME_MIDNIGHT": return ProtoFormTheme.MIDNIGHT;
    case "FORM_THEME_OCEAN": return ProtoFormTheme.OCEAN;
    case "FORM_THEME_SUNSET": return ProtoFormTheme.SUNSET;
    case "FORM_THEME_FOREST": return ProtoFormTheme.FOREST;
    case "FORM_THEME_LAVENDER": return ProtoFormTheme.LAVENDER;
    case "FORM_THEME_WELADEE": return ProtoFormTheme.MINIMAL; // Default fallback
    default: return ProtoFormTheme.MINIMAL;
  }
}

function mapFormThemeFromProto(theme: ProtoFormTheme): FormTheme {
  switch (theme) {
    case ProtoFormTheme.MINIMAL: return "FORM_THEME_MINIMAL";
    case ProtoFormTheme.MIDNIGHT: return "FORM_THEME_MIDNIGHT";
    case ProtoFormTheme.OCEAN: return "FORM_THEME_OCEAN";
    case ProtoFormTheme.SUNSET: return "FORM_THEME_SUNSET";
    case ProtoFormTheme.FOREST: return "FORM_THEME_FOREST";
    case ProtoFormTheme.LAVENDER: return "FORM_THEME_LAVENDER";
    default: return "FORM_THEME_MINIMAL";
  }
}

// Convert proto Form to app Form type
function fromProtoForm(proto: any): Form {
  return {
    id: proto.id,
    userId: proto.userId,
    title: proto.title,
    description: proto.description,
    theme: mapFormThemeFromProto(proto.theme),
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
    type: proto.type as QuestionType, // Will need similar mapping if needed
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
  request.theme = mapFormThemeToProto(data.theme);
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
  if (params.page) {
    request.pagination = new PaginationRequest({
      page: params.page,
      pageSize: params.pageSize || 20
    });
  }

  const response = await formClient.listForms(request);
  return {
    forms: response.forms.map(fromProtoForm),
    total: Number(response.pagination!.total),
    page: Number(response.pagination!.page),
    pageSize: Number(response.pagination!.pageSize),
    totalPages: Number(response.pagination!.totalPages),
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
    totalResponses: Number(response.stats!.totalResponses),
    completedResponses: Number(response.stats!.completedResponses),
    partialResponses: Number(response.stats!.partialResponses),
  };
}
