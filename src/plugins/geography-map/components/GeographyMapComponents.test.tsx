import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { GeographyMapMasterView } from './GeographyMapMasterView'
import { GeographyMapDrawer } from './GeographyMapDrawer'
import { indexedDbGeoMapRepository } from '../../../adapters/indexedDbGeoMapRepository'

vi.mock('../../../adapters/indexedDbGeoMapRepository', () => ({
  indexedDbGeoMapRepository: {
    getAll: vi.fn().mockResolvedValue([
      {
        id: 'map-1',
        projectId: 'p1',
        locationId: 'loc-1',
        scaleKmPerCell: 10,
        bounds: { minX: 0, minY: 0, maxX: 7, maxY: 7 },
        occupiedCells: [
          { x: 0, y: 0, terrainType: 'city' },
          { x: 1, y: 1, terrainType: 'mountain' },
        ],
        fillColor: '#3b82f6',
        linkedOverlays: {
          activeCharacterIds: ['韩立'],
          foreshadowIds: [],
          timelineEventIds: [],
        },
        updatedAt: Date.now(),
      },
    ]),
    save: vi.fn().mockResolvedValue(undefined),
  },
}))

describe('GeographyMap Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders GeographyMapMasterView with travel calculator', async () => {
    render(<GeographyMapMasterView projectId="p1" />)

    expect(screen.getByText(/物理拓扑网格地图与战局沙盘/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/行军日程精密测算仪/)).toBeInTheDocument()
      expect(screen.getByText(/拓扑结构完整连通/)).toBeInTheDocument()
    })

    const saveBtn = screen.getByText('保存地图沙盘')
    fireEvent.click(saveBtn)
    expect(indexedDbGeoMapRepository.save).toHaveBeenCalled()
  })

  it('renders GeographyMapDrawer with text location detection', async () => {
    render(
      <GeographyMapDrawer
        projectId="p1"
        currentText="主角一行人翻山越岭，终于来到了传说中的青云门！"
      />
    )

    expect(screen.getByText(/地理拓扑随动感知/)).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByText(/青云门/)).toBeInTheDocument()
    })
  })
})
