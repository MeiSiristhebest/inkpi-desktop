/**
 * 封面上传辅助：把本地图片文件读为 data URL。
 * 体积校验（≤2MB）与提示留在 UI 层；返回 null 表示被拒绝（未读取）。
 * 抽出为共享函数，避免 CreateProjectPanel / ProjectEditForm 重复 FileReader 样板（§2.2）。
 */
export const readCoverImage = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    if (file.size > 2 * 1024 * 1024) {
      alert('封面图片请控制在 2MB 以内')
      resolve(null)
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(file)
  })
