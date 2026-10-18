import { afterEach, describe, expect, it } from 'vitest'
import { DB_NAME, DB_VERSION, db } from './indexedDB'

const projectId = 'snapshot-consistency-project'
const chapterId = 'snapshot-consistency-chapter'
const timelineId = 'snapshot-consistency-timeline'

function openWriterConnection(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error ?? new Error('Transaction aborted'))
  })
}

describe('IndexedDB backup snapshots', () => {
  let writerConnection: IDBDatabase | undefined

  afterEach(async () => {
    writerConnection?.close()
    writerConnection = undefined
    await Promise.all([
      db.delete('projects', projectId),
      db.delete('chapters', chapterId),
      db.delete('timelineNodes', timelineId),
    ])
  })

  it('does not mix store versions while another connection commits a multi-store write', async () => {
    const originalProject = { id: projectId, name: 'before' }
    const originalChapter = { id: chapterId, projectId, content: 'before' }
    const originalTimeline = { id: timelineId, projectId, title: 'before' }
    const updatedProject = { ...originalProject, name: 'after' }
    const updatedChapter = { ...originalChapter, content: 'after' }
    const updatedTimeline = { ...originalTimeline, title: 'after' }

    await Promise.all([
      db.put('projects', originalProject),
      db.put('chapters', originalChapter),
      db.put('timelineNodes', originalTimeline),
    ])
    await db.getAll('projects')
    writerConnection = await openWriterConnection()

    const snapshotPromise = db.getAllSnapshot(['projects', 'chapters', 'timelineNodes'])
    // Let the already-open database create the readonly transaction and enqueue its reads.
    await Promise.resolve()

    const writeTransaction = writerConnection.transaction(
      ['projects', 'chapters', 'timelineNodes'],
      'readwrite',
    )
    writeTransaction.objectStore('projects').put(updatedProject)
    writeTransaction.objectStore('chapters').put(updatedChapter)
    writeTransaction.objectStore('timelineNodes').put(updatedTimeline)

    const [snapshot] = await Promise.all([snapshotPromise, transactionComplete(writeTransaction)])
    expect(
      snapshot.projects?.find((record) => (record as typeof originalProject).id === projectId),
    ).toMatchObject(originalProject)
    expect(
      snapshot.chapters?.find((record) => (record as typeof originalChapter).id === chapterId),
    ).toMatchObject(originalChapter)
    expect(
      snapshot.timelineNodes?.find(
        (record) => (record as typeof originalTimeline).id === timelineId,
      ),
    ).toMatchObject(originalTimeline)

    const nextSnapshot = await db.getAllSnapshot(['projects', 'chapters', 'timelineNodes'])
    expect(
      nextSnapshot.projects?.find((record) => (record as typeof updatedProject).id === projectId),
    ).toMatchObject(updatedProject)
    expect(
      nextSnapshot.chapters?.find((record) => (record as typeof updatedChapter).id === chapterId),
    ).toMatchObject(updatedChapter)
    expect(
      nextSnapshot.timelineNodes?.find(
        (record) => (record as typeof updatedTimeline).id === timelineId,
      ),
    ).toMatchObject(updatedTimeline)
  })
})
