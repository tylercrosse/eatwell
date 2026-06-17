import { useRef, type PointerEvent } from 'react'
import { formatShortDay } from '../lib/date'
import {
  clampTrendWindow,
  indexFromTrackX,
  panTrendWindow,
  resizeTrendWindowEdge,
  windowSize,
  type TrendWindow,
} from '../lib/trendWindow'

interface Props {
  axis: string[]
  windowRange: TrendWindow
  onWindowChange: (windowRange: TrendWindow) => void
}

type Drag = { mode: 'pan' | 'start' | 'end'; startX: number; startWindow: TrendWindow }

export function TrendScrubber({ axis, windowRange, onWindowChange }: Props) {
  const trackRef = useRef<HTMLDivElement | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const total = axis.length
  const last = Math.max(1, total - 1)
  const leftPct = (windowRange.startIndex / last) * 100
  const rightPct = 100 - (windowRange.endIndex / last) * 100
  const startIndex = Math.max(0, Math.min(total - 1, Math.floor(windowRange.startIndex)))
  const endIndex = Math.max(0, Math.min(total - 1, Math.ceil(windowRange.endIndex)))
  const startLabel = axis[startIndex] ? formatShortDay(axis[startIndex]) : ''
  const endLabel = axis[endIndex] ? formatShortDay(axis[endIndex]) : ''

  const pxPerDay = () => {
    const rect = trackRef.current?.getBoundingClientRect()
    return rect && total > 1 ? rect.width / (total - 1) : 1
  }

  const beginDrag = (mode: Drag['mode'], event: PointerEvent<HTMLDivElement>) => {
    if (total <= 1) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { mode, startX: event.clientX, startWindow: windowRange }
  }

  return (
    <div className="trend-scrubber" aria-label="Trend timeline" role="group">
      <div className="trend-scrubber__labels" aria-hidden="true">
        <span>{formatShortDay(axis[0])}</span>
        <span>{formatShortDay(axis[axis.length - 1])}</span>
      </div>
      <div
        ref={trackRef}
        className="trend-scrubber__track"
        onPointerDown={(event) => {
          if (event.target !== event.currentTarget || total <= 1) return
          const rect = event.currentTarget.getBoundingClientRect()
          const center = indexFromTrackX(event.clientX, rect.left, rect.width, total)
          const size = windowSize(windowRange)
          const start = center - (size - 1) / 2
          onWindowChange(clampTrendWindow({ startIndex: start, endIndex: start + size - 1 }, total))
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current
          if (!drag) return
          const deltaDays = (event.clientX - drag.startX) / pxPerDay()
          if (drag.mode === 'pan') {
            onWindowChange(panTrendWindow(drag.startWindow, total, deltaDays))
          } else {
            onWindowChange(resizeTrendWindowEdge(drag.startWindow, total, drag.mode, deltaDays))
          }
        }}
        onPointerUp={() => {
          dragRef.current = null
        }}
        onPointerCancel={() => {
          dragRef.current = null
        }}
      >
        <div className="trend-scrubber__range" style={{ left: `${leftPct}%`, right: `${rightPct}%` }}>
          <div
            className="trend-scrubber__handle trend-scrubber__handle--start"
            role="slider"
            aria-label="Start date"
            aria-valuetext={startLabel}
            tabIndex={0}
            onPointerDown={(event) => beginDrag('start', event)}
          />
          <div className="trend-scrubber__selection" onPointerDown={(event) => beginDrag('pan', event)} />
          <div
            className="trend-scrubber__handle trend-scrubber__handle--end"
            role="slider"
            aria-label="End date"
            aria-valuetext={endLabel}
            tabIndex={0}
            onPointerDown={(event) => beginDrag('end', event)}
          />
        </div>
      </div>
    </div>
  )
}
