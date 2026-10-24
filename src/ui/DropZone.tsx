/**
 * 上传区：拖进来或点一下选图。
 */

import { useRef, useState } from 'react'
import { ACCEPTED_MIME_TYPES, formatMegabytes, MAX_FILE_BYTES } from '../state/loadImageFile'

type DropZoneProps = {
  onFile: (file: File) => void
}

export function DropZone({ onFile }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const acceptFile = (files: FileList | null) => {
    const file = files?.[0]
    if (file) {
      onFile(file)
    }
  }

  return (
    <section
      aria-label="上传图片"
      className={`rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
        dragging ? 'border-neutral-900 bg-neutral-100' : 'border-neutral-300 bg-white'
      }`}
      onDragOver={(event) => {
        event.preventDefault()
        setDragging(true)
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault()
        setDragging(false)
        acceptFile(event.dataTransfer.files)
      }}
    >
      <p className="font-medium text-neutral-800 text-sm">把图片拖到这里</p>
      <p className="mt-1 text-neutral-500 text-xs">
        支持 JPEG / PNG / WebP，最大 {formatMegabytes(MAX_FILE_BYTES)}
      </p>

      <button
        type="button"
        className="mt-3 rounded-md bg-neutral-900 px-3 py-1.5 text-sm text-white hover:bg-neutral-700"
        onClick={() => inputRef.current?.click()}
      >
        选择图片
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_MIME_TYPES.join(',')}
        className="hidden"
        onChange={(event) => {
          acceptFile(event.target.files)
          // 允许同一张图再选一次，否则重新转换不会触发变更事件
          event.target.value = ''
        }}
      />

      <p className="mt-3 text-balance text-neutral-400 text-xs">
        图片不会离开这台设备，也不会传到任何服务器。
      </p>
    </section>
  )
}
