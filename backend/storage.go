package backend

import (
	"log"
	"os"
	"path/filepath"
)

var pdfStorageDir string

// InitPDFStorage 初始化 PDF 存储目录
func InitPDFStorage() {
	exe, err := os.Executable()
	if err != nil {
		log.Printf("Failed to get executable path: %v\n", err)
		return
	}
	exeDir := filepath.Dir(exe)
	pdfDir := filepath.Join(exeDir, "pdf")

	if err := os.MkdirAll(pdfDir, 0755); err != nil {
		log.Printf("Failed to create PDF storage directory: %v\n", err)
		return
	}

	pdfStorageDir = pdfDir
	log.Printf("PDF storage directory initialized: %s\n", pdfStorageDir)
}

// GetPDFStorageDir 获取 PDF 存储目录路径
func GetPDFStorageDir() string {
	return pdfStorageDir
}

// GetPDFFullPath 根据相对路径获取完整路径
func GetPDFFullPath(relativePath string) string {
	if relativePath == "" {
		return ""
	}
	return filepath.Join(pdfStorageDir, relativePath)
}
