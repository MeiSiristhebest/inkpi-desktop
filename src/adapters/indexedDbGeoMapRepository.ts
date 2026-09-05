import { db } from '../db/indexedDB'
import type { GeoMapGridRecord, GeoMapRepository } from '../ports/geoMapRepository'

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
    await db.put('geoMapGrids', record)
  },

  async delete(id: string): Promise<void> {
    await db.delete('geoMapGrids', id)
  },
}
