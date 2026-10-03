import { ApiError, run } from "./core";

export type AdminRole = "OWNER" | "STAFF";

export interface AdminSession {
  email: string;
  name: string;
  role: AdminRole;
}

// MOCK: demo credentials, shown on the login page. A real backend checks a password hash and issues a token.
const USERS: Array<AdminSession & { password: string }> = [
  { email: "owner@barbr.demo", password: "demo1234", name: "Salon owner", role: "OWNER" },
  { email: "staff@barbr.demo", password: "demo1234", name: "Front desk", role: "STAFF" },
];

export const DEMO_LOGINS = USERS.map(({ email, password, role }) => ({ email, password, role }));

/** MOCK login. Returns the session; the caller keeps it (see lib/auth-session.ts). */
export function adminLogin(input: { email: string; password: string }): Promise<AdminSession> {
  return run("adminLogin", { readOnly: true }, () => {
    const u = USERS.find((x) => x.email === input.email.trim().toLowerCase() && x.password === input.password);
    if (!u) throw new ApiError("UNAUTHORIZED", "Wrong email or password.");
    const { password: _password, ...session } = u;
    void _password;
    return session;
  });
}
