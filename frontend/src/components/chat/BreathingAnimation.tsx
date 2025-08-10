'use client'

interface BreathingAnimationProps {
  className?: string
}

export default function BreathingAnimation({ className = '' }: BreathingAnimationProps) {
  return (
    <div className={`flex items-center gap-2 text-gray-500 dark:text-gray-400 ${className}`}>
      <div className="flex items-center gap-1">
        <div className="breathing-dot w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
        <div className="breathing-dot w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full" style={{ animationDelay: '0.2s' }}></div>
        <div className="breathing-dot w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full" style={{ animationDelay: '0.4s' }}></div>
      </div>
      <span className="text-sm">AI正在思考...</span>
      
      <style jsx>{`
        .breathing-dot {
          animation: breathe 1.5s ease-in-out infinite;
        }
        
        @keyframes breathe {
          0%, 100% {
            transform: scale(1);
            opacity: 0.7;
          }
          50% {
            transform: scale(1.3);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  )
}