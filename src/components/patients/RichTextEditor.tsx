import React, { useRef, useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Pilcrow,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Highlighter,
  Minus,
  Undo2,
  Redo2,
  RemoveFormatting,
} from "lucide-react"

export interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  readOnly?: boolean
  className?: string
  minHeight?: string
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value,
  onChange,
  placeholder = "Digite aqui a queixa principal, anamnese, história da moléstia ou conduta clínica...",
  readOnly = false,
  className = "",
  minHeight = "280px",
}) => {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalChangeRef = useRef(false)
  const [activeHighlightColor, setActiveHighlightColor] = useState<string>("transparent")
  const [showColorPicker, setShowColorPicker] = useState(false)

  // Sincroniza o valor inicial ou externo com o innerHTML do editor
  useEffect(() => {
    if (!editorRef.current) return
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false
      return
    }
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || ""
    }
  }, [value])

  const handleInput = useCallback(() => {
    if (!editorRef.current) return
    const html = editorRef.current.innerHTML
    isInternalChangeRef.current = true
    onChange(html)
  }, [onChange])

  const executeCommand = (command: string, arg: string | undefined = undefined) => {
    if (readOnly || !editorRef.current) return
    editorRef.current.focus()
    document.execCommand(command, false, arg)
    handleInput()
  }

  const applyHeading = (tag: "h1" | "h2" | "p") => {
    if (readOnly || !editorRef.current) return
    editorRef.current.focus()
    document.execCommand("formatBlock", false, tag === "p" ? "<p>" : `<${tag}>`)
    handleInput()
  }

  const applyHighlight = (color: string) => {
    if (readOnly || !editorRef.current) return
    editorRef.current.focus()
    if (color === "transparent") {
      document.execCommand("removeFormat", false)
    } else {
      document.execCommand("hiliteColor", false, color)
    }
    setActiveHighlightColor(color)
    setShowColorPicker(false)
    handleInput()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      if (e.key === "b" || e.key === "B") {
        e.preventDefault()
        executeCommand("bold")
      } else if (e.key === "i" || e.key === "I") {
        e.preventDefault()
        executeCommand("italic")
      } else if (e.key === "u" || e.key === "U") {
        e.preventDefault()
        executeCommand("underline")
      }
    }
  }

  return (
    <div
      className={`border border-border rounded-xl bg-card overflow-hidden shadow-2xs transition-all focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary ${className}`}
    >
      {/* Barra de Ferramentas Clínica */}
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-1 p-2 bg-muted/40 border-b border-border text-foreground select-none shrink-0">
          {/* Grupo: Histórico */}
          <div className="flex items-center gap-0.5 pr-1.5 border-r border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("undo")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("redo")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Refazer (Ctrl+Y)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Grupo: Formatação Básica */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("bold")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground font-bold"
              title="Negrito (Ctrl+B)"
            >
              <Bold className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("italic")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground italic"
              title="Itálico (Ctrl+I)"
            >
              <Italic className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("underline")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground underline"
              title="Sublinhado (Ctrl+U)"
            >
              <Underline className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("strikeThrough")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground line-through"
              title="Tachado / Riscado"
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Grupo: Títulos e Estrutura */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyHeading("h1")}
              className="h-7 px-2 text-xs font-bold text-muted-foreground hover:text-foreground gap-1"
              title="Título Principal (H1)"
            >
              <Heading1 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">H1</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyHeading("h2")}
              className="h-7 px-2 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1"
              title="Subtítulo (H2)"
            >
              <Heading2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">H2</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => applyHeading("p")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Parágrafo Normal"
            >
              <Pilcrow className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Grupo: Listas */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("insertUnorderedList")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Lista com Marcadores"
            >
              <List className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("insertOrderedList")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Lista Numerada"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Grupo: Alinhamento */}
          <div className="flex items-center gap-0.5 px-1.5 border-r border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("justifyLeft")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Alinhar à Esquerda"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("justifyCenter")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Centralizar"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("justifyRight")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Alinhar à Direita"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("justifyFull")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Justificar"
            >
              <AlignJustify className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Grupo: Destaques & Cores */}
          <div className="relative flex items-center gap-0.5 px-1.5 border-r border-border/60">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowColorPicker(!showColorPicker)}
              className="h-7 px-1.5 gap-1 text-muted-foreground hover:text-foreground"
              title="Cor de Destaque / Marca-texto"
            >
              <Highlighter className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-[10px] hidden sm:inline">Destaque</span>
            </Button>

            {showColorPicker && (
              <div className="absolute top-8 left-0 z-30 p-2 rounded-xl bg-popover border border-border shadow-lg flex items-center gap-1.5 animate-in fade-in zoom-in-95">
                {[
                  { name: "Sem cor", color: "transparent", bg: "bg-transparent border border-muted-foreground/30" },
                  { name: "Amarelo", color: "#fef08a", bg: "bg-yellow-200" },
                  { name: "Verde", color: "#bbf7d0", bg: "bg-emerald-200" },
                  { name: "Azul", color: "#bae6fd", bg: "bg-sky-200" },
                  { name: "Rosa", color: "#fbcfe8", bg: "bg-pink-200" },
                  { name: "Laranja", color: "#fed7aa", bg: "bg-orange-200" },
                ].map((item) => (
                  <button
                    key={item.color}
                    type="button"
                    title={item.name}
                    onClick={() => applyHighlight(item.color)}
                    className={`h-6 w-6 rounded-md ${item.bg} hover:scale-110 transition-transform`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Grupo: Linha e Limpeza */}
          <div className="flex items-center gap-0.5 pl-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("insertHorizontalRule")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Inserir Linha Divisória"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => executeCommand("removeFormat")}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              title="Limpar Formatação"
            >
              <RemoveFormatting className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Área Editável ContentEditable */}
      <div
        ref={editorRef}
        contentEditable={!readOnly}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        style={{ minHeight }}
        className={`p-4 sm:p-5 outline-none text-foreground leading-relaxed text-sm selection:bg-primary/20 overflow-y-auto max-h-[550px]
          prose prose-sm dark:prose-invert max-w-none
          prose-headings:font-bold prose-headings:text-foreground prose-h1:text-xl prose-h1:mb-3 prose-h2:text-lg prose-h2:mb-2
          prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
          empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground/60 empty:before:pointer-events-none empty:before:italic`}
      />
    </div>
  )
}
