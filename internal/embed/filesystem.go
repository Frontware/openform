package embed

import (
	"embed"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"strings"
	"time"
)

//go:embed all:dist
var distFS embed.FS

// FileSystem provides access to embedded static files
type FileSystem struct {
	root fs.FS
}

// NewFileSystem creates a new embedded file system
func NewFileSystem() *FileSystem {
	root, err := fs.Sub(distFS, "dist")
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
	
	// If file doesn't exist, try adding .html (for clean URLs like /en/dashboard)
	if err != nil {
		if !strings.HasSuffix(filePath, ".html") {
			htmlPath := filePath + ".html"
			if fHtml, errHtml := fs.root.Open(htmlPath); errHtml == nil {
				f = fHtml
				filePath = htmlPath
				err = nil
			} else {
				// If still not found, try to find a parallel .html for a directory request
				// e.g. /en/dashboard/ -> /en/dashboard.html
				if strings.HasSuffix(filePath, "/") {
					htmlPath := strings.TrimSuffix(filePath, "/") + ".html"
					if fHtml, errHtml := fs.root.Open(htmlPath); errHtml == nil {
						f = fHtml
						filePath = htmlPath
						err = nil
					}
				}
			}
		}
	}

	if err != nil {
		// Special handling for dynamic form IDs (/[locale]/forms/[id]/edit or /responses)
		// Try to serve a generic template for these routes
		if strings.Count(filePath, "/") == 3 { // e.g., "en/forms/xxx/edit" or "en/forms/xxx/responses"
			parts := strings.Split(filePath, "/")
			if len(parts) == 4 && (parts[2] != "new") { // Skip /forms/new which is handled separately
				locale, _, _, page := parts[0], parts[1], parts[2], parts[3]

				// Try to serve a generic template for this page type
				genericTemplate := fmt.Sprintf("%s/forms/%s-%s.html", locale, page, "template")
				if fGeneric, errGeneric := fs.root.Open(genericTemplate); errGeneric == nil {
					fGeneric.Close()
					// Template exists, but we need to serve the actual page
					// For now, serve the first available pre-generated page as a template
					// Try to find any pre-generated edit page
					templatePath := fmt.Sprintf("%s/forms/00000000-0000-0000-0000-000000000001/%s", locale, page)
					if fTemplate, errTemplate := fs.root.Open(templatePath); errTemplate == nil {
						fTemplate.Close()
						// Serve the template file
						f, err = fs.root.Open(templatePath + ".html")
						if err == nil {
							filePath = templatePath + ".html"
							defer f.Close()
							goto serveFile
						}
					}
				}

				// Fallback: try to serve any edit.html as template
				templatePath := fmt.Sprintf("%s/forms/00000000-0000-0000-0000-000000000001/%s.html", locale, page)
				if fTemplate, errTemplate := fs.root.Open(templatePath); errTemplate == nil {
					fTemplate.Close()
					f, err = fs.root.Open(templatePath)
					if err == nil {
						filePath = templatePath
						defer f.Close()
						goto serveFile
					}
				}
			}
		}

		// Special handling for /f/[slug] URLs (public forms)
		// Try to serve the form.html template for unknown slugs
		if strings.Count(filePath, "/") == 1 && strings.HasPrefix(filePath, "f/") {
			slug := strings.TrimPrefix(filePath, "f/")
			// If it looks like a UUID (or the word "form"), serve the form.html template
			if len(slug) == 36 || slug == "form" { // UUID length is 36 chars
				templatePath := "f/form.html"
				if fTemplate, errTemplate := fs.root.Open(templatePath); errTemplate == nil {
					fTemplate.Close()
					f, err = fs.root.Open(templatePath)
					if err == nil {
						filePath = templatePath
						defer f.Close()
						goto serveFile
					}
				}
			}
		}

		// If file doesn't exist, serve index.html for SPA routing
		fs.serveIndex(w, r)
		return
	}
	defer f.Close()

serveFile:

	// Check if it's a directory
	stat, err := f.Stat()
	if err != nil {
		fs.serveIndex(w, r)
		return
	}

	if stat.IsDir() {
		// If directory, look for index.html inside
		indexInnerPath := filePath + "/index.html"
		if filePath == "" { // Root directory
			indexInnerPath = "index.html"
		} else if !strings.HasSuffix(filePath, "/") {
			indexInnerPath = filePath + "/index.html"
		}

		if fIndex, errIndex := fs.root.Open(indexInnerPath); errIndex == nil {
			fIndex.Close() // Close immediately, we just wanted to check existence

			// Re-open/serve the index file
			f.Close() // Close the directory

			// Update filePath for content type detection
			filePath = indexInnerPath

			f, err = fs.root.Open(filePath)
			if err != nil {
				fs.serveIndex(w, r)
				return
			}
			defer f.Close()

			// Update stat
			stat, _ = f.Stat()
		} else {
			// If index.html not found in directory, check if there is a .html file with same name as directory
			// e.g. /en/dashboard/ -> exists as dir, but maybe we want /en/dashboard.html
			// This logic handles the case where Next.js creates both a dir and an html file
			// Remove trailing slash before adding .html
			dirName := strings.TrimSuffix(filePath, "/")
			htmlPath := dirName + ".html"

			if fHtml, errHtml := fs.root.Open(htmlPath); errHtml == nil {
				f.Close() // Close directory
				f = fHtml
				filePath = htmlPath
				stat, _ = f.Stat()
			} else {
				// If directory and no index or parallel html, serve root index.html
				fs.serveIndex(w, r)
				return
			}
		}
	}

	// Set appropriate content type based on file extension
	contentType := fs.getContentType(filePath)
	if contentType != "" {
		w.Header().Set("Content-Type", contentType)
	}

	// Copy file content to response
	http.ServeContent(w, r, filePath, stat.ModTime(), f.(io.ReadSeeker))
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
