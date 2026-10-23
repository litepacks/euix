/**
 * apps/deepseek-studio/src/deepseek.js
 * Resilient Server-Sent Events (SSE) Streaming Client for DeepSeek API.
 */

import { getSystemPrompt } from "./prompts.js";

/**
 * Stream completion from DeepSeek API using SSE reader.
 *
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} [options.baseUrl="https://api.deepseek.com"]
 * @param {string} [options.model="deepseek-chat"]
 * @param {string} options.userPrompt
 * @param {string} [options.systemPrompt]
 * @param {number} [options.temperature=0.2]
 * @param {Function} options.onChunk - (delta: string, accumulated: string) => void
 * @param {Function} options.onComplete - (fullText: string) => void
 * @param {Function} options.onError - (error: Error) => void
 * @param {AbortSignal} [options.signal]
 * @returns {Promise<void>}
 */
export async function streamDeepSeekCompletion({
    apiKey,
    baseUrl = "https://api.deepseek.com",
    model = "deepseek-chat",
    userPrompt,
    systemPrompt = getSystemPrompt(),
    temperature = 0.2,
    onChunk,
    onComplete,
    onError,
    signal,
}) {
    if (!apiKey) {
        const err = new Error("DeepSeek API Key is required. Please enter your API Key in Settings.");
        onError(err);
        return;
    }

    const cleanBaseUrl = baseUrl.replace(/\/+$/, "");
    const endpoint = `${cleanBaseUrl}/chat/completions`;

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
    ];

    const body = {
        model,
        messages,
        temperature,
        stream: true,
    };

    let response;
    try {
        response = await fetch(endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey.trim()}`,
            },
            body: JSON.stringify(body),
            signal,
        });
    } catch (fetchErr) {
        if (signal?.aborted) return;
        onError(new Error(`Failed to connect to DeepSeek API at ${endpoint}: ${fetchErr.message}`));
        return;
    }

    if (!response.ok) {
        let errDetail = "";
        try {
            const errJson = await response.json();
            errDetail = errJson.error?.message || JSON.stringify(errJson);
        } catch (_) {
            errDetail = await response.text();
        }

        const msg = `DeepSeek API Error (${response.status}): ${errDetail || response.statusText}`;
        onError(new Error(msg));
        return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let accumulated = "";
    let buffer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data:")) continue;

                const dataPayload = trimmed.slice(5).trim();
                if (dataPayload === "[DONE]") {
                    continue;
                }

                try {
                    const parsed = JSON.parse(dataPayload);
                    const delta = parsed.choices?.[0]?.delta?.content || "";
                    if (delta) {
                        accumulated += delta;
                        if (onChunk) {
                            onChunk(delta, accumulated);
                        }
                    }
                } catch (_) {
                    // Incomplete JSON in SSE frame, ignore and continue
                }
            }
        }

        // Flush any trailing buffer
        if (buffer.trim()) {
            const trimmed = buffer.trim();
            if (trimmed.startsWith("data:") && trimmed.slice(5).trim() !== "[DONE]") {
                try {
                    const parsed = JSON.parse(trimmed.slice(5).trim());
                    const delta = parsed.choices?.[0]?.delta?.content || "";
                    if (delta) {
                        accumulated += delta;
                        if (onChunk) onChunk(delta, accumulated);
                    }
                } catch (_) {}
            }
        }

        if (onComplete) {
            onComplete(accumulated);
        }
    } catch (streamErr) {
        if (signal?.aborted) return;
        onError(streamErr);
    }
}
