// iOS Safari 视口高度修正
export function setViewportHeight() {
  const vh = window.innerHeight * 0.01
  document.documentElement.style.setProperty('--vh', `${vh}px`)
}

// 键盘弹出检测
export function handleKeyboardEvents() {
  let initialViewportHeight = window.visualViewport?.height || window.innerHeight
  
  const handleViewportChange = () => {
    const currentViewportHeight = window.visualViewport?.height || window.innerHeight
    const heightDifference = initialViewportHeight - currentViewportHeight
    
    // 如果高度差超过150px，认为是键盘弹出
    if (heightDifference > 150) {
      document.body.classList.add('keyboard-open')
    } else {
      document.body.classList.remove('keyboard-open')
    }
    
    // 更新视口高度
    setViewportHeight()
  }
  
  // 监听视口变化
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', handleViewportChange)
  }
  
  // 监听窗口大小变化
  window.addEventListener('resize', handleViewportChange)
  window.addEventListener('orientationchange', () => {
    setTimeout(setViewportHeight, 100)
  })
  
  return () => {
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', handleViewportChange)
    }
    window.removeEventListener('resize', handleViewportChange)
  }
}

// 防止iOS下拉刷
export function preventPullToRefresh() {
  let startY = 0
  
  document.addEventListener('touchstart', (e) => {
    startY = e.touches[0].clientY
  }, { passive: false })
  
  document.addEventListener('touchmove', (e) => {
    const currentY = e.touches[0].clientY
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
    
    // 如果在顶部且向下滑动，阻止默认行为
    if (scrollTop === 0 && currentY > startY) {
      e.preventDefault()
    }
  }, { passive: false })
}

// 初始化移动端适配
export function initMobileAdaptation() {
  if (typeof window === 'undefined') return
  
  // 检查是否为移动端
  const isMobile = window.innerWidth <= 768
  
  if (isMobile) {
    // 设置初始视口高度
    setViewportHeight()
    
    // 监听视口变化和键盘事件
    const cleanup = handleKeyboardEvents()
    
    // 防止下拉刷新
    preventPullToRefresh()
    
    return cleanup
  }
}