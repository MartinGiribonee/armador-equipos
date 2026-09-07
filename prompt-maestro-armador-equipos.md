# Prompt maestro — App para armar equipos de fútbol amateur

Copiá y pegá todo este documento como primer mensaje en Claude Code.

---

Quiero que construyas conmigo una aplicación web para armar equipos de fútbol
parejos en partidos amateur (el "picado" semanal entre amigos, fútbol 5/7/8/11).
La referencia visual es la app **Lineup11** (editor de alineación con cancha,
formaciones y colores de camiseta), pero el objetivo real no es solo dibujar
una alineación bonita: es resolver el problema de repartir jugadores de forma
pareja según su nivel y posición, y compartir el resultado en segundos.

## 1. Usuario objetivo y caso de uso

- Alguien que organiza un partido amateur semanal con un grupo fijo de amigos
  (WhatsApp, típicamente 10 a 22 jugadores).
- Necesita: cargar la lista de jugadores, decir cuántos equipos quiere,
  obtener equipos equilibrados en nivel y posición, ajustar a mano si algo no
  le cierra, y mandar el resultado al grupo como imagen o link.
- No necesita gestión de club, calendario de temporada ni roles de
  entrenador — eso es para fase futura, no para el MVP.

## 2. Funcionalidades — Fase 1 (MVP)

### 2.1 Gestión de jugadores
- Alta rápida de jugadores por nombre (uno por línea, para poder pegar una
  lista copiada de WhatsApp de un tirón).
- A cada jugador se le asigna: nivel (escala 1 a 5) y posición
  (Arquero / Defensor / Mediocampista / Delantero).
- El plantel se guarda en `localStorage` para no tener que cargarlo de nuevo
  en el próximo partido (sin necesidad de cuenta ni login en esta fase).
- Editar o eliminar un jugador ya cargado.

### 2.2 Algoritmo de balanceo de equipos
- El usuario define: cantidad de equipos (2 o más) y cantidad de jugadores
  por equipo (formatos típicos: 5v5, 6v6, 7v7, 8v8, 11v11, o "libre").
- El algoritmo reparte jugadores equilibrando:
  1. Nivel promedio por equipo (que quede lo más parejo posible).
  2. Distribución de posiciones (que no queden todos los arqueros en el
     mismo equipo, ni todos los defensores juntos).
- Botón "Regenerar" para volver a correr el algoritmo si el resultado no
  convence.
- Ajuste manual: poder arrastrar un jugador de un equipo a otro después de
  generado el reparto.
- Ver la especificación exacta del algoritmo en la sección 5.

### 2.3 Editor visual de alineación (estilo Lineup11)
- Cancha con vista de arriba, jugadores representados como camisetas
  numeradas ubicadas según una formación (4-3-3, 4-4-2, 3-4-3, etc., más
  formaciones reducidas para 5v5/7v7).
- Colores de camiseta personalizables por equipo (color primario y
  secundario) para diferenciar visualmente a los dos equipos generados.
- Nombre editable para cada equipo.
- Clic sobre un jugador en la cancha para ver/editar su nombre.

### 2.4 Exportar y compartir
- Exportar la alineación final como imagen (PNG) descargable.
- Botón directo de "Compartir por WhatsApp" (usando el link/imagen
  generado).
- Copiar la lista de equipos como texto plano (útil para pegar directo en
  el chat del grupo sin necesidad de imagen).

## 3. Funcionalidades — Fase 2 (después de validar el MVP, no implementar todavía)

- Historial de partidos jugados por el grupo.
- Estadísticas simples: goleadores, partidos jugados, victorias por jugador.
- Grupos con invitación por link o código QR, para que cada jugador cargue
  su propio nivel autoevaluado (privado, solo visible para el algoritmo).
- Registro de asistencia con lista de espera/suplentes automática.
- Modo torneo o fixture para partidos "todos contra todos".

No implementes nada de la fase 2 todavía — priorizá dejar el MVP de la
sección 2 completo y funcionando antes de sugerir cualquier extensión.

## 4. Diseño y experiencia de usuario

- Mobile-first: la mayoría va a cargar la lista y ver el resultado desde el
  celular, parado en la cancha o desde el grupo de WhatsApp.
- Estética tipo cancha de fútbol: verde césped, líneas blancas, camisetas
  como ícono principal — similar a la sobriedad visual de Lineup11, sin
  saturar de elementos.
- Flujo de carga en el mínimo de pasos posible: pegar lista → asignar
  nivel/posición (rápido, con selectores, no formularios largos) → ver
  equipos → compartir. Todo en una sola pantalla o wizard de 3 pasos como
  máximo.
- Sin necesidad de login para usar la función principal (bajar la fricción
  al máximo); el login queda reservado para las funciones de grupo de fase 2.

## 5. Especificación del algoritmo de balanceo

Implementar así (algoritmo tipo "serpentina" con ajuste fino posterior):

1. Agrupar los jugadores por posición.
2. Dentro de cada grupo de posición, ordenar por nivel de mayor a menor.
3. Repartir en serpentina entre los N equipos (equipo 1, 2, 3... N, N... 3, 2, 1,
   y así sucesivamente) para que cada equipo reciba una mezcla similar de
   niveles altos y bajos en cada posición, y quede al menos un arquero por
   equipo si hay arqueros cargados.
4. Calcular el nivel total de cada equipo. Si la diferencia entre el equipo
   más fuerte y el más débil supera un umbral (por ejemplo, más de 2 puntos
   de diferencia sobre el total), hacer una pasada de ajuste: probar
   intercambiar pares de jugadores de la misma posición entre el equipo más
   fuerte y el más débil, y quedarse con el intercambio que más reduzca la
   diferencia. Repetir hasta un máximo de 20 iteraciones o hasta que ya no
   se pueda mejorar.
5. Mostrar el resultado y permitir "Regenerar" (que vuelva a barajar dentro
   de las restricciones) o mover jugadores a mano.

## 6. Modelo de datos sugerido

```
Player {
  id: string
  name: string
  level: number        // 1 a 5
  position: "POR" | "DEF" | "MED" | "DEL"
}

Team {
  id: string
  name: string
  primaryColor: string
  secondaryColor: string
  players: Player[]
  formation: string     // ej. "4-3-3"
}

Match {
  id: string
  date: string
  format: string        // ej. "7v7"
  teams: Team[]
}
```

## 7. Stack técnico sugerido

- Next.js (App Router) + TypeScript + TailwindCSS.
- Estado y persistencia local con `localStorage` para el MVP (nada de
  backend todavía).
- Librería de drag & drop (`dnd-kit` o similar) para mover jugadores entre
  equipos y ubicarlos en la cancha.
- `html-to-image` (o equivalente) para exportar la cancha como PNG.
- Dejar preparado el modelo de datos para que en fase 2 sea fácil migrar a
  una base real (Supabase o Firebase) sin rehacer la lógica de negocio.

## 8. Cómo quiero que trabajes

- Antes de escribir código, hacé un resumen corto de cómo vas a estructurar
  el proyecto (carpetas, componentes principales) y preguntame si algo no
  te queda claro de las secciones de arriba.
- Construí primero el flujo completo del MVP (secciones 2.1 a 2.4) de punta
  a punta con datos de prueba, antes de pulir el diseño visual.
- Priorizá que el algoritmo de balanceo (sección 5) funcione bien y sea
  fácil de testear con distintas listas de jugadores.
- No agregues autenticación, base de datos externa ni funcionalidades de la
  fase 2 salvo que yo lo pida explícitamente.
