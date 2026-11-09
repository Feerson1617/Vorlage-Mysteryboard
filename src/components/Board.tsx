import {
  useEffect,
  useRef,
  useState,
  useMemo,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Mystery, Work } from "../core/model";
import { COLORS } from "../core/model";
import { CardImage } from "./CardImage";
import {
  overview,
  numberBadge,
  CARD_WIDTH,
  edgeGeometry,
  makeLayouts,
} from "../core/layout";
type View = { x: number; y: number; z: number };
type Point = { x: number; y: number };
type Gesture = {
  kind: "card" | "pan" | "pinch";
  start: Point;
  view: View;
  before: Work;
  id?: number;
  moved: boolean;
  distance?: number;
  world?: Point;
};
export function Board({
  work,
  mystery,
  onChange,
  onCard,
  onEdge,
  fitTick,
  connecting,
}: {
  work: Work;
  mystery: Mystery;
  onChange: (w: Work) => void;
  onCard: (id: number) => void;
  onEdge: (id: number) => void;
  fitTick: number;
  connecting: number | null;
}) {
  const svg = useRef<SVGSVGElement>(null),
    points = useRef(new Map<number, Point>()),
    gesture = useRef<Gesture | null>(null),
    tap = useRef<{ kind: "card" | "edge"; id: number } | null>(null);
  const [view, setView] = useState<View>({ x: 40, y: 40, z: 0.5 }),
    [preview, setPreview] = useState<Work | null>(null);
  const current = useRef(work),
    v = useRef(view);
  current.current = work;
  v.current = view;
  const layouts = useMemo(() => makeLayouts(mystery), [mystery]),
    content = useMemo(
      () => new Map(mystery.cards.map((c) => [c.id, c])),
      [mystery],
    );
  const drawn = preview ?? work;
  const fit = () => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return;
    setView(overview(current.current, layouts, rect.width, rect.height));
  };
  useEffect(() => {
    fit();
  }, [fitTick]); // Refit only on explicit overview, start/import or resize.
  useEffect(() => {
    const r = new ResizeObserver(fit);
    if (svg.current) r.observe(svg.current);
    return () => r.disconnect();
  }, [layouts]);
  useEffect(() => {
    const el = svg.current!;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect(),
        p = { x: e.clientX - r.left, y: e.clientY - r.top };
      const old = v.current,
        z = Math.min(3, Math.max(0.001, old.z * Math.exp(-e.deltaY * 0.0015)));
      setView({
        x: p.x - ((p.x - old.x) * z) / old.z,
        y: p.y - ((p.y - old.y) * z) / old.z,
        z,
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const local = (e: ReactPointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const pinch = () => {
    const [a, b] = [...points.current.values()];
    const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    gesture.current = {
      kind: "pinch",
      start: center,
      view: v.current,
      before: current.current,
      moved: true,
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      world: {
        x: (center.x - v.current.x) / v.current.z,
        y: (center.y - v.current.y) / v.current.z,
      },
    };
    setPreview(null);
  };
  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    tap.current = null;
    svg.current!.setPointerCapture(e.pointerId);
    const p = local(e);
    points.current.set(e.pointerId, p);
    if (points.current.size >= 2) {
      pinch();
      return;
    }
    const card = (e.target as Element)
      .closest("[data-card]")
      ?.getAttribute("data-card");
    gesture.current = {
      kind: card ? "card" : "pan",
      start: p,
      view: v.current,
      before: current.current,
      id: card ? Number(card) : undefined,
      moved: false,
    };
  };
  const move = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!points.current.has(e.pointerId)) return;
    points.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (!g) return;
    if (g.kind === "pinch") {
      if (points.current.size < 2) return;
      const [a, b] = [...points.current.values()],
        center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        z = Math.min(
          3,
          Math.max(
            0.001,
            (g.view.z * Math.hypot(a.x - b.x, a.y - b.y)) / g.distance!,
          ),
        );
      setView({
        x: center.x - g.world!.x * z,
        y: center.y - g.world!.y * z,
        z,
      });
      return;
    }
    const p = local(e),
      dx = p.x - g.start.x,
      dy = p.y - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) < 8) return;
    g.moved = true;
    if (g.kind === "pan")
      setView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy });
    else if (connecting === null) {
      const card = g.before.cards.find((c) => c.id === g.id)!;
      const clamp = (n: number) =>
        Math.max(-100000, Math.min(100000, Math.round(n * 100) / 100));
      setPreview({
        ...g.before,
        cards: [
          ...g.before.cards.filter((c) => c.id !== g.id),
          {
            ...card,
            x: clamp(card.x + dx / g.view.z),
            y: clamp(card.y + dy / g.view.z),
          },
        ],
      });
    }
  };
  const finish = (e: ReactPointerEvent<SVGSVGElement>, cancel = false) => {
    if (!points.current.has(e.pointerId)) return;
    const g = gesture.current;
    points.current.delete(e.pointerId);
    if (svg.current?.hasPointerCapture(e.pointerId))
      svg.current.releasePointerCapture(e.pointerId);
    if (!g) return;
    // Once two fingers participated, consume all remaining fingers; never turn the last one into a drag/tap.
    if (g.kind === "pinch") {
      if (points.current.size === 0) gesture.current = null;
      setPreview(null);
      return;
    }
    gesture.current = null;
    if (cancel) {
      setPreview(null);
      return;
    }
    if (g.kind === "card") {
      if (g.moved && preview) onChange(preview);
      else if (!g.moved) tap.current = { kind: "card", id: g.id! };
    } else if (!g.moved) {
      const p = local(e),
        target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest("[data-edge-label], [data-edge]");
      if (target && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 8)
        tap.current = {
          kind: "edge",
          id: Number(
            target.getAttribute("data-edge-label") ??
              target.getAttribute("data-edge"),
          ),
        };
    }
    setPreview(null);
  };
  return (
    <svg
      ref={svg}
      className="board"
      role="group"
      aria-label="Arbeitsfläche"
      data-zoom={view.z}
      onClick={(e) => {
        // Opening on pointerup lets the following native touch click hit a
        // newly mounted dialog button. Activate only after that click arrives.
        e.preventDefault();
        e.stopPropagation();
        const selected = tap.current;
        tap.current = null;
        if (selected?.kind === "card") onCard(selected.id);
        else if (selected?.kind === "edge") onEdge(selected.id);
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={(e) => finish(e)}
      onPointerCancel={(e) => finish(e, true)}
      onLostPointerCapture={(e) => {
        if (points.current.has(e.pointerId)) finish(e, true);
      }}
    >
      <defs>
        <marker
          id="arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="8"
          markerHeight="8"
          orient="auto-start-reverse"
        >
          <path d="M0 0L10 5L0 10z" fill="#738277" />
        </marker>
      </defs>
      <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
        {drawn.edges.map((e) => {
          const g = edgeGeometry(e, drawn.cards, layouts);
          return (
            <g
              key={e.id}
              data-edge={e.id}
              className="edge"
              role="button"
              tabIndex={0}
              aria-label={`Verbindung ${e.from} zu ${e.to}${e.label ? ": " + e.label : ""}`}
              onKeyDown={(ev) => {
                if (ev.key === "Enter" || ev.key === " ") {
                  ev.preventDefault();
                  onEdge(e.id);
                }
              }}
            >
              <line
                x1={g.start.x}
                y1={g.start.y}
                x2={g.end.x}
                y2={g.end.y}
                stroke="transparent"
                strokeWidth={Math.max(30, 44 / view.z)}
              />
              <line
                x1={g.start.x}
                y1={g.start.y}
                x2={g.end.x}
                y2={g.end.y}
                stroke="#738277"
                strokeWidth="2"
                markerEnd={e.direction === 1 ? "url(#arrow)" : undefined}
                markerStart={e.direction === 2 ? "url(#arrow)" : undefined}
              />
            </g>
          );
        })}
        {/* Visible labels are above every transparent line target. */}
        {drawn.edges
          .filter((e) => e.label)
          .map((e) => {
            const g = edgeGeometry(e, drawn.cards, layouts);
            return (
              <g
                key={e.id}
                data-edge-label={e.id}
                className="edge"
                transform={`translate(${g.labelCenter.x} ${g.labelCenter.y})`}
              >
                <rect
                  x={-g.labelWidth / 2}
                  y={-g.labelHeight / 2}
                  width={g.labelWidth}
                  height={g.labelHeight}
                  rx="5"
                  fill="#f7f8f7"
                />
                <text textAnchor="middle" fontSize="14" fill="#4e5e53">
                  {g.labelLines.map((s, i) => (
                    <tspan
                      key={i}
                      x="0"
                      y={-g.labelLines.length * 9 + 14 + i * 18}
                    >
                      {s}
                    </tspan>
                  ))}
                </text>
              </g>
            );
          })}
        {drawn.cards.map((c) => {
          const card = content.get(c.id)!,
            l = layouts.get(c.id)!,
            badge = numberBadge(view.z);
          return (
            <g
              key={c.id}
              transform={`translate(${c.x} ${c.y})`}
              data-card={c.id}
              data-x={c.x}
              data-y={c.y}
              className="card"
              role="button"
              tabIndex={0}
              aria-label={`Karte ${c.id} öffnen`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onCard(c.id);
                }
              }}
            >
              <rect
                width={CARD_WIDTH}
                height={l.height}
                rx="10"
                fill={COLORS[c.color]}
                stroke={connecting === c.id ? "#315e45" : "#bcc8c0"}
                strokeWidth={connecting === c.id ? 4 : 1.3}
              />
              <text
                x="18"
                y="32"
                fontWeight="bold"
                fontSize="18"
                fill="#253c30"
              >
                {l.title.map((s, i) => (
                  <tspan x="18" dy={i ? 24 : 0} key={i}>
                    {s}
                  </tspan>
                ))}
              </text>
              <text fontSize="16" fill="#343f38">
                {l.text.map((s, i) => (
                  <tspan
                    x="18"
                    y={24 + l.title.length * 24 + 26 + i * 22}
                    key={i}
                  >
                    {s}
                  </tspan>
                ))}
              </text>
              {card.image && (
                <CardImage src={card.image} alt={card.imageAlt} y={l.imageY} />
              )}
              <g
                data-number={c.id}
                transform={`translate(${badge.offset} ${badge.offset}) scale(${badge.scale})`}
              >
                <circle
                  r={badge.radius}
                  fill="#334f40"
                  stroke="#f7f8f7"
                  strokeWidth="2"
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={badge.fontSize}
                  fontWeight="bold"
                  fill="white"
                >
                  {c.id}
                </text>
              </g>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
