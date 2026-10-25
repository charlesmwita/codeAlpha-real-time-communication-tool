"use client";

import { useEffect, useRef, useState } from "react";
import type { Stroke } from "@/lib/types";

const COLORS = ["#17140f", "#ff6a3d", "#2f6bff", "#1f9d6c", "#d61f6a", "#f0b429"];

type Tool = "pen" | "highlighter" | "eraser" | "line" | "rect";

export function Whiteboard({
  strokes,
  onStroke,
  onClear,
}: {
  strokes: Stroke[];
  onStroke: (stroke: Omit<Stroke, "id" | "userId">) => void;
  onClear: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("pen");
  const [color, setColor] = useState("#17140f");
  const [width, setWidth] = useState(4);
  const drawing = useRef<{ points: { x: number; y: number }[] } | null>(null);

  function redraw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width: w, height: h } = canvas;
    ctx.clearRect(0, 0, w, h);
    for (const stroke of strokes) drawStroke(ctx, stroke, w, h);
    if (drawing.current) {
      drawStroke(
        ctx,
        {
          id: "live",
          userId: "me",
          tool,
          color,
          width: tool === "highlighter" ? Math.max(width, 16) : width,
          points: drawing.current.points,
        },
        w,
        h,
      );
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const resize = () => {
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(parent.clientWidth * ratio);
      canvas.height = Math.floor(parent.clientHeight * ratio);
      canvas.style.width = `${parent.clientWidth}px`;
      canvas.style.height = `${parent.clientHeight}px`;
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes, tool, color, width]);

  useEffect(() => {
    redraw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strokes]);

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  }

  function onPointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = { points: [pointFromEvent(event)] };
    redraw();
  }

  function onPointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current.points.push(pointFromEvent(event));
    redraw();
  }

  function onPointerUp() {
    if (!drawing.current || drawing.current.points.length < 1) {
      drawing.current = null;
      return;
    }
    onStroke({
      tool,
      color,
      width: tool === "highlighter" ? Math.max(width, 16) : width,
      points: drawing.current.points,
    });
    drawing.current = null;
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-[#1c1914] px-3 py-2">
        {(["pen", "highlighter", "line", "rect", "eraser"] as Tool[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTool(item)}
            className={`rounded-full px-3 py-1 text-xs font-bold capitalize ${
              tool === item ? "bg-[var(--lime)] text-[var(--ink)]" : "text-[var(--paper-dim)]"
            }`}
          >
            {item}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-[var(--line-strong)]" />
        {COLORS.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setColor(value)}
            className="h-6 w-6 rounded-full"
            style={{
              background: value,
              boxShadow: color === value ? "0 0 0 2px #defa3b" : "inset 0 0 0 1px rgba(255,255,255,.2)",
            }}
            aria-label={value}
          />
        ))}
        <input
          type="range"
          min={2}
          max={18}
          value={width}
          onChange={(event) => setWidth(Number(event.target.value))}
          className="ml-2 w-24"
        />
        <button type="button" onClick={onClear} className="ml-auto text-xs font-bold text-[var(--coral)]">
          Clear board
        </button>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden rounded-[24px] border border-black/10">
        <canvas
          ref={canvasRef}
          className="board-canvas h-full w-full"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>
    </div>
  );
}

function drawStroke(
  ctx: CanvasRenderingContext2D,
  stroke: Stroke,
  width: number,
  height: number,
) {
  const points = stroke.points.map((point) => ({ x: point.x * width, y: point.y * height }));
  if (points.length < 1) return;
  ctx.save();
  if (stroke.tool === "eraser") {
    ctx.globalCompositeOperation = "destination-out";
    ctx.strokeStyle = "rgba(0,0,0,1)";
  } else if (stroke.tool === "highlighter") {
    ctx.globalCompositeOperation = "multiply";
    ctx.strokeStyle = stroke.color;
    ctx.globalAlpha = 0.35;
  } else {
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = stroke.color;
  }
  ctx.lineWidth = stroke.width * (width / 900);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (stroke.tool === "rect" && points.length >= 2) {
    const start = points[0];
    const end = points[points.length - 1];
    ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
  } else if (stroke.tool === "line" && points.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }
  ctx.restore();
}
