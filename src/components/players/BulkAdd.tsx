"use client";

import { useState } from "react";

interface BulkAddProps {
  onAdd: (text: string) => number;
}

const PLACEHOLDER = `Pegá la lista del grupo, uno por línea:

1. Juan
2. Seba
3. Nico
...`;

/**
 * Entrada masiva de nombres. Es el primer contacto con la app, así que acepta
 * el copy-paste crudo de WhatsApp (numeraciones, guiones, viñetas) sin pedirle
 * al usuario que lo limpie.
 */
export function BulkAdd({ onAdd }: BulkAddProps) {
  const [text, setText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const submit = () => {
    const added = onAdd(text);
    if (added > 0) {
      setText("");
      setFeedback(`Se agregaron ${added} jugador${added === 1 ? "" : "es"}.`);
    } else {
      setFeedback(
        text.trim() ? "No encontré nombres nuevos (¿ya estaban cargados?)." : null,
      );
    }
  };

  return (
    <div className="card p-3 sm:p-4">
      <label htmlFor="bulk" className="mb-2 block text-sm font-semibold text-grass-100">
        Agregar jugadores
      </label>
      <textarea
        id="bulk"
        className="field h-28 w-full resize-y p-3 text-sm placeholder:text-grass-100/30"
        placeholder={PLACEHOLDER}
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setFeedback(null);
        }}
        onKeyDown={(e) => {
          // Ctrl/Cmd+Enter agrega sin sacar las manos del teclado.
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs text-grass-100/50">
          {feedback ?? "Uno por línea o separados por comas."}
        </p>
        <button
          type="button"
          onClick={submit}
          disabled={!text.trim()}
          className="shrink-0 rounded-xl bg-grass-500 px-4 py-2 text-sm font-bold text-grass-950 transition hover:bg-grass-400 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-grass-100/30"
        >
          Agregar
        </button>
      </div>
    </div>
  );
}
