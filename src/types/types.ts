export interface Folder {
  id:          number
  name:        string
  icon:        string
  entry_count: number
}

export interface Entry {
  id:          number
  folder_id:   number
  title:       string
  username:    string | null
  password:    string
  url:         string | null
  notes:       string | null
  favorite:    0 | 1
  created_at:  string
  updated_at:  string
  folder_name?: string
}