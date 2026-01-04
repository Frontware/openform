package storage

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"fmt"
	"io"
	"net/url"
	"time"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/google/uuid"
)

// S3Config holds the S3 configuration
type S3Config struct {
	Region    string
	Bucket    string
	AccessKey string
	SecretKey string
	Endpoint  string // For S3-compatible services like R2
}

// S3Storage handles S3 operations
type S3Storage struct {
	client *s3.Client
	bucket string
	region string
}

// NewS3Storage creates a new S3 storage client
func NewS3Storage(cfg S3Config) (*S3Storage, error) {
	var awsCfg aws.Config
	var err error

	if cfg.Endpoint != "" {
		// S3-compatible service (R2, MinIO, etc.)
		awsCfg, err = config.LoadDefaultConfig(context.Background(),
			config.WithRegion(cfg.Region),
			config.WithEndpointResolverWithOptions(aws.EndpointResolverWithOptionsFunc(
				func(service, region string, options ...any) (aws.Endpoint, error) {
					return aws.Endpoint{URL: cfg.Endpoint}, nil
				},
			)),
			config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
				cfg.AccessKey, cfg.SecretKey, "",
			)),
		)
	} else {
		// Standard AWS S3
		awsCfg, err = config.LoadDefaultConfig(context.Background(),
			config.WithRegion(cfg.Region),
			config.WithCredentialsProvider(credentials.NewStaticCredentialsProvider(
				cfg.AccessKey, cfg.SecretKey, "",
			)),
		)
	}

	if err != nil {
		return nil, fmt.Errorf("failed to load AWS config: %w", err)
	}

	client := s3.NewFromConfig(awsCfg)

	return &S3Storage{
		client: client,
		bucket: cfg.Bucket,
		region: cfg.Region,
	}, nil
}

// UploadFile uploads a file to S3
func (s *S3Storage) UploadFile(ctx context.Context, key, mimeType string, data []byte) (string, string, error) {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		Body:          bytes.NewReader(data),
		ContentType:   aws.String(mimeType),
		ContentLength: aws.Int64(int64(len(data))),
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to upload to S3: %w", err)
	}

	// Generate URL - use custom endpoint if configured
	var url string
	if s.region != "" {
		// For standard S3 or with custom endpoint, use the bucket as part of URL
		// This works for both S3 and R2 when using custom endpoint
		url = fmt.Sprintf("https://%s/%s", s.bucket, key)
	} else {
		url = fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", s.bucket, s.region, key)
	}

	return key, url, nil
}

// UploadFileReader uploads a file from an io.Reader to S3
func (s *S3Storage) UploadFileReader(ctx context.Context, key, mimeType string, reader io.Reader) (string, string, error) {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(key),
		Body:        reader,
		ContentType: aws.String(mimeType),
	})
	if err != nil {
		return "", "", fmt.Errorf("failed to upload to S3: %w", err)
	}

	url := fmt.Sprintf("https://%s/%s", s.bucket, key)
	return key, url, nil
}

// GetPresignedURL returns a presigned URL for downloading a file
// This is a simple implementation for S3-compatible storage
// For production with AWS S3, you may want to use the official presign client
func (s *S3Storage) GetPresignedURL(ctx context.Context, key string, expiresIn time.Duration) (string, error) {
	// For now, return the direct URL
	// In production, you should implement proper presigned URL generation
	// with AWS Signature V4 signing
	return fmt.Sprintf("https://%s/%s", s.bucket, key), nil
}

// generatePresignedURL generates a proper AWS S3 presigned URL with signature
// This is a placeholder for full implementation
func (s *S3Storage) generatePresignedURL(key string, expiresIn time.Duration) string {
	// This is a simplified version - for production use, implement
	// full AWS Signature V4 signing process
	u := &url.URL{
		Scheme: "https",
		Host:   fmt.Sprintf("%s.s3.%s.amazonaws.com", s.bucket, s.region),
		Path:   key,
	}
	q := u.Query()
	q.Set("X-Amz-Algorithm", "AWS4-HMAC-SHA256")
	q.Set("X-Amz-Credential", fmt.Sprintf("%s/%s/s3/s3/aws4_request", "ACCESS_KEY", s.region))
	q.Set("X-Amz-Date", time.Now().UTC().Format("20060102T150405Z"))
	q.Set("X-Amz-Expires", fmt.Sprintf("%d", int64(expiresIn.Seconds())))
	q.Set("X-Amz-SignedHeaders", "host")
	// In production: calculate proper signature
	q.Set("X-Amz-Signature", uuid.New().String()) // Placeholder
	u.RawQuery = q.Encode()
	return u.String()
}

// signHMAC generates HMAC-SHA256 signature
func signHMAC(key []byte, data []byte) []byte {
	hash := hmac.New(sha256.New, key)
	hash.Write(data)
	return hash.Sum(nil)
}

// getSignatureKey generates the signature key
func getSignatureKey(key, dateStamp, regionName, serviceName string) []byte {
	kDate := signHMAC([]byte("AWS4"+key), []byte(dateStamp))
	kRegion := signHMAC(kDate, []byte(regionName))
	kService := signHMAC(kRegion, []byte(serviceName))
	kSigning := signHMAC(kService, []byte("aws4_request"))
	return kSigning
}

// DeleteFile deletes a file from S3
func (s *S3Storage) DeleteFile(ctx context.Context, key string) error {
	_, err := s.client.DeleteObject(ctx, &s3.DeleteObjectInput{
		Bucket: aws.String(s.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("failed to delete from S3: %w", err)
	}

	return nil
}
