package gapi

import (
	"context"
	"fmt"
	"io"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/timestamppb"

	"github.com/weladee/weladee-form/internal/db"
	"github.com/weladee/weladee-form/internal/db/sqlc"
	"github.com/weladee/weladee-form/internal/storage"
	"github.com/weladee/weladee-form/proto/pb"
)

type FileServerImpl struct {
	pb.UnimplementedFileServiceServer
	db      *db.Database
	storage *storage.S3Storage
}

// UploadFile handles streaming upload: first metadata, then chunks
func (s *FileServerImpl) UploadFile(stream pb.FileService_UploadFileServer) error {
	var metadata *pb.FileMetadata
	var fileBuffer []byte
	var tempFilename string

	// Step 1: Receive metadata first
	req, err := stream.Recv()
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "failed to receive metadata: %v", err)
	}

	metadataMsg := req.GetMetadata()
	if metadataMsg == nil {
		return status.Errorf(codes.InvalidArgument, "first message must contain metadata")
	}
	metadata = metadataMsg

	// Validate form and question access (public forms allow upload if file question exists)
	formID, err := uuid.Parse(metadata.FormId)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid form ID")
	}

	questionID, err := uuid.Parse(metadata.QuestionId)
	if err != nil {
		return status.Errorf(codes.InvalidArgument, "invalid question ID")
	}

	// Optional response ID for tying file to a response
	var responseID uuid.UUID
	if metadata.ResponseId != "" {
		rID, err := uuid.Parse(metadata.ResponseId)
		if err != nil {
			return status.Errorf(codes.InvalidArgument, "invalid response ID")
		}
		responseID = rID
	}

	// Verify that the question is a file_upload type
	question, err := s.db.Queries.GetQuestion(stream.Context(), questionID)
	if err != nil || question.FormID != formID {
		return status.Errorf(codes.NotFound, "question not found or does not belong to form")
	}

	if strings.ToLower(question.Type) != "file_upload" {
		return status.Errorf(codes.InvalidArgument, "question is not a file upload type")
	}

	// Optional: add file size limit check (e.g., 10MB)
	if metadata.FileSize > 10*1024*1024 {
		return status.Errorf(codes.InvalidArgument, "file too large (max 10MB)")
	}

	// Clean filename
	originalFilename := sanitizeFilename(metadata.Filename)
	ext := filepath.Ext(originalFilename)
	tempFilename = fmt.Sprintf("%s%s", uuid.New().String(), ext)

	// Step 2: Receive file chunks
	for {
		req, err := stream.Recv()
		if err == io.EOF {
			break
		}
		if err != nil {
			return status.Errorf(codes.Internal, "failed to receive chunk: %v", err)
		}

		chunk := req.GetChunk()
		if chunk == nil {
			return status.Errorf(codes.InvalidArgument, "expected chunk data")
		}

		fileBuffer = append(fileBuffer, chunk...)
		if int64(len(fileBuffer)) > metadata.FileSize {
			return status.Errorf(codes.InvalidArgument, "received more data than declared")
		}
	}

	// Validate final size
	if int64(len(fileBuffer)) != metadata.FileSize {
		return status.Errorf(codes.InvalidArgument, "file size mismatch: expected %d, got %d", metadata.FileSize, len(fileBuffer))
	}

	// Step 3: Upload to S3
	s3Key, fileURL, err := s.storage.UploadFile(
		stream.Context(),
		filepath.Join("uploads", formID.String(), tempFilename),
		metadata.MimeType,
		fileBuffer,
	)
	if err != nil {
		return status.Errorf(codes.Internal, "failed to upload to storage: %v", err)
	}

	// Step 4: Record file in database
	err = s.db.ExecTx(stream.Context(), func(q *sqlc.Queries) error {
		_, err := q.CreateFileUpload(stream.Context(), sqlc.CreateFileUploadParams{
			FormID:           formID,
			QuestionID:       questionID,
			ResponseID:       responseID,
			Filename:         tempFilename,
			OriginalFilename: originalFilename,
			MimeType:         metadata.MimeType,
			FileSize:         metadata.FileSize,
			S3Key:            s3Key,
			S3Url:            fileURL,
		})
		return err
	})
	if err != nil {
		// Optional: delete from S3 on DB failure (fire-and-forget)
		return status.Errorf(codes.Internal, "failed to record file upload: %v", err)
	}

	// Step 5: Respond with file info
	fileID := uuid.New() // or use DB-generated ID if you add it to table
	return stream.SendAndClose(&pb.UploadFileResponse{
		FileId:  fileID.String(),
		FileUrl: fileURL,
		S3Key:   s3Key,
	})
}

// GetFileUrl returns a presigned URL for downloading/viewing the file
func (s *FileServerImpl) GetFileUrl(ctx context.Context, req *pb.GetFileUrlRequest) (*pb.GetFileUrlResponse, error) {
	fileID, err := uuid.Parse(req.FileId)
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "invalid file ID")
	}

	// Fetch file record
	fileUpload, err := s.db.Queries.GetFileUpload(ctx, fileID) // You need this query
	if err != nil {
		return nil, status.Errorf(codes.NotFound, "file not found")
	}

	expiresIn := 15 * time.Minute
	if req.ExpiresInSeconds != nil && *req.ExpiresInSeconds > 0 {
		expiresIn = time.Duration(*req.ExpiresInSeconds) * time.Second
		if expiresIn > 7*24*time.Hour {
			expiresIn = 7 * 24 * time.Hour // AWS max
		}
	}

	presignedURL, err := s.storage.GetPresignedURL(ctx, fileUpload.S3Key, expiresIn)
	if err != nil {
		return nil, status.Errorf(codes.Internal, "failed to generate presigned URL: %v", err)
	}

	return &pb.GetFileUrlResponse{
		Url:       presignedURL,
		ExpiresAt: timestamppb.New(time.Now().Add(expiresIn)),
	}, nil
}

// Helper: sanitize filename to prevent path traversal and bad chars
func sanitizeFilename(name string) string {
	name = filepath.Base(name)
	// Remove dangerous characters
	name = strings.Map(func(r rune) rune {
		if strings.ContainsRune("/\\?%*:|\"<> ", r) {
			return '-'
		}
		return r
	}, name)
	if len(name) > 255 {
		ext := filepath.Ext(name)
		name = name[:255-len(ext)] + ext
	}
	return name
}
