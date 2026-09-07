import { teamAverage } from "./balance";
import { sortByLine } from "./players";
import { MATCH_FORMATS, type Match, type Player } from "./types";

/** Fecha larga en español: "domingo 7 de septiembre". */
export function formatDate(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

export function formatLabel(formatId: string): string {
  return MATCH_FORMATS.find((f) => f.id === formatId)?.label ?? formatId;
}

/**
 * Texto plano de los equipos, pensado para pegar directo en el grupo de
 * WhatsApp. Sin markdown ni tablas: emoji, nombres y poco más.
 */
export function matchToText(match: Match, bench: readonly Player[] = []): string {
  const lines: string[] = [];
  lines.push(`⚽ ${formatLabel(match.format)} · ${formatDate(match.date)}`);

  for (const team of match.teams) {
    lines.push("");
    lines.push(`🎽 ${team.name.toLocaleUpperCase("es")}`);
    for (const player of sortByLine(team.players)) {
      lines.push(`• ${player.name}`);
    }
    lines.push(`Nivel promedio: ${teamAverage(team.players).toFixed(1)}`);
  }

  if (bench.length > 0) {
    lines.push("");
    lines.push("🪑 SUPLENTES");
    for (const player of bench) lines.push(`• ${player.name}`);
  }

  return lines.join("\n");
}

/** Link de WhatsApp que abre el selector de chat con el texto ya cargado. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Sin permiso de portapapeles: probamos el método viejo.
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

/** Dispara la descarga de un dataURL como archivo. */
export function downloadDataUrl(dataUrl: string, filename: string): void {
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Nombre de archivo sin espacios ni acentos, para el PNG exportado. */
export function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}
