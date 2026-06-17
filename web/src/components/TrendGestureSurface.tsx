import { useCallback, useEffect, useRef, type MutableRefObject, type ReactNode } from 'react'
import {
  MIN_TREND_WINDOW_DAYS,
  indexFromClientX,
  panTrendWindow,
  windowSize,
  zoomTrendWindow,
  zoomTrendWindowByFactor,
  type TrendWindow,
} from '../lib/trendWindow'

type Point = { x: number; y: number }

type Gesture =
  | { type: 'pending'; startX: number; startY: number; startWindow: TrendWindow }
  | { type: 'pan'; startX: number; startY: number; startWindow: TrendWindow }
  | { type: 'pinch'; startDistance: number; startWindow: TrendWindow; anchorIndex: number }
  | { type: 'scroll' }

interface Props {
  windowRange: TrendWindow
  totalDays: number
  onWindowChange: (windowRange: TrendWindow) => void
  onGestureActiveChange?: (active: boolean) => void
  suppressClickUntilRef: MutableRefObject<number>
  children: ReactNode
}

const PAN_INTENT_PX = 8
const CLICK_SUPPRESS_MS = 350
const WHEEL_IDLE_MS = 120

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
}

export function TrendGestureSurface({
  windowRange,
  totalDays,
  onWindowChange,
  onGestureActiveChange,
  suppressClickUntilRef,
  children,
}: Props) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const latestWindowRef = useRef(windowRange)
  const committedWindowRef = useRef(windowRange)
  const pointersRef = useRef(new Map<number, Point>())
  const gestureRef = useRef<Gesture | null>(null)
  const pendingWindowRef = useRef<TrendWindow | null>(null)
  const frameRef = useRef<number | null>(null)
  const wheelZoomSizeRef = useRef<number | null>(null)
  const latestTotalDaysRef = useRef(totalDays)
  const activeRef = useRef(false)
  const wheelIdleTimerRef = useRef<number | null>(null)

  useEffect(() => {
    latestWindowRef.current = windowRange
    committedWindowRef.current = windowRange
  }, [windowRange])

  useEffect(() => {
    latestTotalDaysRef.current = totalDays
  }, [totalDays])

  useEffect(() => {
    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current)
      if (wheelIdleTimerRef.current != null) window.clearTimeout(wheelIdleTimerRef.current)
    }
  }, [])

  const setGestureActive = useCallback(
    (active: boolean) => {
      if (activeRef.current === active) return
      activeRef.current = active
      onGestureActiveChange?.(active)
    },
    [onGestureActiveChange],
  )

  const markWheelActive = useCallback(() => {
    setGestureActive(true)
    if (wheelIdleTimerRef.current != null) window.clearTimeout(wheelIdleTimerRef.current)
    wheelIdleTimerRef.current = window.setTimeout(() => {
      wheelIdleTimerRef.current = null
      setGestureActive(false)
    }, WHEEL_IDLE_MS)
  }, [setGestureActive])

  const suppressClick = useCallback(() => {
    suppressClickUntilRef.current = Date.now() + CLICK_SUPPRESS_MS
  }, [suppressClickUntilRef])

  const scheduleWindow = useCallback((next: TrendWindow) => {
    latestWindowRef.current = next
    pendingWindowRef.current = next
    if (frameRef.current != null) return
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null
      const pending = pendingWindowRef.current
      pendingWindowRef.current = null
      if (
        pending &&
        (pending.startIndex !== committedWindowRef.current.startIndex || pending.endIndex !== committedWindowRef.current.endIndex)
      ) {
        committedWindowRef.current = pending
        onWindowChange(pending)
      }
    })
  }, [onWindowChange])

  const startPinch = () => {
    const rect = surfaceRef.current?.getBoundingClientRect()
    const points = [...pointersRef.current.values()]
    if (!rect || points.length < 2) return
    const a = points[0]
    const b = points[1]
    gestureRef.current = {
      type: 'pinch',
      startDistance: Math.max(distance(a, b), 1),
      startWindow: latestWindowRef.current,
      anchorIndex: indexFromClientX(midpoint(a, b).x, rect.left, rect.width, latestWindowRef.current),
    }
    setGestureActive(true)
    suppressClick()
  }

  useEffect(() => {
    const el = surfaceRef.current
    if (!el) return

    const onWheel = (event: WheelEvent) => {
      const total = latestTotalDaysRef.current
      if (total <= 1) return
      const rect = el.getBoundingClientRect()
      const currentWindow = latestWindowRef.current

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault()
        const anchor = indexFromClientX(event.clientX, rect.left, rect.width, currentWindow)
        const clampedDelta = Math.max(-60, Math.min(60, event.deltaY))
        const currentSize = windowSize(currentWindow)
        const baseSize =
          wheelZoomSizeRef.current == null || Math.abs(wheelZoomSizeRef.current - currentSize) > 1
            ? currentSize
            : wheelZoomSizeRef.current
        const nextSize = baseSize * Math.exp(clampedDelta * 0.01)
        wheelZoomSizeRef.current = Math.min(Math.max(nextSize, Math.min(MIN_TREND_WINDOW_DAYS, total)), total)
        scheduleWindow(zoomTrendWindow(currentWindow, total, wheelZoomSizeRef.current, anchor))
        markWheelActive()
        suppressClick()
        return
      }

      const horizontal = Math.abs(event.deltaX) >= 3 ? event.deltaX : event.shiftKey ? event.deltaY : 0
      if (horizontal === 0) return

      wheelZoomSizeRef.current = null
      const pxPerDay = rect.width / Math.max(windowSize(currentWindow) - 1, 1)
      event.preventDefault()
      scheduleWindow(panTrendWindow(currentWindow, total, horizontal / pxPerDay))
      markWheelActive()
      suppressClick()
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [markWheelActive, scheduleWindow, suppressClick])

  return (
    <div
      ref={surfaceRef}
      className="trend-gesture-surface"
      onPointerDownCapture={(event) => {
        if (totalDays <= 1) return
        if (event.pointerType === 'mouse' && event.button !== 0) return
        wheelZoomSizeRef.current = null
        event.currentTarget.setPointerCapture(event.pointerId)
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

        if (pointersRef.current.size >= 2) {
          startPinch()
          return
        }

        gestureRef.current = {
          type: 'pending',
          startX: event.clientX,
          startY: event.clientY,
          startWindow: latestWindowRef.current,
        }
      }}
      onPointerMoveCapture={(event) => {
        if (!pointersRef.current.has(event.pointerId)) return
        pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY })

        const rect = surfaceRef.current?.getBoundingClientRect()
        if (!rect) return

        if (pointersRef.current.size >= 2) {
          if (gestureRef.current?.type !== 'pinch') startPinch()
          const g = gestureRef.current
          if (g?.type !== 'pinch') return
          const points = [...pointersRef.current.values()]
          const currentDistance = Math.max(distance(points[0], points[1]), 1)
          const factor = g.startDistance / currentDistance
          event.preventDefault()
          suppressClick()
          scheduleWindow(zoomTrendWindowByFactor(g.startWindow, totalDays, factor, g.anchorIndex))
          return
        }

        const g = gestureRef.current
        if (!g || g.type === 'scroll' || g.type === 'pinch') return

        const dx = event.clientX - g.startX
        const dy = event.clientY - g.startY
        if (g.type === 'pending') {
          if (Math.max(Math.abs(dx), Math.abs(dy)) < PAN_INTENT_PX) return
          if (Math.abs(dx) <= Math.abs(dy) * 1.2) {
            gestureRef.current = { type: 'scroll' }
            return
          }
          gestureRef.current = { ...g, type: 'pan' }
          setGestureActive(true)
        }

        const pxPerDay = rect.width / Math.max(windowSize(g.startWindow) - 1, 1)
        const deltaDays = -dx / pxPerDay
        event.preventDefault()
        suppressClick()
        scheduleWindow(panTrendWindow(g.startWindow, totalDays, deltaDays))
      }}
      onPointerUpCapture={(event) => {
        pointersRef.current.delete(event.pointerId)
        if (pointersRef.current.size === 0) {
          gestureRef.current = null
          setGestureActive(false)
        }
      }}
      onPointerCancelCapture={(event) => {
        pointersRef.current.delete(event.pointerId)
        if (pointersRef.current.size === 0) {
          gestureRef.current = null
          setGestureActive(false)
        }
      }}
    >
      {children}
    </div>
  )
}
