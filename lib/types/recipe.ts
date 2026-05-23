export interface Recipe {
  id: string
  name: string
  notes: string | null
  image_url: string | null
  created_by: string
  created_by_name: string
  created_at: string
  category_tag: string | null
  recipe_ingredients: { name: string }[]
}

export interface RecipeIngredient {
  id: string
  name: string
  quantity: string | null
  unit: string | null
}

export interface RecipeStep {
  id: string
  step_number: number
  instruction: string
}

export interface RecipeDetail {
  id: string
  name: string
  notes: string | null
  image_url: string | null
  created_by: string
  created_by_name: string
  created_at: string
  category_tag: string | null
  recipe_ingredients: RecipeIngredient[]
  recipe_steps: RecipeStep[]
}

export interface RecipeTag {
  id: string
  household_id: string
  name: string
  created_at: string
}

export interface CreateRecipePayload {
  name: string
  notes: string | null
  category_tag: string | null
  household_id: string
  ingredients: { name: string; quantity: string | null }[]
  steps: { instruction: string }[]
}

export interface UpdateRecipePayload {
  name: string
  notes: string | null
  category_tag: string | null
  image_url?: string | null
  ingredients: { name: string; quantity: string | null }[]
  steps: { instruction: string }[]
}
