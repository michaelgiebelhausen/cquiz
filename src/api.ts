let csrf = "";
let transport = "sse";
export function setTransport(value: string) {
  transport = value;
}
export function getTransport() {
  return transport;
}
export function setCsrf(value: string) {
  csrf = value;
}
export async function api<T>(path: string, body?: unknown): Promise<T> {
  const form = body instanceof FormData;
  const response = await fetch(`/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers:
      body === undefined
        ? {}
        : {
            "X-CSRF-Token": csrf,
            ...(form ? {} : { "Content-Type": "application/json" }),
          },
    body: body === undefined ? undefined : form ? body : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed. Try again.");
  return data;
}
