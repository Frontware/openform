import { createPromiseClient } from "@bufbuild/connect";
import { createGrpcWebTransport } from "@bufbuild/connect-web";
import { FormService } from "./proto/proto/form_connect";
import { ResponseService } from "./proto/proto/response_connect";
import { FileService } from "./proto/proto/file_connect";
import { AnalyticsService } from "./proto/proto/analytics_connect";
import { getToken, clearToken } from "./auth/weladee";
import { ConnectError } from "@bufbuild/connect";

// The base URL for the gRPC-Web server (Envoy or gRPC server if it supports web)
// For now, assuming the Go server listens on a port that supports gRPC-Web or we use a proxy.
const baseUrl = process.env.NEXT_PUBLIC_GRPC_URL || "http://localhost:50051";

const transport = createGrpcWebTransport({
  baseUrl,
  interceptors: [
    // Auth interceptor: Add token to all requests
    (next) => async (req) => {
      const token = getToken();
      console.log('[gRPC Interceptor] Token for request:', token ? 'present' : 'MISSING!');
      if (token) {
        req.header.set("Authorization", `Bearer ${token}`);
        console.log('[gRPC Interceptor] Authorization header set');
      } else {
        console.log('[gRPC Interceptor] WARNING: No token available!');
      }
      return await next(req);
    },
    // Error interceptor: Handle auth failures
    (next) => async (req) => {
      try {
        return await next(req);
      } catch (err) {
        // Check if it's an auth error
        if (err instanceof ConnectError) {
          // Unauthenticated = status code 16
          if (err.message.includes('Unauthenticated') ||
              err.message.includes('authentication') ||
              err.message.includes('401')) {
            // Clear invalid token and redirect to home
            clearToken();
            if (typeof window !== 'undefined') {
              window.location.href = '/?auth=expired';
            }
          }
        }
        throw err;
      }
    },
  ],
});

export const formClient = createPromiseClient(FormService, transport);
export const responseClient = createPromiseClient(ResponseService, transport);
export const fileClient = createPromiseClient(FileService, transport);
export const analyticsClient = createPromiseClient(AnalyticsService, transport);