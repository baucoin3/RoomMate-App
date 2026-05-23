import Image from 'next/image'
import Link from 'next/link'
import { RECIPES } from '@/locales/en'
import { ROUTES } from '@/lib/constants/routes'

interface RecipeCardProps {
  id: string
  householdId: string
  name: string
  created_by_name: string
  image_url: string | null
  category_tag: string | null
  cookTimeLabel: string | null
}

// Deterministic placeholder palette cycled by id.charCodeAt(0) % 5
const PLACEHOLDERS = [
  { bg: 'from-[#FAC775] to-[#EF9F27]', icon: 'ti-bread' },
  { bg: 'from-[#C0DD97] to-[#5DCAA5]', icon: 'ti-salad' },
  { bg: 'from-[#F5C4B3] to-[#F0997B]', icon: 'ti-meat' },
  { bg: 'from-[#CECBF6] to-[#AFA9EC]', icon: 'ti-cookie' },
  { bg: 'from-[#B5D4F4] to-[#85B7EB]', icon: 'ti-fish' },
] as const

export default function RecipeCard({
  id,
  householdId,
  name,
  created_by_name,
  image_url,
  category_tag,
  cookTimeLabel,
}: RecipeCardProps) {
  const placeholder = PLACEHOLDERS[id.charCodeAt(0) % 5]

  return (
    <Link
      href={ROUTES.RECIPE_DETAIL(householdId, id)}
      className="group block rounded-xl overflow-hidden border border-[--color-border-secondary] bg-[--color-background-card] hover:border-[--color-border-primary] transition-colors"
    >
      {/* Image area */}
      <div className="aspect-[4/3] w-full overflow-hidden rounded-t-xl relative">
        {image_url ? (
          <Image
            src={image_url}
            alt={name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div
            className={`w-full h-full bg-gradient-to-br ${placeholder.bg} flex items-center justify-center`}
          >
            <i className={`${placeholder.icon} text-4xl text-white`} />
          </div>
        )}

        {/* Category badge */}
        {category_tag && (
          <span className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-medium bg-white/85 text-[#2C2C2A] backdrop-blur-sm">
            {category_tag}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="px-3.5 py-3">
        <p
          className="text-[15px] font-medium leading-tight mb-1 truncate"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {name}
        </p>

        <p
          className="text-[13px] text-[--color-text-secondary] mb-2 truncate"
          style={{ fontFamily: "'Caveat', cursive" }}
        >
          {RECIPES.BY_AUTHOR(created_by_name)}
        </p>

        {/* Ornamental divider */}
        <div className="flex items-center gap-1.5 my-1.5">
          <div className="flex-1 h-px bg-[--color-border-secondary]" />
          <span className="text-[8px] text-[--color-text-tertiary]">✦</span>
          <div className="flex-1 h-px bg-[--color-border-secondary]" />
        </div>

        {/* Meta row */}
        <div className="flex gap-2.5 text-[12px] text-[--color-text-tertiary] mt-2">
          <span className="flex items-center gap-1">
            <i className="ti-clock text-[11px]" />
            {cookTimeLabel ?? RECIPES.NO_TIME}
          </span>
          <span className="flex items-center gap-1">
            <i className="ti-users text-[11px]" />
            {RECIPES.NO_TIME}
          </span>
        </div>
      </div>
    </Link>
  )
}
