'use client'

import { useEffect, useState, RefObject } from 'react'

export function useIsAtBottom(containerRef: RefObject<HTMLElement>, threshold: number = 100) {
  const [isAtBottom, setIsAtBottom] = useState(true)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight
      setIsAtBottom(distanceFromBottom <= threshold)
    }

    container.addEventListener('scroll', handleScroll)
    handleScroll() // Initial check

    return () => container.removeEventListener('scroll', handleScroll)
  }, [containerRef, threshold])

  return isAtBottom
}