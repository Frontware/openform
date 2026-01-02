import { responseClient } from "../grpc-client";
import { SubmitResponseRequest, GetResponseRequest, ListResponsesRequest, DeleteResponseRequest, ExportResponsesRequest } from "../proto/proto/response_pb";
import { PaginationRequest } from "../proto/proto/common_pb";
import type { Response, Answer, PaginationParams, PaginationResponse } from "../types";

// Convert proto Response to app Response type
function fromProtoResponse(proto: any): Response {
  return {
    id: proto.id,
    formId: proto.formId,
    respondentUserId: proto.respondentUserId,
    respondentEmail: proto.respondentEmail,
    respondentName: proto.respondentName,
    completed: proto.completed,
    submittedAt: proto.submittedAt ? new Date(proto.submittedAt) : undefined,
    createdAt: new Date(proto.createdAt),
    answers: proto.answers.map(fromProtoAnswer),
  };
}

function fromProtoAnswer(proto: any): Answer {
  return {
    id: proto.id,
    responseId: proto.responseId,
    questionId: proto.questionId,
    answerText: proto.answerText,
    answerNumber: proto.answerNumber,
    answerDate: proto.answerDate,
    answerTime: proto.answerTime,
    answerChoices: proto.answerChoices,
    answerFileUrl: proto.answerFileUrl,
    createdAt: new Date(proto.createdAt),
  };
}

// Response API functions

export async function submitResponse(data: {
  formId: string;
  answers: Partial<Answer>[];
  complete?: boolean;
  respondentEmail?: string;
  respondentName?: string;
}): Promise<Response> {
  const request = new SubmitResponseRequest();
  request.formId = data.formId;
  request.complete = data.complete ?? true;
  if (data.respondentEmail) request.respondentEmail = data.respondentEmail;
  if (data.respondentName) request.respondentName = data.respondentName;
  // ... map answers

  const response = await responseClient.submitResponse(request);
  return fromProtoResponse(response.response!);
}

export async function getResponse(id: string): Promise<Response> {
  const request = new GetResponseRequest();
  request.id = id;

  const response = await responseClient.getResponse(request);
  return fromProtoResponse(response.response!);
}

export async function listResponses(
  formId: string,
  params: PaginationParams & { completedOnly?: boolean } = {}
): Promise<{ responses: Response[] } & PaginationResponse> {
  const request = new ListResponsesRequest();
  request.formId = formId;
  if (params.page) {
    request.pagination = new PaginationRequest({
      page: params.page,
      pageSize: params.pageSize || 20
    });
  }
  if (params.completedOnly !== undefined) request.completedOnly = params.completedOnly;

  const response = await responseClient.listResponses(request);
  return {
    responses: response.responses.map(fromProtoResponse),
    total: Number(response.pagination!.total),
    page: Number(response.pagination!.page),
    pageSize: Number(response.pagination!.pageSize),
    totalPages: Number(response.pagination!.totalPages),
  };
}

export async function exportResponses(formId: string, format: "csv" | "json" = "csv"): Promise<{
  data: ArrayBuffer;
  filename: string;
  mimeType: string;
}> {
  const request = new ExportResponsesRequest();
  request.formId = formId;
  request.format = format;

  const response = await responseClient.exportResponses(request);
  return {
    data: response.data.buffer.slice(response.data.byteOffset, response.data.byteOffset + response.data.byteLength),
    filename: response.filename,
    mimeType: response.mimeType,
  };
}

export async function deleteResponse(id: string): Promise<void> {
  const request = new DeleteResponseRequest();
  request.id = id;

  await responseClient.deleteResponse(request);
}
