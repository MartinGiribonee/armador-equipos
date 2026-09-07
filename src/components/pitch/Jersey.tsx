import { readableTextOn } from "@/lib/kits";

interface JerseyProps {
  primary: string;
  secondary: string;
  number?: number;
  className?: string;
  /** Tamaño fijo en px. Sin esto el SVG toma el ancho del contenedor. */
  size?: number;
}

/**
 * Camiseta vista de frente: cuerpo en el color primario, mangas y cuello en el
 * secundario, y el dorsal en el color que mejor contraste con el cuerpo.
 */
export function Jersey({ primary, secondary, number, className, size }: JerseyProps) {
  const numberColor = readableTextOn(primary);

  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={number ? `Camiseta número ${number}` : "Camiseta"}
    >
      <g>
        {/* Mangas */}
        <path d="M22 4 L9 9.5 L2 24.5 L14.5 30 L20 14 Z" fill={secondary} />
        <path d="M42 4 L55 9.5 L62 24.5 L49.5 30 L44 14 Z" fill={secondary} />
        {/* Cuerpo */}
        <path
          d="M22 4 C24.5 10.5 39.5 10.5 42 4 L54 9 L61 24.5 L49.5 29.5 L47 24 L47 59
             C47 60.1 46.1 61 45 61 L19 61 C17.9 61 17 60.1 17 59 L17 24 L14.5 29.5
             L3 24.5 L10 9 Z"
          fill={primary}
        />
        {/* Cuello */}
        <path
          d="M22 4 C24.5 10.5 39.5 10.5 42 4 L38.5 2.6 C36.5 7 27.5 7 25.5 2.6 Z"
          fill={secondary}
        />
        {/* Sombra interior para que no quede plana */}
        <path
          d="M17 24 L17 59 C17 60.1 17.9 61 19 61 L26 61 L26 24 Z"
          fill="rgba(0,0,0,0.08)"
        />
      </g>
      {number != null && (
        <text
          x="32"
          y="44"
          textAnchor="middle"
          fontSize="22"
          fontWeight="800"
          fill={numberColor}
          fontFamily="inherit"
        >
          {number}
        </text>
      )}
    </svg>
  );
}
