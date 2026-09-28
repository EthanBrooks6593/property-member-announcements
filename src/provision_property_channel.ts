import { InfraiRealtime } from "./infrai_realtime.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before provisioning a channel");

const propertyId = process.argv[2];
if (!propertyId) throw new Error("Pass a property ID, for example: npm run provision -- maple-court");

const channel = `property-management:${propertyId}`;
const realtime = new InfraiRealtime(apiKey);
await realtime.createPropertyChannel(channel);
console.log(JSON.stringify({ created: true, channel }, null, 2));
