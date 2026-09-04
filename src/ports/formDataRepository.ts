/**
 * 设定表单仓储端口 (DIP)
 */
export interface FormDataRepository {
  getFormData(projectId: string, tabId: string): Promise<Record<string, any>>
  saveFormData(projectId: string, tabId: string, data: Record<string, any>): Promise<void>
}
