package gapi

import (
	"github.com/weladee/weladee-form/internal/db"
	"github.com/weladee/weladee-form/internal/storage"
	pb "github.com/weladee/weladee-form/proto/pb"
)

// FormServer wrapper - embeds FormServerImpl which already embeds UnimplementedFormServiceServer
type FormServer struct {
	*FormServerImpl
}

// ResponseServer wrapper - embeds ResponseServerImpl which already embeds UnimplementedResponseServiceServer
type ResponseServer struct {
	*ResponseServerImpl
}

// FileServer wrapper - embeds FileServerImpl which already embeds UnimplementedFileServiceServer
type FileServer struct {
	*FileServerImpl
}

// Constructor functions

func NewFormServer(database *db.Database, storage *storage.S3Storage) pb.FormServiceServer {
	return &FormServer{
		FormServerImpl: &FormServerImpl{
			db:      database,
			storage: storage,
		},
	}
}

func NewResponseServer(database *db.Database) pb.ResponseServiceServer {
	return &ResponseServer{
		ResponseServerImpl: &ResponseServerImpl{
			db: database,
		},
	}
}

func NewFileServer(database *db.Database, storage *storage.S3Storage) pb.FileServiceServer {
	return &FileServer{
		FileServerImpl: &FileServerImpl{
			db:      database,
			storage: storage,
		},
	}
}
