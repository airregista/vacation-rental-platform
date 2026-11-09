export class ApiError extends Error {
  status: number
  detail: string

  constructor(status: number, detail: string) {
    super(`API Error (${status}): ${detail}`)
    this.name = "ApiError"
    this.status = status
    this.detail = detail
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1"

function serializeBody(body?: unknown): BodyInit | null | undefined {
  if (body === undefined || body === null) return undefined
  if (typeof body === "string" || body instanceof FormData) return body
  return JSON.stringify(body)
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`

  const headers = new Headers(options.headers || {})
  if (options.body && !headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }

  // Inject token if available in client environment
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token")
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`)
    }
  }

  const response = await fetch(url, {
    ...options,
    headers,
  })

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("access_token")
      window.dispatchEvent(new Event("auth:unauthorized"))
    }
    let errorDetail = "خطای سرور رخ داده است"
    try {
      const errorJson = await response.json()
      if (typeof errorJson.detail === "string") {
        errorDetail = errorJson.detail
      } else if (Array.isArray(errorJson.detail) && errorJson.detail.length > 0) {
        errorDetail = errorJson.detail[0]?.msg || JSON.stringify(errorJson.detail)
      } else if (errorJson.message) {
        errorDetail = errorJson.message
      }
    } catch {
      errorDetail = response.statusText || errorDetail
    }
    throw new ApiError(response.status, errorDetail)
  }

  if (response.status === 204) {
    return {} as T
  }

  const text = await response.text()
  return (text ? JSON.parse(text) : {}) as T
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: serializeBody(body),
    }),

  put: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: serializeBody(body),
    }),

  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: serializeBody(body),
    }),

  delete: <T>(endpoint: string, body?: unknown, options?: RequestInit) =>
    request<T>(endpoint, {
      ...options,
      method: "DELETE",
      body: serializeBody(body),
    }),
}
