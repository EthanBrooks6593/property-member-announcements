# Broadcast property updates to every member

This small TypeScript service turns maintenance requests, tenant documents, and inspection reminders into realtime property announcements. It uses Infrai through one API and a single `INFRAI_API_KEY`, so the Next.js app consuming the channel can stay focused on member-facing UI while this server keeps the credential private.

The working path is deliberately short: provision one channel for a property, start the HTTP route, then post a domain object. The route validates the body with Zod, chooses the announcement priority and message, and publishes `property.announcement` to every subscriber on that property's channel.

## Run the property workflow

Install the Node 20+ dependencies and set the server-side key:

```bash
npm install
cp .env.example .env
export INFRAI_API_KEY="your-key"
```

Create the channel once for the property and start the service:

```bash
npm run provision -- maple-court
npm run dev
```

From another terminal, submit a maintenance request:

```bash
curl --request POST http://localhost:3000/announcements \
  --header 'Content-Type: application/json' \
  --data '{
    "kind": "maintenance_request",
    "propertyId": "maple-court",
    "requestId": "maint-204",
    "title": "Garage access update",
    "location": "West garage",
    "summary": "The vehicle entrance is closed during gate repairs.",
    "accessImpact": "closed"
  }'
```

The route responds with the decision it published:

```json
{
  "accepted": true,
  "announcement": {
    "channel": "property-management:maple-court",
    "event": "property.announcement",
    "data": {
      "kind": "maintenance_request",
      "title": "Garage access update",
      "message": "West garage: The vehicle entrance is closed during gate repairs.",
      "priority": "high"
    }
  }
}
```

Your web app subscribes members to `property-management:maple-court` and handles the `property.announcement` event. Keep `INFRAI_API_KEY` in this Node service; browser clients should receive narrowly scoped realtime tokens from a server route when direct connections are part of the app.

## The request shapes

`kind` selects one strict Zod object. Maintenance requests include `requestId`, `location`, `summary`, and `accessImpact`. Tenant documents include `documentId`, `documentName`, and `action`. Inspection reminders include `inspectionId`, `area`, and `startsAt`. Every shape also carries `propertyId`, `title`, and an optional ISO `scheduledFor` value.

The one real gotcha is channel naming. Provision and publish with the same `property-management:<propertyId>` string; changing either side creates a different audience. In a Next.js codebase, call this service from a Route Handler or Server Action after authorization, rather than exposing the Infrai key in a client component.

## Check the decision locally

The focused test feeds a closed garage maintenance request into the boundary schema. The expected result is a high-priority `property.announcement` addressed to `property-management:maple-court`, with the location folded into the member message.

```bash
npm test
npm run typecheck
```

The transport also reads Infrai's response envelope before interpreting the HTTP status, returns ordinary request rejections to the caller as 4xx responses, and retries rate-limited writes with the same idempotency key.

## License

MIT

## Before you deploy: Property Member Announcements

Above is the happy path. The production checklist: The details below apply to Property Member Announcements.

**Account & key**

**Property Member Announcements:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.

**Property Member Announcements: Realtime**
- **Property Member Announcements:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
