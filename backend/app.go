package backend

import (
	"context"
	osruntime "runtime"
	"sync"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type App struct {
	ctx         context.Context
	mu          sync.Mutex
	lastBioAuth time.Time
}

func NewApp() *App { return &App{} }

func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx
	InitConfig()
	InitDB()
	AutoMigrate()
}

func (a *App) Shutdown(ctx context.Context) {
	CloseDB()
}

func (a *App) GetContext() context.Context {
	return a.ctx
}

// SetTheme 设置应用主题（用于更新窗口外观）
func (a *App) SetTheme(isDark bool) {
	if a.ctx == nil {
		return
	}
	// Wails 在 macOS 上会自动跟随系统外观，这里主要用于日志记录
	if isDark {
		runtime.LogInfo(a.ctx, "Theme switched to dark mode")
	} else {
		runtime.LogInfo(a.ctx, "Theme switched to light mode")
	}
}

// RequireBiometric 在需要时请求 Touch ID（仅 macOS 生效）
func (a *App) RequireBiometric(reason string) error {
	if osruntime.GOOS != "darwin" {
		return nil
	}
	a.mu.Lock()
	if !a.lastBioAuth.IsZero() && time.Since(a.lastBioAuth) < 30*time.Minute {
		a.mu.Unlock()
		return nil
	}
	a.mu.Unlock()

	err := requireBiometricAuth(reason)
	if err == nil {
		a.mu.Lock()
		a.lastBioAuth = time.Now()
		a.mu.Unlock()
	}
	return err
}
