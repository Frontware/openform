package main

import (
	"net/http"

	"github.com/weladee/weladee-form/internal/embed"
)

var embeddedFS *embed.FileSystem

func init() {
	embeddedFS = embed.NewFileSystem()
}

// serveEmbeddedFiles serves embedded static files when built with embed tag
func serveEmbeddedFiles(w http.ResponseWriter, r *http.Request) {
	embeddedFS.ServeHTTP(w, r)
}
