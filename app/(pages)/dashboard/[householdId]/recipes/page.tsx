import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { getRecipes, getRecipeTags } from '@/lib/services/recipes'
import RecipesClient from '@/components/recipes/RecipesClient'

export default async function RecipesPage({ params }: { params: { householdId: string } }) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  const [{ data: recipes, error }, { data: tags }] = await Promise.all([
    getRecipes(supabase, params.householdId),
    getRecipeTags(supabase, params.householdId),
  ])

  return (
    <RecipesClient
      householdId={params.householdId}
      initialRecipes={recipes ?? []}
      initialTags={tags ?? []}
      error={error}
    />
  )
}
