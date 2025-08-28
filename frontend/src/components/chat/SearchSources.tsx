'use client'

import { LinkIcon, GlobeAltIcon } from '@heroicons/react/24/outline'
import { SearchSource } from '@/lib/types'

interface SearchSourcesProps {
  sources: SearchSource[]
}

export default function SearchSources({ sources }: SearchSourcesProps) {
  if (!sources || sources.length === 0) {
    return null
  }

  const handleSourceClick = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
      <div className="flex items-center gap-2 mb-3">
        <GlobeAltIcon className="w-4 h-4 text-blue-500" />
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          搜索来源
        </h4>
      </div>
      
      <div className="space-y-2">
        {sources.map((source, index) => (
          <div 
            key={index}
            onClick={() => handleSourceClick(source.url)}
            className="flex items-start gap-3 p-3 bg-white dark:bg-gray-700 rounded-lg border hover:shadow-md transition-all cursor-pointer group"
          >
            <div className="flex-shrink-0 mt-0.5">
              <LinkIcon className="w-4 h-4 text-blue-500 group-hover:text-blue-600" />
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h5 className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1 group-hover:text-blue-600">
                  {source.title}
                </h5>
              </div>
              
              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                {source.domain}
              </div>
              
              {source.snippet && (
                <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                  {source.snippet}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}