export function genTk(): string {
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const alphaNum = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const rand = (pool: string) => pool[Math.floor(Math.random() * pool.length)];
  let token = rand(letters);
  for (let i = 1; i < 4; i += 1) token += rand(alphaNum);
  return token;
}

export function genOid(): string {
  const uuid = `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  const short = String(uuid).replace(/-/g, '').slice(0, 10).toUpperCase();
  return `ON-${short}`;
}
