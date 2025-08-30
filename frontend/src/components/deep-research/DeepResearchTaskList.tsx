'use client'

import { StopIcon, ClockIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import type { DeepResearchTask } from '../../services/deepResearchService'

interface DeepResearchTaskListProps {
  tasks: DeepResearchTask[]
  selectedTask: string | null
  onTaskSelect: (taskId: string) => void
  onStopTask: (taskId: string) => void
}

export default function DeepResearchTaskList({ 
  tasks, 
  selectedTask, 
  onTaskSelect, 
  onStopTask 
}: DeepResearchTaskListProps) {
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / (1000 * 60))
    
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}小时前`
    
    const days = Math.floor(hours / 24)
    if (days === 1) return '昨天'
    if (days < 7) return `${days}天前`
    
    return date.toLocaleDateString('zh-CN')
  }

  const getStatusIcon = (status: DeepResearchTask['status']) => {
    switch (status) {
      case 'running':
        return <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent" />
      case 'warning':
        return <div className="animate-spin rounded-full h-4 w-4 border-2 border-yellow-600 border-t-transparent" />
      case 'completed':
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircleIcon className="w-4 h-4 text-red-500" />
      default:
        return <ClockIcon className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusText = (status: DeepResearchTask['status']) => {
    switch (status) {
      case 'running':
        return '研究中...'
      case 'warning':
        return '研究中...'
      case 'completed':
        return '已完成'
      case 'failed':
        return '已中止'
      default:
        return '等待中'
    }
  }

  const getStatusColor = (status: DeepResearchTask['status']) => {
    switch (status) {
      case 'running':
        return 'text-blue-600 dark:text-blue-400'
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400'
      case 'completed':
        return 'text-green-600 dark:text-green-400'
      case 'failed':
        return 'text-red-600 dark:text-red-400'
      default:
        return 'text-gray-600 dark:text-gray-400'
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="flex-1 h-full flex items-center justify-center">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <div className="text-sm">还没有深度研究任务</div>
          <div className="text-xs mt-1">在上方输入框中提交您的研究问题开始</div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4">
        <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-4">
          研究任务 ({tasks.length})
        </div>
        
        <div className="space-y-2">
          {tasks.map((task, index) => (
            <div
              key={task.id}
              onClick={() => onTaskSelect(task.id)}
              className={`
                p-4 rounded-lg border cursor-pointer transition-all duration-200 group animate-in fade-in-0 slide-in-from-bottom-2
                ${selectedTask === task.id 
                  ? 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 shadow-sm' 
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                }
              `}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  {/* 任务标题 */}
                  <div className="font-medium text-gray-900 dark:text-white mb-2 truncate">
                    {task.title}
                  </div>
                  
                  {/* 任务详情 */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
                    <div className="flex items-center gap-1">
                      {getStatusIcon(task.status)}
                      <span className={getStatusColor(task.status)}>
                        {getStatusText(task.status)}
                      </span>
                    </div>
                    <div>模型: {task.model}</div>
                    <div>{formatDate(task.created_at)}</div>
                  </div>
                  
                  {/* 附件信息 */}
                  {task.files && task.files.length > 0 && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      📎 {task.files.length} 个附件
                    </div>
                  )}
                </div>
                
                {/* 中止按钮 */}
                {(task.status === 'running' || task.status === 'warning') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onStopTask(task.id)
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all duration-200"
                    title="中止研究"
                  >
                    <StopIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}