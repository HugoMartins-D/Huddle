import { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { BoardElement, FieldKind } from "../lib/types";

export const BOARD_W = 1000;
export const BOARD_H = 600;

export const BOARD_COLORS = ["#ffffff", "#f5d90a", "#ff5a5f", "#4ea1ff", "#3ddc97", "#111111"];

export const FIELDS: { value: FieldKind; label: string }[] = [
  { value: "gridiron", label: "Futebol americano / flag" },
  { value: "soccer", label: "Futebol / society" },
  { value: "court", label: "Quadra" },
  { value: "blank", label: "Em branco" },
];

const LINE = "rgba(255,255,255,0.85)";

function Field({ kind }: { kind: FieldKind }) {
  if (kind === "gridiron") {
    return (
      <g>
        <rect width={BOARD_W} height={BOARD_H} fill="#2e6b3d" />
        <rect width={100} height={BOARD_H} fill="#245832" />
        <rect x={900} width={100} height={BOARD_H} fill="#245832" />
        {Array.from({ length: 21 }, (_, i) => 100 + i * 40).map((x, i) => (
          <line key={x} x1={x} y1={0} x2={x} y2={BOARD_H} stroke={LINE} strokeWidth={i % 2 ? 1 : 2.5} opacity={i % 2 ? 0.45 : 1} />
        ))}
        {Array.from({ length: 81 }, (_, i) => 100 + i * 10).map((x) => (
          <g key={x} opacity={0.6}>
            <line x1={x} y1={200} x2={x} y2={212} stroke={LINE} strokeWidth={1.5} />
            <line x1={x} y1={388} x2={x} y2={400} stroke={LINE} strokeWidth={1.5} />
          </g>
        ))}
        <rect x={2} y={2} width={BOARD_W - 4} height={BOARD_H - 4} fill="none" stroke={LINE} strokeWidth={4} />
      </g>
    );
  }
  if (kind === "soccer") {
    return (
      <g>
        <rect width={BOARD_W} height={BOARD_H} fill="#2f7a43" />
        {Array.from({ length: 10 }, (_, i) => (
          <rect key={i} x={i * 100} width={50} height={BOARD_H} fill="#2b7240" />
        ))}
        <g fill="none" stroke={LINE} strokeWidth={3}>
          <rect x={20} y={20} width={960} height={560} />
          <line x1={500} y1={20} x2={500} y2={580} />
          <circle cx={500} cy={300} r={75} />
          <rect x={20} y={150} width={150} height={300} />
          <rect x={20} y={230} width={55} height={140} />
          <rect x={830} y={150} width={150} height={300} />
          <rect x={925} y={230} width={55} height={140} />
          <path d="M170 245 A 75 75 0 0 1 170 355" />
          <path d="M830 245 A 75 75 0 0 0 830 355" />
        </g>
        <circle cx={500} cy={300} r={4} fill={LINE} />
      </g>
    );
  }
  if (kind === "court") {
    return (
      <g>
        <rect width={BOARD_W} height={BOARD_H} fill="#b8864e" />
        {Array.from({ length: 30 }, (_, i) => (
          <line key={i} x1={0} y1={i * 20} x2={BOARD_W} y2={i * 20} stroke="#a77744" strokeWidth={1} />
        ))}
        <g fill="none" stroke={LINE} strokeWidth={3}>
          <rect x={20} y={20} width={960} height={560} />
          <line x1={500} y1={20} x2={500} y2={580} />
          <circle cx={500} cy={300} r={60} />
          <rect x={20} y={200} width={190} height={200} />
          <rect x={790} y={200} width={190} height={200} />
          <path d="M20 60 L120 60 A 240 240 0 0 1 120 540 L20 540" />
          <path d="M980 60 L880 60 A 240 240 0 0 0 880 540 L980 540" />
        </g>
      </g>
    );
  }
  return (
    <g>
      <rect width={BOARD_W} height={BOARD_H} fill="#11171a" />
      {Array.from({ length: 19 }, (_, i) => (
        <line key={`v${i}`} x1={(i + 1) * 50} y1={0} x2={(i + 1) * 50} y2={BOARD_H} stroke="rgba(255,255,255,0.06)" />
      ))}
      {Array.from({ length: 11 }, (_, i) => (
        <line key={`h${i}`} x1={0} y1={(i + 1) * 50} x2={BOARD_W} y2={(i + 1) * 50} stroke="rgba(255,255,255,0.06)" />
      ))}
    </g>
  );
}

const markerId = (color: string, kind: "arrow" | "block") => `${kind}-${color.replace("#", "")}`;

function Markers() {
  return (
    <defs>
      {BOARD_COLORS.map((c) => (
        <g key={c}>
          <marker id={markerId(c, "arrow")} viewBox="0 0 10 10" refX={8} refY={5} markerWidth={5} markerHeight={5} orient="auto-start-reverse">
            <path d="M0 0 L10 5 L0 10 z" fill={c} />
          </marker>
          <marker id={markerId(c, "block")} viewBox="0 0 10 10" refX={5} refY={5} markerWidth={6} markerHeight={6} orient="auto">
            <line x1={5} y1={0} x2={5} y2={10} stroke={c} strokeWidth={2.5} />
          </marker>
        </g>
      ))}
    </defs>
  );
}

export function routePath(points: [number, number][]) {
  return points.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ");
}

export function ElementShape({
  el,
  selected,
  onPointerDown,
}: {
  el: BoardElement;
  selected?: boolean;
  onPointerDown?: (e: ReactPointerEvent<SVGGElement>) => void;
}) {
  const interactive = !!onPointerDown;
  const cursor = interactive ? "move" : undefined;
  if (el.kind === "route") {
    const d = routePath(el.points);
    const color = BOARD_COLORS.includes(el.color) ? el.color : BOARD_COLORS[0];
    return (
      <g onPointerDown={onPointerDown} style={{ cursor }}>
        {interactive && <path d={d} stroke="transparent" strokeWidth={22} fill="none" />}
        {selected && <path d={d} stroke="#ffffff" strokeOpacity={0.35} strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
        <path
          d={d}
          stroke={color}
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={el.style === "dashed" ? "14 10" : undefined}
          markerEnd={`url(#${markerId(color, el.style === "block" ? "block" : "arrow")})`}
        />
      </g>
    );
  }
  if (el.kind === "text") {
    return (
      <g onPointerDown={onPointerDown} style={{ cursor }}>
        {selected && <rect x={el.x - 6} y={el.y - 22} width={el.text.length * 11 + 12} height={30} rx={6} fill="rgba(255,255,255,0.15)" />}
        <text x={el.x} y={el.y} fill={el.color} fontSize={20} fontWeight={800} fontFamily="Inter, sans-serif" style={{ userSelect: "none" }}>
          {el.text}
        </text>
      </g>
    );
  }
  const filled = el.side === "a";
  return (
    <g onPointerDown={onPointerDown} style={{ cursor }}>
      {selected && <circle cx={el.x} cy={el.y} r={27} fill="none" stroke="#ffffff" strokeWidth={2} strokeDasharray="4 4" />}
      {filled ? (
        <circle cx={el.x} cy={el.y} r={19} fill={el.color} stroke="#0b0f0d" strokeWidth={2} />
      ) : (
        <circle cx={el.x} cy={el.y} r={18} fill="rgba(0,0,0,0.35)" stroke={el.color} strokeWidth={4} />
      )}
      <text
        x={el.x}
        y={el.y + 5}
        textAnchor="middle"
        fontSize={el.label.length > 2 ? 11 : 14}
        fontWeight={800}
        fontFamily="Inter, sans-serif"
        fill={filled ? (el.color === "#ffffff" || el.color === "#f5d90a" || el.color === "#3ddc97" ? "#0b0f0d" : "#ffffff") : el.color}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {el.label}
      </text>
    </g>
  );
}

/** Desenho da jogada. Sem handlers = só leitura (playbook, miniaturas). */
export function BoardSvg({
  field,
  elements,
  selectedId,
  onElementDown,
  children,
  svgRef,
  className = "",
  ...handlers
}: {
  field: FieldKind;
  elements: BoardElement[];
  selectedId?: string | null;
  onElementDown?: (el: BoardElement, e: ReactPointerEvent<SVGGElement>) => void;
  children?: ReactNode;
  svgRef?: React.Ref<SVGSVGElement>;
  className?: string;
} & React.SVGProps<SVGSVGElement>) {
  return (
    <svg ref={svgRef} viewBox={`0 0 ${BOARD_W} ${BOARD_H}`} className={`block w-full touch-none select-none ${className}`} {...handlers}>
      <Markers />
      <Field kind={field} />
      {elements.filter((e) => e.kind === "route").map((el) => (
        <ElementShape key={el.id} el={el} selected={el.id === selectedId} onPointerDown={onElementDown && ((e) => onElementDown(el, e))} />
      ))}
      {elements.filter((e) => e.kind !== "route").map((el) => (
        <ElementShape key={el.id} el={el} selected={el.id === selectedId} onPointerDown={onElementDown && ((e) => onElementDown(el, e))} />
      ))}
      {children}
    </svg>
  );
}
