export function skipValidate(): boolean {
  const v = process.env.SKIP_VALIDATE?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}
