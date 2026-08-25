'use client'

import { DragEvent, ReactNode, useRef, useState } from 'react'

type FileDropZoneProps = {
  onFiles: (files: File[]) => void
  accept?: string
  multiple?: boolean
  disabled?: boolean
  className?: string
  dragActiveClassName?: string
  children: ReactNode
}

// Wraps any upload trigger (a button, a link, a whole card) so it accepts a
// dropped file in addition to the existing click-to-browse behaviour - one
// onFiles callback either way, so callers don't need two code paths.
export default function FileDropZone({
  onFiles,
  accept,
  multiple = false,
  disabled = false,
  className = '',
  dragActiveClassName = 'border-deck-accent bg-deck-raised',
  children,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setDragOver(false)
    if (disabled) return
    const files = Array.from(e.dataTransfer.files || [])
    if (files.length > 0) onFiles(multiple ? files : [files[0]])
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`${className} ${dragOver ? dragActiveClassName : ''}`}
    >
      {children}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || [])
          if (files.length > 0) onFiles(multiple ? files : [files[0]])
          e.target.value = ''
        }}
      />
    </div>
  )
}
