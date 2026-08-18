// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.

function extractOutputText(response) {
  if (typeof response.output_text === "string" && response.output_text) return response.output_text;
  const parts = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") parts.push(content.text);
    }
  }
  if (!parts.length) throw new Error("OpenAI response contained no output text");
  return parts.join("\n");
}

export class OpenAIResponsesProvider {
  constructor({ apiKey, model = "gpt-5.6-luna", baseUrl = "https://api.openai.com/v1", fetchImpl = fetch }) {
    if (!apiKey) throw new Error("OPENAI_API_KEY is required");
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.fetchImpl = fetchImpl;
  }

  async respond({ messages, instructions }) {
    const response = await this.fetchImpl(`${this.baseUrl}/responses`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({ model: this.model, instructions, input: messages })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(body.error?.message ?? `OpenAI request failed with ${response.status}`);
      error.status = response.status;
      error.code = body.error?.code;
      throw error;
    }
    return { text: extractOutputText(body), provider: "openai", model: body.model ?? this.model, response_id: body.id };
  }
}

export { extractOutputText };
