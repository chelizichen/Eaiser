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
