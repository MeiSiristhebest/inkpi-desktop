import { describe, expect, it } from 'vitest'
import { PovGuardEngine, type EpistemicContext } from './PovGuardEngine'

const context: EpistemicContext = {
  povCharacter: '甲',
  povMode: 'third_limited',
  allCharacters: [
    { characterId: 'a', characterName: '甲', knownSecretIds: [] },
    { characterId: 'b', characterName: '乙[1]', knownSecretIds: [] },
  ],
  secrets: [
    { id: 's', title: '密钥', confidentialityLevel: 'secret', originChapterOrder: 1, holders: [] },
  ],
}

describe('POV source and knowledge boundaries', () => {
  it('treats names literally and retains original offsets including blank lines', () => {
    const text = '\n\n  乙[1]心想：还不能离开。'
    const result = PovGuardEngine.analyze(text, context)
    expect(result.violations).toHaveLength(1)
    const finding = result.violations[0]
    expect(finding.paragraphIndex).toBe(2)
    expect(text.slice(finding.startOffset, finding.endOffset)).toBe(finding.snippet)
    expect(finding.status).toBe('candidate')
  })
  it.each(['乙[1]没有心想这件事。', '甲说：“乙[1]心想我不会来。”', '乙[1]看见甲心想：要走了。'])(
    'does not infer a mind from %s',
    (text) => {
      expect(PovGuardEngine.analyze(text, context).headHoppingCount).toBe(0)
    },
  )
  it('honors author-declared holders by name or ID', () => {
    for (const holder of ['甲', 'a']) {
      const configured = { ...context, secrets: [{ ...context.secrets[0], holders: [holder] }] }
      expect(PovGuardEngine.analyze('甲取出了密钥。', configured).leakageCount).toBe(0)
    }
  })
  it('ignores empty titles and redacts the exact literal secret without retaining it', () => {
    const text = '密钥在柜子里。密钥是蓝色的。'
    const result = PovGuardEngine.analyze(text, {
      ...context,
      secrets: [...context.secrets, { ...context.secrets[0], id: 'empty', title: '' }],
    })
    expect(result.leakageCount).toBe(2)
    expect(result.sanitizedTextMask).not.toContain('密钥')
    expect(result.sanitizedTextMask).toContain('在柜子里')
  })
  it('checks the POV character too in objective mode', () => {
    expect(
      PovGuardEngine.analyze('甲心想：还不能走。', { ...context, povMode: 'third_objective' })
        .headHoppingCount,
    ).toBe(1)
  })
})
