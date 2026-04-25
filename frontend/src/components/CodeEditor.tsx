import { lazy, Suspense, useState } from 'react'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

interface Props {
  value: string
  onChange: (v: string) => void
  language?: string
  height?: number
}

const LANGUAGES = ['python', 'java', 'cpp', 'javascript']

export default function CodeEditor({ value, onChange, language = 'python', height = 200 }: Props) {
  const [lang, setLang] = useState(language)

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-bg-elevated border-b border-border">
        {LANGUAGES.map(l => (
          <button
            key={l}
            onClick={() => setLang(l)}
            className={`font-body text-xs px-2 py-0.5 rounded transition-colors ${
              lang === l
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {l}
          </button>
        ))}
      </div>
      <Suspense fallback={
        <div style={{ height }} className="bg-bg-surface flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <MonacoEditor
          height={height}
          language={lang}
          value={value}
          onChange={(v) => onChange(v ?? '')}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: 'JetBrains Mono, monospace',
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            padding: { top: 12 },
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: { vertical: 'hidden', horizontal: 'hidden' },
            renderLineHighlight: 'none',
          }}
          loading={
            <div style={{ height }} className="bg-[#1e1e1e] flex items-center justify-center">
              <div className="w-5 h-5 border-2 border-accent-primary border-t-transparent rounded-full animate-spin" />
            </div>
          }
        />
      </Suspense>
    </div>
  )
}
