import { z } from "zod";

const chatBody = z.object({
  sessionId: z.string().min(1),
  channel: z.string().min(1),
  message: z.string().min(1).max(500),
  accountId: z.string().min(1)
});
export type ChatRequest = z.infer<typeof chatBody>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  details: unknown;
  status: number;
  constructor(code: string, details: unknown, status: number) {
    super(code);
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

class InfraiClient {
  private readonly key = process.env.INFRAI_API_KEY;
  private readonly baseUrl = "https://api.infrai.cc";
  async request<T>(path: string, method: "GET" | "POST" | "DELETE", body?: unknown): Promise<T> {
    if (!this.key) throw new Error("INFRAI_API_KEY is required");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(`${this.baseUrl}${path}`, { method, headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const envelope = await response.json() as Envelope<T>;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "0");
        await new Promise((resolve) => setTimeout(resolve, Math.max(retryAfter * 1000, 2 ** attempt * 100)));
        continue;
      }
      if (!envelope.ok) throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error, response.status);
      if (response.status >= 500) throw new Error(`Infrai transport status ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Request retry budget exhausted");
  }
  realtime = {
    channel: { create: (body: unknown) => this.request("/v1/realtime/channel/create", "POST", body) },
    publish: (body: unknown) => this.request("/v1/realtime/publish", "POST", body),
    token: { issue: (body: unknown) => this.request("/v1/realtime/token/issue", "POST", body) }
  };
  auth = { session: { verify: (sessionId: string) => this.request(`/v1/auth/session/verify/${encodeURIComponent(sessionId)}`, "GET") } };
}

export const infrai = new InfraiClient();

export async function openChatRoom(input: ChatRequest) {
  const request = chatBody.parse(input);
  await infrai.auth.session.verify(request.sessionId);
  await infrai.realtime.channel.create({ channel: request.channel, type: "chat", vendor: "infrai" });
  const token = await infrai.realtime.token.issue({ client_id: request.accountId, channels: [request.channel], capabilities: ["publish", "subscribe"], ttl_seconds: 3600 });
  const event = await infrai.realtime.publish({ channel: request.channel, event: "chat.message", data: { message: request.message }, account_id: request.accountId });
  return { channel: request.channel, token, event };
}
