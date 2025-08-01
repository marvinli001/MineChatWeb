import * as React from "react"
import { cn } from "@/lib/utils"

interface DialogProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children: React.ReactNode
}

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="fixed inset-0 bg-black/50" 
        onClick={() => onOpenChange?.(false)}
      />
      <div className="relative z-50 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        {children}
      </div>
    </div>
  )
}

const DialogContent: React.FC<{ children: React.ReactNode; className?: string }> = ({ 
  children, 
  className 
}) => {
  return (
    <div className={cn("p-6", className)}>
      {children}
    </div>
  )
}

const DialogHeader: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="mb-4">
      {children}
    </div>
  )
}

const DialogTitle: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
      {children}
    </h2>
  )
}

export { Dialog, DialogContent, DialogHeader, DialogTitle }