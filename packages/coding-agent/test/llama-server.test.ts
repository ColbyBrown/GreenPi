import { afterEach, describe, expect, it } from "vitest";
import { llamaServerUrl } from "../src/core/llama-server.ts";
import { llamaServerAsset } from "../src/utils/llama-install.ts";

afterEach(() => {
	delete process.env.LLAMA_BASE_URL;
});

describe("llamaServerAsset", () => {
	it("maps macOS to Metal builds", () => {
		expect(llamaServerAsset("darwin", "arm64", false)).toMatch(/bin-macos-arm64\.tar\.gz$/u);
		expect(llamaServerAsset("darwin", "x64", true)).toMatch(/bin-macos-x64\.tar\.gz$/u);
	});

	it("uses Vulkan on Linux when ICDs are detected, CPU otherwise", () => {
		expect(llamaServerAsset("linux", "x64", true)).toMatch(/bin-ubuntu-vulkan-x64\.tar\.gz$/u);
		expect(llamaServerAsset("linux", "arm64", true)).toMatch(/bin-ubuntu-vulkan-arm64\.tar\.gz$/u);
		expect(llamaServerAsset("linux", "x64", false)).toMatch(/bin-ubuntu-x64\.tar\.gz$/u);
		expect(llamaServerAsset("linux", "arm64", false)).toMatch(/bin-ubuntu-arm64\.tar\.gz$/u);
	});

	it("uses Vulkan only for Windows x64, CPU otherwise", () => {
		expect(llamaServerAsset("win32", "x64", true)).toMatch(/bin-win-vulkan-x64\.zip$/u);
		expect(llamaServerAsset("win32", "x64", false)).toMatch(/bin-win-cpu-x64\.zip$/u);
		expect(llamaServerAsset("win32", "arm64", true)).toMatch(/bin-win-cpu-arm64\.zip$/u);
	});

	it("returns null for unsupported platforms and architectures", () => {
		expect(llamaServerAsset("linux", "s390x", false)).toBeNull();
		expect(llamaServerAsset("android", "arm64", false)).toBeNull();
		expect(llamaServerAsset("freebsd", "x64", false)).toBeNull();
	});
});

describe("llamaServerUrl", () => {
	it("defaults to localhost:8080", () => {
		expect(llamaServerUrl()).toBe("http://127.0.0.1:8080");
	});

	it("honors LLAMA_BASE_URL and strips /v1 and trailing slashes", () => {
		process.env.LLAMA_BASE_URL = "http://localhost:9999/v1/";
		expect(llamaServerUrl()).toBe("http://localhost:9999");
		process.env.LLAMA_BASE_URL = "http://192.168.1.10:8081";
		expect(llamaServerUrl()).toBe("http://192.168.1.10:8081");
	});
});
