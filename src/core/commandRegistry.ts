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

export const commandRegistry = new CommandRegistry()
