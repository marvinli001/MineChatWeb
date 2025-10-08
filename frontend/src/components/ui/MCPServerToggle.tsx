'use client'

import { useState, useRef, useEffect } from 'react'
import { ServerIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { usePluginStore } from '@/store/pluginStore'

interface MCPServerToggleProps {
  activatedServerIds: string[]
  onServerToggle: (serverId: string) => void
}

export default function MCPServerToggle({
  activatedServerIds,
  onServerToggle
}: MCPServerToggleProps) {
  const { mcpServers } = usePluginStore()
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // 点击外部关闭下拉菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const activatedCount = activatedServerIds.length
  const hasServers = mcpServers.length > 0

  // 如果没有MCP服务器，不显示按钮
  if (!hasServers) {
    return null
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all duration-200 sm:active:scale-[0.98] ${
          activatedCount > 0
            ? 'bg-[#C96342]/10 text-[#C96342] border-[#C96342]/30 dark:bg-[#C96342]/20 dark:border-[#C96342]/40'
            : 'border-[#DDDDDD] dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
        }`}
        title={activatedCount > 0 ? `已激活 ${activatedCount} 个MCP服务器` : '点击管理MCP服务器'}
      >
        <ServerIcon className="w-5 h-5" />
        {activatedCount > 0 && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#C96342] text-white text-xs rounded-full flex items-center justify-center font-medium">
            {activatedCount > 9 ? '9+' : activatedCount}
          </div>
        )}
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg z-50 max-h-80 overflow-y-auto">
          <div className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                MCP 服务器管理
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <XMarkIcon className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              {mcpServers.map((server) => {
                const isActivated = activatedServerIds.includes(server.id)
                return (
                  <div
                    key={server.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    <div className="flex-1 min-w-0 mr-3">
                      <div className="flex items-center gap-2 mb-1">
                        <ServerIcon className="w-4 h-4 text-[#C96342] dark:text-[#C96342] flex-shrink-0" />
                        <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {server.name}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">
                        {server.description}
                      </p>
                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded truncate">
                        {server.url}
                      </div>
                    </div>

                    {/* iOS风格的开关 */}
                    <button
                      type="button"
                      onClick={() => onServerToggle(server.id)}
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#C96342] focus:ring-offset-2 ${
                        isActivated
                          ? 'bg-[#C96342]'
                          : 'bg-gray-200 dark:bg-gray-600'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          isActivated ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                )
              })}
            </div>

            {/* 底部状态信息 */}
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                {activatedCount > 0
                  ? `已激活 ${activatedCount} 个服务器，将在下次发送消息时生效`
                  : '请选择要激活的MCP服务器'
                }
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}