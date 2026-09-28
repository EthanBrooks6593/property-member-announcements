import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import { InfraiError, InfraiRealtime } from "./infrai_realtime.js";
import { announcementRequestSchema, broadcastAnnouncement } from "./property_announcement_service.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const realtime = new InfraiRealtime(apiKey);
const port = Number(process.env.PORT ?? 3000);

createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/announcements") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const body = await readJson(request);
    const input = announcementRequestSchema.parse(body);
    const announcement = await broadcastAnnouncement(realtime, input);
    sendJson(response, 202, { accepted: true, announcement });
  } catch (error) {
    if (error instanceof ZodError) {
      sendJson(response, 400, { error: "Invalid announcement", issues: error.issues });
      return;
    }
    if (error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Request body must be valid JSON" });
      return;
    }
    if (error instanceof InfraiError) {
      const status = error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.message, details: error.details });
      return;
    }
    sendJson(response, 500, { error: "Announcement could not be processed" });
  }
}).listen(port, () => {
  console.log(`Property announcement service listening on http://localhost:${port}`);
});

function readJson(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = "";
    void (async () => {
      try {
        for await (const chunk of request) {
          body += chunk;
          if (body.length > 64_000) throw new SyntaxError("Request body is too large");
        }
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    })();
  });
}

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}
