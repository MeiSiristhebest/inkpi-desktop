import type { ActiveWritingContext } from './activeWritingContext'

export interface Command {
  id: string
  title: string
  keywords: string[]
  shortcut?: string
  category: 'edit' | 'continuity' | 'intelligence' | 'worldbuilding' | 'view' | 'system'
  availability?: (context?: ActiveWritingContext) => boolean
  execute: (context?: ActiveWritingContext) => void | Promise<void>
}

class CommandRegistry {
  private readonly commands = new Map<string, Command>()

  register(command: Command): () => void {
    this.commands.set(command.id, command)
    return () => {
      this.commands.delete(command.id)
    }
  }

  get(id: string): Command | undefined {
    return this.commands.get(id)
  }

  getAll(): Command[] {
    return Array.from(this.commands.values())
  }

  getAvailable(context?: ActiveWritingContext): Command[] {
    return this.getAll().filter((cmd) => (cmd.availability ? cmd.availability(context) : true))
  }

  findByShortcut(
    event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
    context?: ActiveWritingContext,
  ): Command | undefined {
    return this.getAvailable(context).find((command) =>
      command.shortcut ? matchesShortcut(command.shortcut, event) : false,
    )
  }

  search(query: string, context?: ActiveWritingContext): Command[] {
    const q = query.trim().toLowerCase()
    const available = this.getAvailable(context)
    if (!q) return available

    return available.filter((cmd) => {
      if (cmd.title.toLowerCase().includes(q)) return true
      if (cmd.shortcut && cmd.shortcut.toLowerCase().includes(q)) return true
      return cmd.keywords.some((kw) => kw.toLowerCase().includes(q))
    })
  }
}

function matchesShortcut(
  shortcut: string,
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>,
): boolean {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  const key = parts.at(-1)
  if (!key) return false

  const modifiers = new Set(parts.slice(0, -1))
  const wantsMod = modifiers.has('mod')
  const wantsCtrl = modifiers.has('ctrl')
  const wantsMeta = modifiers.has('meta') || modifiers.has('cmd')
  const wantsShift = modifiers.has('shift')
  const wantsAlt = modifiers.has('alt') || modifiers.has('option')

  if (wantsMod ? !(event.ctrlKey || event.metaKey) : event.ctrlKey !== wantsCtrl) return false
  if (!wantsMod && event.metaKey !== wantsMeta) return false
  if (Boolean(event.shiftKey) !== wantsShift) return false
  if (Boolean(event.altKey) !== wantsAlt) return false

  return event.key.toLowerCase() === key
}

export const commandRegistry = new CommandRegistry()
