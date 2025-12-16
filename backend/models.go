package backend

import "time"

type Category struct {
	ID             uint      `json:"id" gorm:"primaryKey"`
	Name           string    `json:"name" gorm:"size:100;not null"`
	ColorPresetID  *uint     `json:"colorPresetId"`
	ParentID       *uint     `json:"parentId"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

type ColorPreset struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	Name      string    `json:"name" gorm:"size:100;not null"`
	Hex       string    `json:"hex" gorm:"size:7;not null"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type Note struct {
	ID         uint      `json:"id" gorm:"primaryKey"`
	Title      string    `json:"title" gorm:"size:200"`
	Language   string    `json:"language" gorm:"size:50"`
	Snippet    string    `json:"snippet" gorm:"type:text"`
	Analysis   string    `json:"analysis" gorm:"type:text"`
	ContentMD  string    `json:"contentMd" gorm:"type:longtext"`
	CategoryID uint      `json:"categoryId"`
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}
