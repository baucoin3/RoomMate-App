import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { getRecipeById } from '@/lib/services/recipes'
import { getMealLogsForRecipe } from '@/lib/services/mealLogs'
import RecipeDetail from '@/components/recipes/RecipeDetail'

interface RecipeDetailPageProps {
  params: { householdId: string; recipeId: string }
}

export default async function RecipeDetailPage({ params }: RecipeDetailPageProps) {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  const [{ data: recipe, error }, { data: mealLogs }] = await Promise.all([
    getRecipeById(supabase, params.recipeId),
    getMealLogsForRecipe(supabase, params.recipeId, 3),
  ])
  if (error || !recipe) notFound()

  return (
    <RecipeDetail
      recipe={recipe}
      householdId={params.householdId}
      initialMealLogs={mealLogs ?? []}
    />
  )
}
