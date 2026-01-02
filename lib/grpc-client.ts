import { createPromiseClient } from "@bufbuild/connect";
import { createGrpcWebTransport } from "@bufbuild/connect-web";
import { FormService } from "./proto/proto/form_connect";
import { ResponseService } from "./proto/proto/response_connect";
import { FileService } from "./proto/proto/file_connect";
import { getToken } from "./auth/weladee";

// The base URL for the gRPC-Web server (Envoy or gRPC server if it supports web)
// For now, assuming the Go server listens on a port that supports gRPC-Web or we use a proxy.
const baseUrl = process.env.NEXT_PUBLIC_GRPC_URL || "http://localhost:8080";

const transport = createGrpcWebTransport({
  baseUrl,
  interceptors: [
    (next) => async (req) => {
      // Add auth token to all requests if available
      const token = getToken();
      if (token) {
        req.header.set("Authorization", `Bearer ${token}`);
      }
      return await next(req);
    },
  ],
});

export const formClient = createPromiseClient(FormService, transport);
export const responseClient = createPromiseClient(ResponseService, transport);
export const fileClient = createPromiseClient(FileService, transport);