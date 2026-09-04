import { openAICompletionsApi } from "../api/openai-completions.lazy.ts";
import { envApiKeyAuth } from "../auth/helpers.ts";
import { createProvider, type Provider } from "../models.ts";
import { fetchOpenAICompatibleModels } from "./local.ts";

// Viro AI OpenAI-compatible endpoint (https://ai.viro.app/api).
const VIRO_BASE_URL = "https://ai.viro.app/api";

/** Viro AI with a dynamically discovered model catalog (GET /models). */
export function viroProvider(): Provider<"openai-completions"> {
	return createProvider({
		id: "viro",
		name: "Viro AI",
		baseUrl: VIRO_BASE_URL,
		auth: { apiKey: envApiKeyAuth("Viro API key", ["VIRO_API_KEY"]) },
		models: [],
		fetchModels: async (context) =>
			await fetchOpenAICompatibleModels(
				"viro",
				VIRO_BASE_URL,
				context.signal,
				context.credential?.type === "api_key" ? context.credential.key : undefined,
			),
		api: openAICompletionsApi(),
	});
}
