import { describe, expect, it, vi } from 'vitest'
import { domainChangeEvents } from './domainChangeEvents'

describe('domain change events', () => {
  it('notifies only listeners for the changed workspace', () => {
    const projectListener = vi.fn()
    const otherListener = vi.fn()
    const unsubscribeProject = domainChangeEvents.subscribe('project-1', projectListener)
    const unsubscribeOther = domainChangeEvents.subscribe('project-2', otherListener)

    domainChangeEvents.publish('project-1')
    expect(projectListener).toHaveBeenCalledOnce()
    expect(otherListener).not.toHaveBeenCalled()

    unsubscribeProject()
    unsubscribeOther()
  })
})
