import { designOf, designFont } from "../core/design";
import {
  useEffect,
  useRef,
  useState,
  useMemo,
  useId,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Mystery, Work } from "../core/model";
import { COLORS, cardNumber } from "../core/model";
import { CardImage } from "./CardImage";
import { helpForCard, numberTextColor } from "../core/help";
import {
  overview,
  numberBadge,
  CARD_WIDTH,
  edgeGeometry,
  edgeArrow,
  arrowSize,
  makeLayouts,
} from "../core/layout";
type View = { x: number; y: number; z: number };
type Point = { x: number; y: number };
type BoardPointer = Pick<
  PointerEvent,
  | "pointerId"
  | "pointerType"
  | "button"
  | "clientX"
  | "clientY"
  | "target"
  | "preventDefault"
>;
type Gesture = {
  kind: "card" | "pan" | "pinch";
  start: Point;
  view: View;
  before: Work;
  pointer: number;
  origin: { left: number; top: number };
  cancelled?: boolean;
  id?: number;
  edge?: number;
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
  orientation = false,
}: {
  work: Work;
  mystery: Mystery;
  onChange: (w: Work) => void;
  onCard: (id: number) => void;
  onEdge: (id: number) => void;
  fitTick: number;
  connecting: number | null;
  orientation?: boolean;
}) {
  const design = designOf(mystery);
  const svg = useRef<SVGSVGElement>(null),
    points = useRef(new Map<number, Point>()),
    gesture = useRef<Gesture | null>(null);
  const [view, setView] = useState<View>({ x: 40, y: 40, z: 0.5 }),
    [preview, setPreview] = useState<Work | null>(null);
  const current = useRef(work),
    v = useRef(view),
    latestPreview = useRef<Work | null>(null),
    previewFrame = useRef<number | null>(null),
    measured = useRef<{ width: number; height: number } | null>(null),
    pointerHandlers = useRef<{
      move: (e: BoardPointer) => void;
      finish: (e: BoardPointer, cancel?: boolean) => void;
    } | null>(null);
  current.current = work;
  const changeView = (next: View) => {
    v.current = next;
    setView(next);
  };
  const clearPreview = () => {
    if (previewFrame.current !== null)
      cancelAnimationFrame(previewFrame.current);
    previewFrame.current = null;
    latestPreview.current = null;
    setPreview(null);
  };
  const showPreview = (next: Work) => {
    latestPreview.current = next;
    if (previewFrame.current === null)
      previewFrame.current = requestAnimationFrame(() => {
        previewFrame.current = null;
        setPreview(latestPreview.current);
      });
  };
  const abortGesture = () => {
    if (gesture.current) gesture.current.cancelled = true;
    clearPreview();
  };
  const layouts = useMemo(() => makeLayouts(mystery), [mystery]),
    content = useMemo(
      () => new Map(mystery.cards.map((c) => [c.id, c])),
      [mystery],
    );
  const liveGesture = gesture.current;
  // An undo/load can replace work while a finger is still down. Never draw
  // that gesture's old preview against geometry from the replacement state.
  const livePreview =
    liveGesture && !liveGesture.cancelled && liveGesture.before === work
      ? preview
      : null;
  const drawn = livePreview ?? work;
  const baseGeometry = useMemo(
    () =>
      new Map(
        work.edges.map((e) => [e.id, edgeGeometry(e, work.cards, layouts)]),
      ),
    [work, layouts],
  );
  const geometry = useMemo(() => {
    const id = gesture.current?.id;
    if (!livePreview || id === undefined) return baseGeometry;
    return new Map(
      livePreview.edges.map((e) => [
        e.id,
        e.from === id || e.to === id
          ? edgeGeometry(e, livePreview.cards, layouts)
          : baseGeometry.get(e.id)!,
      ]),
    );
  }, [livePreview, baseGeometry, layouts]);
  const arrowId = "arrow-" + useId().replace(/[^A-Za-z0-9_-]/g, "");
  const headSize = arrowSize(view.z);
  useEffect(() => {
    // Board gestures finish at pointerup. Only a fresh, completed gesture on
    // the same live control may authorize a following pointer click. WebKit
    // can synthesize that click as a different pointer type AND pointer ID.
    const active = new Set<number>(),
      boardPointers = new Set<string>();
    const key = (e: PointerEvent) => `${e.pointerType}:${e.pointerId}`;
    const control = (target: EventTarget | null) =>
      target instanceof Element
        ? (target.closest(
            "button, a, input, select, textarea, label, [role=button]",
          ) ?? target)
        : null;
    let sequence: {
      id: number;
      type: string;
      target: Element;
      start: Point;
      released: boolean;
    } | null = null;
    const down = (e: PointerEvent) => {
      const idle = active.size === 0;
      active.add(e.pointerId);
      if (e.target instanceof Element && svg.current?.contains(e.target)) {
        if (idle) boardPointers.clear();
        boardPointers.add(key(e));
        sequence = null;
      } else {
        const target = control(e.target);
        sequence =
          idle && e.button === 0 && target
            ? {
                id: e.pointerId,
                type: e.pointerType,
                target,
                start: { x: e.clientX, y: e.clientY },
                released: false,
              }
            : null;
      }
    };
    const displaced = (e: PointerEvent) =>
      sequence &&
      Math.hypot(e.clientX - sequence.start.x, e.clientY - sequence.start.y) >=
        8;
    const move = (e: PointerEvent) => {
      if (sequence?.id === e.pointerId && displaced(e)) sequence = null;
      if (e.target instanceof Node && !svg.current?.contains(e.target))
        pointerHandlers.current?.move(e);
    };
    const up = (e: PointerEvent) => {
      active.delete(e.pointerId);
      if (e.target instanceof Node && !svg.current?.contains(e.target))
        pointerHandlers.current?.finish(e);
      if (gesture.current?.cancelled || !gesture.current) {
        points.current.delete(e.pointerId);
        if (!points.current.size) gesture.current = null;
      }
      if (sequence?.id === e.pointerId) {
        if (
          active.size ||
          displaced(e) ||
          control(e.target) !== sequence.target
        )
          sequence = null;
        else sequence.released = true;
      }
    };
    const cancel = (e: PointerEvent) => {
      if (active.delete(e.pointerId) || sequence?.id === e.pointerId)
        sequence = null;
      pointerHandlers.current?.finish(e, true);
    };
    const lost = (e: PointerEvent) => {
      // Normal implicit capture loss AFTER pointerup must keep its click valid.
      // Capture loss does not lift the finger: keep it active until up/cancel.
      if (active.has(e.pointerId)) sequence = null;
      // During a live gesture capture loss aborts the edit, but does not mean
      // the finger was lifted. Consume its eventual up and any other fingers.
      if (points.current.has(e.pointerId) && gesture.current) abortGesture();
    };
    const touchCancel = (e: TouchEvent) => {
      sequence = null;
      if (!e.touches.length) active.clear();
      if (e.target instanceof Element && svg.current?.contains(e.target)) {
        abortGesture();
        if (!e.touches.length) {
          points.current.clear();
          gesture.current = null;
        }
      }
    };
    const click = (e: MouseEvent) => {
      const target = control(e.target);
      // Scope the guard to this application, not other document controls.
      if (
        !boardPointers.size ||
        !target ||
        !svg.current?.closest("main")?.contains(target)
      )
        return;
      const pointer = e as PointerEvent;
      // Keyboard/assistive activation and fileInput.click have no pointer type.
      if (e.detail === 0 && !pointer.pointerType) return;
      const oldBoardClick =
        sequence &&
        pointer.pointerType === sequence.type &&
        pointer.pointerId !== sequence.id &&
        boardPointers.has(key(pointer));
      if (
        sequence?.released &&
        sequence.target.isConnected &&
        target === sequence.target &&
        !oldBoardClick
      ) {
        sequence = null;
        return;
      }
      e.preventDefault();
      e.stopImmediatePropagation();
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move, true);
    document.addEventListener("pointerup", up, true);
    document.addEventListener("pointercancel", cancel, true);
    document.addEventListener("lostpointercapture", lost, true);
    document.addEventListener("touchcancel", touchCancel, true);
    document.addEventListener("click", click, true);
    return () => {
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", move, true);
      document.removeEventListener("pointerup", up, true);
      document.removeEventListener("pointercancel", cancel, true);
      document.removeEventListener("lostpointercapture", lost, true);
      document.removeEventListener("touchcancel", touchCancel, true);
      document.removeEventListener("click", click, true);
      if (previewFrame.current !== null)
        cancelAnimationFrame(previewFrame.current);
    };
  }, []);
  const fit = () => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return;
    measured.current = { width: rect.width, height: rect.height };
    changeView(overview(current.current, layouts, rect.width, rect.height));
  };
  // A toolbar/viewport shift changes local coordinates. Keep the same world
  // point under the finger instead of refitting the entire board mid-gesture.
  const syncOrigin = () => {
    const g = gesture.current,
      rect = svg.current?.getBoundingClientRect();
    if (!g || !rect) return;
    const dx = g.origin.left - rect.left,
      dy = g.origin.top - rect.top;
    if (dx || dy) {
      g.start = { x: g.start.x + dx, y: g.start.y + dy };
      g.view = { ...g.view, x: g.view.x + dx, y: g.view.y + dy };
      for (const [id, p] of points.current)
        points.current.set(id, { x: p.x + dx, y: p.y + dy });
      changeView({ ...v.current, x: v.current.x + dx, y: v.current.y + dy });
      g.origin = { left: rect.left, top: rect.top };
    }
  };
  useEffect(() => {
    if (points.current.size) abortGesture();
    fit();
  }, [fitTick]); // Refit only on explicit overview, start/import or resize.
  useEffect(() => {
    const r = new ResizeObserver(() => {
      const rect = svg.current?.getBoundingClientRect();
      if (!rect) return;
      if (points.current.size) {
        syncOrigin();
        measured.current = { width: rect.width, height: rect.height };
      } else if (
        !measured.current ||
        measured.current.width !== rect.width ||
        measured.current.height !== rect.height
      )
        fit();
    });
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
      if (points.current.size) return;
      changeView({
        x: p.x - ((p.x - old.x) * z) / old.z,
        y: p.y - ((p.y - old.y) * z) / old.z,
        z,
      });
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  const local = (e: Pick<BoardPointer, "clientX" | "clientY">) => {
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
      pointer: -1,
      origin: svg.current!.getBoundingClientRect(),
      moved: true,
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      world: {
        x: (center.x - v.current.x) / v.current.z,
        y: (center.y - v.current.y) / v.current.z,
      },
    };
    clearPreview();
  };
  const down = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault();
    syncOrigin();
    try {
      svg.current!.setPointerCapture(e.pointerId);
    } catch {
      // Document handlers still finish a pointer released outside this SVG.
    }
    const p = local(e);
    points.current.set(e.pointerId, p);
    if (gesture.current?.cancelled) return;
    if (points.current.size >= 2) {
      pinch();
      return;
    }
    const card = (e.target as Element)
      .closest("[data-card]")
      ?.getAttribute("data-card");
    const edge = (e.target as Element).closest(
      "[data-edge-label], [data-edge]",
    );
    gesture.current = {
      kind: card ? "card" : "pan",
      edge: edge
        ? Number(
            edge.getAttribute("data-edge-label") ??
              edge.getAttribute("data-edge"),
          )
        : undefined,
      start: p,
      view: v.current,
      before: current.current,
      pointer: e.pointerId,
      origin: svg.current!.getBoundingClientRect(),
      id: card ? Number(card) : undefined,
      moved: false,
    };
  };
  const dragged = (g: Gesture, p: Point): Work => {
    const card = g.before.cards.find((c) => c.id === g.id)!;
    const clamp = (n: number) =>
      Math.max(-100000, Math.min(100000, Math.round(n * 100) / 100));
    return {
      ...g.before,
      cards: [
        ...g.before.cards.filter((c) => c.id !== g.id),
        {
          ...card,
          x: clamp(card.x + (p.x - g.start.x) / g.view.z),
          y: clamp(card.y + (p.y - g.start.y) / g.view.z),
        },
      ],
    };
  };
  const move = (e: BoardPointer) => {
    if (!points.current.has(e.pointerId)) return;
    syncOrigin();
    points.current.set(e.pointerId, local(e));
    const g = gesture.current;
    if (!g || g.cancelled) return;
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
      changeView({
        x: center.x - g.world!.x * z,
        y: center.y - g.world!.y * z,
        z,
      });
      return;
    }
    if (e.pointerId !== g.pointer) return;
    const p = local(e),
      dx = p.x - g.start.x,
      dy = p.y - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) < 8) return;
    g.moved = true;
    if (g.kind === "pan")
      changeView({ ...g.view, x: g.view.x + dx, y: g.view.y + dy });
    else if (connecting === null) {
      showPreview(dragged(g, p));
    }
  };
  const finish = (e: BoardPointer, cancel = false) => {
    if (!points.current.has(e.pointerId)) return;
    syncOrigin();
    const g = gesture.current;
    points.current.delete(e.pointerId);
    if (!g) return;
    if (cancel) g.cancelled = true;
    // Once two fingers participated, consume all remaining fingers; never turn the last one into a drag/tap.
    if (g.kind === "pinch" || g.cancelled) {
      if (points.current.size === 0) gesture.current = null;
      clearPreview();
      if (svg.current?.hasPointerCapture(e.pointerId))
        svg.current.releasePointerCapture(e.pointerId);
      return;
    }
    if (g.pointer !== e.pointerId) return;
    // Clear the live gesture before releasing capture: delayed normal capture
    // loss must never abort an edit that has already completed successfully.
    gesture.current = null;
    const p = local(e);
    // Some engines deliver a displaced release without a final pointermove.
    const moved = g.moved || Math.hypot(p.x - g.start.x, p.y - g.start.y) >= 8;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (g.kind === "card") {
      if (g.moved && connecting === null) {
        const next = dragged(g, p);
        current.current = next;
        onChange(next);
      } else if (
        !moved &&
        Number(target?.closest("[data-card]")?.getAttribute("data-card")) ===
          g.id
      )
        onCard(g.id!);
    } else if (g.moved) {
      changeView({
        ...g.view,
        x: g.view.x + p.x - g.start.x,
        y: g.view.y + p.y - g.start.y,
      });
    } else if (g.edge !== undefined) {
      const hit = target?.closest("[data-edge-label], [data-edge]");
      const id = Number(
        hit?.getAttribute("data-edge-label") ?? hit?.getAttribute("data-edge"),
      );
      if (id === g.edge) onEdge(id);
    }
    clearPreview();
    if (svg.current?.hasPointerCapture(e.pointerId))
      svg.current.releasePointerCapture(e.pointerId);
  };
  pointerHandlers.current = { move, finish };
  useEffect(() => {
    if (gesture.current && gesture.current.before !== work) abortGesture();
  }, [work]);
  return (
    <svg
      ref={svg}
      className="board"
      style={
        mystery.design
          ? {
              background: design.background,
              fontFamily: designFont(mystery.design),
            }
          : undefined
      }
      role="group"
      aria-label="Arbeitsfläche"
      data-zoom={view.z}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={(e) => finish(e)}
      onPointerCancel={(e) => finish(e, true)}
      onLostPointerCapture={(e) => {
        if (points.current.has(e.pointerId)) abortGesture();
      }}
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 14 12"
          refX="14"
          refY="6"
          markerUnits="userSpaceOnUse"
          markerWidth={headSize.length}
          markerHeight={headSize.halfWidth * 2}
          orient="auto-start-reverse"
        >
          <path
            d={
              design.arrowHead === "open" ? "M0 0L14 6L0 12" : "M0 0L14 6L0 12z"
            }
            fill={design.arrowHead === "open" ? "none" : design.edgeColor}
            stroke={design.edgeColor}
          />
        </marker>
      </defs>
      <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
        {drawn.edges.map((e) => {
          const g = geometry.get(e.id)!;
          return (
            <g
              key={e.id}
              data-edge={e.id}
              className="edge"
              role="button"
              tabIndex={0}
              aria-label={`Verbindung ${cardNumber(mystery, e.from)} zu ${cardNumber(mystery, e.to)}${e.label ? ": " + e.label : ""}`}
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
                stroke={mystery.design ? design.edgeColor : "#738277"}
                strokeWidth={design.edgeWidth}
                strokeDasharray={design.edgeDash ? "10 7" : undefined}
                markerEnd={e.direction === 1 ? `url(#${arrowId})` : undefined}
                markerStart={e.direction === 2 ? `url(#${arrowId})` : undefined}
              />
            </g>
          );
        })}
        {/* Visible labels are above every transparent line target. */}
        {drawn.edges
          .filter((e) => e.label)
          .map((e) => {
            const g = geometry.get(e.id)!;
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
                  fill={design.labelBackground}
                />
                <text
                  textAnchor="middle"
                  fontSize={design.labelSize}
                  fill={mystery.design ? design.textColor : "#4e5e53"}
                >
                  {g.labelLines.map((s, i) => (
                    <tspan
                      key={i}
                      x="0"
                      y={
                        (-g.labelLines.length * (design.labelSize + 4)) / 2 +
                        design.labelSize +
                        i * (design.labelSize + 4)
                      }
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
            badge = numberBadge(view.z, l.numberLabel);
          const hint = helpForCard(mystery, c.id, orientation);
          return (
            <g
              key={c.id}
              transform={`translate(${c.x} ${c.y})`}
              data-card={c.id}
              data-group={card.group}
              data-x={c.x}
              data-y={c.y}
              className="card"
              role="button"
              tabIndex={0}
              aria-label={`Karte ${l.numberLabel} öffnen`}
              aria-description={
                hint ? `Orientierung: ${hint.label}` : undefined
              }
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
                rx={design.radius}
                fill={c.color ? COLORS[c.color] : design.cardColor}
                stroke={connecting === c.id ? "#315e45" : design.borderColor}
                strokeWidth={connecting === c.id ? 4 : design.borderWidth}
              />
              <text
                x="18"
                y="32"
                fontWeight="bold"
                fontSize={l.fontSize + 2}
                fontFamily={l.fontFamily}
                fill={mystery.design ? design.textColor : "#253c30"}
              >
                {l.title.map((s, i) => (
                  <tspan x="18" dy={i ? l.titleLine : 0} key={i}>
                    {s}
                  </tspan>
                ))}
              </text>
              <text
                fontSize={l.fontSize}
                fontFamily={l.fontFamily}
                fill={design.textColor}
              >
                {l.text.map((s, i) => (
                  <tspan x="18" y={l.textY + i * l.textLine} key={i}>
                    {s}
                  </tspan>
                ))}
              </text>
              {(card.image || card.extraImages?.length) && (
                <CardImage
                  src={card.image ?? card.extraImages![0].src}
                  alt={card.imageAlt ?? card.extraImages?.[0].alt}
                  y={l.imageY}
                  width={l.imageWidth}
                  height={l.imageHeight}
                />
              )}
              {l.caption.map((text, i) => (
                <text
                  key={"caption" + i}
                  x="18"
                  y={l.imageY + l.imageHeight + 16 + i * 16}
                  fontSize="12"
                  fill={design.textColor}
                >
                  {text}
                </text>
              ))}
              <g
                data-number={c.id}
                transform={`translate(${badge.offset} ${badge.offset}) scale(${badge.scale})`}
              >
                <circle
                  r={badge.radius}
                  fill={hint?.color ?? "#334f40"}
                  stroke="#f7f8f7"
                  strokeWidth="2"
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={badge.fontSize}
                  fontWeight="bold"
                  fill={hint ? numberTextColor(hint.color) : "white"}
                >
                  {l.numberLabel}
                </text>
              </g>
            </g>
          );
        })}
        {/* Paint the heads last so crossings, labels and card fills cannot hide
            them. This decorative layer introduces no new pointer targets. */}
        <g pointerEvents="none" aria-hidden="true" data-arrowheads="true">
          {drawn.edges.map((e) => {
            const g = geometry.get(e.id)!,
              points = edgeArrow(e, g.start, g.end, view.z);
            return (
              points && (
                <polygon
                  key={e.id}
                  data-arrowhead={e.id}
                  data-direction={e.direction}
                  points={points.map((p) => `${p.x},${p.y}`).join(" ")}
                  fill={
                    design.arrowHead === "open"
                      ? design.labelBackground
                      : design.edgeColor
                  }
                  stroke={
                    design.arrowHead === "open" ? design.edgeColor : "#f7f8f7"
                  }
                  strokeWidth={Math.min(3, 0.8 / view.z)}
                  strokeLinejoin="round"
                />
              )
            );
          })}
        </g>
      </g>
    </svg>
  );
}
