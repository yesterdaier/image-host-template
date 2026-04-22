import axios from 'axios'

class ImageHostApi {
  constructor() {
    this.client = axios.create({
      timeout: 60000,
    })
  }

  getBaseUrl() {
    const cfg = JSON.parse(localStorage.getItem('image-host-config') || '{}')
    return cfg.workerUrl?.replace(/\/$/, '') || ''
  }

  getHeaders() {
    const cfg = JSON.parse(localStorage.getItem('image-host-config') || '{}')
    const headers = {}
    if (cfg.password) {
      headers['X-Access-Password'] = cfg.password
    }
    return headers
  }

  async getImages() {
    const res = await this.client.get(`${this.getBaseUrl()}/api/images`, {
      headers: this.getHeaders(),
    })
    return res.data
  }

  async upload(path, base64Content, filename) {
    const res = await this.client.post(
      `${this.getBaseUrl()}/api/upload`,
      {
        path,
        content: base64Content,
        message: `Upload ${filename}`,
      },
      { headers: this.getHeaders() }
    )
    return res.data
  }

  async deleteFile(path) {
    const res = await this.client.delete(`${this.getBaseUrl()}/api/delete`, {
      headers: this.getHeaders(),
      data: { path },
    })
    return res.data
  }
}

export const api = new ImageHostApi()
