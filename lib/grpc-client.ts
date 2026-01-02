import { createPromiseClient } from "@bufbuild/connect-web";
import { FormService } from "./proto/proto/form_connect";
import { ResponseService } from "./proto/proto/response_connect";
import { FileService } from "./proto/proto/file_connect";

// The base URL for the gRPC-Web server
const baseUrl = process.env.NEXT_PUBLIC_GRPC_URL || "http://localhost:50051";

// Create transport with auth interceptor
const transport = createPromiseClient(async (req) => {
  // Add auth token to all requests if available
  const token = typeof window !== "undefined" ? localStorage.getItem("weladee_token") : null;
  if (token) {
    req.header.set("Authorization", `Bearer ${token}`);
  }
  // For gRPC-web, we need to use a transport that can handle the protocol
  // For development, we'll use a simple fetch-based implementation
  const response = await fetch(`${baseUrl}${req.method.name}`, {
    method: "POST",
    headers: req.header.toJSON() as HeadersInit,
    body: req.toBinary(),
  });
  return response.arrayBuffer();
});

// Create clients using connect-web's createPromiseClient
// Note: This is a simplified version - you may need to adjust based on your actual gRPC-web setup
export const createFormClient = () => {
  return createPromiseClient(FormService, {
    baseUrl,
  });
};

export const createResponseClient = () => {
  return createPromiseClient(ResponseService, {
    baseUrl,
  });
};

export const createFileClient = () => {
  return createPromiseClient(FileService, {
    baseUrl,
  });
};

// Singleton clients
export const formClient = createFormClient();
export const responseClient = createResponseClient();
export const fileClient = createFileClient();

// Helper to set auth token
export const setAuthToken = (token: string) => {
  if (typeof window !== "undefined") {
    localStorage.setItem("weladee_token", token);
  }
};

// Helper to get auth token
export const getAuthToken = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem("weladee_token");
  }
  return null;
};

// Helper to clear auth token
export const clearAuthToken = () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("weladee_token");
  }
};
