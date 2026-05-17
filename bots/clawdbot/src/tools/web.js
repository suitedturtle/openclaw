export const webTools = [
  {
    name: "fetch_url",
    description: "Fetch the text content of a URL. Use for documentation, APIs, or any web page.",
    input_schema: {
      type: "object",
      properties: {
        url: { type: "string", description: "The URL to fetch" },
      },
      required: ["url"],
    },
  },
];

export async function executeWebTool(name, input) {
  if (name === "fetch_url") {
    try {
      const res = await fetch(input.url, {
        headers: { "User-Agent": "clawdbot/1.0" },
        signal: AbortSignal.timeout(10000),
      });
      const text = await res.text();
      return text.slice(0, 8000);
    } catch (e) {
      return `Fetch error: ${e.message}`;
    }
  }
}
