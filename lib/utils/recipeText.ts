export function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (c) => c.toUpperCase())
}

export function quantityToUpperCase(str: string): string {
  return str.toUpperCase()
}

export function capitalizeSentences(str: string): string {
  return str.replace(/(^|\.\s+|!\s+|\?\s+)([a-z])/g, (_, sep, letter) => sep + letter.toUpperCase())
}
