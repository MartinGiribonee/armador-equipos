import type { Kit } from "./types";

/**
 * Juegos de camiseta predefinidos. El orden importa: los primeros son los que
 * se asignan automáticamente a los equipos generados, y están elegidos para
 * que dos equipos consecutivos nunca se confundan en la cancha.
 */
export const KITS: Array<Kit & { id: string; name: string }> = [
  { id: "rojo", name: "Rojo", primaryColor: "#dc2626", secondaryColor: "#ffffff" },
  { id: "azul", name: "Azul", primaryColor: "#1d4ed8", secondaryColor: "#ffffff" },
  { id: "blanco", name: "Blanco", primaryColor: "#f8fafc", secondaryColor: "#0f172a" },
  { id: "negro", name: "Negro", primaryColor: "#18181b", secondaryColor: "#facc15" },
  { id: "amarillo", name: "Amarillo", primaryColor: "#facc15", secondaryColor: "#1e3a8a" },
  { id: "celeste", name: "Celeste", primaryColor: "#38bdf8", secondaryColor: "#ffffff" },
  { id: "verde", name: "Verde", primaryColor: "#15803d", secondaryColor: "#ffffff" },
  { id: "naranja", name: "Naranja", primaryColor: "#ea580c", secondaryColor: "#0f172a" },
  { id: "violeta", name: "Violeta", primaryColor: "#7c3aed", secondaryColor: "#ffffff" },
  { id: "bordo", name: "Bordó", primaryColor: "#7f1d1d", secondaryColor: "#fbbf24" },
];

/** Nombres por defecto de los equipos, en el mismo orden que los kits. */
export const TEAM_NAMES = [
  "Rojos",
  "Azules",
  "Blancos",
  "Negros",
  "Amarillos",
  "Celestes",
  "Verdes",
  "Naranjas",
  "Violetas",
  "Bordós",
];

export function kitFor(index: number): Kit {
  const kit = KITS[index % KITS.length];
  return { primaryColor: kit.primaryColor, secondaryColor: kit.secondaryColor };
}

export function teamNameFor(index: number): string {
  return TEAM_NAMES[index % TEAM_NAMES.length] ?? `Equipo ${index + 1}`;
}

/**
 * Color de texto legible sobre un fondo dado (luminancia relativa simplificada).
 * Sirve para el número del dorsal sobre camisetas claras u oscuras.
 */
export function readableTextOn(hex: string): string {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  if ([r, g, b].some((c) => Number.isNaN(c))) return "#0f172a";
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  return luminance > 0.45 ? "#0f172a" : "#ffffff";
}
