package backend

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
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
	return a.CreateNoteMDWithType(title, language, contentMD, categoryID, 0)
}

func (a *App) CreateNoteMDWithType(title string, language string, contentMD string, categoryID uint, noteType uint) (*Note, error) {
	n := &Note{Title: title, Language: language, ContentMD: contentMD, CategoryID: categoryID, Type: noteType}
	err := DB.Create(n).Error
	return n, err
}

func (a *App) UpdateNoteMD(id uint, title string, language string, contentMD string, categoryID uint) error {
	var note Note
	if err := DB.First(&note, id).Error; err != nil {
		return err
	}
	// 保持原有的 Type，不修改
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

// UpdatePDFPage 更新 PDF 的当前页码
func (a *App) UpdatePDFPage(noteID uint, page uint) error {
	var note Note
	if err := DB.First(&note, noteID).Error; err != nil {
		return fmt.Errorf("笔记不存在: %v", err)
	}

	if note.Type != 1 {
		return errors.New("该笔记不是 PDF 类型")
	}

	return DB.Model(&Note{}).Where("id = ?", noteID).Update("pdf_page", page).Error
}

// ExecuteScript 执行命令行工具脚本
// noteID: 笔记 ID
// 返回: ScriptResult
func (a *App) ExecuteScript(noteID uint) (*ScriptResult, error) {
	// 查询笔记
	var note Note
	if err := DB.First(&note, noteID).Error; err != nil {
		return nil, fmt.Errorf("笔记不存在: %v", err)
	}

	// 验证类型
	if note.Type != 2 {
		return nil, errors.New("该笔记不是命令行工具类型")
	}

	// 验证脚本内容
	scriptContent := strings.TrimSpace(note.ContentMD)
	if scriptContent == "" {
		return nil, errors.New("脚本内容为空")
	}

	// 记录执行日志
	log.Printf("执行脚本 (Note ID: %d): %s", noteID, note.Title)

	// 创建执行上下文，设置超时 30 秒
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 执行脚本（使用 sh -c）
	cmd := exec.CommandContext(ctx, "sh", "-c", scriptContent)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// 执行命令
	err := cmd.Run()

	// 获取输出
	stdoutStr := stdout.String()
	stderrStr := stderr.String()

	result := &ScriptResult{
		Stdout:  stdoutStr,
		Stderr:  stderrStr,
		Success: err == nil,
	}

	// 如果命令执行失败，记录错误信息
	if err != nil {
		log.Printf("脚本执行失败 (Note ID: %d): %v, stderr: %s", noteID, err, stderrStr)
		result.Error = err.Error()
	} else {
		log.Printf("脚本执行成功 (Note ID: %d), stdout: %s", noteID, stdoutStr)
	}

	return result, nil
}

// LogFrontend prints frontend logs to backend stdout for easy debugging
func (a *App) LogFrontend(message string) {
	log.Printf("[Frontend] %s", message)
}

// GetCategoryContent 获取目录下所有笔记的内容
func (a *App) GetCategoryContent(categoryID uint) (string, error) {
	log.Printf("[GetCategoryContent] 开始获取目录内容，categoryID=%d", categoryID)
	
	// 先获取目录信息
	var category Category
	if err := DB.First(&category, categoryID).Error; err != nil {
		log.Printf("[GetCategoryContent] 目录不存在: categoryID=%d, error=%v", categoryID, err)
		return "", fmt.Errorf("目录不存在: %v", err)
	}
	log.Printf("[GetCategoryContent] 目录信息: id=%d, name=%s, parentId=%v", category.ID, category.Name, category.ParentID)
	
	notes, err := a.ListNotes(&categoryID)
	if err != nil {
		log.Printf("[GetCategoryContent] 获取笔记列表失败: categoryID=%d, error=%v", categoryID, err)
		return "", fmt.Errorf("获取目录笔记失败: %v", err)
	}
	
	log.Printf("[GetCategoryContent] 获取到笔记数量: %d (categoryID=%d)", len(notes), categoryID)
	
	var contents []string
	for _, note := range notes {
		if note.Type == 1 {
			// PDF 类型，跳过
			log.Printf("[GetCategoryContent] 跳过 PDF 笔记: id=%d, title=%s", note.ID, note.Title)
			continue
		}
		if note.ContentMD != "" {
			contentLen := len(note.ContentMD)
			log.Printf("[GetCategoryContent] 添加笔记: id=%d, title=%s, contentLength=%d, categoryId=%d", 
				note.ID, note.Title, contentLen, note.CategoryID)
			contents = append(contents, fmt.Sprintf("标题: %s\n%s", note.Title, note.ContentMD))
		} else {
			log.Printf("[GetCategoryContent] 跳过空内容笔记: id=%d, title=%s", note.ID, note.Title)
		}
	}

	result := strings.Join(contents, "\n\n---\n\n")
	resultLen := len(result)
	log.Printf("[GetCategoryContent] 最终内容长度: %d 字符 (categoryID=%d, 笔记数=%d)", resultLen, categoryID, len(contents))
	
	if resultLen == 0 {
		log.Printf("[GetCategoryContent] 警告: 目录下没有有效内容 (categoryID=%d)", categoryID)
	}
	
	return result, nil
}

// GetNoteContent 获取单个笔记的内容
func (a *App) GetNoteContent(noteID uint) (string, error) {
	var note Note
	if err := DB.First(&note, noteID).Error; err != nil {
		return "", fmt.Errorf("笔记不存在: %v", err)
	}

	if note.Type == 1 {
		return "", errors.New("PDF 类型笔记暂不支持作为上下文")
	}

	return note.ContentMD, nil
}

// ChatWithAI 与 OpenAI API 进行对话
func (a *App) ChatWithAI(prompt string, contextTexts []string) (string, error) {
	log.Printf("[AI Chat] 开始 AI 对话请求")
	log.Printf("[AI Chat] 用户提示词: %s", prompt)
	log.Printf("[AI Chat] 关联上下文数量: %d", len(contextTexts))
	log.Printf("[AI Chat] 关联上下文: %v", contextTexts)
	
	apiKey := Cfg.OpenAIAPIKey
	if apiKey == "" {
		log.Printf("[AI Chat] 错误: 未配置 OpenAI API Key")
		return "", errors.New("未配置 OpenAI API Key，请设置 OPENAI_API_KEY 环境变量")
	}

	// 构建系统提示词
	systemPrompt := "你是一个有用的 AI 助手。"
	if len(contextTexts) > 0 {
		systemPrompt += "以下是用户提供的上下文内容：\n\n"
		systemPrompt += strings.Join(contextTexts, "\n\n---\n\n")
		systemPrompt += "\n\n请基于以上上下文内容回答用户的问题。"
		log.Printf("[AI Chat] 系统提示词长度: %d 字符", len(systemPrompt))
		for i, ctx := range contextTexts {
			log.Printf("[AI Chat] 上下文 %d 长度: %d 字符", i+1, len(ctx))
		}
	}

	// 构建请求体
	requestBody := map[string]interface{}{
		"model": Cfg.OpenAIModel,
		"messages": []map[string]string{
			{
				"role":    "system",
				"content": systemPrompt,
			},
			{
				"role":    "user",
				"content": prompt,
			},
		},
		"max_tokens": 2000,
		"temperature": 0.7,
	}

	jsonData, err := json.Marshal(requestBody)
	if err != nil {
		log.Printf("[AI Chat] 序列化请求失败: %v", err)
		return "", fmt.Errorf("序列化请求失败: %v", err)
	}
	log.Printf("[AI Chat] 请求体大小: %d 字节", len(jsonData))

	// 创建 HTTP 请求
	apiURL := Cfg.OpenAIAPIURL
	log.Printf("[AI Chat] 请求 URL: %s", apiURL)
	req, err := http.NewRequest("POST", apiURL, bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("[AI Chat] 创建请求失败: %v", err)
		return "", fmt.Errorf("创建请求失败: %v", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	log.Printf("[AI Chat] 请求头已设置，API Key 长度: %d", len(apiKey))

	// 发送请求
	startTime := time.Now()
	client := &http.Client{
		Timeout: 60 * time.Second,
	}
	log.Printf("[AI Chat] 开始发送 HTTP 请求...")
	resp, err := client.Do(req)
	requestDuration := time.Since(startTime)
	if err != nil {
		log.Printf("[AI Chat] HTTP 请求失败 (耗时: %v): %v", requestDuration, err)
		return "", fmt.Errorf("请求失败: %v", err)
	}
	defer resp.Body.Close()
	log.Printf("[AI Chat] HTTP 响应状态码: %d (耗时: %v)", resp.StatusCode, requestDuration)

	// 读取响应
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("[AI Chat] 读取响应失败: %v", err)
		return "", fmt.Errorf("读取响应失败: %v", err)
	}
	log.Printf("[AI Chat] 响应体大小: %d 字节", len(body))

	// 检查 HTTP 状态码
	if resp.StatusCode != http.StatusOK {
		log.Printf("[AI Chat] API 请求失败 (状态码: %d): %s", resp.StatusCode, string(body))
		return "", fmt.Errorf("API 请求失败 (状态码: %d): %s", resp.StatusCode, string(body))
	}

	// 解析响应
	var apiResponse struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.Unmarshal(body, &apiResponse); err != nil {
		log.Printf("[AI Chat] 解析响应失败: %v, 响应内容: %s", err, string(body))
		return "", fmt.Errorf("解析响应失败: %v", err)
	}

	// 检查是否有错误
	if apiResponse.Error.Message != "" {
		log.Printf("[AI Chat] API 返回错误: %s", apiResponse.Error.Message)
		return "", fmt.Errorf("API 错误: %s", apiResponse.Error.Message)
	}

	// 检查是否有回复
	if len(apiResponse.Choices) == 0 {
		log.Printf("[AI Chat] API 未返回任何回复")
		return "", errors.New("API 未返回任何回复")
	}

	responseContent := apiResponse.Choices[0].Message.Content
	log.Printf("[AI Chat] 收到 AI 回复，长度: %d 字符", len(responseContent))
	log.Printf("[AI Chat] AI 回复内容: %s", responseContent)
	log.Printf("[AI Chat] AI 对话请求完成")

	return responseContent, nil
}

// GetAIConfig 获取 AI 配置
func (a *App) GetAIConfig() (*AIConfig, error) {
	cfgMu.RLock()
	defer cfgMu.RUnlock()
	
	return &AIConfig{
		APIKey: Cfg.OpenAIAPIKey,
		APIURL: Cfg.OpenAIAPIURL,
		Model:  Cfg.OpenAIModel,
	}, nil
}

// UpdateAIConfig 更新 AI 配置
func (a *App) UpdateAIConfig(config *AIConfig) error {
	log.Printf("[Config] 更新 AI 配置")
	
	cfgMu.Lock()
	
	// 更新配置值
	if config.APIKey != "" {
		Cfg.OpenAIAPIKey = config.APIKey
		log.Printf("[Config] API Key 已更新 (长度: %d)", len(config.APIKey))
	}
	if config.APIURL != "" {
		Cfg.OpenAIAPIURL = config.APIURL
		log.Printf("[Config] API URL 已更新: %s", config.APIURL)
	}
	if config.Model != "" {
		Cfg.OpenAIModel = config.Model
		log.Printf("[Config] Model 已更新: %s", config.Model)
	}
	
	// 准备保存的数据
	saveConfig := AIConfig{
		APIKey: Cfg.OpenAIAPIKey,
		APIURL: Cfg.OpenAIAPIURL,
		Model:  Cfg.OpenAIModel,
	}
	
	// 获取配置文件路径（需要在锁内获取，因为 configFilePath 可能被修改）
	filePath := configFilePath
	
	cfgMu.Unlock() // 释放锁，避免在文件 I/O 时持有锁
	
	// 序列化配置
	data, err := json.MarshalIndent(saveConfig, "", "  ")
	if err != nil {
		log.Printf("[Config] 序列化配置失败: %v", err)
		return fmt.Errorf("序列化配置失败: %v", err)
	}
	
	// 写入文件
	if err := os.WriteFile(filePath, data, 0644); err != nil {
		log.Printf("[Config] 保存配置文件失败: %v", err)
		return fmt.Errorf("保存配置文件失败: %v", err)
	}
	
	log.Printf("[Config] 配置已保存到: %s", filePath)
	return nil
}

// GetConfigFilePath 获取配置文件路径
func (a *App) GetConfigFilePath() string {
	return GetConfigFilePath()
}

// GetLogFilePath 获取日志文件路径
func (a *App) GetLogFilePath() (string, error) {
	exe, err := os.Executable()
	if err != nil {
		return "", fmt.Errorf("获取可执行文件路径失败: %v", err)
	}
	logDir := filepath.Dir(exe)
	logPath := filepath.Join(logDir, "eaiser.log")
	return logPath, nil
}

// ReadLogFile 读取日志文件内容
func (a *App) ReadLogFile() (string, error) {
	logPath, err := a.GetLogFilePath()
	if err != nil {
		return "", err
	}

	// 检查文件是否存在
	if _, err := os.Stat(logPath); os.IsNotExist(err) {
		return "", fmt.Errorf("日志文件不存在: %s", logPath)
	}

	// 读取文件内容
	fileData, err := os.ReadFile(logPath)
	if err != nil {
		log.Printf("Failed to read log file: %v\n", err)
		return "", fmt.Errorf("读取日志文件失败: %v", err)
	}

	return string(fileData), nil
}

// SaveImage 保存图片文件
// imageDataBase64: base64 编码的图片数据（包含 data:image/xxx;base64, 前缀）
// 返回: 相对路径，用于在 markdown 中引用
func (a *App) SaveImage(imageDataBase64 string) (string, error) {
	// 解析 base64 数据
	var imageData []byte
	var ext string
	
	// 检查是否包含 data URL 前缀
	if strings.HasPrefix(imageDataBase64, "data:image/") {
		// 解析 data URL
		parts := strings.Split(imageDataBase64, ",")
		if len(parts) != 2 {
			return "", fmt.Errorf("无效的 base64 图片数据格式")
		}
		
		// 提取 MIME 类型和扩展名
		mimePart := parts[0]
		if strings.Contains(mimePart, "png") {
			ext = ".png"
		} else if strings.Contains(mimePart, "jpeg") || strings.Contains(mimePart, "jpg") {
			ext = ".jpg"
		} else if strings.Contains(mimePart, "gif") {
			ext = ".gif"
		} else if strings.Contains(mimePart, "webp") {
			ext = ".webp"
		} else {
			ext = ".png" // 默认使用 png
		}
		
		// 解码 base64 数据
		var err error
		imageData, err = base64.StdEncoding.DecodeString(parts[1])
		if err != nil {
			log.Printf("Failed to decode base64 image data: %v\n", err)
			return "", fmt.Errorf("解码图片数据失败: %v", err)
		}
	} else {
		// 直接是 base64 字符串，尝试解码
		var err error
		imageData, err = base64.StdEncoding.DecodeString(imageDataBase64)
		if err != nil {
			log.Printf("Failed to decode base64 image data: %v\n", err)
			return "", fmt.Errorf("解码图片数据失败: %v", err)
		}
		ext = ".png" // 默认扩展名
	}

	// 生成唯一文件名
	timestamp := time.Now().UnixNano()
	uniqueFileName := fmt.Sprintf("%d%s", timestamp, ext)

	// 保存文件到图片存储目录
	relativePath := uniqueFileName
	fullPath := GetImageFullPath(relativePath)

	if err := os.WriteFile(fullPath, imageData, 0644); err != nil {
		log.Printf("Failed to save image file: %v\n", err)
		return "", fmt.Errorf("保存图片文件失败: %v", err)
	}

	log.Printf("Image saved successfully: %s (size: %d bytes)\n", uniqueFileName, len(imageData))
	
	// 返回相对路径，前端可以使用 file:// 协议或相对路径引用
	return relativePath, nil
}

// GetImageContent 获取图片的 base64 编码内容
// relativePath: 相对路径（如 "1234567890.png"）
func (a *App) GetImageContent(relativePath string) (string, error) {
	if relativePath == "" {
		return "", errors.New("图片路径为空")
	}

	fullPath := GetImageFullPath(relativePath)

	// 验证文件是否存在
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		return "", fmt.Errorf("图片文件不存在: %s", fullPath)
	}

	fileData, err := os.ReadFile(fullPath)
	if err != nil {
		log.Printf("Failed to read image file: %v\n", err)
		return "", fmt.Errorf("读取图片文件失败: %v", err)
	}

	// 检测图片类型
	var mimeType string
	ext := filepath.Ext(relativePath)
	switch strings.ToLower(ext) {
	case ".png":
		mimeType = "image/png"
	case ".jpg", ".jpeg":
		mimeType = "image/jpeg"
	case ".gif":
		mimeType = "image/gif"
	case ".webp":
		mimeType = "image/webp"
	default:
		mimeType = "image/png"
	}

	base64Data := base64.StdEncoding.EncodeToString(fileData)
	return fmt.Sprintf("data:%s;base64,%s", mimeType, base64Data), nil
}

