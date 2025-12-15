package backend

import (
	"log"
	"time"

	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func dsn() string {
	host := Cfg.DB_HOST
	port := Cfg.DB_PORT
	user := Cfg.DB_USER
	pass := Cfg.DB_PASS
	name := Cfg.DB_NAME
	return user + ":" + pass + "@tcp(" + host + ":" + port + ")/" + name + "?charset=utf8mb4&parseTime=True&loc=Local"
}

func InitDB() {
	cfg := &gorm.Config{Logger: logger.Default.LogMode(logger.Warn)}
	db, err := gorm.Open(mysql.Open(dsn()), cfg)
	if err != nil {
		log.Printf("InitDB Error: %v \n", err.Error())
		panic(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		panic(err)
	}
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
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
