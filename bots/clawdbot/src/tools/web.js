const BLOCKED_HOSTNAMES = ["localhost", "0.0.0.0"];

function isBlockedUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return "Invalid URL.";
  }
  const h = parsed.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.includes(h)) return `Blocked host: ${h}`;
  if (/^127\./.test(h)) return "Blocked: loopback address.";
  if (/^10\./.test(h)) return "Blocked: private network (10.x).";
  if (/^192\.168\./.test(h)) return "Blocked: private network (192.168.x).";
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(h)) return "Blocked: private network (172.16-31.x).";
  if (h.endsWith(".local")) return "Blocked: .local domain.";
  if (!["http:", "https:"].includes(parsed.protocol)) return `Blocked protocol: ${parsed.protocol}`;
  return null;
}

function stripHtml(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export const webTools = [
  {
    name: "fetch_url",
    description: "Fetch the text content of a public URL. HTML is stripped to plain text. Private/local addresses are blocked.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "A public http or https URL" },
      },
      required: ["url"],
    },
  },
];

export async function executeWebTool(name, input) {
  if (name === "fetch_url") {
    const blocked = isBlockedUrl(input.url);
    if (blocked) return `Fetch rejected: ${blocked}`;

    try {
      const res = await fetch(input.url, {
        headers: { "User-Agent": "clawdbot/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      const raw = await res.text();
      const contentType = res.headers.get("content-type") ?? "";
      const text = contentType.includes("text/html") ? stripHtml(raw) : raw;
      return text.slice(0, 8000);
    } catch (e) {
      return `Fetch error: ${e.message}`;
    }
  }
}
