/*
  Design reminder — 紙上工作室 / New Modern Craft:
  畫布是唯一主角；石墨黑工作台、暖紙白畫布與印刷朱砂 #E4513B 建立操作階層。
  左側工具 rail、中央工作區、右側 inspector 維持非對稱工作台；互動快速、可逆、可理解。
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  Check,
  ChevronDown,
  Download,
  Eraser,
  ImagePlus,
  Maximize2,
  Minus,
  MoreHorizontal,
  PaintBucket,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Type,
  Undo2,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";

type Tool = "brush" | "eraser" | "fill" | "text";

type CanvasPoint = {
  x: number;
  y: number;
};

type TextLayer = {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: number;
  color: string;
  opacity: number;
  fontFamily: "Noto Sans TC" | "DM Sans" | "IBM Plex Mono";
};

type HistoryItem = {
  width: number;
  height: number;
  imageData: ImageData;
  layers: TextLayer[];
};

type Adjustments = {
  exposure: number;
  contrast: number;
  saturation: number;
  opacity: number;
  backgroundTolerance: number;
};

const BRAND_RED = "#E4513B";
const PAPER = "#FFFDF8";
const GRAPHITE = "#1F2528";

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const hexToRgb = (hex: string) => {
  const normalized = hex.replace("#", "");
  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const makeId = () => `text-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

function ToolButton({
  label,
  active,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  active?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className={`tool-button ${active ? "is-active" : ""}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function SectionTitle({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="section-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="range-control">
      <span className="range-heading">
        <span>{label}</span>
        <span className="mono-value">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastPointRef = useRef<CanvasPoint | null>(null);
  const textDragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const historyRef = useRef<HistoryItem[]>([]);
  const historyIndexRef = useRef(-1);
  const layersRef = useRef<TextLayer[]>([]);

  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 640 });
  const [tool, setTool] = useState<Tool>("brush");
  const [brushColor, setBrushColor] = useState(BRAND_RED);
  const [brushSize, setBrushSize] = useState(18);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [zoom, setZoom] = useState(68);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasArtwork, setHasArtwork] = useState(false);
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<Adjustments>({
    exposure: 0,
    contrast: 0,
    saturation: 100,
    opacity: 100,
    backgroundTolerance: 32,
  });
  const [backgroundRemoved, setBackgroundRemoved] = useState(false);
  const [fileMeta, setFileMeta] = useState({ name: "未命名畫布", size: "—" });

  const selectedText = useMemo(
    () => layers.find((layer) => layer.id === selectedTextId) ?? null,
    [layers, selectedTextId],
  );

  const canvasFilter = useMemo(
    () =>
      `brightness(${100 + adjustments.exposure}%) contrast(${100 + adjustments.contrast}%) saturate(${adjustments.saturation}%)`,
    [adjustments],
  );

  const syncLayers = useCallback((nextLayers: TextLayer[]) => {
    layersRef.current = nextLayers;
    setLayers(nextLayers);
  }, []);

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * canvas.width, 0, canvas.width),
      y: clamp(((clientY - rect.top) / rect.height) * canvas.height, 0, canvas.height),
    };
  }, []);

  const captureHistory = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const item: HistoryItem = {
      width: canvas.width,
      height: canvas.height,
      imageData: context.getImageData(0, 0, canvas.width, canvas.height),
      layers: layersRef.current.map((layer) => ({ ...layer })),
    };
    const current = historyRef.current.slice(0, historyIndexRef.current + 1);
    const next = [...current, item].slice(-24);
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
  }, []);

  const restoreHistory = useCallback(
    (index: number) => {
      const item = historyRef.current[index];
      const canvas = canvasRef.current;
      if (!item || !canvas) return;
      canvas.width = item.width;
      canvas.height = item.height;
      canvas.getContext("2d")?.putImageData(item.imageData, 0, 0);
      setCanvasSize({ width: item.width, height: item.height });
      syncLayers(item.layers.map((layer) => ({ ...layer })));
      setSelectedTextId(null);
      historyIndexRef.current = index;
    },
    [syncLayers],
  );

  const undo = () => {
    if (historyIndexRef.current <= 0) {
      toast.info("目前已經是最初狀態");
      return;
    }
    restoreHistory(historyIndexRef.current - 1);
  };

  const redo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) {
      toast.info("沒有可以重做的動作");
      return;
    }
    restoreHistory(historyIndexRef.current + 1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = canvasSize.width;
    canvas.height = canvasSize.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = PAPER;
    context.fillRect(0, 0, canvas.width, canvas.height);
    captureHistory();
    // 初始化只執行一次；尺寸更新由 resizeCanvas 直接保留畫面資料。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const drag = textDragRef.current;
      if (!drag) return;
      const point = getCanvasPoint(event.clientX, event.clientY);
      const nextLayers = layersRef.current.map((layer) =>
        layer.id === drag.id
          ? {
              ...layer,
              x: clamp(point.x - drag.offsetX, 0, canvasSize.width - 30),
              y: clamp(point.y - drag.offsetY, 0, canvasSize.height - 30),
            }
          : layer,
      );
      syncLayers(nextLayers);
    };
    const handleUp = () => {
      if (!textDragRef.current) return;
      textDragRef.current = null;
      captureHistory();
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [canvasSize.height, canvasSize.width, captureHistory, getCanvasPoint, syncLayers]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT") return;
      const key = event.key.toLowerCase();
      if (key === "b") setTool("brush");
      if (key === "e") setTool("eraser");
      if (key === "f") setTool("fill");
      if (key === "t") setTool("text");
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const drawStroke = (from: CanvasPoint, to: CanvasPoint) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = brushSize;
    context.globalAlpha = brushOpacity / 100;
    context.strokeStyle = brushColor;
    context.fillStyle = brushColor;
    context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    context.beginPath();
    context.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  const floodFill = (point: CanvasPoint) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const targetIndex = (Math.floor(point.y) * canvas.width + Math.floor(point.x)) * 4;
    const target = {
      r: image.data[targetIndex],
      g: image.data[targetIndex + 1],
      b: image.data[targetIndex + 2],
      a: image.data[targetIndex + 3],
    };
    const fill = hexToRgb(brushColor);
    const fillAlpha = Math.round((brushOpacity / 100) * 255);
    const tolerance = 22;
    const matches = (index: number) =>
      Math.abs(image.data[index] - target.r) <= tolerance &&
      Math.abs(image.data[index + 1] - target.g) <= tolerance &&
      Math.abs(image.data[index + 2] - target.b) <= tolerance &&
      Math.abs(image.data[index + 3] - target.a) <= tolerance;
    if (
      Math.abs(target.r - fill.r) < 2 &&
      Math.abs(target.g - fill.g) < 2 &&
      Math.abs(target.b - fill.b) < 2 &&
      target.a === fillAlpha
    ) {
      return;
    }
    const stack = [Math.floor(point.y) * canvas.width + Math.floor(point.x)];
    const visited = new Uint8Array(canvas.width * canvas.height);
    while (stack.length) {
      const pixel = stack.pop();
      if (pixel === undefined || visited[pixel]) continue;
      visited[pixel] = 1;
      const index = pixel * 4;
      if (!matches(index)) continue;
      image.data[index] = fill.r;
      image.data[index + 1] = fill.g;
      image.data[index + 2] = fill.b;
      image.data[index + 3] = fillAlpha;
      const x = pixel % canvas.width;
      const y = Math.floor(pixel / canvas.width);
      if (x > 0) stack.push(pixel - 1);
      if (x < canvas.width - 1) stack.push(pixel + 1);
      if (y > 0) stack.push(pixel - canvas.width);
      if (y < canvas.height - 1) stack.push(pixel + canvas.width);
    }
    context.putImageData(image, 0, 0);
    setHasArtwork(true);
    captureHistory();
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (tool === "fill") {
      floodFill(point);
      return;
    }
    if (tool === "text") {
      const nextLayer: TextLayer = {
        id: makeId(),
        text: "在這裡輸入文字",
        x: point.x,
        y: point.y,
        fontSize: 52,
        fontWeight: 700,
        color: GRAPHITE,
        opacity: 100,
        fontFamily: "Noto Sans TC",
      };
      const nextLayers = [...layersRef.current, nextLayer];
      syncLayers(nextLayers);
      setSelectedTextId(nextLayer.id);
      setTool("brush");
      captureHistory();
      toast.success("文字卡已加入畫布");
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDrawing(true);
    setHasArtwork(true);
    lastPointRef.current = point;
    drawStroke(point, { x: point.x + 0.01, y: point.y + 0.01 });
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    const point = getCanvasPoint(event.clientX, event.clientY);
    drawStroke(lastPointRef.current, point);
    lastPointRef.current = point;
  };

  const finishStroke = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;
    captureHistory();
  };

  const updateTextLayer = (patch: Partial<TextLayer>) => {
    if (!selectedTextId) return;
    const nextLayers = layersRef.current.map((layer) =>
      layer.id === selectedTextId ? { ...layer, ...patch } : layer,
    );
    syncLayers(nextLayers);
  };

  const addTextCard = () => {
    const nextLayer: TextLayer = {
      id: makeId(),
      text: "標題文字",
      x: canvasSize.width * 0.16,
      y: canvasSize.height * 0.18,
      fontSize: 64,
      fontWeight: 700,
      color: BRAND_RED,
      opacity: 100,
      fontFamily: "DM Sans",
    };
    const nextLayers = [...layersRef.current, nextLayer];
    syncLayers(nextLayers);
    setSelectedTextId(nextLayer.id);
    toast.success("已新增文字卡，現在可以直接編輯");
    captureHistory();
  };

  const deleteSelectedText = () => {
    if (!selectedTextId) return;
    syncLayers(layersRef.current.filter((layer) => layer.id !== selectedTextId));
    setSelectedTextId(null);
    captureHistory();
    toast.success("文字卡已移除");
  };

  const resizeCanvas = () => {
    const widthInput = document.getElementById("canvas-width") as HTMLInputElement | null;
    const heightInput = document.getElementById("canvas-height") as HTMLInputElement | null;
    const nextWidth = clamp(Number(widthInput?.value) || canvasSize.width, 240, 2400);
    const nextHeight = clamp(Number(heightInput?.value) || canvasSize.height, 180, 1800);
    const oldCanvas = canvasRef.current;
    if (!oldCanvas) return;
    const temp = document.createElement("canvas");
    temp.width = nextWidth;
    temp.height = nextHeight;
    const tempContext = temp.getContext("2d");
    if (!tempContext) return;
    tempContext.fillStyle = PAPER;
    tempContext.fillRect(0, 0, nextWidth, nextHeight);
    tempContext.drawImage(oldCanvas, 0, 0, nextWidth, nextHeight);
    oldCanvas.width = nextWidth;
    oldCanvas.height = nextHeight;
    oldCanvas.getContext("2d")?.drawImage(temp, 0, 0);
    const scaleX = nextWidth / canvasSize.width;
    const scaleY = nextHeight / canvasSize.height;
    syncLayers(
      layersRef.current.map((layer) => ({
        ...layer,
        x: layer.x * scaleX,
        y: layer.y * scaleY,
        fontSize: layer.fontSize * Math.min(scaleX, scaleY),
      })),
    );
    setCanvasSize({ width: nextWidth, height: nextHeight });
    setFileMeta((meta) => ({ ...meta, size: `${nextWidth} × ${nextHeight}px` }));
    captureHistory();
    toast.success(`畫布已調整為 ${nextWidth} × ${nextHeight}`);
  };

  const removeBackground = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const target = {
      r: image.data[0],
      g: image.data[1],
      b: image.data[2],
    };
    const threshold = adjustments.backgroundTolerance;
    const matches = (index: number) =>
      Math.abs(image.data[index] - target.r) <= threshold &&
      Math.abs(image.data[index + 1] - target.g) <= threshold &&
      Math.abs(image.data[index + 2] - target.b) <= threshold;
    const stack: number[] = [];
    const visited = new Uint8Array(canvas.width * canvas.height);
    for (let x = 0; x < canvas.width; x += 1) {
      stack.push(x, (canvas.height - 1) * canvas.width + x);
    }
    for (let y = 1; y < canvas.height - 1; y += 1) {
      stack.push(y * canvas.width, y * canvas.width + canvas.width - 1);
    }
    while (stack.length) {
      const pixel = stack.pop();
      if (pixel === undefined || visited[pixel]) continue;
      visited[pixel] = 1;
      const index = pixel * 4;
      if (!matches(index)) continue;
      image.data[index + 3] = 0;
      const x = pixel % canvas.width;
      const y = Math.floor(pixel / canvas.width);
      if (x > 0) stack.push(pixel - 1);
      if (x < canvas.width - 1) stack.push(pixel + 1);
      if (y > 0) stack.push(pixel - canvas.width);
      if (y < canvas.height - 1) stack.push(pixel + canvas.width);
    }
    context.putImageData(image, 0, 0);
    setHasArtwork(true);
    setBackgroundRemoved(true);
    captureHistory();
    toast.success("已移除與左上角相近的背景色");
  };

  const resetAdjustments = () => {
    setAdjustments({
      exposure: 0,
      contrast: 0,
      saturation: 100,
      opacity: 100,
      backgroundTolerance: 32,
    });
    toast.info("影像調整已重設");
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const maxDimension = 1600;
      const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(240, Math.round(image.naturalWidth * ratio));
      const height = Math.max(180, Math.round(image.naturalHeight * ratio));
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
      setCanvasSize({ width, height });
      setFileMeta({ name: file.name, size: formatBytes(file.size) });
      syncLayers([]);
      setSelectedTextId(null);
      setHasArtwork(true);
      setBackgroundRemoved(false);
      captureHistory();
      toast.success("影像已載入，可以開始編輯");
    };
    image.src = URL.createObjectURL(file);
    event.target.value = "";
  };

  const exportImage = () => {
    const source = canvasRef.current;
    if (!source) return;
    const output = document.createElement("canvas");
    output.width = source.width;
    output.height = source.height;
    const context = output.getContext("2d");
    if (!context) return;
    context.filter = canvasFilter;
    context.globalAlpha = adjustments.opacity / 100;
    context.drawImage(source, 0, 0);
    context.filter = "none";
    layersRef.current.forEach((layer) => {
      context.save();
      context.globalAlpha = (adjustments.opacity / 100) * (layer.opacity / 100);
      context.fillStyle = layer.color;
      context.font = `${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}", sans-serif`;
      context.textBaseline = "top";
      context.fillText(layer.text, layer.x, layer.y);
      context.restore();
    });
    const link = document.createElement("a");
    link.download = `${fileMeta.name.replace(/\.[^.]+$/, "") || "paper-studio"}.png`;
    link.href = output.toDataURL("image/png");
    link.click();
    toast.success("PNG 已匯出");
  };

  const handleTextPointerDown = (event: ReactPointerEvent<HTMLDivElement>, layer: TextLayer) => {
    event.stopPropagation();
    const point = getCanvasPoint(event.clientX, event.clientY);
    setSelectedTextId(layer.id);
    textDragRef.current = {
      id: layer.id,
      offsetX: point.x - layer.x,
      offsetY: point.y - layer.y,
    };
  };

  const currentZoomLabel = `${zoom}%`;

  return (
    <main className="studio-app">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            <img src="/manus-storage/studio-mark_49f4186a.png" alt="" />
          </div>
          <div className="brand-copy">
            <span className="brand-name">紙上工作室</span>
            <span className="brand-status">
              <span className="status-dot" /> 純前端編輯器
            </span>
          </div>
        </div>

        <div className="document-meta">
          <span className="document-kicker">WORKING FILE</span>
          <strong>{fileMeta.name}</strong>
          <span className="document-size">{fileMeta.size === "—" ? `${canvasSize.width} × ${canvasSize.height}px` : fileMeta.size}</span>
        </div>

        <div className="top-actions">
          <button type="button" className="icon-button" onClick={undo} title="復原" aria-label="復原">
            <Undo2 size={17} />
          </button>
          <button type="button" className="icon-button" onClick={redo} title="重做" aria-label="重做">
            <Redo2 size={17} />
          </button>
          <span className="top-divider" />
          <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()}>
            <Upload size={15} /> 匯入影像
          </button>
          <button type="button" className="primary-button" onClick={exportImage}>
            <Download size={15} /> 匯出 PNG
          </button>
          <button type="button" className="icon-button" title="更多" aria-label="更多">
            <MoreHorizontal size={18} />
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImport} hidden />
      </header>

      <div className="studio-layout">
        <aside className="tool-rail" aria-label="繪圖工具">
          <div className="rail-label">TOOLS</div>
          <div className="tool-group">
            <ToolButton label="筆刷" active={tool === "brush"} icon={<Pencil size={18} />} onClick={() => setTool("brush")} />
            <ToolButton label="橡皮擦" active={tool === "eraser"} icon={<Eraser size={18} />} onClick={() => setTool("eraser")} />
            <ToolButton label="填色桶" active={tool === "fill"} icon={<PaintBucket size={18} />} onClick={() => setTool("fill")} />
            <ToolButton label="文字卡" active={tool === "text"} icon={<Type size={18} />} onClick={() => setTool("text")} />
          </div>
          <div className="rail-rule" />
          <div className="tool-group rail-secondary">
            <ToolButton label="新增文字" icon={<Plus size={18} />} onClick={addTextCard} />
            <ToolButton label="匯入影像" icon={<ImagePlus size={18} />} onClick={() => fileInputRef.current?.click()} />
          </div>
          <div className="rail-bottom">
            <div className="rail-caption">快捷鍵</div>
            <kbd>B</kbd><kbd>T</kbd><kbd>F</kbd>
          </div>
        </aside>

        <section className="workspace" aria-label="畫布工作區">
          <div className="workspace-toolbar">
            <div className="active-tool-name">
              <span className="active-tool-marker" />
              <span>{tool === "brush" ? "筆刷" : tool === "eraser" ? "橡皮擦" : tool === "fill" ? "填色桶" : "文字卡"}</span>
              <span className="tool-hint">{tool === "text" ? "點擊畫布加入文字" : "在畫布上落筆"}</span>
            </div>
            <div className="workspace-actions">
              <button type="button" className="ghost-button" onClick={() => setZoom((value) => clamp(value - 10, 25, 150))}>
                <Minus size={14} />
              </button>
              <span className="zoom-value">{currentZoomLabel}</span>
              <button type="button" className="ghost-button" onClick={() => setZoom((value) => clamp(value + 10, 25, 150))}>
                <Plus size={14} />
              </button>
              <span className="top-divider" />
              <button type="button" className="ghost-button" onClick={() => setZoom(68)} title="重設縮放">
                <Maximize2 size={15} />
              </button>
            </div>
          </div>

          <div className="canvas-viewport">
            <div className="stage-notes stage-note-top">PAPER / 01</div>
            <div className="stage-notes stage-note-bottom">{canvasSize.width} × {canvasSize.height}</div>
            <div
              className="canvas-shell-outer"
              style={{
                width: `${canvasSize.width * (zoom / 100)}px`,
                height: `${canvasSize.height * (zoom / 100)}px`,
              }}
            >
              <div
                className="canvas-shell"
                style={{
                  width: `${canvasSize.width}px`,
                  height: `${canvasSize.height}px`,
                  transform: `scale(${zoom / 100})`,
                }}
              >
                <div className="canvas-content" style={{ filter: canvasFilter, opacity: adjustments.opacity / 100 }}>
                  <canvas
                    ref={canvasRef}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={finishStroke}
                    onPointerCancel={finishStroke}
                    onPointerLeave={finishStroke}
                    aria-label="繪圖畫布"
                  />
                  {layers.map((layer) => (
                    <div
                      key={layer.id}
                      className={`text-layer ${selectedTextId === layer.id ? "is-selected" : ""}`}
                      style={{
                        left: `${layer.x}px`,
                        top: `${layer.y}px`,
                        color: layer.color,
                        fontSize: `${layer.fontSize}px`,
                        fontWeight: layer.fontWeight,
                        fontFamily: `"${layer.fontFamily}", sans-serif`,
                        opacity: layer.opacity / 100,
                      }}
                      onPointerDown={(event) => handleTextPointerDown(event, layer)}
                      onDoubleClick={() => setSelectedTextId(layer.id)}
                      role="button"
                      tabIndex={0}
                      aria-label={`文字卡：${layer.text}`}
                    >
                      {layer.text}
                      {selectedTextId === layer.id && <span className="text-layer-tag">TEXT</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {layers.length === 0 && !hasArtwork && (
              <div className="canvas-empty-note">
                <img src="/manus-storage/paint-study-card_e95bc42a.png" alt="抽象顏料色彩樣本" />
                <span>在紙上留下第一筆</span>
              </div>
            )}
          </div>

          <div className="workspace-footer">
            <div className="brush-context">
              <span className="context-label">筆刷</span>
              <span className="brush-preview" style={{ width: `${clamp(brushSize, 8, 28)}px`, height: `${clamp(brushSize, 8, 28)}px`, backgroundColor: brushColor }} />
              <span className="mono-value">{brushSize}px</span>
              <span className="context-separator" />
              <span className="color-chip" style={{ backgroundColor: brushColor }} />
              <span className="mono-value">{brushColor.toUpperCase()}</span>
            </div>
            <div className="footer-note"><Check size={14} /> 所有操作都在瀏覽器完成</div>
          </div>
        </section>

        <aside className="inspector" aria-label="屬性與調整">
          <div className="inspector-scroll">
            <SectionTitle
              eyebrow="TOOL SETTINGS"
              title={tool === "text" || selectedText ? "文字卡" : "筆刷設定"}
              action={<button type="button" className="icon-button subtle" title="面板選項" aria-label="面板選項"><MoreHorizontal size={17} /></button>}
            />

            {tool !== "text" && !selectedText && (
              <div className="inspector-section">
                <div className="color-row">
                  <div>
                    <span className="field-label">前景色</span>
                    <span className="field-help">點擊色票選擇顏色</span>
                  </div>
                  <label className="color-picker">
                    <input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} aria-label="筆刷顏色" />
                    <span style={{ backgroundColor: brushColor }} />
                  </label>
                </div>
                <RangeControl label="筆刷大小" value={brushSize} min={2} max={160} suffix=" px" onChange={setBrushSize} />
                <RangeControl label="筆刷不透明度" value={brushOpacity} min={1} max={100} suffix="%" onChange={setBrushOpacity} />
                <div className="swatch-row">
                  {["#E4513B", "#1F2528", "#426B8A", "#D59B42", "#FFFDF8"].map((color) => (
                    <button key={color} type="button" className={`swatch ${brushColor === color ? "is-selected" : ""}`} style={{ backgroundColor: color }} onClick={() => setBrushColor(color)} aria-label={`選擇顏色 ${color}`} />
                  ))}
                </div>
              </div>
            )}

            {(tool === "text" || selectedText) && (
              <div className="inspector-section text-inspector-section">
                {!selectedText && <p className="empty-inspector">選擇畫布上的文字，或按左側「新增文字」建立文字卡。</p>}
                {selectedText && (
                  <>
                    <label className="field-label" htmlFor="text-content">文字內容</label>
                    <textarea id="text-content" className="text-input" value={selectedText.text} onChange={(event) => updateTextLayer({ text: event.target.value })} rows={3} />
                    <div className="select-row">
                      <label className="select-wrap">
                        <span className="field-label">字型</span>
                        <select value={selectedText.fontFamily} onChange={(event) => updateTextLayer({ fontFamily: event.target.value as TextLayer["fontFamily"] })}>
                          <option value="Noto Sans TC">Noto Sans TC</option>
                          <option value="DM Sans">DM Sans</option>
                          <option value="IBM Plex Mono">IBM Plex Mono</option>
                        </select>
                        <ChevronDown size={14} />
                      </label>
                      <label className="select-wrap small-select">
                        <span className="field-label">粗細</span>
                        <select value={selectedText.fontWeight} onChange={(event) => updateTextLayer({ fontWeight: Number(event.target.value) })}>
                          <option value={400}>Regular</option>
                          <option value={500}>Medium</option>
                          <option value={700}>Bold</option>
                        </select>
                        <ChevronDown size={14} />
                      </label>
                    </div>
                    <div className="color-row text-color-row">
                      <span className="field-label">文字顏色</span>
                      <label className="color-picker">
                        <input type="color" value={selectedText.color} onChange={(event) => updateTextLayer({ color: event.target.value })} aria-label="文字顏色" />
                        <span style={{ backgroundColor: selectedText.color }} />
                      </label>
                    </div>
                    <RangeControl label="字級" value={selectedText.fontSize} min={12} max={180} suffix=" px" onChange={(value) => updateTextLayer({ fontSize: value })} />
                    <RangeControl label="不透明度" value={selectedText.opacity} min={1} max={100} suffix="%" onChange={(value) => updateTextLayer({ opacity: value })} />
                    <div className="text-actions">
                      <button type="button" className="secondary-button full-width" onClick={deleteSelectedText}><Trash2 size={14} /> 移除文字卡</button>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="inspector-divider" />

            <div className="inspector-section">
              <SectionTitle eyebrow="CANVAS" title="畫布尺寸" action={<Maximize2 size={15} className="section-icon" />} />
              <div className="dimension-grid">
                <label><span>寬度</span><input id="canvas-width" type="number" min={240} max={2400} defaultValue={canvasSize.width} key={`width-${canvasSize.width}`} /></label>
                <span className="dimension-mark">×</span>
                <label><span>高度</span><input id="canvas-height" type="number" min={180} max={1800} defaultValue={canvasSize.height} key={`height-${canvasSize.height}`} /></label>
              </div>
              <button type="button" className="secondary-button full-width" onClick={resizeCanvas}>套用新尺寸</button>
              <div className="canvas-meta"><span>比例</span><span className="mono-value">{(canvasSize.width / canvasSize.height).toFixed(2)} : 1</span></div>
            </div>

            <div className="inspector-divider" />

            <div className="inspector-section">
              <SectionTitle eyebrow="IMAGE ADJUSTMENTS" title="影像調整" action={<SlidersHorizontal size={15} className="section-icon" />} />
              <RangeControl label="曝光" value={adjustments.exposure} min={-60} max={60} suffix="%" onChange={(value) => setAdjustments((current) => ({ ...current, exposure: value }))} />
              <RangeControl label="對比" value={adjustments.contrast} min={-60} max={60} suffix="%" onChange={(value) => setAdjustments((current) => ({ ...current, contrast: value }))} />
              <RangeControl label="飽和度" value={adjustments.saturation} min={0} max={200} suffix="%" onChange={(value) => setAdjustments((current) => ({ ...current, saturation: value }))} />
              <RangeControl label="不透明度" value={adjustments.opacity} min={1} max={100} suffix="%" onChange={(value) => setAdjustments((current) => ({ ...current, opacity: value }))} />
              <button type="button" className="link-button" onClick={resetAdjustments}><RotateCcw size={13} /> 重設所有調整</button>
            </div>

            <div className="inspector-divider" />

            <div className="inspector-section remove-bg-section">
              <div className="remove-bg-heading">
                <div>
                  <span className="eyebrow">QUICK CUTOUT</span>
                  <h3>簡易去背</h3>
                </div>
                <WandSparkles size={17} />
              </div>
              <img className="inspector-swatch-image" src="/manus-storage/inspector-paper-texture_3e8b73b5.png" alt="紙張色彩樣本" />
              <p className="field-help">以畫布左上角的顏色作為背景基準，移除與它相近且連續的區域。</p>
              <RangeControl label="色彩容差" value={adjustments.backgroundTolerance} min={4} max={90} onChange={(value) => setAdjustments((current) => ({ ...current, backgroundTolerance: value }))} />
              <button type="button" className={`secondary-button full-width ${backgroundRemoved ? "is-complete" : ""}`} onClick={removeBackground}>
                {backgroundRemoved ? <Check size={14} /> : <WandSparkles size={14} />} {backgroundRemoved ? "已完成去背" : "移除背景色"}
              </button>
            </div>

            <div className="inspector-divider" />

            <div className="inspector-tip">
              <Sparkles size={15} />
              <p><strong>小提示</strong>　按 <kbd>B</kbd> 切換筆刷，按 <kbd>T</kbd> 選擇文字卡。</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
