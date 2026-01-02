//go:build embed

package embed

import (
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"strings"
	"time"
)

//go:embed all:out
var distFS embed.FS

// FileSystem provides access to embedded static files
type FileSystem struct {
	root fs.FS
}

// NewFileSystem creates a new embedded file system
func NewFileSystem() *FileSystem {
	root, err := fs.Sub(distFS, "out")
	if err != nil {
		panic(fmt.Sprintf("failed to create embedded filesystem: %v", err))
	}
	return &FileSystem{root: root}
}

// Exists checks if a file exists in the embedded filesystem
func (fs *FileSystem) Exists(prefix string, filepath string) bool {
	if p := strings.TrimPrefix(filepath, prefix); len(p) < len(filepath) {
		if _, err := fs.root.Open(p); err != nil {
			return false
		}
		return true
	}
	return false
}

// ServeHTTP implements http.Handler for serving embedded files with SPA fallback
func (fs *FileSystem) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	filePath := r.URL.Path

	// Remove leading slash
	filePath = strings.TrimPrefix(filePath, "/")

	// Try to serve the file directly
	f, err := fs.root.Open(filePath)
	if err != nil {
		// If file doesn't exist, serve index.html for SPA routing
		fs.serveIndex(w, r)
		return
	}
	defer f.Close()

	// Check if it's a directory
	stat, err := f.Stat()
	if err != nil {
		fs.serveIndex(w, r)
		return
	}

	if stat.IsDir() {
		// If directory, serve index.html for SPA routing
		fs.serveIndex(w, r)
		return
	}

	// Set appropriate content type based on file extension
	contentType := fs.getContentType(filePath)
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}

	// Copy file content to response
	http.ServeFile(w, r, filePath)
}

// serveIndex serves the index.html file for SPA routing
func (fs *FileSystem) serveIndex(w http.ResponseWriter, r *http.Request) {
	indexFile, err := fs.root.Open("index.html")
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer indexFile.Close()

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	http.ServeContent(w, r, "index.html", getModTime(indexFile), &readSeekerWrapper{indexFile})
}

// getContentType returns the content type based on file extension
func (fs *FileSystem) getContentType(filepath string) string {
	switch {
	case strings.HasSuffix(filepath, ".js"):
		return "application/javascript"
	case strings.HasSuffix(filepath, ".css"):
		return "text/css"
	case strings.HasSuffix(filepath, ".json"):
		return "application/json"
	case strings.HasSuffix(filepath, ".png"):
		return "image/png"
	case strings.HasSuffix(filepath, ".jpg"), strings.HasSuffix(filepath, ".jpeg"):
		return "image/jpeg"
	case strings.HasSuffix(filepath, ".svg"):
		return "image/svg+xml"
	case strings.HasSuffix(filepath, ".woff"):
		return "font/woff"
	case strings.HasSuffix(filepath, ".woff2"):
		return "font/woff2"
	default:
		return ""
	}
}

// GetRootFS returns the root filesystem for advanced usage
func (fs *FileSystem) GetRootFS() fs.FS {
	return fs.root
}

// readSeekerWrapper wraps an fs.File to implement io.ReadSeeker for http.ServeContent
type readSeekerWrapper struct {
	file fs.File
}

func (r *readSeekerWrapper) Read(p []byte) (n int, err error) {
	return r.file.Read(p)
}

func (r *readSeekerWrapper) Seek(offset int64, whence int) (int64, error) {
	if seeker, ok := r.file.(ioSeeker); ok {
		return seeker.Seek(offset, whence)
	}
	// If the file doesn't support seeking, return an error
	return 0, fmt.Errorf("file does not support seeking")
}

// ioSeeker interface to check if fs.File supports seeking
type ioSeeker interface {
	Seek(offset int64, whence int) (int64, error)
}

// getModTime gets the modification time from an fs.File
func getModTime(file fs.File) time.Time {
	if stat, err := file.Stat(); err == nil {
		return stat.ModTime()
	}
	return time.Now()
}
