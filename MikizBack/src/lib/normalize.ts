export function normalizeWord(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/Œ/g, "OE")
    .replace(/Æ/g, "AE")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z]/g, "");
}
