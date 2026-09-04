import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { SceneBeatsMasterView } from './SceneBeatsMasterView'
import { indexedDbSceneBeatRepository } from '../../../adapters/indexedDbSceneBeatRepository'

describe('SceneBeatsMasterView — 细纲节拍导演器主视口', () => {
  beforeEach(async () => {
    const all = await indexedDbSceneBeatRepository.getAll()
    await Promise.all(all.map((p) => indexedDbSceneBeatRepository.delete(p.id)))
  })

  it('renders empty state when no plans exist and allows creating from template', async () => {
    render(<SceneBeatsMasterView projectId="p1" />)
    expect(await screen.findByText('尚无章节细纲计划')).toBeInTheDocument()

    // 点击决战高潮模板
    fireEvent.click(screen.getByText('决战高潮模板'))
    await waitFor(() => {
      expect(screen.getByDisplayValue('动机切入与风暴前夕')).toBeInTheDocument()
      expect(screen.getByDisplayValue('强敌骤现，试探交锋')).toBeInTheDocument()
      expect(screen.getByDisplayValue('祭出底牌，绝地反杀')).toBeInTheDocument()
    })
  })

  it('allows adding a new beat to current plan', async () => {
    render(<SceneBeatsMasterView projectId="p1" />)
    await screen.findByText('尚无章节细纲计划')
    fireEvent.click(screen.getByText('决战高潮模板'))
    await screen.findByDisplayValue('动机切入与风暴前夕')

    fireEvent.click(screen.getByText('追加微节拍'))
    await waitFor(() => {
      expect(screen.getByDisplayValue('新节拍场景')).toBeInTheDocument()
    })
  })
})
