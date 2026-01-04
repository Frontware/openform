package gapi

import (
    "github.com/weladee/weladee-form/internal/db"
    pb "github.com/weladee/weladee-form/proto/pb"
)

type AnalyticsServerImpl struct {
    pb.UnimplementedAnalyticsServiceServer
    db *db.Database
}

func NewAnalyticsServerImpl(database *db.Database) *AnalyticsServerImpl {
    return &AnalyticsServerImpl{
        db: database,
    }
}
