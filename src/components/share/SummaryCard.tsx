import { Jersey } from "@/components/pitch/Jersey";
import { teamAverage, type LevelOf } from "@/lib/balance";
import { sortByLine } from "@/lib/players";
import { formatDate, formatLabel } from "@/lib/share";
import type { Match, Player } from "@/lib/types";

interface SummaryCardProps {
  match: Match;
  bench: Player[];
  levelOf?: LevelOf;
}

/**
 * Placa con todos los equipos y sus jugadores, pensada exclusivamente para
 * exportar como PNG y mandar al grupo. Usa colores y tamaños fijos (nada de
 * variables CSS ni transparencias) porque `html-to-image` clona el nodo fuera
 * del árbol y algunos estilos heredados no viajan.
 */
export function SummaryCard({ match, bench, levelOf }: SummaryCardProps) {
  const columns = match.teams.length >= 3 ? 3 : match.teams.length;

  return (
    <div
      style={{
        width: 720,
        padding: 28,
        backgroundColor: "#0f1a13",
        backgroundImage:
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(34,197,94,0.22), transparent 70%)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        color: "#f0fdf4",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 20 }}>
        <span style={{ fontSize: 26 }}>⚽</span>
        <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em" }}>
          {formatLabel(match.format)}
        </span>
        <span style={{ fontSize: 15, color: "#86efac", textTransform: "capitalize" }}>
          {formatDate(match.date)}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap: 14,
        }}
      >
        {match.teams.map((team) => (
          <div
            key={team.id}
            style={{
              backgroundColor: "#17251c",
              border: "1px solid rgba(34,197,94,0.22)",
              borderRadius: 14,
              padding: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <Jersey
                primary={team.primaryColor}
                secondary={team.secondaryColor}
                size={22}
              />
              <span
                style={{
                  fontSize: 15,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  letterSpacing: "0.02em",
                }}
              >
                {team.name}
              </span>
            </div>

            <ol style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {sortByLine(team.players).map((player, index) => (
                <li
                  key={player.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "4px 0",
                    borderTop: index === 0 ? "none" : "1px solid rgba(255,255,255,0.06)",
                    fontSize: 14,
                  }}
                >
                  <span
                    style={{
                      width: 20,
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#4ade80",
                    }}
                  >
                    {index + 1}
                  </span>
                  <span style={{ flex: 1, fontWeight: 600 }}>{player.name}</span>
                  <span style={{ fontSize: 11, color: "rgba(240,253,244,0.45)" }}>
                    {player.position}
                  </span>
                </li>
              ))}
            </ol>

            <div
              style={{
                marginTop: 10,
                paddingTop: 8,
                borderTop: "1px solid rgba(34,197,94,0.22)",
                fontSize: 12,
                color: "#86efac",
              }}
            >
              Nivel promedio {teamAverage(team.players, levelOf).toFixed(1)}
            </div>
          </div>
        ))}
      </div>

      {bench.length > 0 && (
        <div style={{ marginTop: 14, fontSize: 13, color: "rgba(240,253,244,0.6)" }}>
          <strong style={{ color: "#f0fdf4" }}>🪑 Suplentes:</strong>{" "}
          {bench.map((p) => p.name).join(" · ")}
        </div>
      )}
    </div>
  );
}
