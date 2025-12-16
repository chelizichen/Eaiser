package backend

import "log"

func (a *App) CreateColorPreset(name string, hex string) (*ColorPreset, error) {
	p := &ColorPreset{Name: name, Hex: hex}
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

func (a *App) UpdateColorPreset(id uint, name string, hex string) error {
	return DB.Model(&ColorPreset{}).Where("id = ?", id).Updates(map[string]interface{}{
		"name": name,
		"hex":  hex,
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
	err := DB.Order("name asc").Find(&list).Error
	return list, err
}

func (a *App) UpdateCategory(id uint, name string, colorPresetID *uint, parentID *uint) error {
	return DB.Model(&Category{}).Where("id = ?", id).Updates(map[string]interface{}{
		"name":             name,
		"color_preset_id":  colorPresetID,
		"parent_id":        parentID,
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
	log.Printf("ListNotes categoryID=%v", categoryID)
	q := DB.Order("updated_at desc")
	q = q.Where("content_md <> ''")
	if categoryID != nil {
		q = q.Where("category_id = ?", *categoryID)
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

// LogFrontend prints frontend logs to backend stdout for easy debugging
func (a *App) LogFrontend(message string) {
	log.Printf("[Frontend] %s", message)
}
