import { useState, useEffect, useCallback } from 'react'
import type { FormDataRepository } from '../ports/formDataRepository'
import { indexedDbFormDataRepository } from '../adapters/indexedDbFormDataRepository'
import { legacyDomainApplicationService } from '../services/domainApplicationServices'

/** 设定表单视图模型实际写入所需的领域服务接口（结构子类型，便于 DI 与测试注入）。*/
export type FormDomainWriteService = Pick<typeof legacyDomainApplicationService, 'saveForm'>

export interface UseFormViewModelOptions {
  projectId: string
  tabId: string
  repository?: FormDataRepository
  domainService?: FormDomainWriteService
}

export function useFormViewModel({
  projectId,
  tabId,
  repository = indexedDbFormDataRepository,
  domainService = legacyDomainApplicationService,
}: UseFormViewModelOptions) {
  const [formData, setFormData] = useState<Record<string, unknown>>({})
  const [isSaved, setIsSaved] = useState<boolean>(true)
  const [loading, setLoading] = useState<boolean>(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const data = await repository.getFormData(projectId, tabId)
      setFormData(data)
      setIsSaved(true)
    } finally {
      setLoading(false)
    }
  }, [projectId, tabId, repository])

  useEffect(() => {
    loadData()
  }, [loadData])

  const updateField = useCallback((fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }))
    setIsSaved(false)
  }, [])

  const save = useCallback(async () => {
    await domainService.saveForm(projectId, tabId, formData)
    setIsSaved(true)
  }, [projectId, tabId, formData, domainService])

  return {
    formData,
    isSaved,
    loading,
    updateField,
    save,
    reload: loadData,
  }
}
