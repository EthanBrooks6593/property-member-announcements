import { z } from "zod";
import type { InfraiRealtime } from "./infrai_realtime.js";

const baseFields = {
  propertyId: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  scheduledFor: z.string().datetime({ offset: true }).optional(),
};

export const announcementRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    ...baseFields,
    kind: z.literal("maintenance_request"),
    requestId: z.string().trim().min(1).max(80),
    location: z.string().trim().min(1).max(120),
    summary: z.string().trim().min(1).max(500),
    accessImpact: z.enum(["none", "partial", "closed"]),
  }).strict(),
  z.object({
    ...baseFields,
    kind: z.literal("tenant_document"),
    documentId: z.string().trim().min(1).max(80),
    documentName: z.string().trim().min(1).max(160),
    action: z.enum(["review", "sign", "acknowledge"]),
  }).strict(),
  z.object({
    ...baseFields,
    kind: z.literal("inspection_reminder"),
    inspectionId: z.string().trim().min(1).max(80),
    area: z.string().trim().min(1).max(120),
    startsAt: z.string().datetime({ offset: true }),
  }).strict(),
]);

export type AnnouncementRequest = z.infer<typeof announcementRequestSchema>;

export type PreparedAnnouncement = {
  channel: string;
  event: "property.announcement";
  data: {
    kind: AnnouncementRequest["kind"];
    title: string;
    message: string;
    priority: "normal" | "high";
    scheduledFor?: string;
  };
};

export function prepareAnnouncement(input: AnnouncementRequest): PreparedAnnouncement {
  const channel = `property-management:${input.propertyId}`;

  if (input.kind === "maintenance_request") {
    return {
      channel,
      event: "property.announcement",
      data: {
        kind: input.kind,
        title: input.title,
        message: `${input.location}: ${input.summary}`,
        priority: input.accessImpact === "closed" ? "high" : "normal",
        scheduledFor: input.scheduledFor,
      },
    };
  }

  if (input.kind === "tenant_document") {
    return {
      channel,
      event: "property.announcement",
      data: {
        kind: input.kind,
        title: input.title,
        message: `${input.documentName} is ready to ${input.action}.`,
        priority: "normal",
        scheduledFor: input.scheduledFor,
      },
    };
  }

  return {
    channel,
    event: "property.announcement",
    data: {
      kind: input.kind,
      title: input.title,
      message: `Inspection of ${input.area} starts at ${input.startsAt}.`,
      priority: "high",
      scheduledFor: input.scheduledFor,
    },
  };
}

export async function broadcastAnnouncement(
  realtime: InfraiRealtime,
  input: AnnouncementRequest,
): Promise<PreparedAnnouncement> {
  const announcement = prepareAnnouncement(input);
  const entityId = input.kind === "maintenance_request"
    ? input.requestId
    : input.kind === "tenant_document"
      ? input.documentId
      : input.inspectionId;

  await realtime.publish(announcement, `announcement:${input.kind}:${entityId}`);
  return announcement;
}
