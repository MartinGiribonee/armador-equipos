# Armador de equipos ⚽

App web para armar equipos parejos en el picado semanal: pegás la lista del
grupo, ponés nivel y puesto, y salen los equipos equilibrados listos para
mandar al chat.

Sin login, sin backend: todo se guarda en el navegador (`localStorage`).

## Arrancar

```bash
npm install
npm run dev      # http://localhost:3000
```

| Script          | Qué hace                          |
| --------------- | --------------------------------- |
| `npm run dev`   | Servidor de desarrollo            |
| `npm run build` | Build de producción               |
| `npm run test`  | Tests (Vitest)                    |
| `npm run lint`  | ESLint                            |

## El flujo

Cuatro pasos, pensados para hacerse desde el celular:

1. **Plantel** — pegás los nombres (acepta el copy-paste crudo de WhatsApp, con
   numeración y viñetas) y le ponés a cada uno nivel 1-5 y puesto. Arrancan
   todos en nivel 3 y mediocampistas. El plantel queda guardado para la próxima.
2. **Equipos** — elegís cuántos equipos y qué formato (5v5 … 11v11 o libre), y
   después el **modo de armado**:
   - *Automático*: el algoritmo reparte. Podés regenerar las veces que quieras.
   - *Manual*: se crean los equipos vacíos con todo el plantel en "Sin asignar"
     y los repartís vos.

   En los dos casos podés arrastrar jugadores de un equipo a otro, soltarlos
   encima de otro para intercambiarlos, o mandarlos al banco.
3. **Cancha** — cada equipo en su cancha con formación y colores de camiseta
   editables. Podés **arrastrar las camisetas** para ubicar a cada uno donde
   quieras, más allá de la formación; "Volver a la formación" descarta esos
   ajustes. De ahí sale el PNG de la alineación, el PNG con las listas, el
   texto plano y el link de WhatsApp.
4. **Resultado** — cuando terminó el partido, cargás el marcador y (opcional,
   pero muy recomendado) la figura y el flojo de la fecha. Eso alimenta el
   sistema de rating y deja los equipos libres para el próximo partido.

## Cómo reparte

`src/lib/balance.ts`, en dos etapas:

1. **Serpentina por puesto.** Se agrupa por posición y se ordena por nivel. Un
   arquero por equipo primero; el resto se reparte 1→N, N→1, 1→N… El cursor de
   la serpentina **no se reinicia** entre puestos: el equipo que eligió primero
   entre los defensores elige último entre los medios. Reiniciarlo por grupo le
   daría al mismo equipo el mejor jugador de cada línea.
2. **Ajuste por intercambios.** Si la diferencia de nivel total entre el equipo
   más fuerte y el más débil supera 2 puntos, se prueban todos los canjes de
   jugadores del **mismo puesto** entre esos dos equipos y se aplica el que más
   achica la brecha. Hasta 20 iteraciones o hasta que no se pueda mejorar. Como
   el canje es puesto por puesto, el reparto de líneas queda intacto.

Es una función pura: con la misma `seed` da el mismo reparto. "Regenerar" es
simplemente correrla con otra semilla.

En modo manual el algoritmo no corre: se crean los equipos vacíos y el reparto
sale de los movimientos del usuario.

## Cómo aprende

`src/lib/rating.ts`. Cada jugador tiene un rating tipo Elo que arranca en el
nivel 1-5 cargado a mano y se corrige con cada fecha del historial.

**Elo por equipos.** El rating del equipo es el promedio de sus jugadores, y el
ajuste no depende de si ganaste sino de **cuánto se desvió el resultado de lo
esperado**: ganarle al equipo flojo casi no suma, dar el batacazo suma el doble.
Se usa la diferencia de goles, no solo quién ganó. El K arranca alto y baja con
los partidos jugados, así un novato encuentra su lugar rápido y a un veterano no
lo desbarata un mal domingo.

Que la app rearme los equipos cada semana es lo que hace que esto funcione: si
alguien jugara siempre con los mismos, su rating quedaría confundido con el de
sus compañeros.

**La figura y el flojo importan más de lo que parece.** Sobre partidos simulados
(ver `rating.test.ts`), con equipos armados por el propio balanceador:

| Señal cargada | Error medio a las 50 fechas |
| --- | --- |
| Solo el marcador | 0.78 puntos — prácticamente no aprende |
| Marcador + figura/flojo | ~0.25 puntos |

La razón: cuando el balanceador hace bien su trabajo los equipos quedan parejos
y el marcador pasa a ser casi azar. La marca de figura/flojo es la única señal
*individual*, sin diluir entre 8 jugadores. **Si no se marca a nadie, el sistema
casi no aprende.**

**El nivel manual no se descarta**: es la semilla. El nivel que se muestra es una
mezcla entre esa semilla y lo aprendido, pesada por partidos jugados (con 0
fechas se ve lo cargado, con 4 va mitad y mitad, con 20 manda el historial). Y
como el rating se **recalcula entero desde el historial**, corregir el nivel a
mano corre toda la curva del jugador, y borrar una fecha mal cargada deshace su
efecto.

El balanceador usa este nivel continuo en vez del entero 1-5, lo que ya de por sí
deja los equipos más parejos: distingue entre dos "nivel 4" que no son iguales.

## Ubicaciones en la cancha

Cada equipo se dibuja por formación, pero `Team.layout` guarda las posiciones
puestas a mano (`{ x, y }` en el mismo sistema 0-100 de las formaciones) y
esas pisan al hueco que tocaba. Las ubicaciones se descartan solas cuando
dejan de tener sentido: si el jugador se va del equipo, si se lo borra del
plantel, o si se cambia de formación — sin eso, elegir otra formación no
mostraría ningún cambio.

## Estructura

```
src/
  app/                  layout, página (arma el wizard), estilos globales
  components/
    players/            carga masiva y edición del plantel
    teams/              configuración, columnas de equipos y drag & drop
    pitch/              cancha, camiseta, formación, colores
    share/              placa de listas para exportar
    ui/                 stepper, selector de nivel, selector de puesto
  hooks/useArmador.ts   única suscripción al store
  lib/
    types.ts            Player · Team · Match
    balance.ts          ← el algoritmo
    formations.ts       formaciones y coordenadas en la cancha
    players.ts          parseo de la lista pegada, orden, nombres cortos
    kits.ts             juegos de camiseta y contraste del dorsal
    rating.ts           ← el aprendizaje (Elo por equipos)
    store.ts            estado + acciones (fuera de React)
    storage.ts          lectura/escritura de localStorage
    share.ts            texto plano, link de WhatsApp, descarga del PNG
    __tests__/          88 tests, incluida una simulación de 50 fechas
                        que verifica que el rating converge
```

El estado vive en `src/lib/store.ts`, fuera de React, y se consume con
`useSyncExternalStore`. Por eso no hace falta ningún efecto para hidratar ni
para persistir.

## Migrar a una base (fase 2)

`Player`, `Team`, `Match` y `MatchResult` son objetos planos y serializables
que mapean 1:1 a tablas. La lectura y escritura está toda en `storage.ts`, y las acciones de
negocio en `store.ts`: para pasar a Supabase o Firebase se reemplaza
`storage.ts` y se hacen `async` las acciones del store. Ni el algoritmo ni los
componentes se tocan.

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · dnd-kit · html-to-image ·
Vitest.
