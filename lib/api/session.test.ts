import { beforeEach, describe, expect, it } from "vitest";
import { setDevConfig } from "../mock/dev";
import { canOpen, clearSession, getSession, setSession } from "../auth-session";
import { adminLogin, ApiError } from "./index";

beforeEach(() => {
  window.localStorage.clear();
  setDevConfig({ delay: false, errorMode: "off" });
});

describe("adminLogin (mock)", () => {
  it("accepts the owner and staff demo logins", async () => {
    expect(await adminLogin({ email: "owner@barbr.demo", password: "demo1234" })).toEqual({ email: "owner@barbr.demo", name: "Salon owner", role: "OWNER" });
    expect((await adminLogin({ email: " STAFF@barbr.demo ", password: "demo1234" })).role).toBe("STAFF");
  });
  it("never returns the password", async () => {
    expect(JSON.stringify(await adminLogin({ email: "owner@barbr.demo", password: "demo1234" }))).not.toContain("demo1234");
  });
  it("rejects wrong credentials", async () => {
    for (const bad of [{ email: "owner@barbr.demo", password: "nope" }, { email: "x@y.z", password: "demo1234" }, { email: "", password: "" }]) {
      await expect(adminLogin(bad)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    }
    await expect(adminLogin({ email: "a", password: "b" })).rejects.toBeInstanceOf(ApiError);
  });
});

describe("session storage and roles", () => {
  it("stores, reads and clears a session", () => {
    expect(getSession()).toBeNull();
    setSession({ email: "owner@barbr.demo", name: "Salon owner", role: "OWNER" });
    expect(getSession()?.role).toBe("OWNER");
    clearSession();
    expect(getSession()).toBeNull();
  });
  it("survives corrupt storage", () => {
    window.localStorage.setItem("barbr-admin-session", "{not json");
    expect(getSession()).toBeNull();
  });
  it("keeps staff out of Branches & fees only", () => {
    expect(canOpen("STAFF", "/admin/branches")).toBe(false);
    expect(canOpen("STAFF", "/admin/branches/anything")).toBe(false);
    for (const p of ["/admin", "/admin/bookings", "/admin/calendar", "/admin/barbers", "/admin/settings"]) expect(canOpen("STAFF", p), p).toBe(true);
    expect(canOpen("OWNER", "/admin/branches")).toBe(true);
  });
});
