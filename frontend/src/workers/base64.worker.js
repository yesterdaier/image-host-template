// Web Worker: 将 File 对象转为 Base64 字符串
// 在后台线程执行，避免阻塞 UI
self.onmessage = function (e) {
  const { file, id } = e.data
  const reader = new FileReader()

  reader.onload = () => {
    const result = reader.result // data:image/png;base64,xxxxx
    const base64 = result.split(',')[1] // 去掉前缀，只保留 base64 内容
    self.postMessage({ id, success: true, base64, result })
  }

  reader.onerror = () => {
    self.postMessage({ id, success: false, error: reader.error?.message || 'Read failed' })
  }

  reader.readAsDataURL(file)
}
