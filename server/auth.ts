/*
 * Senhas (scrypt com salt) e sessões (token assinado com HMAC-SHA256).
 * A sessão vai no cabeçalho Authorization — não usamos cookie, porque o app
 * (Vercel) e a API (ZimaOS) ficam em domínios diferentes.
 */
import { createHmac, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;
const SESSION_DAYS = 30;

const SECRET = process.env.SESSION_SECRET ?? "";
if (SECRET.length < 32) throw new Error("Defina SESSION_SECRET com pelo menos 32 caracteres (openssl rand -hex 32).");

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string | undefined) {
  const [scheme, saltHex, keyHex] = (stored ?? "").split("$");
  if (scheme !== "scrypt" || !saltHex || !keyHex) return false;
  const key = await scryptAsync(password, Buffer.from(saltHex, "hex"), 64);
  return timingSafeEqual(key, Buffer.from(keyHex, "hex"));
}

const sign = (payload: string) => createHmac("sha256", SECRET).update(payload).digest("base64url");

/** `sv` = versão da sessão da conta: trocar a senha aumenta a versão e derruba as sessões antigas. */
export type Session = { memberId: string; teamId: string; sv: number };

export function createSession(session: Session) {
  const payload = Buffer.from(JSON.stringify({ ...session, exp: Date.now() + SESSION_DAYS * 864e5 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSession(token: string | undefined | null): Session | null {
  const [payload, signature] = (token ?? "").split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return { memberId: String(data.memberId), teamId: String(data.teamId), sv: Number(data.sv) || 0 };
  } catch {
    return null;
  }
}
