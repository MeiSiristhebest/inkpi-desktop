import type { FileDownloader } from '../ports/fileDownloader'

/**
 * Blob 文件下载器：封装「创建 ObjectURL + 触发 <a> 点击 + 回收」这一浏览器副作用。
 * 业务层（exportProject / 章节导出）通过端口调用，不直接操作 document。
 */
export const blobFileDownloader: FileDownloader = {
  downloadBlob(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
