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
export interface CreateEntryInput {
  folderId:  number;
  title:     string;
  username:  string;
  password:  string;           
  url?:      string | null;
  notes?:    string | null;
  favorite?: 0 | 1;
}

export interface UpdateEntryInput extends CreateEntryInput {
  id: number;
}

export interface CreateFolderInput {
  name: string;
  icon?: string;
}

export interface UpdateFolderInput extends CreateFolderInput {
  id: number;
}

export interface EntryFormProps {
  entry:           Entry | null      
  folders:         Folder[]
  defaultFolderId: number | null
  onSave:          () => void
  onCancel:        () => void
}
export interface EntryListProps {
  selectedFolderId: number | null
  folders:          Folder[]
  settingsVersion?: number
}

export interface SidebarProps {
  selectedFolderId: number | null
  onSelectFolder:   (id: number | null) => void
  onFoldersChange?:  () => void   
  onSettingsChange?: () => void
}

export interface UnlockScreenProps {
  isFirstLaunch: boolean
  onUnlocked: () => void
}

export interface EncryptedPayload {
  iv:         string;
  authTag:    string;
  ciphertext: string;
}
