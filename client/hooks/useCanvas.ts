import { useRef, useState } from "react";

export type Tool = "pen" | "arrow" | "rectangle" | "circle" | "text" | "laser" | null;

export function useCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [toolColor, setToolColor] = useState("#FFB200");
  const [lineWeight, setLineWeight] = useState(3);
  const laserTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  function getCanvasPos(e: React.MouseEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    };
  }

  function canvasMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!activeTool) return;
    setIsDrawing(true);
    setDrawStart(getCanvasPos(e, canvasRef.current!));
  }

  function canvasMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !activeTool || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const pos = getCanvasPos(e, canvasRef.current);

    if (activeTool === "pen") {
      ctx.strokeStyle = toolColor;
      ctx.lineWidth = lineWeight;
      ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y);
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
      setDrawStart(pos);
    } else if (activeTool === "laser") {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      const gradient = ctx.createRadialGradient(pos.x, pos.y, 0, pos.x, pos.y, 24);
      gradient.addColorStop(0, "rgba(255, 50, 50, 0.9)");
      gradient.addColorStop(0.3, "rgba(255, 50, 50, 0.4)");
      gradient.addColorStop(1, "rgba(255, 50, 50, 0)");
      ctx.fillStyle = gradient;
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 24, 0, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
      ctx.beginPath(); ctx.arc(pos.x, pos.y, 4, 0, 2 * Math.PI); ctx.fill();
      if (laserTimeoutRef.current) clearTimeout(laserTimeoutRef.current);
      laserTimeoutRef.current = setTimeout(() => {
        ctx.clearRect(0, 0, canvasRef.current!.width, canvasRef.current!.height);
      }, 300);
    }
  }

  function canvasMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing || !activeTool || !canvasRef.current) return;
    const ctx = canvasRef.current.getContext("2d")!;
    const pos = getCanvasPos(e, canvasRef.current);
    ctx.strokeStyle = toolColor; ctx.lineWidth = lineWeight; ctx.lineCap = "round";

    if (activeTool === "rectangle") {
      ctx.strokeRect(drawStart.x, drawStart.y, pos.x - drawStart.x, pos.y - drawStart.y);
    } else if (activeTool === "circle") {
      const r = Math.sqrt((pos.x - drawStart.x) ** 2 + (pos.y - drawStart.y) ** 2);
      ctx.beginPath(); ctx.arc(drawStart.x, drawStart.y, r, 0, 2 * Math.PI); ctx.stroke();
    } else if (activeTool === "arrow") {
      ctx.beginPath(); ctx.moveTo(drawStart.x, drawStart.y);
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
      const angle = Math.atan2(pos.y - drawStart.y, pos.x - drawStart.x);
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(pos.x - 20 * Math.cos(angle - 0.4), pos.y - 20 * Math.sin(angle - 0.4));
      ctx.lineTo(pos.x - 20 * Math.cos(angle + 0.4), pos.y - 20 * Math.sin(angle + 0.4));
      ctx.closePath(); ctx.fillStyle = toolColor; ctx.fill();
    } else if (activeTool === "laser") {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setIsDrawing(false);
  }

  function clearCanvas() {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx && canvasRef.current)
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
  }

  function stampNumber(n: number) {
    if (!canvasRef.current) return;
    setActiveTool(null);
    const canvas = canvasRef.current;
    function placeStamp(e: MouseEvent) {
      const ctx = canvas.getContext("2d")!;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) * (canvas.width / rect.width);
      const y = (e.clientY - rect.top) * (canvas.height / rect.height);
      ctx.beginPath(); ctx.arc(x, y, 18, 0, 2 * Math.PI);
      ctx.fillStyle = toolColor; ctx.fill();
      ctx.fillStyle = "#0A1628";
      ctx.font = "bold 16px sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(String(n), x, y);
      canvas.removeEventListener("click", placeStamp);
    }
    canvas.addEventListener("click", placeStamp);
  }

  return {
    canvasRef, activeTool, setActiveTool, toolColor, setToolColor,
    lineWeight, setLineWeight, laserTimeoutRef,
    canvasMouseDown, canvasMouseMove, canvasMouseUp, clearCanvas, stampNumber,
  };
}