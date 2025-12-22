package backend

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"
)

var (
	cfgMu sync.RWMutex
	Cfg   = struct {
		DB_PATH      string
		OpenAIAPIKey string
		OpenAIAPIURL string
		OpenAIModel  string
	}{
		DB_PATH:      "eaiser.db",
		OpenAIAPIKey: "",
		OpenAIAPIURL: "https://api.xiaomimimo.com/v1/chat/completions",
		OpenAIModel:  "mimo-v2-flash",
	}
	configFilePath string
)

// AIConfig AI 配置结构
type AIConfig struct {
	APIKey string `json:"apiKey"`
	APIURL string `json:"apiURL"`
	Model  string `json:"model"`
}

// InitConfig 初始化配置，从配置文件读取
func InitConfig() {
	// 获取可执行文件所在目录
	exe, err := os.Executable()
	if err != nil {
		log.Printf("Failed to get executable path: %v\n", err)
		configFilePath = "eaiser.config.json"
	} else {
		exeDir := filepath.Dir(exe)
		configFilePath = filepath.Join(exeDir, "eaiser.config.json")
	}

	// 尝试读取配置文件
	if err := LoadConfig(); err != nil {
		log.Printf("Failed to load config file, using defaults: %v\n", err)
		// 如果配置文件不存在，使用默认值并保存
		if os.IsNotExist(err) {
			if err := SaveConfig(); err != nil {
				log.Printf("Failed to save default config: %v\n", err)
			}
		}
	}
}

// LoadConfig 从配置文件加载配置
func LoadConfig() error {
	cfgMu.Lock()
	defer cfgMu.Unlock()

	data, err := os.ReadFile(configFilePath)
	if err != nil {
		log.Printf("Failed to read config file: %v\n", err)
		return err
	}

	var config AIConfig
	if err := json.Unmarshal(data, &config); err != nil {
		log.Printf("Failed to unmarshal config: %v\n", err)
		return err
	}

	Cfg.OpenAIAPIKey = config.APIKey
	if config.APIURL != "" {
		Cfg.OpenAIAPIURL = config.APIURL
	}
	if config.Model != "" {
		Cfg.OpenAIModel = config.Model
	}

	log.Printf("Config loaded from: %s\n", configFilePath)
	return nil
}

// SaveConfig 保存配置到文件
func SaveConfig() error {
	cfgMu.Lock()
	defer cfgMu.Unlock()

	config := AIConfig{
		APIKey: Cfg.OpenAIAPIKey,
		APIURL: Cfg.OpenAIAPIURL,
		Model:  Cfg.OpenAIModel,
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		log.Printf("Failed to marshal config: %v\n", err)
		return err
	}

	if err := os.WriteFile(configFilePath, data, 0644); err != nil {
		log.Printf("Failed to save config: %v\n", err)
		return err
	}

	log.Printf("Config saved to: %s\n", configFilePath)
	return nil
}

// GetConfigFilePath 获取配置文件路径
func GetConfigFilePath() string {
	return configFilePath
}
