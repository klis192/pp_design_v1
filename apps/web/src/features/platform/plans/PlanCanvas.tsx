import { useRef } from "react";
import type {
  FloorPlan,
  PlanGeometry,
} from "../../../../../../packages/contracts/src/operations-platform";
import type { View } from "./geometry";
type Point = { x: number; y: number };
type Props = {
  imageHeight: number;
  plan: FloorPlan;
  view: View;
  setView: (v: View) => void;
  hidden: string[];
  selected: string;
  select: (id: string) => void;
  tool: string;
  points: Point[];
  addPoint: (p: Point) => void;
  updateGeometry: (g: PlanGeometry) => void;
  ticketUnits: Set<string>;
  unitLabels: Map<string, string>;
  readOnly?: boolean;
  interactive?: boolean;
  ariaLabel?: string;
  onActivate?: (id: string) => void;
  onCloseContour?: () => void;
};
export function PlanCanvas(p: Props) {
  const svg = useRef<SVGSVGElement>(null);
  const suppressClick = useRef(false);
  const drag = useRef<{
    start: Point;
    view: View;
    vertex?: number;
    shape?: string;
    client: Point;
    inverse: DOMMatrix;
    moved: boolean;
  } | null>(null);
  const point = (event: React.PointerEvent) => {
    const element = svg.current!;
    const ctm = element.getScreenCTM();
    const result = ctm
      ? new DOMPoint(event.clientX, event.clientY).matrixTransform(
          ctm.inverse(),
        )
      : { x: 0, y: 0 };
    return { x: result.x, y: result.y };
  };
  return (
    <svg
      ref={svg}
      className="plan-canvas"
      role={p.interactive === false ? "img" : "group"}
      aria-label={p.ariaLabel ?? "Интерактивный план"}
      data-tool={p.tool}
      viewBox={`${p.view.x} ${p.view.y} ${p.view.width} ${p.view.height}`}
      onPointerDown={(e) => {
        if (p.interactive === false || e.button !== 0) return;
        suppressClick.current = false;
        if (p.tool === "draw" && !p.readOnly) {
          p.addPoint(point(e));
          return;
        }
        if (p.tool === "pan") {
          const inverse = e.currentTarget.getScreenCTM()?.inverse();
          if (!inverse) return;
          drag.current = {
            start: point(e),
            view: p.view,
            client: { x: e.clientX, y: e.clientY },
            inverse,
            moved: false,
          };
        }
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        if (e.buttons === 0) {
          drag.current = null;
          return;
        }
        const at = point(e),
          d = drag.current;
        if (Math.hypot(e.clientX - d.client.x, e.clientY - d.client.y) >= 4) {
          d.moved = true;
          if (!e.currentTarget.hasPointerCapture(e.pointerId))
            e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (d.vertex !== undefined && d.shape && !p.readOnly) {
          p.updateGeometry(
            p.plan.geometry.map((s) =>
              s.id === d.shape
                ? {
                    ...s,
                    points: s.points.map((v, i) =>
                      i === d.vertex ? { x: at.x, y: at.y } : v,
                    ),
                  }
                : s,
            ),
          );
        } else if (d.moved) {
          const moved = new DOMPoint(e.clientX, e.clientY).matrixTransform(
            d.inverse,
          );
          p.setView({
            ...d.view,
            x: d.view.x + d.start.x - moved.x,
            y: d.view.y + d.start.y - moved.y,
          });
        }
      }}
      onPointerUp={(e) => {
        suppressClick.current = Boolean(drag.current?.moved);
        drag.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId))
          e.currentTarget.releasePointerCapture(e.pointerId);
      }}
      onPointerCancel={() => {
        drag.current = null;
        suppressClick.current = false;
      }}
    >
      {p.plan.image && (
        <image
          href={p.plan.image}
          x="0"
          y="0"
          width="1000"
          height={p.imageHeight}
          preserveAspectRatio="xMidYMid meet"
        />
      )}
      {p.plan.geometry
        .filter((s) => !p.hidden.includes(s.layer))
        .map((s) => {
          const active = s.id === p.selected,
            hasTickets = !!s.unitId && p.ticketUnits.has(s.unitId);
          const color = active
            ? "#1e79be"
            : hasTickets
              ? "#a96500"
              : s.equipmentId
                ? "#357c42"
                : "#555";
          const props = {
            key: s.id,
            stroke: color,
            strokeWidth: active ? 2.5 : 1,
            vectorEffect: "non-scaling-stroke" as const,
            onClick: (e: React.MouseEvent) => {
              if (
                p.interactive !== false &&
                p.tool !== "draw" &&
                !suppressClick.current
              ) {
                e.stopPropagation();
                p.select(s.id);
                p.onActivate?.(s.id);
              }
            },
            tabIndex: p.interactive === false ? undefined : 0,
            onKeyDown: (e: React.KeyboardEvent) => {
              if (p.interactive !== false && ["Enter", " "].includes(e.key)) {
                e.preventDefault();
                p.select(s.id);
                p.onActivate?.(s.id);
              }
            },
            role: p.interactive === false ? undefined : "button",
            "aria-label":
              s.label ||
              p.unitLabels.get(s.unitId ?? "") ||
              (s.id === "building-outline" ? "Контур здания" : s.layer),
          };
          return (
            <g key={s.id}>
              {s.type === "text" ? (
                <text
                  {...props}
                  stroke="none"
                  fill={color}
                  x={s.points[0].x}
                  y={s.points[0].y}
                  fontSize={p.view.width / 70}
                >
                  {s.label}
                </text>
              ) : s.type === "polygon" ? (
                <polygon
                  {...props}
                  points={s.points.map((v) => `${v.x},${v.y}`).join(" ")}
                  fill={
                    active ? "#e4f1fb" : s.unitId ? "#f4f8f4" : "transparent"
                  }
                />
              ) : (
                <polyline
                  {...props}
                  points={s.points.map((v) => `${v.x},${v.y}`).join(" ")}
                  fill="none"
                />
              )}
              {s.unitId && s.type !== "text" && (
                <text
                  x={s.points[0].x}
                  y={s.points[0].y}
                  fontSize={p.view.width / 70}
                  fill={color}
                  pointerEvents="none"
                >
                  {p.unitLabels.get(s.unitId)}
                  {hasTickets ? " · заявка" : ""}
                </text>
              )}
              {active &&
                p.tool === "edit" &&
                !p.readOnly &&
                p.interactive !== false &&
                s.points.map((v, i) => (
                  <circle
                    key={i}
                    cx={v.x}
                    cy={v.y}
                    r={p.view.width / 140}
                    fill="white"
                    stroke="#1e79be"
                    vectorEffect="non-scaling-stroke"
                    tabIndex={p.interactive === false ? undefined : 0}
                    role="button"
                    aria-label={`Вершина ${i + 1}`}
                    onPointerDown={(e) => {
                      if (p.interactive === false || e.button !== 0) return;
                      e.stopPropagation();
                      suppressClick.current = false;
                      const inverse = svg.current!.getScreenCTM()?.inverse();
                      if (!inverse) return;
                      drag.current = {
                        start: point(e),
                        view: p.view,
                        vertex: i,
                        shape: s.id,
                        client: { x: e.clientX, y: e.clientY },
                        inverse,
                        moved: false,
                      };
                      svg.current!.setPointerCapture(e.pointerId);
                    }}
                    onKeyDown={(event) => {
                      const directions: Record<
                        string,
                        readonly [number, number]
                      > = {
                        ArrowLeft: [-1, 0],
                        ArrowRight: [1, 0],
                        ArrowUp: [0, -1],
                        ArrowDown: [0, 1],
                      };
                      const direction = directions[event.key];
                      if (!direction) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const step = p.view.width / (event.shiftKey ? 10 : 100);
                      p.updateGeometry(
                        p.plan.geometry.map((item) =>
                          item.id === s.id
                            ? {
                                ...item,
                                points: item.points.map((point, index) =>
                                  index === i
                                    ? {
                                        x: point.x + direction[0] * step,
                                        y: point.y + direction[1] * step,
                                      }
                                    : point,
                                ),
                              }
                            : item,
                        ),
                      );
                    }}
                  />
                ))}
            </g>
          );
        })}
      {p.plan.markers.map((m) => (
        <g
          key={m.unitId}
          role={p.interactive === false ? undefined : "button"}
          tabIndex={p.interactive === false ? undefined : 0}
          aria-label={`Помещение ${p.unitLabels.get(m.unitId) ?? "на плане"}`}
          onClick={(event) => {
            if (
              p.interactive === false ||
              p.tool === "draw" ||
              suppressClick.current
            )
              return;
            event.stopPropagation();
            p.select(`marker:${m.unitId}`);
            p.onActivate?.(`marker:${m.unitId}`);
          }}
          onKeyDown={(event) => {
            if (
              p.interactive === false ||
              p.tool === "draw" ||
              !["Enter", " "].includes(event.key)
            )
              return;
            event.preventDefault();
            p.select(`marker:${m.unitId}`);
            p.onActivate?.(`marker:${m.unitId}`);
          }}
        >
          <circle
            cx={m.x * 10}
            cy={(m.y * p.imageHeight) / 100}
            r={p.view.width / 100}
            fill="#1e79be"
          />
          <text
            x={m.x * 10 + p.view.width / 80}
            y={(m.y * p.imageHeight) / 100}
            fontSize={p.view.width / 65}
          >
            {p.unitLabels.get(m.unitId)}
          </text>
        </g>
      ))}
      {p.points.length > 0 && (
        <>
          <polyline
            points={p.points.map((v) => `${v.x},${v.y}`).join(" ")}
            fill="none"
            stroke="#1e79be"
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {p.points.map((point, index) => (
            <circle
              key={index}
              cx={point.x}
              cy={point.y}
              r={p.view.width / 140}
              fill={index === 0 ? "#008060" : "white"}
              stroke="#008060"
              vectorEffect="non-scaling-stroke"
              role={index === 0 && p.points.length >= 3 ? "button" : undefined}
              tabIndex={index === 0 && p.points.length >= 3 ? 0 : undefined}
              aria-label={
                index === 0 && p.points.length >= 3
                  ? "Замкнуть контур"
                  : undefined
              }
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (index === 0 && p.points.length >= 3) p.onCloseContour?.();
              }}
              onKeyDown={(event) => {
                if (
                  index === 0 &&
                  p.points.length >= 3 &&
                  ["Enter", " "].includes(event.key)
                ) {
                  event.preventDefault();
                  p.onCloseContour?.();
                }
              }}
            />
          ))}
        </>
      )}
    </svg>
  );
}
