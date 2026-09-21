import { db } from '../db/indexedDB'
import type { GeoMapGridRecord, GeoMapRepository } from '../ports/geoMapRepository'
import {
  appendAuthoritativePluginDelete,
  appendAuthoritativePluginUpsert,
} from '../services/authoritativePluginWrite'

export const indexedDbGeoMapRepository: GeoMapRepository = {
  async getAll(projectId: string): Promise<GeoMapGridRecord[]> {
    return db.getByIndex<GeoMapGridRecord>('geoMapGrids', 'projectId', projectId)
  },

  async get(id: string): Promise<GeoMapGridRecord | undefined> {
    return await db.get<GeoMapGridRecord>('geoMapGrids', id)
  },

  async getByLocationId(locationId: string): Promise<GeoMapGridRecord | undefined> {
    const all = await db.getAll<GeoMapGridRecord>('geoMapGrids')
    return all.find((r) => r.locationId === locationId)
  },

  async save(record: GeoMapGridRecord): Promise<void> {
    const existing = await db.get<GeoMapGridRecord>('geoMapGrids', record.id)
    await appendAuthoritativePluginUpsert({
      aggregateType: 'geo-map-grid',
      aggregateId: record.id,
      workspaceId: record.projectId,
      store: 'geoMapGrids',
      record,
      existing,
    })
  },

  async delete(id: string): Promise<void> {
    const existing = await db.get<GeoMapGridRecord>('geoMapGrids', id)
    await appendAuthoritativePluginDelete({
      aggregateType: 'geo-map-grid',
      aggregateId: id,
      store: 'geoMapGrids',
      existing,
    })
  },
}
