import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { CSS } from '@dnd-kit/utilities'

const DisabledCtx = createContext(false)

export function SortableList({
  ids,
  onMove,
  disabled,
  children,
}: {
  ids: string[]
  onMove: (activeId: string, overId: string) => void
  disabled?: boolean
  children: ReactNode
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      modifiers={[restrictToVerticalAxis]}
      onDragEnd={({ active, over }) => {
        if (over && active.id !== over.id) onMove(String(active.id), String(over.id))
      }}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy} disabled={disabled}>
        <DisabledCtx.Provider value={Boolean(disabled)}>{children}</DisabledCtx.Provider>
      </SortableContext>
    </DndContext>
  )
}

export function useSortRow(id: string) {
  const s = useSortable({ id })
  const disabled = useContext(DisabledCtx)
  const style: CSSProperties = {
    transform: CSS.Translate.toString(s.transform),
    transition: s.transition,
    position: 'relative',
    zIndex: s.isDragging ? 20 : undefined,
    boxShadow: s.isDragging ? '0 8px 24px rgba(0,0,0,.18)' : undefined,
  }
  return {
    ref: s.setNodeRef,
    style,
    isDragging: s.isDragging,
    handle: <DragHandle {...s.attributes} {...s.listeners} disabled={disabled} />,
  }
}

function DragHandle({ disabled, ...props }: { disabled?: boolean } & Record<string, unknown>) {
  return (
    <button
      type="button"
      aria-label="Kéo để đổi thứ tự"
      title={disabled ? 'Tắt kéo thả khi đang lọc' : 'Kéo để đổi thứ tự'}
      onClick={(e) => e.stopPropagation()}
      className={`flex h-8 w-6 shrink-0 items-center justify-center rounded text-gray-400 ${
        disabled ? 'cursor-not-allowed opacity-30' : 'cursor-grab hover:bg-gray-100 active:cursor-grabbing'
      }`}
      style={{ touchAction: 'none' }}
      {...(disabled ? {} : props)}
    >
      <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor">
        {[2, 8, 14].flatMap((y) => [<circle key={`a${y}`} cx="3" cy={y} r="1.6" />, <circle key={`b${y}`} cx="9" cy={y} r="1.6" />])}
      </svg>
    </button>
  )
}
