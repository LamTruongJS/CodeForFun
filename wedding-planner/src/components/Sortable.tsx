import { createContext, createElement, useContext, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  defaultDropAnimationSideEffects,
  useSensor,
  useSensors,
  type DraggableAttributes,
  type DraggableSyntheticListeners,
  type DropAnimation,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis, restrictToWindowEdges } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'

/** Đè giữ bao lâu (ms) trên màn cảm ứng thì mới bắt đầu kéo. */
const LONG_PRESS_MS = 280

const ListCtx = createContext({ disabled: false, overlay: false })
const ItemCtx = createContext<{ attributes?: DraggableAttributes; listeners?: DraggableSyntheticListeners; disabled: boolean; whole: boolean }>({
  disabled: true,
  whole: false,
})

// Chặn "click" ngay sau khi thả (tránh mở form sửa ngoài ý muốn)
let lastDragEnd = 0
const justDragged = () => Date.now() - lastDragEnd < 300

const dropAnimation: DropAnimation = {
  duration: 220,
  easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: '0.35' } } }),
}

/**
 * Danh sách kéo thả.
 * - Chuột: kéo ngay khi di chuyển 4px.
 * - Cảm ứng: phải ĐÈ GIỮ ~0,3 giây mới kéo; vuốt nhanh = cuộn trang bình thường.
 * - `overlay`: vẽ một bản xem trước nhẹ đi theo ngón tay → mượt hơn trên điện thoại.
 */
export function SortableList({
  ids,
  onMove,
  disabled,
  overlay,
  children,
}: {
  ids: string[]
  onMove: (activeId: string, overId: string) => void
  disabled?: boolean
  overlay?: (activeId: string) => ReactNode
  children: ReactNode
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: LONG_PRESS_MS, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  const end = () => {
    lastDragEnd = Date.now()
    setActiveId(null)
    document.body.classList.remove('is-dragging')
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      autoScroll={{ threshold: { x: 0, y: 0.15 }, acceleration: 8 }}
      onDragStart={({ active }) => {
        setActiveId(String(active.id))
        document.body.classList.add('is-dragging')
        navigator.vibrate?.(12) // rung nhẹ báo đã vào chế độ kéo (Android)
      }}
      onDragCancel={end}
      onDragEnd={({ active, over }) => {
        end()
        if (over && active.id !== over.id) onMove(String(active.id), String(over.id))
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        <ListCtx.Provider value={{ disabled: Boolean(disabled), overlay: Boolean(overlay) }}>{children}</ListCtx.Provider>
      </SortableContext>
      {overlay && (
        <DragOverlay dropAnimation={dropAnimation} modifiers={[restrictToVerticalAxis, restrictToWindowEdges]}>
          {activeId ? <div className="drag-overlay">{overlay(activeId)}</div> : null}
        </DragOverlay>
      )}
    </DndContext>
  )
}

/**
 * Một dòng / thẻ kéo được.
 * Chỉ component này (và DragHandle) vẽ lại khi đang kéo; phần nội dung bên trong
 * giữ nguyên → nhẹ hơn nhiều so với vẽ lại cả dòng.
 * `whole`: đè giữ ở bất kỳ đâu trên thẻ đều kéo được (dùng cho thẻ trên điện thoại).
 */
export function SortableItem({
  id,
  as = 'div',
  whole = false,
  className = '',
  style,
  onClick,
  children,
}: {
  id: string
  as?: 'div' | 'tr'
  whole?: boolean
  className?: string
  style?: CSSProperties
  onClick?: () => void
  children: ReactNode
}) {
  const list = useContext(ListCtx)
  const s = useSortable({
    id,
    transition: { duration: 220, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)' },
  })
  const dragging = s.isDragging
  const placeholder = dragging && list.overlay
  const st: CSSProperties = {
    ...style,
    transform: CSS.Translate.toString(s.transform),
    transition: s.transition,
    position: 'relative',
    zIndex: dragging ? 20 : undefined,
    opacity: placeholder ? 0.35 : undefined,
    boxShadow: dragging && !placeholder ? '0 10px 28px -8px rgba(60,20,35,.35)' : style?.boxShadow,
    willChange: s.transform ? 'transform' : undefined,
  }
  const wholeProps = whole && !list.disabled ? { ...s.attributes, ...s.listeners } : {}
  return createElement(
    as,
    {
      ref: s.setNodeRef,
      style: st,
      className: `${className} ${whole ? 'drag-whole' : ''}`,
      ...wholeProps,
      onClick: (e: MouseEvent) => {
        if (justDragged()) {
          e.preventDefault()
          return
        }
        onClick?.()
      },
      onContextMenu: whole ? (e: MouseEvent) => e.preventDefault() : undefined,
    },
    <ItemCtx.Provider value={{ attributes: s.attributes, listeners: s.listeners, disabled: list.disabled, whole }}>{children}</ItemCtx.Provider>,
  )
}

/** Tay nắm ⋮⋮ — dùng bên trong SortableItem. */
export function DragHandle() {
  const { attributes, listeners, disabled, whole } = useContext(ItemCtx)
  // Khi cả thẻ đã kéo được (whole) thì tay nắm chỉ là biểu tượng.
  const props = !disabled && !whole ? { ...attributes, ...listeners } : {}
  return (
    <button
      type="button"
      aria-label="Đè giữ để kéo đổi thứ tự"
      title={disabled ? 'Tắt kéo thả khi đang lọc' : 'Kéo để đổi thứ tự (điện thoại: đè giữ)'}
      tabIndex={whole ? -1 : undefined}
      onClick={(e) => e.stopPropagation()}
      className={`flex h-8 w-6 shrink-0 items-center justify-center rounded text-gray-400 ${
        disabled ? 'cursor-not-allowed opacity-30' : 'cursor-grab hover:bg-gray-100 active:cursor-grabbing'
      }`}
      {...props}
    >
      <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
        {[2, 8, 14].flatMap((y) => [<circle key={`a${y}`} cx="3" cy={y} r="1.6" />, <circle key={`b${y}`} cx="9" cy={y} r="1.6" />])}
      </svg>
    </button>
  )
}

/** Thẻ xem trước nhẹ đi theo ngón tay khi kéo (điện thoại). */
export function DragPreview({ stt, title, sub, bg = '#fff' }: { stt?: number; title: string; sub?: ReactNode; bg?: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[#e7cdd6] p-3" style={{ background: bg }}>
      <div className="flex flex-col items-center text-wine">
        <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
          {[2, 8, 14].flatMap((y) => [<circle key={`a${y}`} cx="3" cy={y} r="1.6" />, <circle key={`b${y}`} cx="9" cy={y} r="1.6" />])}
        </svg>
        {stt != null && <span className="num mt-1 text-xs text-gray-400">{stt}</span>}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold text-[#2b2326]">{title}</div>
        {sub && <div className="truncate text-[13px] text-gray-500">{sub}</div>}
      </div>
    </div>
  )
}
