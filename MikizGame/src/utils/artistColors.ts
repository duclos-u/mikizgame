export function artistHue(name: string): number {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = ((hash * 31) + name.charCodeAt(i)) >>> 0
  return hash % 360
}

export function artistColors(name: string) {
  const h = artistHue(name)
  return {
    avBg: `oklch(0.86 0.07 ${h})`,
    avFg: `oklch(0.42 0.13 ${h})`,
    bar: `oklch(0.62 0.15 ${h})`,
  }
}
