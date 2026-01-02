import { fileClient } from "../grpc-client";

// File API functions

export async function uploadFile(
  formId: string,
  questionId: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<{ fileUrl: string; filename: string }> {
  // Create a streaming upload
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);

        // For streaming, you would use the gRPC streaming API
        // For simplicity, this is a basic implementation
        // In production, you'd want true streaming for large files

        // Note: This is a simplified version
        // You'll need to implement proper streaming using the connect-web streaming API

        resolve({
          fileUrl: "", // Will be filled by the actual response
          filename: file.name,
        });
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export async function getFileUrl(fileId: string): Promise<string> {
  const request = new GetFileUrlRequest();
  request.id = fileId;

  const response = await fileClient.getFileUrl(request);
  return response.url;
}

// Helper to validate file before upload
export function validateFile(file: File, maxSizeMB = 10, allowedTypes?: string[]): {
  valid: boolean;
  error?: string;
} {
  // Check file size
  if (file.size > maxSizeMB * 1024 * 1024) {
    return {
      valid: false,
      error: `File size exceeds ${maxSizeMB}MB limit`,
    };
  }

  // Check file type
  if (allowedTypes && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type ${file.type} is not allowed`,
    };
  }

  return { valid: true };
}

// Helper to get file extension
export function getFileExtension(filename: string): string {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2);
}

// Helper to format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
