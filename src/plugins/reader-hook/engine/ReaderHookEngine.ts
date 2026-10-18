import type { HookAnalysisResult, HookTemplate } from '../types'
import { reviewEnding } from '../../../domain/endingReview'
import { pluginEventBus } from '../../../core/pluginEventBus'
const TEMPLATES: HookTemplate[] = [
  {
    id: 'tpl-question',
    type: 'question',
    name: '未回答的问题',
    description: '可选构思：保留人物需要回答的问题。',
    example: '她读完信，却仍不知道是谁寄来的。',
  },
  {
    id: 'tpl-countdown',
    type: 'countdown',
    name: '时间限制',
    description: '可选构思：使用故事中已经设定的期限。',
    example: '离约定时间还有十分钟，车还没有来。',
  },
  {
    id: 'tpl-epiphany',
    type: 'epiphany',
    name: '新信息',
    description: '可选构思：让新信息改变人物下一步的选择。',
    example: '名单上最后一个名字，是她自己的。',
  },
  {
    id: 'tpl-battle-cut',
    type: 'battle_cut',
    name: '行动进行中',
    description: '可选构思：在行动完成前停下；下一章需要承接。',
    example: '她按下了发送键。',
  },
  {
    id: 'tpl-crisis',
    type: 'crisis',
    name: '条件改变',
    description: '可选构思：改变一个已知条件，保留应对行动。',
    example: '门开了，等在里面的人换了。',
  },
  {
    id: 'tpl-anomaly',
    type: 'anomaly',
    name: '异常细节',
    description: '可选构思：使用与此前信息不一致的细节。',
    example: '那把钥匙，她明明已经归还了。',
  },
]
export class ReaderHookEngine {
  analyzeEnding(text: string): HookAnalysisResult {
    const report = reviewEnding(text)
    return {
      ...report,
      hookType: 'unclassified',
      feedback:
        report.inputStatus === 'empty'
          ? '没有正文，无法审阅章尾。'
          : '词项只用于定位。未解问题、利害与下一章承接需要结合语境复核。',
    }
  }
  getTemplates(): HookTemplate[] {
    return TEMPLATES.map((template) => ({ ...template }))
  }
  auditChapterEnding(params: {
    projectId: string
    chapterId: string
    content: string
  }): HookAnalysisResult {
    const result = this.analyzeEnding(params.content)
    pluginEventBus.emit('CHAPTER_CONTENT_AUDITED', {
      projectId: params.projectId,
      chapterId: params.chapterId,
      wordCount: result.characters,
    })
    return result
  }
}
export const readerHookEngine = new ReaderHookEngine()
