import { createPromiseClient } from "@bufbuild/connect";
import { createGrpcWebTransport } from "@bufbuild/connect-web";
import { FormService } from "./proto/proto/form_connect";
import { ResponseService } from "./proto/proto/response_connect";
import { FileService } from "./proto/proto/file_connect";
import { AnalyticsService } from "./proto/proto/analytics_connect";
import { getToken, clearToken } from "./auth/weladee";
import { ConnectError } from "@bufbuild/connect";

// The base URL for the gRPC-Web server
// Use empty string for same-origin requests (embedded build where frontend is served from same Go binary)
// Set NEXT_PUBLIC_GRPC_URL during build for external API configuration
const baseUrl = process.env.NEXT_PUBLIC_GRPC_URL || "";

const transport = createGrpcWebTransport({
  baseUrl,
  interceptors: [
    // Auth interceptor: Add token to all requests except public methods
    (next) => async (req) => {
      // List of public methods that don't require authentication
      const publicMethods = [
        '/weladee.form.v1.FormService/GetFormBySlug',
        '/weladee.form.v1.ResponseService/SubmitResponse'
      ];

      // Check if this is a public method
      const isPublicMethod = publicMethods.includes(req.url);
      
      if (!isPublicMethod) {
        const token = getToken();
        console.log('[gRPC Interceptor] Token for request:', token ? 'present' : 'MISSING!');
        if (token) {
          req.header.set("Authorization", `Bearer ${token}`);
          console.log('[gRPC Interceptor] Authorization header set');
        } else {
          console.log('[gRPC Interceptor] WARNING: No token available!');
        }
      } else {
        console.log('[gRPC Interceptor] Skipping auth for public method:', req.url);
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

export async function downloadAnalyticsExport(
  formId: string,
  format: 'csv' | 'xlsx' | 'pdf',
  startDate: Date,
  endDate: Date
) {
  try {
    const response = await analyticsClient.exportAnalytics({
      formId,
      format,
      startDate: {
        seconds: BigInt(Math.floor(startDate.getTime() / 1000)),
        nanos: 0
      },
      endDate: {
        seconds: BigInt(Math.floor(endDate.getTime() / 1000)),
        nanos: 0
      }
    });

    // Create blob and download
    const blob = new Blob([response.data], { type: response.mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = response.filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    return { success: true, filename: response.filename };
  } catch (error) {
    console.error('Export failed:', error);
    throw error;
  }
}
