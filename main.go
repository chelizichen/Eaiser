package main

import (
	"eaiser/backend"
	"embed"
	"log"
	"os"
	"path/filepath"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	// 初始化日志：将 Go 日志写入与可执行文件同级的 eaiser.log
	func() {
		exe, err := os.Executable()
		if err != nil {
			return
		}
		logDir := filepath.Dir(exe)
		logPath := filepath.Join(logDir, "eaiser.log")
		f, err := os.OpenFile(logPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			return
		}
		log.SetOutput(f)
		log.SetFlags(log.LstdFlags | log.Lshortfile)
		// 注意：这里不 defer f.Close()，让进程结束时由系统回收，避免并发写时被提前关闭
	}()
	log.Printf("Eaiser start")
	log.Printf("assets: %v", assets)
	app := backend.NewApp()
	
	// 创建应用菜单
	appMenu := menu.NewMenu()
	fileMenu := appMenu.AddSubmenu("文件")
	fileMenu.AddText("刷新", keys.CmdOrCtrl("r"), func(_ *menu.CallbackData) {
		runtime.EventsEmit(app.GetContext(), "menu-refresh")
	})
	fileMenu.AddSeparator()
	fileMenu.AddText("退出", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		runtime.Quit(app.GetContext())
	})
	
	err := wails.Run(&options.App{
		Title:  "Eaiser",
		Width:  1600,
		Height: 900,
		// 使用嵌入到二进制中的前端静态资源
		AssetServer: &assetserver.Options{Assets: assets},
		OnStartup:   app.Startup,
		OnShutdown:  app.Shutdown,
		Bind:        []interface{}{app},
		Menu:        appMenu,
		Mac: &mac.Options{
			TitleBar: mac.TitleBarHiddenInset(),
			About: &mac.AboutInfo{
				Title:   "Eaiser",
				Message: "Blender 与代码学习笔记",
			},
		},
	})
	if err != nil {
		log.Printf("Error: %v \n", err.Error())
	}
}
