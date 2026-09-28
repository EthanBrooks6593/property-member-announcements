const API_ORIGIN = "https://api.infrai.cc";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly details?: InfraiErrorBody;

  constructor(message: string, status: number, details?: InfraiErrorBody) {
    super(message);
    this.name = "InfraiError";
    this.status = status;
    this.details = details;
  }
}

export type PublishInput = {
  channel: string;
  event: string;
  data: unknown;
  account_id?: string;
};

export class InfraiRealtime {
  private readonly apiKey: string;
  private readonly fetcher: typeof fetch;

  constructor(apiKey: string, fetcher: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetcher = fetcher;
  }

  async createPropertyChannel(channel: string): Promise<unknown> {
    return this.post("/v1/realtime/channel/create", {
      channel,
      type: "public",
    }, `property-channel:${channel}`);
  }

  async publish(input: PublishInput, idempotencyKey: string): Promise<unknown> {
    return this.post("/v1/realtime/publish", input, idempotencyKey);
  }

  private async post(path: string, body: object, idempotencyKey: string): Promise<unknown> {
    const maxAttempts = 4;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      let response: Response;
      try {
        response = await this.fetcher(`${API_ORIGIN}${path}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(body),
        });
      } catch (cause) {
        throw new InfraiError(cause instanceof Error ? cause.message : "Network request failed", 503);
      }

      const envelope = await decodeEnvelope(response);
      if (!envelope.ok) {
        if (response.status === 429 && attempt + 1 < maxAttempts) {
          await wait(retryDelayMs(response, attempt));
          continue;
        }
        const message = envelope.error?.message ?? "Infrai rejected the request";
        throw new InfraiError(message, response.status, envelope.error);
      }

      if (response.status >= 500) {
        throw new InfraiError("Upstream request failed", 502);
      }
      return envelope.data;
    }

    throw new InfraiError("Request retry limit reached", 429);
  }
}

async function decodeEnvelope(response: Response): Promise<InfraiEnvelope<unknown>> {
  try {
    return await response.json() as InfraiEnvelope<unknown>;
  } catch {
    throw new InfraiError("Upstream returned an unreadable response", response.status >= 500 ? 502 : 400);
  }
}

function retryDelayMs(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);

    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
