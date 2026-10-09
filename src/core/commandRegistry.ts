import type { ActiveWritingContext } from './activeWritingContext'

export interface Command {
  id: string
  title: string
  keywords: string[]
  shortcut?: string
  shortcutScope?: 'application' | 'editor'
  showInCommandPalette?: boolean
  category: 'edit' | 'continuity' | 'intelligence' | 'worldbuilding' | 'view' | 'system'
  availability?: (context?: ActiveWritingContext) => boolean
  execute: (context?: ActiveWritingContext) => void | Promise<void>
}

export const EDITOR_SHORTCUT_COMMAND_IDS = {
  commandPalette: 'cmd-open-command-palette',
  saveChapter: 'cmd-editor-save-chapter',
  newChapter: 'cmd-editor-new-chapter',
  findReplace: 'cmd-editor-find-replace',
  toggleChapterTree: 'cmd-editor-toggle-chapter-tree',
  history: 'cmd-editor-history',
  renameChapter: 'cmd-editor-rename-chapter',
  previousChapter: 'cmd-editor-previous-chapter',
  nextChapter: 'cmd-editor-next-chapter',
  bold: 'cmd-editor-bold',
  italic: 'cmd-editor-italic',
  undo: 'cmd-editor-undo',
  redo: 'cmd-editor-redo',
} as const

export type EditorShortcutId = keyof typeof EDITOR_SHORTCUT_COMMAND_IDS
type CommandHandler = (context?: ActiveWritingContext) => void | Promise<void>

class CommandRegistry {
  private readonly commands = new Map<string, Command>()
  private readonly handlers = new Map<string, Map<symbol, CommandHandler>>()

  register(command: Command): () => void {
    if (command.shortcut) {
      const conflict = this.getAll().find(
        (registered) =>
          registered.id !== command.id &&
          registered.shortcut &&
          normalizeShortcut(registered.shortcut) === normalizeShortcut(command.shortcut!),
      )
      if (conflict) {
        throw new Error(
          `Shortcut ${command.shortcut} for ${command.id} conflicts with ${conflict.id} (${conflict.shortcut})`,
        )
      }
    }

    this.commands.set(command.id, command)
    return () => {
      if (this.commands.get(command.id) === command) this.commands.delete(command.id)
    }
  }

  registerHandler(id: string, handler: CommandHandler): () => void {
    const registrations = this.handlers.get(id) ?? new Map<symbol, CommandHandler>()
    const token = Symbol(id)
    registrations.set(token, handler)
    this.handlers.set(id, registrations)

    return () => {
      registrations.delete(token)
      if (registrations.size === 0) this.handlers.delete(id)
    }
  }

  hasHandler(id: string): boolean {
    return (this.handlers.get(id)?.size ?? 0) > 0
  }

  executeHandler(id: string, context?: ActiveWritingContext): void | Promise<void> {
    const handlers = this.handlers.get(id)
    const handler = handlers ? Array.from(handlers.values()).at(-1) : undefined
    return handler?.(context)
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
    scope: 'application' | 'editor' = 'application',
  ): Command | undefined {
    return this.getAvailable(context).find(
      (command) =>
        (command.shortcutScope ?? 'application') === scope &&
        (command.shortcut ? matchesShortcut(command.shortcut, event) : false),
    )
  }

  search(query: string, context?: ActiveWritingContext): Command[] {
    const q = query.trim().toLowerCase()
    const available = this.getAvailable(context).filter(
      (command) => command.showInCommandPalette !== false,
    )
    if (!q) return available

    return available.filter((cmd) => {
      if (cmd.title.toLowerCase().includes(q)) return true
      if (cmd.shortcut && cmd.shortcut.toLowerCase().includes(q)) return true
      return cmd.keywords.some((kw) => kw.toLowerCase().includes(q))
    })
  }
}

function normalizeShortcut(shortcut: string): string {
  const parts = shortcut
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  const key = parts.pop() ?? ''
  const modifiers = parts.map((part) => {
    if (part === 'mod') return 'ctrl'
    if (part === 'cmd') return 'meta'
    if (part === 'option') return 'alt'
    return part
  })
  return [...new Set(modifiers), key].sort().join('+')
}

export function matchesShortcut(
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

export function dispatchCommandShortcut(
  event: KeyboardEvent,
  context?: ActiveWritingContext,
): boolean {
  if (event.defaultPrevented) return false

  const command =
    commandRegistry.findByShortcut(event, context, 'application') ??
    commandRegistry.findByShortcut(event, context, 'editor')
  if (!command) return false

  event.preventDefault()
  void command.execute(context)
  return true
}

function editorShortcutCommand(
  id: EditorShortcutId,
  title: string,
  shortcut: string,
  category: Command['category'],
  keywords: string[] = [],
  shortcutScope: 'application' | 'editor' = 'editor',
  showInCommandPalette = true,
): Command {
  const commandId = EDITOR_SHORTCUT_COMMAND_IDS[id]
  return {
    id: commandId,
    title,
    keywords,
    shortcut,
    shortcutScope,
    showInCommandPalette,
    category,
    availability: () => commandRegistry.hasHandler(commandId),
    execute: (context) => commandRegistry.executeHandler(commandId, context),
  }
}

const editorShortcutCommands: Command[] = [
  editorShortcutCommand(
    'commandPalette',
    '打开命令面板',
    'Mod+K',
    'system',
    ['命令', '搜索'],
    'application',
    false,
  ),
  editorShortcutCommand('saveChapter', '保存当前内容', 'Mod+S', 'edit', ['保存', '章节']),
  editorShortcutCommand('newChapter', '新建章节', 'Mod+N', 'edit', ['新建', '章节']),
  editorShortcutCommand('findReplace', '查找替换', 'Mod+F', 'edit', ['查找', '替换']),
  editorShortcutCommand('toggleChapterTree', '切换章节树', 'Mod+\\', 'view', ['目录', '侧栏']),
  editorShortcutCommand('history', '打开历史记录', 'Mod+H', 'edit', ['历史', '时光机']),
  editorShortcutCommand('renameChapter', '重命名当前章节', 'F2', 'edit', ['重命名']),
  editorShortcutCommand('previousChapter', '上一章', 'Alt+ArrowUp', 'edit', ['上一章', '导航']),
  editorShortcutCommand('nextChapter', '下一章', 'Alt+ArrowDown', 'edit', ['下一章', '导航']),
  editorShortcutCommand('bold', '加粗', 'Mod+B', 'edit', ['格式']),
  editorShortcutCommand('italic', '倾斜', 'Mod+I', 'edit', ['格式']),
  editorShortcutCommand('undo', '撤销', 'Mod+Z', 'edit', ['撤销']),
  editorShortcutCommand('redo', '重做', 'Shift+Mod+Z', 'edit', ['重做']),
]

for (const command of editorShortcutCommands) commandRegistry.register(command)
