package backend

import (
	"log"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	exe, _ := os.Executable()
    dir := filepath.Dir(exe)
    dbPath := filepath.Join(dir, Cfg.DB_PATH)
	cfg := &gorm.Config{Logger: logger.Default.LogMode(logger.Warn)}
	db, err := gorm.Open(sqlite.Open(dbPath), cfg)
	if err != nil {
		log.Printf("InitDB Error: %v \n", err.Error())
		panic(err)
	}
	DB = db
}

func AutoMigrate() {
	DB.AutoMigrate(&Category{}, &ColorPreset{}, &Note{})
}

func CloseDB() {
	if DB == nil {
		return
	}
	sqlDB, err := DB.DB()
	if err != nil {
		return
	}
	sqlDB.Close()
}
