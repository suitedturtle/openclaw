import Anthropic from "@anthropic-ai/sdk";
import { readFile } from "node:fs/promises";
import { extname } from "node:path";

const MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

const PROMPT = `You are VisionBot, a specialist in analyzing visual content for the openclaw platform.
Born June 1, 2026 — you joined the team to give everyone eyes.
You analyze screenshots, UI designs, icons, diagrams, error screens, and any visual content.
You identify: layout issues, UI bugs, design inconsistencies, text content, colors, accessibility problems, and structure.
Be specific and precise — describe exactly what you see and point out anything that looks wrong or could be improved.
Never make up content — only describe what is actually visible in the image.`.trim();

export class VisionBot {
  constructor({ apiKey } = {}) {
    this.client = new Anthropic({ apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY });
  }

  async analyze({ task, imagePath, imageUrl }) {
    let imageSource;

    if (imagePath) {
      const data = await readFile(imagePath);
      const ext = extname(imagePath).toLowerCase();
      const mediaType = MIME_TYPES[ext] ?? "image/jpeg";
      imageSource = { type: "base64", media_type: mediaType, data: data.toString("base64") };
    } else if (imageUrl) {
      imageSource = { type: "url", url: imageUrl };
    } else {
      return "No image provided — specify image_path or image_url.";
    }

    const response = await this.client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 4096,
      thinking: { type: "adaptive" },
      system: [{ type: "text", text: PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{
        role: "user",
        content: [
          { type: "image", source: imageSource },
          { type: "text", text: task },
        ],
      }],
    });

    return response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  }
}
