import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrainstormSparkMasterView } from './BrainstormSparkMasterView'
import { BrainstormSparkDrawer } from './BrainstormSparkDrawer'
import { indexedDbBrainstormRepository } from '../../../adapters/indexedDbBrainstormRepository'

vi.mock('../../../adapters/indexedDbBrainstormRepository', () => ({
  indexedDbBrainstormRepository: {
    getAll: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

const PLACEHOLDERS = {
  coreProblem: '例：主角被困在一处既打不过也退不走的死地',
  enemyAdvantage: '例：对方握着主角无法正面抗衡的人数与规矩',
  currentSituation: '例：合围还在收紧，能用的筹码已经见底',
  protagonistGoal: '例：活着脱身，同时不丢掉最关键的那一样东西',
}

const fillFullDilemma = () => {
  fireEvent.change(screen.getByPlaceholderText(PLACEHOLDERS.coreProblem), {
    target: { value: '主角被堵在废弃矿道尽头，追兵只剩一炷香' },
  })
  fireEvent.change(screen.getByPlaceholderText(PLACEHOLDERS.currentSituation), {
    target: { value: '矿道口已经塌了一半，手里的火折子只剩一根' },
  })
  fireEvent.change(screen.getByPlaceholderText(PLACEHOLDERS.protagonistGoal), {
    target: { value: '带着伤重的同伴出去，并且不暴露身份的来路' },
  })
  fireEvent.change(screen.getByPlaceholderText(PLACEHOLDERS.enemyAdvantage), {
    target: { value: '对方熟知矿道每一条支路，且人手是这边的五倍' },
  })
}

describe('BrainstormSpark Components', () => {
  beforeEach(() => {
    vi.mocked(indexedDbBrainstormRepository.save).mockClear()
  })

  it('§P2.4：空白工作区不预置仙侠困境，也不预置推演结果', () => {
    render(<BrainstormSparkMasterView projectId="proj-1" />)

    expect(screen.getByText(/灵感火花与困境脱壳破局炉/)).toBeInTheDocument()
    // 旧断言要求一进页面就能看到「空间置换 / 金蝉脱壳」，那是用替作者编好的仙侠困境跑出来的，
    // 现在反向断言它必须不存在（INV-05）。
    expect(screen.queryByText(/空间置换 \/ 金蝉脱壳/)).not.toBeInTheDocument()
    expect(screen.queryByText(/采纳为备选灵感/)).not.toBeInTheDocument()

    for (const placeholder of Object.values(PLACEHOLDERS)) {
      expect(screen.getByPlaceholderText(placeholder)).toHaveValue('')
    }
    expect(screen.getByText(/填写困境后再生成/)).toBeInTheDocument()
    expect(screen.getByText(/未配置困境/)).toBeInTheDocument()
  })

  it('四项填齐后点推演才产出 8 条方案', async () => {
    render(<BrainstormSparkMasterView projectId="proj-1" />)
    fillFullDilemma()

    fireEvent.click(screen.getByText('推演 8 大逆向破局策略'))

    await waitFor(() => {
      expect(screen.getAllByText('采纳为备选灵感')).toHaveLength(8)
    })
    expect(screen.queryByText(/填写困境后再生成/)).not.toBeInTheDocument()
    // 卡片里出现的必须是作者自己写的困境，而不是示例文案。
    expect(screen.getAllByText(/追兵只剩一炷香/).length).toBeGreaterThan(0)
  })

  it('未填齐时拒绝推演，并把上一次的卡片撤下（INV-09）', async () => {
    render(<BrainstormSparkMasterView projectId="proj-1" />)
    fillFullDilemma()
    fireEvent.click(screen.getByText('推演 8 大逆向破局策略'))
    await waitFor(() => expect(screen.getAllByText('采纳为备选灵感')).toHaveLength(8))

    fireEvent.change(screen.getByPlaceholderText(PLACEHOLDERS.coreProblem), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByText('推演 8 大逆向破局策略'))

    expect(screen.queryByText(/采纳为备选灵感/)).not.toBeInTheDocument()
    expect(screen.getByText(/填写困境后再生成：当前核心死局 尚未填写/)).toBeInTheDocument()
    expect(indexedDbBrainstormRepository.save).not.toHaveBeenCalled()
  })

  it('填齐后采纳方案才会写入灵感库', async () => {
    render(<BrainstormSparkMasterView projectId="proj-1" />)
    fillFullDilemma()
    fireEvent.click(screen.getByText('推演 8 大逆向破局策略'))
    await waitFor(() => expect(screen.getAllByText('采纳为备选灵感')).toHaveLength(8))

    fireEvent.click(screen.getAllByText('采纳为备选灵感')[0])

    await waitFor(() => expect(indexedDbBrainstormRepository.save).toHaveBeenCalledTimes(1))
  })

  it('§P2.4：抽屉不在渲染时替作者推演，点一次才产一次', async () => {
    render(<BrainstormSparkDrawer projectId="proj-1" currentText="四面大军压境，主角命悬一线！" />)

    expect(screen.getByText(/写作卡文破局炉/)).toBeInTheDocument()
    expect(screen.getByText(/应急破局脑洞方案/)).toBeInTheDocument()
    // 旧的「未点击即给出八条仙侠脑洞」行为已被否定。
    expect(screen.queryByText(/空间置换 \/ 金蝉脱壳/)).not.toBeInTheDocument()
    expect(screen.getByText(/未推演/)).toBeInTheDocument()

    fireEvent.click(screen.getByText('按当前选段推演'))

    await waitFor(() => expect(screen.getAllByText('复制脑洞')).toHaveLength(3))
    expect(screen.getAllByText(/四面大军压境，主角命悬一线！/).length).toBeGreaterThan(0)
  })

  it('抽屉没有选段时点推演只说明缺什么，不编方案', () => {
    render(<BrainstormSparkDrawer projectId="proj-1" currentText="" />)

    fireEvent.click(screen.getByText('按当前选段推演'))

    expect(screen.getByText(/未选中正文：先在编辑器里圈出那段卡住的危机/)).toBeInTheDocument()
    expect(screen.queryByText(/复制脑洞/)).not.toBeInTheDocument()
    expect(screen.getByText('未选中正文')).toBeInTheDocument()
  })
})
