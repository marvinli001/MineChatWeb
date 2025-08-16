'use client'

interface TypewriterEffectProps {
  className?: string
}

export default function TypewriterEffect({ className = '' }: TypewriterEffectProps) {
  return (
    <div className={`flex items-center gap-2 text-gray-500 dark:text-gray-400 ${className}`}>
      <div className="flex items-center gap-2">
        {/* OpenAI-style typewriter cursor */}
        <div className="typewriter-cursor w-3 h-5 bg-gray-500 dark:bg-gray-400 rounded-sm"></div>
        <span className="text-sm">AI正在思考...</span>
      </div>
      
      <style jsx>{`
        .typewriter-cursor {
          animation: blink 1.2s ease-in-out infinite;
        }
        
        @keyframes blink {
          0%, 50% {
            opacity: 1;
          }
          51%, 100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}