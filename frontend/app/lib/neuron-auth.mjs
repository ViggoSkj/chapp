import { createHash, createHmac } from "node:crypto";

function reply(body, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function configuration(request, settings) {
  const origin = settings.publicOrigin ?? process.env.CHAP_PUBLIC_ORIGIN;
  const backend = settings.backendOrigin ?? process.env.CHAP_AUTH_ORIGIN;
  if (!origin || !backend) return null;
  const publicUrl = new URL(origin);
  const backendUrl = new URL(backend);
  if (![publicUrl, backendUrl].every(url => ["http:", "https:"].includes(url.protocol) && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash)) return null;
  if (request.headers.get("Origin") !== publicUrl.origin || request.headers.get("X-Chapp-Request") !== "1") return false;
  return { publicUrl, backendUrl };
}

export async function login(request, settings = {}) {
  try {
    const config = configuration(request, settings);
    if (config === false) return reply({ error: "This sign-in request is not allowed." }, 403);
    if (!config) return reply({ error: "Sign-in is not configured yet." }, 503);
    const raw = await request.text();
    if (raw.length > 16384) return reply({ error: "Sign-in details are too long." }, 400);
    let body;
    try { body = JSON.parse(raw); } catch { return reply({ error: "Enter your username and password." }, 400); }
    if (!body || typeof body.username !== "string" || typeof body.password !== "string" || !body.username.trim() || !body.password || body.username.length > 320 || body.password.length > 4096) return reply({ error: "Enter your username and password." }, 400);
    const username = body.username.trim();
    const headers = { Host: config.publicUrl.host };
    const challengeUrl = new URL("/Login.md", config.backendUrl);
    challengeUrl.searchParams.set("from", new URL("/ChapBackend/Settings.md", config.publicUrl).href);
    const challenge = await fetch(challengeUrl, { headers, redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15000) });
    const page = await challenge.text();
    const nonce = page.match(/id="Nonce"[^>]*value="([^"]+)"/)?.[1];
    const domain = page.match(/DoLogin\('[^']*','([^']*)'\)/)?.[1];
    const sessionCookie = challenge.headers.getSetCookie().find(cookie => cookie.startsWith("HttpSessionID="));
    if (!challenge.ok || !nonce || !domain || !sessionCookie) return reply({ error: "Sign-in is temporarily unavailable. Please try again." }, 503);
    const first = createHash("sha3-256").update(`${username}:${domain}:${body.password}`, "utf8").digest();
    const proof = createHmac("sha256", nonce).update(first).digest("base64");
    const result = await fetch(new URL("/Login", config.backendUrl), {
      method: "POST", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { ...headers, Cookie: sessionCookie.split(";", 1)[0], "Content-Type": "application/json" },
      body: JSON.stringify({ UserName: username, PasswordHash: proof, Nonce: nonce }),
    });
    const authentication = result.ok ? await result.json() : null;
    if (!authentication?.ok) return reply({ error: "Sign-in failed. Check your username and password, or try again later." }, 401);
    const response = reply({ ok: true });
    const authenticatedCookie = result.headers.getSetCookie().find(cookie => cookie.startsWith("HttpSessionID=")) ?? sessionCookie;
    response.headers.append("Set-Cookie", authenticatedCookie + (/;\s*SameSite=/i.test(authenticatedCookie) ? "" : "; SameSite=Lax"));
    return response;
  } catch {
    return reply({ error: "Sign-in is temporarily unavailable. Please try again." }, 503);
  }
}

export async function logout(request, settings = {}) {
  try {
    const config = configuration(request, settings);
    if (config === false) return reply({ error: "This sign-out request is not allowed." }, 403);
    if (!config) return reply({ error: "Sign-out is not configured yet." }, 503);
    const result = await fetch(new URL("/Logout", config.backendUrl), {
      method: "POST", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { Host: config.publicUrl.host, Cookie: request.headers.get("Cookie") ?? "" },
    });
    if (!result.ok && result.status !== 303) return reply({ error: "Could not sign out. Please try again." }, 503);
    const response = reply({ ok: true });
    response.headers.append("Set-Cookie", `HttpSessionID=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${config.publicUrl.protocol === "https:" ? "; Secure" : ""}`);
    return response;
  } catch { return reply({ error: "Could not sign out. Please try again." }, 503); }
}
