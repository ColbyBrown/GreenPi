import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import type { ApiKeyAuth } from "../auth/types.ts";
import { createProvider, type Provider } from "../models.ts";
import type { Model, OpenAICompletionsCompat } from "../types.ts";

// Conservative OpenAI-completions compat shared by local servers and
// OpenAI-compatible proxies: no store/developer-role/strict support, and
// max_tokens instead of max_completion_tokens (widely accepted by local
// servers). Reasoning is model-driven; pi sends no reasoning controls.
const OPENAI_COMPATIBLE_COMPAT: OpenAICompletionsCompat = {
	supportsStore: false,
	supportsDeveloperRole: false,
	supportsReasoningEffort: false,
	maxTokensField: "max_tokens",
	supportsStrictMode: false,
};

/**
 * Auth for servers that usually run without a key: a stored credential or env
 * var wins, otherwise requests are sent with a dummy bearer token (local
 * servers ignore the Authorization header).
 */
function optionalApiKeyAuth(name: string, envVars: readonly string[]): ApiKeyAuth {
	const base = envApiKeyAuth(name, envVars);
	return {
		name,
		login: base.login,
		check: async () => ({ type: "api_key", source: "local server" }),
		resolve: async (input) => (await base.resolve(input)) ?? { auth: { apiKey: "local" }, source: "local server" },
	};
}

interface OpenAIModelsListResponse {
	data?: Array<{ id?: unknown }>;
}

/**
 * Discover models from an OpenAI-compatible `GET /v1/models` endpoint.
 * Returns an empty list when the server is unreachable or the response is not
 * a recognizable model list; contextWindow/maxTokens are conservative guesses
 * that users can override via models.json modelOverrides.
 */
export async function fetchOpenAICompatibleModels(
	providerId: string,
	baseUrl: string,
	signal: AbortSignal,
	apiKey?: string,
): Promise<Model<"openai-completions">[]> {
	try {
		const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
			headers: {
				accept: "application/json",
				...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
			},
			signal: AbortSignal.any([signal, AbortSignal.timeout(5_000)]),
		});
		if (!response.ok) return [];
		const payload = (await response.json()) as OpenAIModelsListResponse;
		if (!Array.isArray(payload.data)) return [];
		return payload.data.flatMap((entry) =>
			typeof entry?.id === "string" && entry.id.length > 0
				? [
						{
							id: entry.id,
							name: entry.id,
							api: "openai-completions" as const,
							provider: providerId,
							baseUrl,
							reasoning: false,
							input: ["text"] as ("text" | "image")[],
							cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
							contextWindow: 128000,
							maxTokens: 8192,
							compat: OPENAI_COMPATIBLE_COMPAT,
						} satisfies Model<"openai-completions">,
					]
				: [],
		);
	} catch {
		// Server offline, timeout, or non-JSON response: no models this round.
		return [];
	}
}

interface LocalProviderOptions {
	id: string;
	name: string;
	baseUrl: string;
	envVars: readonly string[];
}

function localProvider(options: LocalProviderOptions): Provider<"openai-completions"> {
	return createProvider({
		id: options.id,
		name: options.name,
		baseUrl: options.baseUrl,
		auth: { apiKey: optionalApiKeyAuth(`${options.name} API key (optional)`, options.envVars) },
		models: [],
		fetchModels: async (context) =>
			await fetchOpenAICompatibleModels(
				options.id,
				options.baseUrl,
				context.signal,
				context.credential?.type === "api_key" ? context.credential.key : undefined,
			),
		api: openAICompletionsApi(),
	});
}

/** LM Studio local server (Developer → Start Server, default port 1234). */
export function lmStudioProvider(): Provider<"openai-completions"> {
	return localProvider({
		id: "lmstudio",
		name: "LM Studio",
		baseUrl: "http://localhost:1234/v1",
		envVars: ["LMSTUDIO_API_KEY"],
	});
}

/** Ollama local server OpenAI-compatible endpoint (default port 11434). */
export function ollamaProvider(): Provider<"openai-completions"> {
	return localProvider({
		id: "ollama",
		name: "Ollama",
		baseUrl: "http://localhost:11434/v1",
		envVars: ["OLLAMA_API_KEY"],
	});
}

/** vLLM OpenAI-compatible server (default port 8000). */
export function vllmProvider(): Provider<"openai-completions"> {
	return localProvider({
		id: "vllm",
		name: "vLLM",
		baseUrl: "http://localhost:8000/v1",
		envVars: ["VLLM_API_KEY"],
	});
}

/** llama.cpp `llama-server` OpenAI-compatible endpoint (default port 8080). */
export function llamaCppServerProvider(): Provider<"openai-completions"> {
	return localProvider({
		id: "llama-cpp",
		name: "llama.cpp server",
		baseUrl: "http://localhost:8080/v1",
		envVars: ["LLAMA_CPP_API_KEY"],
	});
}
