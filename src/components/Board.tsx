import {
  useEffect,
  useRef,
  useState,
  useMemo,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Mystery, Work } from "../core/model";
import { COLORS } from "../core/model";
import {
  boardBounds,
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
    gesture = useRef<Gesture | null>(null);
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
    const b = boardBounds(current.current, layouts);
    const z = Math.min(
      1.2,
      (rect.width - 64) / b.width,
      (rect.height - 64) / b.height,
    );
    setView({
      x: (rect.width - b.width * z) / 2 - b.x * z,
      y: (rect.height - b.height * z) / 2 - b.y * z,
      z: Math.max(0.001, z),
    });
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
      else if (!g.moved) onCard(g.id!);
    } else if (!g.moved) {
      const p = local(e),
        target = document
          .elementFromPoint(e.clientX, e.clientY)
          ?.closest("[data-edge]");
      if (target && Math.hypot(p.x - g.start.x, p.y - g.start.y) < 8)
        onEdge(Number(target.getAttribute("data-edge")));
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
              {e.label && (
                <g
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
              )}
            </g>
          );
        })}
        {drawn.cards.map((c) => {
          const card = content.get(c.id)!,
            l = layouts.get(c.id)!,
            badge = Math.max(1, Math.min(6, 1 / view.z));
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
                <image
                  href={card.image}
                  x="18"
                  y={l.imageY}
                  width="264"
                  height="98"
                >
                  <title>{card.imageAlt}</title>
                </image>
              )}
              <g transform={`translate(-5 -5) scale(${badge})`}>
                <circle
                  r="17"
                  fill="#334f40"
                  stroke="#f7f8f7"
                  strokeWidth="2"
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize="18"
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
