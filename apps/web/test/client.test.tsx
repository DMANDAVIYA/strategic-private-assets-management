import { ApiError, NetworkError, REQUEST_TIMEOUT_MS, api } from "../src/api/client";
import { jsonResponse } from "./helpers";

test("get throws ApiError carrying status and body on 401", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(401, { error: "unauthorized" })));
  const error = await api.get("/api/auth/me").catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).status).toBe(401);
  expect((error as ApiError).body).toEqual({ error: "unauthorized" });
});

test("get throws NetworkError when fetch rejects", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))));
  await expect(api.get("/api/auth/status")).rejects.toBeInstanceOf(NetworkError);
});

test("get sends credentials and returns parsed json", async () => {
  const fetchMock = vi.fn(async () => jsonResponse(200, { setupRequired: true, authenticated: false, user: null }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(api.get("/api/auth/status")).resolves.toEqual({ setupRequired: true, authenticated: false, user: null });
  expect(fetchMock).toHaveBeenCalledWith("/api/auth/status", expect.objectContaining({ method: "GET", credentials: "include" }));
});

test("post sends a json body with the json content type", async () => {
  const fetchMock = vi.fn(async () => jsonResponse(200, { user: { id: 1, email: "a@b.co", displayName: "Alex" } }));
  vi.stubGlobal("fetch", fetchMock);
  const input = { email: "a@b.co", password: "correct horse battery", trustDevice: false };
  await api.post("/api/auth/login", input);
  const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("/api/auth/login");
  expect(init.method).toBe("POST");
  expect(init.credentials).toBe("include");
  expect(init.body).toBe(JSON.stringify(input));
  expect(new Headers(init.headers).get("content-type")).toBe("application/json");
});

test("post without a body sends an empty json object and resolves null on 204", async () => {
  const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
  vi.stubGlobal("fetch", fetchMock);
  await expect(api.post("/api/auth/logout")).resolves.toBeNull();
  const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
  expect(init.body).toBe("{}");
  expect(new Headers(init.headers).get("content-type")).toBe("application/json");
});

test("get aborts after the request timeout and throws NetworkError", async () => {
  vi.useFakeTimers();
  try {
    const fetchMock = vi.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const outcome = api.get("/api/auth/status").then(
      () => "resolved",
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS - 1);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.signal?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(init.signal?.aborted).toBe(true);
    expect(await outcome).toBeInstanceOf(NetworkError);
  } finally {
    vi.useRealTimers();
  }
});
