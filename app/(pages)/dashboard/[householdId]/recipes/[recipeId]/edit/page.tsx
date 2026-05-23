import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { getRecipeById, getRecipeTags } from '@/lib/services/recipes'
import RecipeForm from '@/components/recipes/RecipeForm'

interface EditRecipePageProps {
  params: { householdId: string; recipeId: string }
}

export default async function EditRecipePage({ params }: EditRecipePageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  const [{ data: recipe, error }, { data: tags }] = await Promise.all([
    getRecipeById(supabase, params.recipeId),
    getRecipeTags(supabase, params.householdId),
  ])

  if (error || !recipe) notFound()

  return (
    <RecipeForm
      mode="edit"
      householdId={params.householdId}
      initialData={recipe}
      existingTags={tags ?? []}
    />
  )
}
