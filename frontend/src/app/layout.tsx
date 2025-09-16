import type { Metadata } from 'next'
import './globals.css'
import { Toaster } from 'react-hot-toast'

export const metadata: Metadata = {
  title: 'MineChatWeb',
  description: 'A powerful AI chat application with multiple providers',
}

export function generateViewport() {
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: [
      { media: '(prefers-color-scheme: light)', color: '#ffffff' },
      { media: '(prefers-color-scheme: dark)', color: '#111827' },
    ],
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              // iOS 视口高度修正和移动端适配
              function setVH() {
                const vh = window.innerHeight * 0.01;
                document.documentElement.style.setProperty('--vh', vh + 'px');
              }
              
              function handleKeyboard() {
                const initialHeight = window.innerHeight;
                const handleResize = () => {
                  const currentHeight = window.visualViewport?.height || window.innerHeight;
                  const diff = initialHeight - currentHeight;
                  
                  if (diff > 150) {
                    document.body.classList.add('keyboard-open');
                  } else {
                    document.body.classList.remove('keyboard-open');
                  }
                  setVH();
                };
                
                if (window.visualViewport) {
                  window.visualViewport.addEventListener('resize', handleResize);
                }
                window.addEventListener('resize', handleResize);
              }
              
              function preventPullToRefresh() {
                let startY = 0;
                document.addEventListener('touchstart', (e) => {
                  startY = e.touches[0].clientY;
                }, { passive: false });
                
                document.addEventListener('touchmove', (e) => {
                  const currentY = e.touches[0].clientY;
                  const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
                  
                  if (scrollTop === 0 && currentY > startY) {
                    e.preventDefault();
                  }
                }, { passive: false });
              }
              
              // 主题初始化
              function initTheme() {
                const savedTheme = localStorage.getItem('theme');
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const theme = savedTheme || (prefersDark ? 'dark' : 'light');

                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              }

              // 初始化
              initTheme();
              setVH();
              if (window.innerWidth <= 768) {
                handleKeyboard();
                preventPullToRefresh();
              }

              window.addEventListener('resize', setVH);
              window.addEventListener('orientationchange', () => {
                setTimeout(setVH, 100);
              });
            `,
          }}
        />
      </head>
      <body className="font-sans">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  )
}