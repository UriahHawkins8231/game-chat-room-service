import assert from "node:assert/strict";
import { openChatRoom } from "./chat-room-service.js";

process.env.INFRAI_API_KEY = "test-key";
const calls: Array<{ path: string; body?: unknown }> = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = (async (input, init) => {
  calls.push({ path: new URL(String(input)).pathname, body: init?.body ? JSON.parse(String(init.body)) : undefined });
  return new Response(JSON.stringify({ ok: true, data: { issued: true } }), { status: 200, headers: { "content-type": "application/json" } });
}) as typeof fetch;
const result = await openChatRoom({ sessionId: "sess_1", channel: "match-42", message: "GG", accountId: "player-7" });
assert.equal(result.channel, "match-42");
assert.deepEqual(calls.map((call) => call.path), ["/v1/auth/session/verify/sess_1", "/v1/realtime/channel/create", "/v1/realtime/token/issue", "/v1/realtime/publish"]);
assert.equal((calls[2].body as { client_id: string }).client_id, "player-7");
globalThis.fetch = originalFetch;
console.log("chat room workflow test passed");
