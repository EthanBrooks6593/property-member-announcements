import assert from "node:assert/strict";
import test from "node:test";
import { announcementRequestSchema, prepareAnnouncement } from "./property_announcement_service.js";

test("a closed maintenance area becomes a high-priority member announcement", () => {
  const input = announcementRequestSchema.parse({
    kind: "maintenance_request",
    propertyId: "maple-court",
    requestId: "maint-204",
    title: "Garage access update",
    location: "West garage",
    summary: "The vehicle entrance is closed during gate repairs.",
    accessImpact: "closed",
  });

  assert.deepEqual(prepareAnnouncement(input), {
    channel: "property-management:maple-court",
    event: "property.announcement",
    data: {
      kind: "maintenance_request",
      title: "Garage access update",
      message: "West garage: The vehicle entrance is closed during gate repairs.",
      priority: "high",
      scheduledFor: undefined,
    },
  });
});

test("unknown request fields are rejected at the HTTP boundary schema", () => {
  const parsed = announcementRequestSchema.safeParse({
    kind: "tenant_document",
    propertyId: "maple-court",
    documentId: "doc-88",
    documentName: "Updated house rules",
    title: "Document ready",
    action: "review",
    surprise: true,
  });

  assert.equal(parsed.success, false);
});
