// 底层实体存储封装
//
// 负责 volumes（分卷）/ chapters（章节）/ codexEntities（世界观实体）/
// pluginSettings（插件开关状态）/ settings（统一应用设置）五张数据表的读写：
//   - 章节记录字段：id / title / order / wordCount / content / 时间戳(createdAt, updatedAt)
//   - 通过 IndexedDB 在本地持久化，离线可用。
//
// 对外暴露通用 CRUD（getAll / get / put / delete）+ 一个轻量 uid 生成器，
// 供上层组件（RichEditor / Engine）调用，不直接参与业务编排。

export const DB_NAME = 'inkpi-studio'
export const DB_VERSION = 21

export const STORES = [
  'projects',
  'volumes',
  'chapters',
  'codexEntities',
  'pluginSettings',
  'settings',
  'formData',
  'tableRows',
  'cardRecords',
  'dailyStats',
  'settingsKV',
  'promiseLedger',
  'timelineNodes',
  'narrativeThreads',
  'sceneBeats',
  'expectationContracts',
  'powerTierSystems',
  'sprintRecords',
  'readerHooks',
  'clueMatrices',
  'waterAuditSnapshots',
  'volumeArcs',
  'dialogueVoiceprints',
  'factionDiplomacies',
  'paywallAudits',
  'memoryPalaceSnapshots',
  'pressExportConfigs',
  'emotionAudits',
  'subPlotStrands',
  'brainstormSparks',
  'readerSimulations',
  'chekhovGuns',
  'rhythmCadences',
  'geoMapGrids',
  'combatDuels',
  'multiCalendars',
  'povSnapshots',
  'linterRulesConfigs',
  'diffReviews',
  'ironChamberRecords',
  'soundscapeConfigs',
  'scrapbookFragments',
  'aftermathPatches',
  'subtextDialogues',
  'narrativeArchetypes',
  'rhythmRadarReports',
  'goldChapterEvals',
  'shadowDanmakus',
  'authorOpsProfiles',
  'multiverseBranches',
  'voiceScriptCasts',
  'storyboardScenes',
] as const
export type StoreName = (typeof STORES)[number]

class InkStudioDB {
  private dbPromise: Promise<IDBDatabase> | null = null

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = () => {
        const db = request.result
        for (const name of STORES) {
          if (!db.objectStoreNames.contains(name)) {
            const keyPath =
              name === 'dailyStats' || name === 'settingsKV'
                ? 'key'
                : name === 'powerTierSystems' || name === 'pressExportConfigs' || name === 'rhythmCadences' || name === 'linterRulesConfigs' || name === 'soundscapeConfigs' || name === 'authorOpsProfiles'
                  ? 'projectId'
                  : 'id'
            const store = db.createObjectStore(name, { keyPath })
            if (name === 'codexEntities' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('category', 'category', { unique: false })
            }
            if ((name === 'tableRows' || name === 'cardRecords') && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('tabId', 'tabId', { unique: false })
            }
            if (name === 'promiseLedger' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('status', 'status', { unique: false })
              store.createIndex('plantChapter', 'plantChapter', { unique: false })
            }
            if (name === 'timelineNodes' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('threadId', 'threadId', { unique: false })
              store.createIndex('chapterOrder', 'chapterOrder', { unique: false })
            }
            if (name === 'narrativeThreads' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
            }
            if (name === 'sceneBeats' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
            if (name === 'expectationContracts' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('status', 'status', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
            if (name === 'sprintRecords' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('completedAt', 'completedAt', { unique: false })
            }
            if (name === 'readerHooks' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
            if (name === 'clueMatrices' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('clueId', 'clueId', { unique: false })
            }
            if (name === 'waterAuditSnapshots' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
            if (name === 'volumeArcs' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('volumeId', 'volumeId', { unique: false })
            }
            if (name === 'dialogueVoiceprints' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('characterName', 'characterName', { unique: false })
            }
            if (name === 'factionDiplomacies' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('factionAId', 'factionAId', { unique: false })
              store.createIndex('factionBId', 'factionBId', { unique: false })
            }
            if (name === 'paywallAudits' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
            if (name === 'memoryPalaceSnapshots' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('entityId', 'entityId', { unique: false })
            }
            if (name === 'emotionAudits' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
            if (name === 'subPlotStrands' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('status', 'status', { unique: false })
              store.createIndex('targetVolumeId', 'targetVolumeId', { unique: false })
            }
            if (name === 'brainstormSparks' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('dilemmaType', 'dilemmaType', { unique: false })
            }
            if (name === 'readerSimulations' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
            if (name === 'chekhovGuns' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('status', 'status', { unique: false })
              store.createIndex('plantChapterOrder', 'plantChapterOrder', { unique: false })
            }
            if (name === 'geoMapGrids' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('locationId', 'locationId', { unique: false })
            }
            if (name === 'combatDuels' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
            if (name === 'multiCalendars' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
            }
            if (name === 'povSnapshots' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
            if (name === 'linterRulesConfigs' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
            }
            if (name === 'diffReviews' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
            if (name === 'ironChamberRecords' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('status', 'status', { unique: false })
            }
            if (name === 'scrapbookFragments' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('sourceChapterId', 'sourceChapterId', { unique: false })
              store.createIndex('deletedAt', 'deletedAt', { unique: false })
            }
            if (name === 'aftermathPatches' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
              store.createIndex('status', 'status', { unique: false })
            }
            if (name === 'subtextDialogues' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
            if (name === 'narrativeArchetypes' && typeof store.createIndex === 'function') {
              store.createIndex('category', 'category', { unique: false })
            }
            if (name === 'rhythmRadarReports' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
            if (name === 'goldChapterEvals' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('score', 'score', { unique: false })
            }
            if (name === 'shadowDanmakus' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
              store.createIndex('personaType', 'personaType', { unique: false })
            }
            if (name === 'multiverseBranches' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('forkChapterIndex', 'forkChapterIndex', { unique: false })
            }
            if (name === 'voiceScriptCasts' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('characterId', 'characterId', { unique: false })
            }
            if (name === 'storyboardScenes' && typeof store.createIndex === 'function') {
              store.createIndex('projectId', 'projectId', { unique: false })
              store.createIndex('chapterId', 'chapterId', { unique: false })
            }
          }
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    return this.dbPromise
  }

  public async getAll<T>(store: StoreName): Promise<T[]> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly')
      const req = tx.objectStore(store).getAll()
      req.onsuccess = () => resolve((req.result as T[]) || [])
      req.onerror = () => reject(req.error)
    })
  }

  public async get<T>(store: StoreName, key: string): Promise<T | undefined> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly')
      const req = tx.objectStore(store).get(key)
      req.onsuccess = () => resolve(req.result as T | undefined)
      req.onerror = () => reject(req.error)
    })
  }

  public async put<T>(store: StoreName, value: T): Promise<void> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).put(value as object)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }

  public async delete(store: StoreName, key: string): Promise<void> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      tx.objectStore(store).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  }
}

export const db = new InkStudioDB()

// 轻量唯一 ID：前缀 + 时间基 + 随机串，避免依赖外部库
export const uid = (prefix = 'id'): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
