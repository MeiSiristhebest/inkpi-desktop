export type EmotionType =
  'tension' | 'catharsis' | 'frustration' | 'anticipation' | 'sorrow' | 'joy'
export interface EmotionVector {
  tension: number
  catharsis: number
  frustration: number
  anticipation: number
  sorrow: number
  joy: number
}
export interface AuthorEmotionAnnotation {
  values: Partial<EmotionVector>
  note: string
  quote: string
  start: number
  end: number
}
export interface ChapterEmotionEvaluation {
  chapterId: string
  chapterTitle: string
  chapterOrder: number | null
  wordCount: number
  inputStatus: 'empty' | 'provided'
  matches: Array<{ type: EmotionType; quote: string; start: number; end: number }>
  annotation?: AuthorEmotionAnnotation
}
