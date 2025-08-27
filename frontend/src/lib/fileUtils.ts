import { FileProcessMode, FileAttachment } from './types'

// 文件扩展名到MIME类型的映射
export const FILE_MIME_TYPES: Record<string, string> = {
  // 文档类
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'txt': 'text/plain',
  'md': 'text/markdown',
  'rtf': 'application/rtf',
  
  // 数据类
  'csv': 'text/csv',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'xls': 'application/vnd.ms-excel',
  'json': 'application/json',
  'xml': 'application/xml',
  'yaml': 'text/yaml',
  'yml': 'text/yaml',
  
  // 压缩类
  'zip': 'application/zip',
  'rar': 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
  'tar': 'application/x-tar',
  'gz': 'application/gzip',
  
  // 代码类
  'js': 'text/javascript',
  'ts': 'application/typescript',
  'py': 'text/x-python',
  'java': 'text/x-java-source',
  'cpp': 'text/x-c++src',
  'c': 'text/x-csrc',
  'html': 'text/html',
  'css': 'text/css',
  'php': 'application/x-php',
  'sql': 'application/sql',
  
  // 图片类（虽然已有独立处理，但也列在这里）
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'svg': 'image/svg+xml',
}

// 根据文件类型自动判断处理模式
export function getDefaultProcessMode(file: File): FileProcessMode {
  const extension = getFileExtension(file.name).toLowerCase()
  
  // 只有 PDF 支持直读
  if (extension === 'pdf') {
    return 'direct'
  }
  
  // 数据类文件 - 需要计算处理
  const dataFiles = ['csv', 'xlsx', 'xls', 'json', 'xml', 'yaml', 'yml']
  if (dataFiles.includes(extension)) {
    return 'code_interpreter'
  }
  
  // 压缩包 - 通常需要解压和分析
  const archiveFiles = ['zip', 'rar', '7z', 'tar', 'gz']
  if (archiveFiles.includes(extension)) {
    return 'code_interpreter'
  }
  
  // 代码文件 - 可能需要运行或分析
  const codeFiles = ['py', 'js', 'ts', 'java', 'cpp', 'c', 'php', 'sql']
  if (codeFiles.includes(extension)) {
    return 'code_interpreter'
  }
  
  // md 文件优先使用 File Search
  if (extension === 'md') {
    return 'file_search'
  }
  
  // 其他文档类文件默认使用 File Search
  const docFiles = ['doc', 'docx', 'ppt', 'pptx', 'txt', 'rtf']
  if (docFiles.includes(extension)) {
    return 'file_search'
  }
  
  // 默认使用 File Search
  return 'file_search'
}

// 获取文件扩展名
export function getFileExtension(filename: string): string {
  return filename.split('.').pop() || ''
}

// 获取文件图标
export function getFileIcon(filename: string): string {
  const extension = getFileExtension(filename).toLowerCase()
  
  // 文档类
  if (['pdf'].includes(extension)) return '📄'
  if (['doc', 'docx'].includes(extension)) return '📝'
  if (['ppt', 'pptx'].includes(extension)) return '📊'
  if (['txt', 'md'].includes(extension)) return '📃'
  
  // 数据类
  if (['csv', 'xlsx', 'xls'].includes(extension)) return '📊'
  if (['json', 'xml', 'yaml', 'yml'].includes(extension)) return '🗃️'
  
  // 压缩类
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(extension)) return '🗜️'
  
  // 代码类
  if (['js', 'ts'].includes(extension)) return '⚡'
  if (['py'].includes(extension)) return '🐍'
  if (['java'].includes(extension)) return '☕'
  if (['html', 'css'].includes(extension)) return '🌐'
  if (['cpp', 'c'].includes(extension)) return '⚙️'
  
  // 图片类
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) return '🖼️'
  
  // 默认
  return '📎'
}

// 格式化文件大小
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

// 获取处理模式的中文描述
export function getProcessModeDescription(mode: FileProcessMode): string {
  switch (mode) {
    case 'direct':
      return '直接读取 - 适用于文档阅读、总结、翻译等任务'
    case 'code_interpreter':
      return '代码解释器 - 适用于数据分析、代码执行、文件处理等任务'
    case 'file_search':
      return '文件搜索 - 适用于多文档查询、知识库检索等任务'
    default:
      return '未知模式'
  }
}

// 检查文件是否支持预览
export function isPreviewable(filename: string): boolean {
  const extension = getFileExtension(filename).toLowerCase()
  const previewableTypes = ['txt', 'md', 'json', 'xml', 'yaml', 'yml', 'csv', 'js', 'ts', 'py', 'html', 'css']
  return previewableTypes.includes(extension)
}

// 创建文件附件对象
export function createFileAttachment(file: File, processMode?: FileProcessMode): FileAttachment {
  return {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    filename: file.name,
    type: file.type || FILE_MIME_TYPES[getFileExtension(file.name).toLowerCase()] || 'application/octet-stream',
    size: file.size,
    processMode: processMode || getDefaultProcessMode(file),
    status: 'pending',
    progress: 0,
  }
}

// 验证文件是否被支持
export function validateFile(file: File): { valid: boolean; error?: string } {
  // 检查文件大小限制 (100MB)
  const MAX_FILE_SIZE = 100 * 1024 * 1024
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `文件过大，最大支持 100MB`
    }
  }
  
  // 检查文件扩展名是否支持
  const extension = getFileExtension(file.name).toLowerCase()
  const supportedExtensions = Object.keys(FILE_MIME_TYPES)
  
  if (!supportedExtensions.includes(extension) && !file.type.startsWith('image/')) {
    return {
      valid: false,
      error: `不支持的文件格式: .${extension}`
    }
  }
  
  return { valid: true }
}

// 下载文件的工具函数
export async function downloadFile(fileId: string, filename: string, containerId?: string): Promise<void> {
  try {
    const params = new URLSearchParams({
      file_id: fileId,
      filename,
      ...(containerId && { container_id: containerId })
    })
    
    const response = await fetch(`/api/v1/file/download?${params.toString()}`)
    
    if (!response.ok) {
      throw new Error('下载失败')
    }
    
    // 创建下载链接
    const blob = await response.blob()
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  } catch (error) {
    console.error('下载文件失败:', error)
    throw error
  }
}