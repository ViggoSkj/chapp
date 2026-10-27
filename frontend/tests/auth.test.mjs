import assert from "node:assert/strict";
import { createHash, createHmac } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { login, logout } from "../app/lib/neuron-auth.mjs";

const publicOrigin = "http://mando.test";
function request(path, body, origin = publicOrigin) {
  return new Request(publicOrigin + path, { method: "POST", headers: { Origin: origin, "X-Chapp-Request": "1", Cookie: "HttpSessionID=existing", "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
async function mockBackend(callback, operation) {
  const server = createServer(callback);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const settings = { publicOrigin, backendOrigin: `http://127.0.0.1:${server.address().port}` };
  try { await operation(settings); } finally { await new Promise(resolve => server.close(resolve)); }
}

test("login uses Neuron nonce proof and forwards its session cookie on HTTP", async () => {
  const nonce = "a-known-test-challenge";
  let proof;
  await mockBackend(async (req, res) => {
    if (req.url.startsWith("/Login.md?")) {
      assert.equal(new URL(req.url, publicOrigin).searchParams.get("from"), publicOrigin + "/ChapBackend/Settings.md");
      res.setHeader("Set-Cookie", "HttpSessionID=fresh-session; Path=/; HttpOnly");
      res.end(`<input id="Nonce" type="hidden" value="${nonce}" /><button onclick="DoLogin('return','mando.test')">Login</button>`);
    } else {
      assert.equal(req.url, "/Login");
      assert.equal(req.headers.cookie, "HttpSessionID=fresh-session");
      let body = ""; for await (const chunk of req) body += chunk;
      proof = JSON.parse(body);
      res.setHeader("Content-Type", "application/json"); res.end('{"ok":true}');
    }
  }, async settings => {
    const result = await login(request("/api/auth/login", { username: "neuron-user", password: "test-password" }), settings);
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { ok: true });
    assert.match(result.headers.get("Set-Cookie"), /HttpSessionID=fresh-session.*HttpOnly.*SameSite=Lax/);
  });
  const first = createHash("sha3-256").update("neuron-user:mando.test:test-password").digest();
  assert.deepEqual(proof, { UserName: "neuron-user", PasswordHash: createHmac("sha256", nonce).update(first).digest("base64"), Nonce: nonce });
  assert.ok(!JSON.stringify(proof).includes("test-password"));
});

test("cross-origin login is rejected before contacting Neuron", async () => {
  const result = await login(request("/api/auth/login", { username: "user", password: "password" }, "http://other.test"), { publicOrigin, backendOrigin: "http://127.0.0.1:1" });
  assert.equal(result.status, 403);
});

test("invalid credentials do not forward a session cookie or backend error details", async () => {
  await mockBackend((req, res) => {
    if (req.url.startsWith("/Login.md?")) {
      res.setHeader("Set-Cookie", "HttpSessionID=challenge; Path=/; HttpOnly");
      res.end('<input id="Nonce" value="nonce"/><button onclick="DoLogin(\'return\',\'mando.test\')">Login</button>');
    } else { res.setHeader("Content-Type", "application/json"); res.end('{"ok":false,"message":"private backend detail"}'); }
  }, async settings => {
    const result = await login(request("/api/auth/login", { username: "user", password: "wrong" }), settings);
    assert.equal(result.status, 401); assert.equal(result.headers.get("Set-Cookie"), null);
    assert.ok(!(await result.text()).includes("private backend detail"));
  });
});

test("logout invalidates the upstream session and clears the browser cookie", async () => {
  await mockBackend((req, res) => {
    assert.equal(req.url, "/Logout"); assert.equal(req.method, "POST");
    assert.equal(req.headers.cookie, "HttpSessionID=existing");
    res.writeHead(303, { Location: "/Index.html" }); res.end();
  }, async settings => {
    const result = await logout(request("/api/auth/logout", {}), settings);
    assert.equal(result.status, 200); assert.match(result.headers.get("Set-Cookie"), /Max-Age=0/);
  });
});

test("missing deployment configuration fails closed", async () => {
  const result = await login(request("/api/auth/login", { username: "user", password: "password" }), { publicOrigin, backendOrigin: "" });
  assert.equal(result.status, 503);
});
