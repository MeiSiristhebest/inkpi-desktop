import { useState, useEffect, useCallback } from 'react'
import type { FormDataRepository } from '../ports/formDataRepository'
import { indexedDbFormDataRepository } from '../adapters/indexedDbFormDataRepository'

export interface UseFormViewModelOptions {
  projectId: string
  tabId: string
  repository?: FormDataRepository
}

export function useFormViewModel({
  projectId,
  tabId,
  repository = indexedDbFormDataRepository,
}: UseFormViewModelOptions) {
  const [formData, setFormData] = useState<Record<string, any>>({})
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
    await repository.saveFormData(projectId, tabId, formData)
    setIsSaved(true)
  }, [projectId, tabId, formData, repository])

  return {
    formData,
    isSaved,
    loading,
    updateField,
    save,
    reload: loadData,
  }
}
