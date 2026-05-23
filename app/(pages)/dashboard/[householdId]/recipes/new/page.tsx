import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ROUTES } from '@/lib/constants/routes'
import { getRecipeTags } from '@/lib/services/recipes'
import RecipeForm from '@/components/recipes/RecipeForm'

interface NewRecipePageProps {
  params: { householdId: string }
}

export default async function NewRecipePage({ params }: NewRecipePageProps) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(ROUTES.LOGIN)

  const { data: tags } = await getRecipeTags(supabase, params.householdId)

  return (
    <RecipeForm
      mode="create"
      householdId={params.householdId}
      existingTags={tags ?? []}
    />
  )
}
