import { normalizeReceiptText } from '@/lib/utils/itemMatching'

export type AliasUpsertInput = {
  household_item_id: string
  display_text: string
}

export type AliasUpsertRow = {
  household_id: string
  household_item_id: string
  alias_text: string
  display_text: string
}

/** Collapse in-request duplicates by normalized alias_text. */
export function dedupeAliasRowsInBatch(
  householdId: string,
  aliases: AliasUpsertInput[],
): AliasUpsertRow[] {
  const byAliasText = new Map<string, AliasUpsertRow>()

  aliases.forEach((alias) => {
    const trimmed = alias.display_text.trim()
    if (!trimmed) return

    const aliasText = normalizeReceiptText(trimmed)
    if (!aliasText) return

    const existing = byAliasText.get(aliasText)
    if (!existing) {
      byAliasText.set(aliasText, {
        household_id: householdId,
        household_item_id: alias.household_item_id,
        alias_text: aliasText,
        display_text: trimmed,
      })
      return
    }

    byAliasText.set(aliasText, {
      ...existing,
      household_item_id: alias.household_item_id,
    })
  })

  return Array.from(byAliasText.values())
}

/** Remove rows that already exist in DB with the same item id (optional filter input). */
export function filterAliasesAlreadyLinked(
  rows: AliasUpsertRow[],
  existing: Array<{ alias_text: string; household_item_id: string }>,
): AliasUpsertRow[] {
  const linked = new Set(
    existing.map((e) => `${e.alias_text}\0${e.household_item_id}`),
  )

  return rows.filter(
    (row) => !linked.has(`${row.alias_text}\0${row.household_item_id}`),
  )
}
