export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}
