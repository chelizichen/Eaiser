import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import ReactQuill from 'react-quill'
import 'highlight.js/styles/github.css'
import 'react-quill/dist/quill.snow.css'

function MarkdownEditor({ valueMD, onChangeMD, height = '60vh' }) {
  const quillRef = useRef(null)
  const [quillContent, setQuillContent] = useState('')

  // 初始化/变更时同步外部传入的内容
  useEffect(() => {
    if (!valueMD) return
    setQuillContent(valueMD)
  }, [valueMD])

  // 安全的日志工具
  const logFrontend = useCallback((payload) => {
    try {
      window?.go?.backend?.App?.LogFrontend?.(JSON.stringify(payload))
    } catch (err) {
      // ignore
    }
  }, [])

  // 粘贴图片处理
  const handlePaste = useCallback((event) => {
    try {
      const items = event.clipboardData?.items
      if (!items) {
        logFrontend({ event: 'MarkdownEditor.handlePaste.noItems' })
        return
      }

      const editor = quillRef.current?.getEditor?.()
      if (!editor) {
        logFrontend({ event: 'MarkdownEditor.handlePaste.noEditor' })
        return
      }

      const itemTypes = Array.from(items).map(i => i.type)
      logFrontend({
        event: 'MarkdownEditor.handlePaste.start',
        itemTypes,
        currentHtmlLength: editor.root?.innerHTML?.length || 0,
      })

      let handled = false
      for (let item of items) {
        if (item.type.indexOf('image') === 0) {
          handled = true
          event.preventDefault() // 阻止 webkit-fake-url
          const blob = item.getAsFile()
          if (!blob) {
            logFrontend({ event: 'MarkdownEditor.handlePaste.noBlob' })
            continue
          }
          const reader = new FileReader()
          reader.onload = (e) => {
            try {
              const src = e.target?.result
              if (!src) {
                logFrontend({ event: 'MarkdownEditor.handlePaste.noSrc' })
                return
              }
              const range = editor.getSelection() || { index: editor.getLength(), length: 0 }
              editor.insertEmbed(range.index, 'image', src, 'user')
              editor.setSelection(range.index + 1, 0)
              const next = editor.root.innerHTML
              setQuillContent(next)
              onChangeMD && onChangeMD(next)
              logFrontend({
                event: 'MarkdownEditor.handlePaste.inserted',
                nextLength: next.length,
                rangeIndex: range.index,
              })
            } catch (err) {
              logFrontend({ event: 'MarkdownEditor.handlePaste.insertError', message: err?.message, stack: err?.stack })
            }
          }
          reader.readAsDataURL(blob)
        }
      }

      if (!handled) {
        logFrontend({ event: 'MarkdownEditor.handlePaste.noImageHandled', itemTypes })
      }
    } catch (err) {
      logFrontend({ event: 'MarkdownEditor.handlePaste.error', message: err?.message, stack: err?.stack })
    }
  }, [onChangeMD, logFrontend])

  // 注册/卸载粘贴事件
  useEffect(() => {
    logFrontend({ event: 'MarkdownEditor.mount', valueMDLength: (valueMD || '').length })
    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
      logFrontend({ event: 'MarkdownEditor.unmount' })
    }
  }, [handlePaste, logFrontend, valueMD])
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['code-block'],
      ['link', 'image'],
      ['clean']
    ],
  };
  const formats = [
    'header',
    'bold', 'italic', 'underline', 'strike',
    'list', 'bullet',
    'align',
    'code-block',
    'link', 'image',
  ];
  const handleChange = (value) => {
    setQuillContent(value);
    onChangeMD && onChangeMD(value);
  };

  return (
    <div className="editor-wrapper" style={{ height }}>
      <ReactQuill
        ref={quillRef}
        theme="snow"
        modules={modules}
        formats={formats}
        value={quillContent}
        onChange={handleChange}
        style={{ flex: 1,height:'80vh' }}
      />
    </div>
  )
}

export default MarkdownEditor
