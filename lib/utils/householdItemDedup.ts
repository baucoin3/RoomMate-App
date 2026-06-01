import type { NewHouseholdItemInput, ResolvedHouseholdItem } from '@/lib/types/receipts'
import { normalizeReceiptText } from '@/lib/utils/itemMatching'

function mergeAliases(existing: string[], incoming: string[]): string[] {
  const seen = new Set<string>()
  const merged: string[] = []
  ;[...existing, ...incoming].forEach((alias) => {
    const trimmed = alias.trim()
    if (!trimmed || seen.has(trimmed)) return
    seen.add(trimmed)
    merged.push(trimmed)
  })
  return merged
}

export function dedupeNewHouseholdItems(items: NewHouseholdItemInput[]): ResolvedHouseholdItem[] {
  const byNormalized = new Map<string, ResolvedHouseholdItem>()

  items.forEach((item) => {
    const trimmedName = item.name.trim()
    if (!trimmedName) return

    const normalizedName = normalizeReceiptText(trimmedName)
    if (!normalizedName) return

    const incomingAliases = (item.initial_aliases ?? []).map((a) => a.trim()).filter(Boolean)
    const itemGroup = item.item_group?.trim() || null

    const existing = byNormalized.get(normalizedName)
    if (!existing) {
      byNormalized.set(normalizedName, {
        name: trimmedName,
        default_category_id: item.default_category_id,
        split_overrides: item.split_overrides ?? null,
        item_group: itemGroup,
        initial_aliases: mergeAliases([], incomingAliases),
        normalizedName,
      })
      return
    }

    byNormalized.set(normalizedName, {
      name: trimmedName,
      default_category_id: item.default_category_id,
      split_overrides: item.split_overrides ?? null,
      item_group: itemGroup,
      initial_aliases: mergeAliases(existing.initial_aliases, incomingAliases),
      normalizedName,
    })
  })

  return Array.from(byNormalized.values())
}
