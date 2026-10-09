import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DialogueDistillerDrawer } from './DialogueDistillerDrawer'

describe('DialogueDistillerDrawer', () => {
  it('starts without sample characters or text and waits for scan inputs', () => {
    render(<DialogueDistillerDrawer projectId="p1" currentText="" />)

    expect(screen.getByPlaceholderText('输入作品中的角色名，以逗号分隔')).toHaveValue('')
    expect(screen.getByPlaceholderText('粘贴正文或使用当前编辑器正文')).toHaveValue('')
    expect(screen.getByRole('button', { name: /测算当前段落角色声纹/ })).toBeDisabled()
  })
})
