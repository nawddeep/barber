import { ApiError, run } from "./core";

const OTP_CODE = "4815"; // MOCK: a real backend sends a random code by SMS.
const MAX_WRONG = 3;
const LOCK_MS = 30_000;
const VERIFIED_MS = 15 * 60_000;

const validPhone = (p: string) => /^\d{10}$/.test(p);

/** MOCK: pretends to send an SMS. Nothing is sent. */
export function sendOtp(input: { phone: string }): Promise<{ sent: true; resendInSec: number }> {
  return run("sendOtp", {}, (db) => {
    if (!validPhone(input.phone)) throw new ApiError("INVALID_INPUT", "Enter a 10-digit mobile number.");
    const state = (db.otp[input.phone] ??= { wrong: 0, lockedUntil: null, verifiedUntil: null });
    state.wrong = 0;
    return { sent: true as const, resendInSec: 30 };
  });
}

/** Three wrong codes lock the phone for 30 seconds. */
export function verifyOtp(input: { phone: string; code: string }): Promise<{ verified: true }> {
  return run("verifyOtp", { saveOnError: true }, (db, now) => {
    if (!validPhone(input.phone)) throw new ApiError("INVALID_INPUT", "Enter a 10-digit mobile number.");
    const state = (db.otp[input.phone] ??= { wrong: 0, lockedUntil: null, verifiedUntil: null });
    if (state.lockedUntil && state.lockedUntil > +now) {
      throw new ApiError("OTP_LOCKED", "Too many wrong codes. Try again shortly.", {
        retryInSec: Math.ceil((state.lockedUntil - +now) / 1000),
      });
    }
    if (input.code !== OTP_CODE) {
      state.wrong += 1;
      if (state.wrong >= MAX_WRONG) {
        state.wrong = 0;
        state.lockedUntil = +now + LOCK_MS;
        throw new ApiError("OTP_LOCKED", "Too many wrong codes. Try again in 30 seconds.", { retryInSec: 30 });
      }
      throw new ApiError("OTP_INVALID", "That code is not right.", { attemptsLeft: MAX_WRONG - state.wrong });
    }
    state.wrong = 0;
    state.lockedUntil = null;
    state.verifiedUntil = +now + VERIFIED_MS;
    return { verified: true as const };
  });
}
