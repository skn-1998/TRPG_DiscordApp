// Character related types
export interface Character {
  id: string
  name: string
  description?: string
  gameSystem: string
  status: 'active' | 'inactive' | 'archived'
  createdAt: Date
  updatedAt: Date
  userId: string
  // Additional character properties
}

export interface CharacterCreateInput {
  name: string
  description?: string
  gameSystem: string
}

export interface CharacterUpdateInput {
  name?: string
  description?: string
  status?: 'active' | 'inactive' | 'archived'
}

export interface CharacterSummary {
  id: string
  name: string
  gameSystem: string
  status: 'active' | 'inactive' | 'archived'
}
