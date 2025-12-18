package backend

import (
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func (a *App) CreateColorPreset(name string, hex string, encrypted bool) (*ColorPreset, error) {
	p := &ColorPreset{Name: name, Hex: hex, Encrypted: encrypted}
	log.Printf("CreateColorPreset: %+v", p)
	err := DB.Create(p).Error
	if err != nil {
		log.Printf("CreateColorPreset error: %v", err)
	}
	return p, err
}

func (a *App) ListColorPresets() ([]ColorPreset, error) {
	var list []ColorPreset
	err := DB.Order("name asc").Find(&list).Error

	return list, err
}

func (a *App) UpdateColorPreset(id uint, name string, hex string, encrypted bool) error {
	return DB.Model(&ColorPreset{}).Where("id = ?", id).Updates(map[string]interface{}{
		"name":      name,
		"hex":       hex,
		"encrypted": encrypted,
	}).Error
}

func (a *App) DeleteColorPreset(id uint) error {
	return DB.Delete(&ColorPreset{}, id).Error
}

func (a *App) CreateCategory(name string, colorPresetID *uint, parentID *uint) (*Category, error) {
	c := &Category{Name: name, ColorPresetID: colorPresetID, ParentID: parentID}
	err := DB.Create(c).Error
	return c, err
}

func (a *App) ListCategories() ([]Category, error) {
	var list []Category
	err := DB.Preload("ColorPreset").Order("name asc").Find(&list).Error
	return list, err
}

func (a *App) UpdateCategory(id uint, name string, colorPresetID *uint, parentID *uint) error {
	return DB.Model(&Category{}).Where("id = ?", id).Updates(map[string]interface{}{
		"name":            name,
		"color_preset_id": colorPresetID,
		"parent_id":       parentID,
	}).Error
}

func (a *App) DeleteCategory(id uint) error {
	return DB.Delete(&Category{}, id).Error
}

func (a *App) CreateNote(title string, language string, snippet string, analysis string, categoryID uint) (*Note, error) {
	n := &Note{Title: title, Language: language, Snippet: snippet, Analysis: analysis, CategoryID: categoryID}
	err := DB.Create(n).Error
	return n, err
}

func (a *App) ListNotes(categoryID *uint) ([]Note, error) {
	var list []Note
	if categoryID != nil {
		log.Printf("ListNotes categoryID=%d", *categoryID)
	} else {
		log.Printf("ListNotes categoryID=<nil>")
	}
	q := DB.Order("updated_at desc")
	q = q.Where("(content_md <> '' OR type = 1)")
	if categoryID != nil {
		// 查询包含子目录的所有分类 ID
		var cats []Category
		if err := DB.Find(&cats).Error; err == nil {
			idSet := map[uint]struct{}{}
			var collect func(uint)
			collect = func(target uint) {
				if _, ok := idSet[target]; ok {
					return
				}
				idSet[target] = struct{}{}
				for _, c := range cats {
					if c.ParentID != nil && *c.ParentID == target {
						collect(c.ID)
					}
				}
			}
			collect(*categoryID)
			var ids []uint
			for id := range idSet {
				ids = append(ids, id)
			}
			if len(ids) > 0 {
				q = q.Where("category_id IN ?", ids)
			} else {
				q = q.Where("category_id = ?", *categoryID)
			}
		} else {
			q = q.Where("category_id = ?", *categoryID)
		}
	}
	err := q.Find(&list).Error
	return list, err
}

func (a *App) UpdateNote(id uint, title string, language string, snippet string, analysis string, categoryID uint) error {
	return DB.Model(&Note{}).Where("id = ?", id).Updates(map[string]interface{}{
		"title":       title,
		"language":    language,
		"snippet":     snippet,
		"analysis":    analysis,
		"category_id": categoryID,
	}).Error
}

func (a *App) CreateNoteMD(title string, language string, contentMD string, categoryID uint) (*Note, error) {
	n := &Note{Title: title, Language: language, ContentMD: contentMD, CategoryID: categoryID}
	err := DB.Create(n).Error
	return n, err
}

func (a *App) UpdateNoteMD(id uint, title string, language string, contentMD string, categoryID uint) error {
	return DB.Model(&Note{}).Where("id = ?", id).Updates(map[string]interface{}{
		"title":       title,
		"language":    language,
		"content_md":  contentMD,
		"category_id": categoryID,
	}).Error
}

func (a *App) DeleteNote(id uint) error {
	return DB.Delete(&Note{}, id).Error
}

// ImportPDF 导入 PDF 文件
// fileDataBase64: base64 编码的文件数据
func (a *App) ImportPDF(fileDataBase64 string, fileName string, categoryID uint) (*Note, error) {
	// 解码 base64 数据
	fileData, err := base64.StdEncoding.DecodeString(fileDataBase64)
	if err != nil {
		log.Printf("Failed to decode base64 PDF data: %v\n", err)
		return nil, fmt.Errorf("解码 PDF 数据失败: %v", err)
	}

	// 生成唯一文件名
	timestamp := time.Now().Unix()
	ext := filepath.Ext(fileName)
	nameWithoutExt := strings.TrimSuffix(fileName, ext)
	safeName := strings.ReplaceAll(nameWithoutExt, " ", "_")
	safeName = strings.ReplaceAll(safeName, "/", "_")
	safeName = strings.ReplaceAll(safeName, "\\", "_")
	uniqueFileName := fmt.Sprintf("%d_%s%s", timestamp, safeName, ext)

	// 保存文件到 PDF 存储目录
	relativePath := uniqueFileName
	fullPath := GetPDFFullPath(relativePath)

	if err := os.WriteFile(fullPath, fileData, 0644); err != nil {
		log.Printf("Failed to save PDF file: %v\n", err)
		return nil, fmt.Errorf("保存 PDF 文件失败: %v", err)
	}

	// 创建 Note 记录
	note := &Note{
		Title:      nameWithoutExt,
		Type:       1, // PDF 类型
		FilePath:   relativePath,
		CategoryID: categoryID,
	}

	if err := DB.Create(note).Error; err != nil {
		// 如果创建失败，删除已保存的文件
		os.Remove(fullPath)
		log.Printf("Failed to create PDF note: %v\n", err)
		return nil, fmt.Errorf("创建 PDF 记录失败: %v", err)
	}

	log.Printf("PDF imported successfully: %s (ID: %d)\n", fileName, note.ID)
	return note, nil
}

// GetPDFPath 获取 PDF 文件的完整路径
func (a *App) GetPDFPath(noteID uint) (string, error) {
	var note Note
	if err := DB.First(&note, noteID).Error; err != nil {
		return "", fmt.Errorf("笔记不存在: %v", err)
	}

	if note.Type != 1 {
		return "", errors.New("该笔记不是 PDF 类型")
	}

	if note.FilePath == "" {
		return "", errors.New("PDF 文件路径为空")
	}

	fullPath := GetPDFFullPath(note.FilePath)

	// 验证文件是否存在
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return "", fmt.Errorf("PDF 文件不存在: %s", fullPath)
	}

	return fullPath, nil
}

// GetPDFContent 获取 PDF 文件的 base64 编码内容
func (a *App) GetPDFContent(noteID uint) (string, error) {
	fullPath, err := a.GetPDFPath(noteID)
	if err != nil {
		return "", err
	}

	fileData, err := os.ReadFile(fullPath)
	if err != nil {
		log.Printf("Failed to read PDF file: %v\n", err)
		return "", fmt.Errorf("读取 PDF 文件失败: %v", err)
	}

	base64Data := base64.StdEncoding.EncodeToString(fileData)
	return base64Data, nil
}

// LogFrontend prints frontend logs to backend stdout for easy debugging
func (a *App) LogFrontend(message string) {
	log.Printf("[Frontend] %s", message)
}
