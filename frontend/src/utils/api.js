const DEFAULT_TIMEOUT_MS = 20000
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim()

function resolveUrl(path) {
  if (!API_BASE_URL) return path
  return `${API_BASE_URL}${path}`
}

async function readJsonSafe(response) {
  try {
    return await response.json()
  } catch {
    return {}
  }
}

export class ApiError extends Error {
  constructor(message, status, payload = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.payload = payload
  }
}

async function request(path, options = {}) {
  const {
    method = 'GET',
    token = '',
    body,
    headers = {},
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  const reqHeaders = { ...headers }
  if (body !== undefined) {
    reqHeaders['Content-Type'] = 'application/json'
  }
  if (token) {
    reqHeaders.Authorization = `Bearer ${token}`
  }

  try {
    const response = await fetch(resolveUrl(path), {
      method,
      headers: reqHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    })

    const payload = await readJsonSafe(response)
    if (!response.ok) {
      const message = payload?.detail || `Request failed with status ${response.status}`
      throw new ApiError(message, response.status, payload)
    }

    return payload
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new ApiError('Request timed out. Please try again.', 408)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

export function getApiHealth() {
  return request('/health', { timeoutMs: 7000 })
}

export function loginUser(payload) {
  return request('/auth/login', {
    method: 'POST',
    body: payload,
  })
}

export function signupUser(payload) {
  return request('/auth/signup', {
    method: 'POST',
    body: payload,
  })
}

export function analyzeStudent(payload, token) {
  return request('/api/analyze', {
    method: 'POST',
    body: payload,
    token,
  })
}

export async function fetchAnalysisHistory(token, limit = 20) {
  if (!token) {
    return { history: [] }
  }

  try {
    return await request(`/api/history?limit=${limit}`, { token })
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { history: [] }
    }
    throw error
  }
}

export function simulateStudent(payload, token) {
  return request('/api/simulate', {
    method: 'POST',
    body: payload,
    token,
  })
}

export function fetchUserProfile(token) {
  if (!token) {
    return Promise.resolve({ profile: null })
  }
  return request('/api/profile', { token })
}

export function saveUserProfile(payload, token) {
  return request('/api/profile', {
    method: 'PUT',
    body: payload,
    token,
  })
}
