import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { VanPlanError } from "@/lib/van-plan/db";

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;
const DUMMY_HASH =
  "scrypt$00000000000000000000000000000000$" + "00".repeat(KEY_LENGTH);

const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER = "abcdefghijkmnopqrstuvwxyz";
const DIGITS = "23456789";
const SPECIAL = "!@#$%&*?";

export const PASSWORD_RULES =
  "at least 8 characters, with one capital letter, one number, and one special character";

export function assertPasswordComplexity(password: string) {
  if (password.length < 8) {
    throw new VanPlanError(`Password must be ${PASSWORD_RULES}.`);
  }

  if (!/[A-Z]/.test(password)) {
    throw new VanPlanError("Password must include at least one capital letter.");
  }

  if (!/\d/.test(password)) {
    throw new VanPlanError("Password must include at least one number.");
  }

  if (!/[^A-Za-z0-9]/.test(password)) {
    throw new VanPlanError("Password must include at least one special character.");
  }
}

export function assertPasswordsMatch(password: string, confirmPassword: string) {
  if (password !== confirmPassword) {
    throw new VanPlanError("Passwords do not match.");
  }
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, KEY_LENGTH)) as Buffer;

  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, storedHash?: string | null) {
  const parsed = parseStoredHash(storedHash || DUMMY_HASH);

  if (!parsed) {
    await scrypt(password, "0".repeat(32), KEY_LENGTH);
    return false;
  }

  const derived = (await scrypt(password, parsed.salt, KEY_LENGTH)) as Buffer;
  const expected = Buffer.from(parsed.hash, "hex");

  if (derived.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(derived, expected);
}

export function generateTemporaryPassword() {
  const parts = [
    pick(UPPER, 2),
    pick(LOWER, 5),
    pick(DIGITS, 2),
    pick(SPECIAL, 2),
  ].join("");

  return shuffle(parts);
}

function parseStoredHash(value: string) {
  const [scheme, salt, hash] = value.split("$");

  if (scheme !== "scrypt" || !salt || !hash) {
    return null;
  }

  return { salt, hash };
}

function pick(alphabet: string, count: number) {
  const bytes = randomBytes(count);

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}

function shuffle(value: string) {
  const chars = value.split("");

  for (let index = chars.length - 1; index > 0; index -= 1) {
    const swapWith = randomBytes(1)[0] % (index + 1);
    [chars[index], chars[swapWith]] = [chars[swapWith], chars[index]];
  }

  return chars.join("");
}
