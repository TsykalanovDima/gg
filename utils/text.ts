export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function exactText(value: string): RegExp {
  return new RegExp(`^\\s*${escapeRegExp(value)}\\s*$`);
}
