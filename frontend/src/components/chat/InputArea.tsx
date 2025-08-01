'use client'

import { useState, useRef, useEffect } from 'react'
import { PaperAirplaneIcon, MicrophoneIcon, PhotoIcon, StopIcon } from '@heroicons/react/24/outline'
import { useChatStore } from '@/store/chatStore'
import { useSettingsStore } from '@/store/settingsStore'
import { Button } from '@/components/ui/button'
import toast from 'react-hot-toast'

export default function InputArea() {
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const { sendMessage, isLoading, stopGeneration } = useChatStore()
  const { settings } = useSettingsStore()

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    // 检查是否配置了AI提供商
    if (!settings.chatProvider || !settings.chatModel) {
      toast.error('请先在设置中配置AI模型')
      return
    }

    const message = input.trim()
    setInput('')
    
    try {
      await sendMessage(message)
    } catch (error) {
      toast.error('发送消息失败')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as any)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      
      const chunks: BlobPart[] = []
      mediaRecorder.ondataavailable = (e) => chunks.push(e.data)
      
      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' })
        await handleVoiceInput(blob)
        stream.getTracks().forEach(track => track.stop())
      }
      
      mediaRecorder.start()
      setIsRecording(true)
      toast.success('开始录音...')
    } catch (error) {
      toast.error('无法访问麦克风')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      toast.success('录音结束')
    }
  }

  const handleVoiceInput = async (audioBlob: Blob) => {
    if (!settings.voiceProvider) {
      toast.error('请先在设置中配置语音提供商')
      return
    }

    try {
      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.wav')
      formData.append('provider', settings.voiceProvider || 'openai')
      formData.append('api_key', settings.apiKeys[settings.voiceProvider] || '')

      const response = await fetch('/api/v1/voice/transcribe', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) throw new Error('转录失败')

      const data = await response.json()
      setInput(data.transcript)
      toast.success('语音转录完成')
    } catch (error) {
      toast.error('语音转录失败')
    }
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // 这里可以实现图片上传和识别功能
    toast.info('图片功能开发中...')
  }

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入您的消息... (Shift+Enter换行)"
              className="w-full resize-none border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-3 pr-24 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={1}
              disabled={isLoading}
            />
            
            {/* 语音和图片按钮 */}
            <div className="absolute right-2 bottom-2 flex items-center gap-1">
              <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                className={`p-2 rounded-full transition-colors ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                }`}
                title={isRecording ? '停止录音' : '开始录音'}
              >
                {isRecording ? (
                  <StopIcon className="w-4 h-4" />
                ) : (
                  <MicrophoneIcon className="w-4 h-4" />
                )}
              </button>
              
              <label className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer transition-colors">
                <PhotoIcon className="w-4 h-4" />
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {isLoading ? (
            <Button
              type="button"
              onClick={stopGeneration}
              variant="outline"
              className="px-4 py-3 text-red-600 border-red-300 hover:bg-red-50"
            >
              <StopIcon className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={!input.trim()}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              <PaperAirplaneIcon className="w-4 h-4" />
            </Button>
          )}
        </form>

        {/* 当前模型显示 */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          当前模型: {settings.chatProvider || '未设置'} - {settings.chatModel || '未选择'}
          {settings.thinkingMode && ' (思考模式)'}
        </div>
      </div>
    </div>
  )
}