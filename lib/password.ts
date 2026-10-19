import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

/**
 * Password hashing with Node's built-in scrypt: no native dependency to compile.
 * Stored format: scrypt$N$r$p$salt$hash (parameters travel with the hash, so the
 * cost can be raised later and old hashes still verify).
 */
const N = 2 ** 15;
const R = 8;
const P = 1;
const KEYLEN = 64;

const derive = (password: string, salt: Buffer, n: number, r: number, p: number, keylen: number) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCb(password.normalize("NFKC"), salt, keylen, { N: n, r, p, maxmem: 128 * n * r * 2 }, (err, key) =>
      err ? reject(err) : resolve(key)
    )
  );

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P, KEYLEN);
  return ["scrypt", N, R, P, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await derive(password, Buffer.from(salt, "base64"), +n, +r, +p, expected.length);
  return timingSafeEqual(key, expected);
}

let dummy: Promise<string> | undefined;
/** A valid hash of a random password, used to spend equal time when an email doesn't exist. */
export const dummyHash = () => (dummy ??= hashPassword(randomBytes(16).toString("hex")));
