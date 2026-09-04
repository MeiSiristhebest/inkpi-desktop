import { pickCoverPalette } from './bookCoverPalettes'

/** 原子组件：书籍封面（书架卡片封面；无封面时按书名生成确定性渐变） */
export const BookCover = ({
  title,
  cover,
  className = '',
}: {
  title: string
  cover?: string
  className?: string
}) => {
  if (cover) {
    return (
      <img
        src={cover}
        alt={title}
        className={`w-full h-full object-cover ${className}`}
      />
    )
  }
  // 按书名确定性选取封面渐变（见 bookCoverPalettes.ts）
  const [from, to] = pickCoverPalette(title)
  return (
    <div
      className={`w-full h-full flex items-end p-3 ${className}`}
      style={{ background: `linear-gradient(160deg, ${from}, ${to})` }}
    >
      <span className="text-white/90 text-[13px] font-semibold leading-snug line-clamp-3">{title}</span>
    </div>
  )
}
