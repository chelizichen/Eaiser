import React, { useEffect, useMemo, useRef, useState } from 'react'
import ReactQuill from 'react-quill'
import 'highlight.js/styles/github.css'
import 'react-quill/dist/quill.snow.css'

function MarkdownEditor({ valueMD, onChangeMD, height = '60vh' }) {
  useEffect(()=>{
    if(!valueMD){
      return;
    }
    setQuillContent(valueMD);
  },[valueMD])
  useEffect(()=>{
    window.addEventListener('paste', handlePaste);
    return () => {
      window.removeEventListener('paste', handlePaste);
    }
  },[])
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
  const [quillContent, setQuillContent] = useState('');

  const handleChange = (value) => {
    setQuillContent(value);
    onChangeMD && onChangeMD(value);
  };

  const handlePaste = (event) => {
    const items = event.clipboardData?.items;
    if (!items) return;
  
    for (let item of items) {
      if (item.type.indexOf('image') === 0) {  // 是图片
        event.preventDefault();  // 阻止默认的 webkit-fake-url 行为
        const blob = item.getAsFile();
        if (blob) {
          // 方式1：转为 base64 插入
          const reader = new FileReader();
          reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;  // data:image/png;base64,...
            // 可选：设置样式
            img.style.maxWidth = '100%';
            setQuillContent(quillContent + '\n\n' + `<img src="${img.src}" alt="image" />`);
          };
          reader.readAsDataURL(blob);
        }
      }
    }
  }


  return (
    <div className="editor-wrapper" style={{ height }}>
      <ReactQuill
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
