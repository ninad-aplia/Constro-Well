// AES-256-GCM OTP encryption + bcrypt verification helpers.
// The plaintext code never reaches the database or logs.
import { createCipheriv, createDecipheriv, randomBytes, randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { ApiError } from "@/server/http";

function key(): Buffer {
  const raw = process.env.OTP_ENCRYPTION_KEY;
  if (!raw) throw new ApiError(500, "otp_key_missing", "OTP encryption is not configured");
  const buffer =
    /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  if (buffer.length !== 32) {
    throw new ApiError(500, "otp_key_invalid", "OTP encryption key must be 32 bytes");
  }
  return buffer;
}

export function generateOtp(): string {
  return String(randomInt(1000, 10000));
}

export function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10);
}

export function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

/** Format: v1:<iv b64>:<tag b64>:<ciphertext b64> */
export function encryptOtp(otp: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(otp, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptOtp(payload: string | null): string | null {
  if (!payload) return null;
  try {
    const [version, iv, tag, ciphertext] = payload.split(":");
    if (version !== "v1" || !iv || !tag || !ciphertext) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
    decipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
