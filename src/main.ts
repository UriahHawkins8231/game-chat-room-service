import { createServer } from "node:http";
import { openChatRoom, InfraiError } from "./chat-room-service.js";

const server = createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/chat/rooms/open") { res.writeHead(404).end(); return; }
  let raw = "";
  for await (const chunk of req) raw += chunk;
  try {
    const result = await openChatRoom(JSON.parse(raw));
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(result));
  } catch (error) {
    const status = error instanceof InfraiError && error.status < 500 ? error.status : 400;
    res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify({ error: error instanceof Error ? error.message : "request rejected" }));
  }
});
server.listen(Number(process.env.PORT ?? 3000), () => console.log("chat room service listening on http://localhost:3000"));
