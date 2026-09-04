export interface TaskCategoryRecord {
  id: string
  householdId: string
  name: string
  color: string
  createdAt: string
}

export interface CreateTaskCategoryPayload {
  name: string
  color: string
}
