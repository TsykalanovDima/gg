export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} must be set in .env (see .env.example)`);
  }
  return value;
}
