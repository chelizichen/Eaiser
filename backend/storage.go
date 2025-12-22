package backend

import (
	"log"
	"os"
	"path/filepath"
)

var (
	pdfStorageDir   string
	imageStorageDir string
)

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

// InitImageStorage 初始化图片存储目录
func InitImageStorage() {
	exe, err := os.Executable()
	if err != nil {
		log.Printf("Failed to get executable path: %v\n", err)
		return
	}
	exeDir := filepath.Dir(exe)
	imageDir := filepath.Join(exeDir, "images")

	if err := os.MkdirAll(imageDir, 0755); err != nil {
		log.Printf("Failed to create image storage directory: %v\n", err)
		return
	}

	imageStorageDir = imageDir
	log.Printf("Image storage directory initialized: %s\n", imageStorageDir)
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

// GetImageStorageDir 获取图片存储目录路径
func GetImageStorageDir() string {
	return imageStorageDir
}

// GetImageFullPath 根据相对路径获取完整路径
func GetImageFullPath(relativePath string) string {
	if relativePath == "" {
		return ""
	}
	return filepath.Join(imageStorageDir, relativePath)
}
