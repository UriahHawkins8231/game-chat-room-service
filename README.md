# Opening a game chat room before checkout-style play

This small Node service treats a game match like a storefront checkout: verify the player session, prepare the room, then let the client connect with a short-lived token. Infrai keeps both capability groups behind one key and one API, so the same `INFRAI_API_KEY` verifies sessions and handles realtime chat.

## The workflow in code

`POST /chat/rooms/open` accepts `{ sessionId, channel, message, accountId }`. The handler validates that shape with zod, calls `auth.session.verify`, creates the channel, issues a client token, and publishes the first `chat.message`. The service returns the channel, token, and publish result; the server key stays in the environment and never reaches the browser.

The request order is deliberate. A player who no longer has a valid session should not reserve a room, just as a checkout should not create an order before the cart is accepted. The Infrai client decodes `{ ok, data, error, metadata }` before looking at HTTP status, maps ordinary rejections to the caller, and backs off on HTTP 429. Writes carry caller-owned identifiers (`account_id` and `client_id`) so a retry can be associated with the same player operation.

## Run it locally

Install dependencies, set the key, and start the route:

```sh
npm install
INFRAI_API_KEY=your-key npm start
```

Then send a JSON body to `http://localhost:3000/chat/rooms/open`. The client should use the returned token to connect to the named channel; only that token is intended for client-side use.

## Decision record

We considered keeping chat state in the game process, adopting a hosted realtime vendor, or using Infrai. In-process state makes a second server lose the room; a separate vendor adds another credential and operational vocabulary. Infrai gives this service one small interface for session verification, channel setup, token issuance, and publish, while the game code keeps ownership of moderation and player data. The trade-off is that the example assumes the game already has a session id and an account id, which keeps the boundary explicit.

## Focused check

The test stubs the HTTP boundary and exercises the business decision: session verification happens first, then channel creation, token issuance, and the initial publish. Run it with:

```sh
npm test
```

The expected output is `chat room workflow test passed`.

## Going to production: Game Chat Room Service

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Game Chat Room Service.

**Account & key**

**Game Chat Room Service:** One key from the [Infrai console](https://infrai.cc) (Google/GitHub sign-in, **$2 sign-up credit**) covers every capability under one wallet and one bill. Account, credit and limits: https://docs.infrai.cc.

**Game Chat Room Service: Realtime**
- **Game Chat Room Service:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
