const STORAGE_KEY = 'image-host-config'

export function getConfig() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function setConfig(config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY)
}
