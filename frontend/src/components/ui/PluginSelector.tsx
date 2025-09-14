'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDownIcon, WrenchScrewdriverIcon, ServerIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { usePluginStore } from '@/store/pluginStore'

interface PluginSelectorProps {
  selectedPluginIds: string[]
  selectedMCPServerIds: string[]
  onPluginToggle: (pluginId: string) => void
  onMCPServerToggle: (serverId: string) => void
}

export default function PluginSelector({
  selectedPluginIds,
  selectedMCPServerIds,
  onPluginToggle,
  onMCPServerToggle
}: PluginSelectorProps) {
  const { plugins, mcpServers } = usePluginStore()
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

  const totalSelected = selectedPluginIds.length + selectedMCPServerIds.length
  const hasItems = plugins.length > 0 || mcpServers.length > 0

  if (!hasItems) {
    return (
      <button
        type="button"
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-lg cursor-not-allowed"
        disabled
      >
        <WrenchScrewdriverIcon className="w-4 h-4" />
        <span>暂无插件</span>
      </button>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border transition-colors ${
          totalSelected > 0
            ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-300'
            : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700'
        }`}
      >
        <WrenchScrewdriverIcon className="w-4 h-4" />
        <span>
          {totalSelected > 0 ? `已选择 ${totalSelected} 个工具` : '选择插件'}
        </span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
          {/* 插件列表 */}
          {plugins.length > 0 && (
            <div className="p-2">
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 mb-2">
                <WrenchScrewdriverIcon className="w-3 h-3" />
                自定义插件
              </div>
              {plugins.map((plugin) => (
                <label
                  key={plugin.id}
                  className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedPluginIds.includes(plugin.id)}
                    onChange={() => onPluginToggle(plugin.id)}
                    className="mt-0.5 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {plugin.name}
                      </span>
                      <span className="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 px-1.5 py-0.5 rounded">
                        Function
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {plugin.description}
                    </p>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {Object.keys(plugin.parameters.properties || {}).length} 个参数
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* MCP 服务器列表 */}
          {mcpServers.length > 0 && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 px-2 py-1 text-xs font-medium text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 mb-2">
                <ServerIcon className="w-3 h-3" />
                MCP 服务器
              </div>
              {mcpServers.map((server) => (
                <label
                  key={server.id}
                  className="flex items-start gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMCPServerIds.includes(server.id)}
                    onChange={() => onMCPServerToggle(server.id)}
                    className="mt-0.5 w-4 h-4 text-purple-600 bg-gray-100 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-white text-sm">
                        {server.name}
                      </span>
                      <span className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 px-1.5 py-0.5 rounded">
                        MCP
                      </span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                      {server.description}
                    </p>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded truncate">
                      {server.url}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* 已选择的工具显示 */}
          {totalSelected > 0 && (
            <div className="p-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  已选择的工具 ({totalSelected})
                </span>
                <button
                  onClick={() => {
                    selectedPluginIds.forEach(id => onPluginToggle(id))
                    selectedMCPServerIds.forEach(id => onMCPServerToggle(id))
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                >
                  清除全部
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedPluginIds.map(id => {
                  const plugin = plugins.find(p => p.id === id)
                  if (!plugin) return null
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300 text-xs rounded-full"
                    >
                      {plugin.name}
                      <button
                        onClick={() => onPluginToggle(id)}
                        className="hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  )
                })}
                {selectedMCPServerIds.map(id => {
                  const server = mcpServers.find(s => s.id === id)
                  if (!server) return null
                  return (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300 text-xs rounded-full"
                    >
                      {server.name}
                      <button
                        onClick={() => onMCPServerToggle(id)}
                        className="hover:bg-purple-200 dark:hover:bg-purple-800 rounded-full p-0.5"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </span>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}