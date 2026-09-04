/**
 * 文件下载端口（抽象）。
 *
 * 把「触发浏览器下载」这一副作用从业务层（如 exportProject）隔离出去，
 * 业务层只调用 downloadBlob(...)，具体如何下载由适配器决定（Blob URL / 远端上传等）。
 */
export interface FileDownloader {
  downloadBlob(filename: string, blob: Blob): void
}
