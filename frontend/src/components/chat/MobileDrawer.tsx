'use client'

import { useEffect, useState, useRef, useCallback } from 'react'

interface MobileDrawerProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

export default function MobileDrawer({ isOpen, onClose, children }: MobileDrawerProps) {
  const [mounted, setMounted] = useState(false)
  const [translateX, setTranslateX] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const drawerRef = useRef<HTMLDivElement>(null)
  const startXRef = useRef(0)
  const currentXRef = useRef(0)

  useEffect(() => {
    setMounted(true)
  }, [])

  // 阻止背景滚动
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // ESC键关闭
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  // 手势滑动处理
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!isOpen) return
    const touch = e.touches[0]
    startXRef.current = touch.clientX
    currentXRef.current = touch.clientX
    setIsDragging(true)
  }, [isOpen])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || !isOpen) return
    const touch = e.touches[0]
    currentXRef.current = touch.clientX
    const deltaX = currentXRef.current - startXRef.current
    
    // 只允许向左滑动关闭
    if (deltaX < 0) {
      setTranslateX(Math.abs(deltaX))
    }
  }, [isDragging, isOpen])

  const handleTouchEnd = useCallback(() => {
    if (!isDragging || !isOpen) return
    setIsDragging(false)
    
    const deltaX = currentXRef.current - startXRef.current
    
    // 如果滑动距离超过1/3宽度，则关闭抽屉
    if (Math.abs(deltaX) > 100) {
      onClose()
    }
    
    // 重置位置
    setTranslateX(0)
  }, [isDragging, isOpen, onClose])

  // 重置状态
  useEffect(() => {
    if (!isOpen) {
      setTranslateX(0)
      setIsDragging(false)
    }
  }, [isOpen])

  if (!mounted || !isOpen) return null

  return (
    <div className="mobile-drawer fixed inset-0 z-50">
      {/* 纯色玉璃遮罩 */}
      <div 
        className={`
          fixed inset-0 bg-black/50 backdrop-blur-sm 
          transition-opacity duration-300 ease-out
          ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={onClose}
        aria-hidden="true"
      />
      
      {/* 抽屉内容 - 占据70%屏幕宽度 */}
      <div 
        ref={drawerRef}
        className={`
          fixed left-0 top-0 h-full bg-gray-50 dark:bg-gray-800 
          shadow-2xl select-none overflow-auto
          ${isDragging ? 'transition-none' : 'transition-transform duration-300 ease-out'}
        `}
        style={{
          width: '80vw',
          transform: isOpen 
            ? `translateX(-${translateX}px)` 
            : 'translateX(-100%)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  )
}