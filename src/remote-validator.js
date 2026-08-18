// Copyright 2026 Cian AI Ltd. Licensed under Apache-2.0.

export class RemoteWelshValidator {
  constructor({ url, apiToken, fetchImpl = fetch } = {}) {
    if (!url || !apiToken) throw new Error("validator URL and API token are required");
    this.url = url.replace(/\/$/, "");
    this.apiToken = apiToken;
    this.fetchImpl = fetchImpl;
  }

  async validate(request) {
    const response = await this.fetchImpl(`${this.url}/v0.1/validate`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.apiToken}` },
      body: JSON.stringify(request)
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? `validator request failed with ${response.status}`);
    return body;
  }
}
