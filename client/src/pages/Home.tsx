/*
  Design reminder — 紙上工作室 / New Modern Craft:
  畫布是唯一主角；石墨黑工作台、暖紙白畫布與印刷朱砂 #E4513B 建立操作階層。
  左側工具 rail、中央工作區、右側 inspector 維持非對稱工作台；互動快速、可逆、可理解。
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  AlignCenter,
  AlignVerticalJustifyCenter,
  Check,
  ChevronDown,
  Circle,
  Download,
  Eraser,
  Heart,
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
  Shapes,
  Square,
  Star,
  Triangle,
  Pentagon,
  Trash2,
  Type,
  Undo2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

type Tool = "brush" | "eraser" | "fill" | "text" | "shape" | "retouch";
type ShapeKind = "rectangle" | "circle" | "star" | "heart" | "triangle" | "pentagon";
type ShapeResizeAxis = "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";

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
  fontFamily: "Noto Sans TC" | "Noto Serif TC" | "Noto Sans JP" | "Noto Serif JP" | "Zen Kaku Gothic New" | "DM Sans" | "IBM Plex Mono";
  anchorShapeId?: string;
};

type ShapeLayer = {
  id: string;
  kind: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
  rotation: number;
  fill: string;
  opacity: number;
  outline: string;
  outlineWidth: number;
  shadow: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowX: number;
  shadowY: number;
};

type HistoryItem = {
  width: number;
  height: number;
  imageData: ImageData;
  layers: TextLayer[];
  shapes: ShapeLayer[];
};

type Adjustments = {
  exposure: number;
  contrast: number;
  saturation: number;
  opacity: number;
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

const makeId = (prefix = "layer") => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
const STAR_POINTS = "50,4 61,37 96,38 68,59 78,94 50,74 22,94 32,59 4,38 39,37";
const TRIANGLE_POINTS = "50,5 94,90 6,90";
const PENTAGON_POINTS = "50,4 97,38 79,94 21,94 3,38";
const SHAPE_LABELS: Record<ShapeKind, string> = {
  rectangle: "方塊",
  circle: "圓形",
  star: "星星",
  heart: "愛心",
  triangle: "三角形",
  pentagon: "五邊形",
};

const hexToRgba = (hex: string, opacity: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

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
  const shapeDragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const shapeResizeRef = useRef<{
    id: string;
    axis: ShapeResizeAxis;
    startPointX: number;
    startPointY: number;
    startWidth: number;
    startHeight: number;
    startX: number;
    startY: number;
    aspectRatio: number;
  } | null>(null);
  const shapeRotateRef = useRef<{
    id: string;
    centerX: number;
    centerY: number;
    startAngle: number;
    startRotation: number;
  } | null>(null);
  const historyRef = useRef<HistoryItem[]>([]);
  const historyIndexRef = useRef(-1);
  const layersRef = useRef<TextLayer[]>([]);
  const shapesRef = useRef<ShapeLayer[]>([]);

  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 640 });
  const [tool, setTool] = useState<Tool>("brush");
  const [brushColor, setBrushColor] = useState(BRAND_RED);
  const [brushSize, setBrushSize] = useState(18);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [zoom, setZoom] = useState(68);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasArtwork, setHasArtwork] = useState(false);
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [shapes, setShapes] = useState<ShapeLayer[]>([]);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rectangle");
  const [shapeFill, setShapeFill] = useState(BRAND_RED);
  const [shapeOutline, setShapeOutline] = useState("#FFFDF8");
  const [shapeOutlineWidth, setShapeOutlineWidth] = useState(2);
  const [shapeShadow, setShapeShadow] = useState(true);
  const [adjustments, setAdjustments] = useState<Adjustments>({
    exposure: 0,
    contrast: 0,
    saturation: 100,
    opacity: 100,
  });
  const [fileMeta, setFileMeta] = useState({ name: "未命名畫布", size: "—" });
  const [documentNameDraft, setDocumentNameDraft] = useState("未命名畫布");
  const clipboardTextRef = useRef<TextLayer | null>(null);
  const panDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const selectedText = useMemo(
    () => layers.find((layer) => layer.id === selectedTextId) ?? null,
    [layers, selectedTextId],
  );
  const selectedShape = useMemo(
    () => shapes.find((shape) => shape.id === selectedShapeId) ?? null,
    [shapes, selectedShapeId],
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

  const syncShapes = useCallback((nextShapes: ShapeLayer[]) => {
    shapesRef.current = nextShapes;
    setShapes(nextShapes);
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
      shapes: shapesRef.current.map((shape) => ({ ...shape })),
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
      syncShapes(item.shapes?.map((shape) => ({ ...shape })) ?? []);
      setSelectedTextId(null);
      setSelectedShapeId(null);
      historyIndexRef.current = index;
    },
    [syncLayers, syncShapes],
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
      const shapeDrag = shapeDragRef.current;
      const resize = shapeResizeRef.current;
      const rotate = shapeRotateRef.current;
      const point = getCanvasPoint(event.clientX, event.clientY);
      if (rotate) {
        const currentAngle = Math.atan2(point.y - rotate.centerY, point.x - rotate.centerX);
        let nextRotation = rotate.startRotation + ((currentAngle - rotate.startAngle) * 180) / Math.PI;
        if (event.shiftKey) nextRotation = Math.round(nextRotation / 15) * 15;
        syncShapes(shapesRef.current.map((shape) => shape.id === rotate.id ? { ...shape, rotation: nextRotation } : shape));
        return;
      }
      if (resize) {
        const nextShapes = shapesRef.current.map((shape) => {
          if (shape.id !== resize.id) return shape;
          const deltaX = point.x - resize.startPointX;
          const deltaY = point.y - resize.startPointY;
          const movesLeft = resize.axis.includes("left");
          const movesRight = resize.axis.includes("right");
          const movesTop = resize.axis.includes("top");
          const movesBottom = resize.axis.includes("bottom");
          let nextWidth = movesLeft ? resize.startWidth - deltaX : movesRight ? resize.startWidth + deltaX : resize.startWidth;
          let nextHeight = movesTop ? resize.startHeight - deltaY : movesBottom ? resize.startHeight + deltaY : resize.startHeight;
          if (event.shiftKey) {
            if (movesLeft || movesRight) nextHeight = nextWidth / resize.aspectRatio;
            if (movesTop || movesBottom) nextWidth = nextHeight * resize.aspectRatio;
          }
          const centerX = resize.startX + resize.startWidth / 2;
          const centerY = resize.startY + resize.startHeight / 2;
          const maxCenteredWidth = Math.max(60, Math.min(canvasSize.width, centerX * 2, (canvasSize.width - centerX) * 2));
          const maxCenteredHeight = Math.max(60, Math.min(canvasSize.height, centerY * 2, (canvasSize.height - centerY) * 2));
          nextWidth = clamp(nextWidth, 60, event.altKey ? maxCenteredWidth : canvasSize.width);
          nextHeight = clamp(nextHeight, 60, event.altKey ? maxCenteredHeight : canvasSize.height);
          const nextX = event.altKey ? centerX - nextWidth / 2 : movesLeft ? resize.startX + resize.startWidth - nextWidth : resize.startX;
          const nextY = event.altKey ? centerY - nextHeight / 2 : movesTop ? resize.startY + resize.startHeight - nextHeight : resize.startY;
          return {
            ...shape,
            width: nextWidth,
            height: nextHeight,
            x: clamp(nextX, 0, canvasSize.width - nextWidth),
            y: clamp(nextY, 0, canvasSize.height - nextHeight),
            cornerRadius: Math.min(shape.cornerRadius, Math.min(nextWidth, nextHeight) / 2),
          };
        });
        syncShapes(nextShapes);
        return;
      }
      if (drag) {
        const nextLayers = layersRef.current.map((layer) =>
          layer.id === drag.id
            ? { ...layer, x: clamp(point.x - drag.offsetX, 0, canvasSize.width - 30), y: clamp(point.y - drag.offsetY, 0, canvasSize.height - 30) }
            : layer,
        );
        syncLayers(nextLayers);
      }
      if (shapeDrag) {
        const nextShapes = shapesRef.current.map((shape) =>
          shape.id === shapeDrag.id
            ? { ...shape, x: clamp(point.x - shapeDrag.offsetX, 0, canvasSize.width - shape.width), y: clamp(point.y - shapeDrag.offsetY, 0, canvasSize.height - shape.height) }
            : shape,
        );
        syncShapes(nextShapes);
      }
    };
    const handleUp = () => {
      if (!textDragRef.current && !shapeDragRef.current && !shapeResizeRef.current && !shapeRotateRef.current) return;
      textDragRef.current = null;
      shapeDragRef.current = null;
      shapeResizeRef.current = null;
      shapeRotateRef.current = null;
      captureHistory();
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [canvasSize.height, canvasSize.width, captureHistory, getCanvasPoint, syncLayers, syncShapes]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable) return;
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      if (key === "delete" || key === "backspace") {
        if (selectedTextId || selectedShapeId) {
          event.preventDefault();
          if (selectedTextId) deleteSelectedText(); else deleteSelectedShape();
        }
        return;
      }
      if (modifier && key === "z") {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
        return;
      }
      if (modifier && key === "c") {
        event.preventDefault();
        void copySelection();
        return;
      }
      if (modifier && key === "v") {
        event.preventDefault();
        void pasteSelection();
        return;
      }
      if (key === "b") setTool("brush");
      if (key === "e") setTool("eraser");
      if (key === "f") setTool("fill");
      if (key === "t") setTool("text");
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [selectedShapeId, selectedTextId]);

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

  const healSpot = (point: CanvasPoint) => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const radius = Math.max(5, brushSize * 1.2);
    const image = context.getImageData(0, 0, canvas.width, canvas.height);
    const samples: number[] = [];
    for (let index = 0; index < 12; index += 1) {
      const angle = (index / 12) * Math.PI * 2;
      const x = clamp(Math.round(point.x + Math.cos(angle) * radius * 1.35), 0, canvas.width - 1);
      const y = clamp(Math.round(point.y + Math.sin(angle) * radius * 1.35), 0, canvas.height - 1);
      samples.push((y * canvas.width + x) * 4);
    }
    const average = [0, 0, 0, 0];
    samples.forEach((index) => {
      average[0] += image.data[index];
      average[1] += image.data[index + 1];
      average[2] += image.data[index + 2];
      average[3] += image.data[index + 3];
    });
    average.forEach((_value, index) => { average[index] /= samples.length; });
    const minX = Math.max(0, Math.floor(point.x - radius));
    const maxX = Math.min(canvas.width - 1, Math.ceil(point.x + radius));
    const minY = Math.max(0, Math.floor(point.y - radius));
    const maxY = Math.min(canvas.height - 1, Math.ceil(point.y + radius));
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const distance = Math.hypot(x - point.x, y - point.y);
        if (distance > radius) continue;
        const index = (y * canvas.width + x) * 4;
        const strength = 1 - distance / radius;
        image.data[index] = image.data[index] * (1 - strength) + average[0] * strength;
        image.data[index + 1] = image.data[index + 1] * (1 - strength) + average[1] * strength;
        image.data[index + 2] = image.data[index + 2] * (1 - strength) + average[2] * strength;
        image.data[index + 3] = image.data[index + 3] * (1 - strength) + average[3] * strength;
      }
    }
    context.putImageData(image, 0, 0);
    setHasArtwork(true);
  };

  const addShape = (kind: ShapeKind = shapeKind) => {
    const width = ["star", "heart", "pentagon"].includes(kind) ? 190 : 220;
    const height = ["star", "heart", "pentagon"].includes(kind) ? 190 : 150;
    const nextShape: ShapeLayer = {
      id: makeId("shape"),
      kind,
      x: (canvasSize.width - width) / 2,
      y: (canvasSize.height - height) / 2,
      width,
      height,
      cornerRadius: kind === "rectangle" ? 12 : 0,
      rotation: 0,
      fill: shapeFill,
      opacity: 100,
      outline: shapeOutline,
      outlineWidth: shapeOutlineWidth,
      shadow: shapeShadow,
      shadowColor: "#000000",
      shadowOpacity: 28,
      shadowBlur: 14,
      shadowX: 0,
      shadowY: 8,
    };
    const nextShapes = [...shapesRef.current, nextShape];
    syncShapes(nextShapes);
    setSelectedShapeId(nextShape.id);
    setSelectedTextId(null);
    setTool("shape");
    captureHistory();
    toast.success(`${SHAPE_LABELS[kind]} 已加入畫布`);
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (tool === "fill") {
      floodFill(point);
      return;
    }
    if (tool === "shape") {
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
      setSelectedShapeId(null);
      setTool("brush");
      captureHistory();
      toast.success("文字卡已加入畫布");
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDrawing(true);
    setHasArtwork(true);
    lastPointRef.current = point;
    if (tool === "retouch") {
      healSpot(point);
    } else {
      drawStroke(point, { x: point.x + 0.01, y: point.y + 0.01 });
    }
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (tool === "retouch") {
      healSpot(point);
    } else {
      drawStroke(lastPointRef.current, point);
    }
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
    const anchorShape = selectedShapeId ? shapesRef.current.find((shape) => shape.id === selectedShapeId) : undefined;
    const nextLayer: TextLayer = {
      id: makeId("text"),
      text: "標題文字",
      x: anchorShape ? anchorShape.x + anchorShape.width / 2 - 90 : canvasSize.width * 0.16,
      y: anchorShape ? anchorShape.y + anchorShape.height / 2 - 32 : canvasSize.height * 0.18,
      fontSize: 64,
      fontWeight: 700,
      color: BRAND_RED,
      opacity: 100,
      fontFamily: "DM Sans",
      anchorShapeId: anchorShape?.id,
    };
    const nextLayers = [...layersRef.current, nextLayer];
    syncLayers(nextLayers);
    setSelectedTextId(nextLayer.id);
    toast.success("已新增文字卡，現在可以直接編輯");
    captureHistory();
  };

  const copySelection = async () => {
    if (!selectedText) {
      toast.info("請先選取文字卡");
      return;
    }
    clipboardTextRef.current = { ...selectedText };
    try {
      await navigator.clipboard?.writeText(selectedText.text);
    } catch {
      // 瀏覽器未授權 clipboard 時仍保留工作台內部複製內容。
    }
    toast.success("文字卡已複製");
  };

  const pasteSelection = async () => {
    let clipboardText = "";
    try {
      clipboardText = (await navigator.clipboard?.readText()) ?? "";
    } catch {
      // 使用工作台內部剪貼簿作為 fallback。
    }
    const source = clipboardTextRef.current;
    if (!source && !clipboardText) {
      toast.info("請先複製文字卡，或將文字複製到剪貼簿");
      return;
    }
    const nextLayer: TextLayer = {
      ...(source ?? {
        id: makeId("text"),
        text: clipboardText,
        x: canvasSize.width * 0.2,
        y: canvasSize.height * 0.2,
        fontSize: 52,
        fontWeight: 700,
        color: GRAPHITE,
        opacity: 100,
        fontFamily: "Noto Sans TC" as TextLayer["fontFamily"],
      }),
      id: makeId("text"),
      text: clipboardText || source?.text || "貼上的文字",
      x: (source?.x ?? canvasSize.width * 0.2) + 24,
      y: (source?.y ?? canvasSize.height * 0.2) + 24,
      anchorShapeId: undefined,
    };
    syncLayers([...layersRef.current, nextLayer]);
    setSelectedTextId(nextLayer.id);
    setSelectedShapeId(null);
    captureHistory();
    toast.success("文字卡已貼上");
  };

  const deleteSelectedText = () => {
    if (!selectedTextId) return;
    syncLayers(layersRef.current.filter((layer) => layer.id !== selectedTextId));
    setSelectedTextId(null);
    captureHistory();
    toast.success("文字卡已移除");
  };

  const updateShape = (patch: Partial<ShapeLayer>) => {
    if (!selectedShapeId) return;
    const nextShapes = shapesRef.current.map((shape) =>
      shape.id === selectedShapeId ? { ...shape, ...patch } : shape,
    );
    syncShapes(nextShapes);
  };

  const deleteSelectedShape = () => {
    if (!selectedShapeId) return;
    syncShapes(shapesRef.current.filter((shape) => shape.id !== selectedShapeId));
    syncLayers(layersRef.current.map((layer) => (
      layer.anchorShapeId === selectedShapeId ? { ...layer, anchorShapeId: undefined } : layer
    )));
    setSelectedShapeId(null);
    captureHistory();
    toast.success("圖形已移除");
  };

  const alignSelected = (axis: "horizontal" | "vertical" | "both") => {
    if (selectedShape) {
      updateShape({
        ...(axis === "horizontal" || axis === "both" ? { x: (canvasSize.width - selectedShape.width) / 2 } : {}),
        ...(axis === "vertical" || axis === "both" ? { y: (canvasSize.height - selectedShape.height) / 2 } : {}),
      });
      captureHistory();
      return;
    }
    if (!selectedText) return;
    const anchor = selectedText.anchorShapeId ? shapesRef.current.find((shape) => shape.id === selectedText.anchorShapeId) : undefined;
    const target = anchor ?? { x: 0, y: 0, width: canvasSize.width, height: canvasSize.height };
    const estimatedWidth = Math.max(48, selectedText.text.length * selectedText.fontSize * 0.58);
    updateTextLayer({
      ...(axis === "horizontal" || axis === "both" ? { x: target.x + (target.width - estimatedWidth) / 2 } : {}),
      ...(axis === "vertical" || axis === "both" ? { y: target.y + (target.height - selectedText.fontSize) / 2 } : {}),
    });
    captureHistory();
  };

  const resizeCanvas = () => {
    const widthInput = document.getElementById("canvas-width") as HTMLInputElement | null;
    const heightInput = document.getElementById("canvas-height") as HTMLInputElement | null;
    const nextWidth = clamp(Number(widthInput?.value) || canvasSize.width, 240, 2400);
    const nextHeight = clamp(Number(heightInput?.value) || canvasSize.height, 180, 1800);
    const previousDisplayWidth = canvasSize.width * (zoom / 100);
    const previousDisplayHeight = canvasSize.height * (zoom / 100);
    const nextDisplayWidth = nextWidth * (zoom / 100);
    const nextDisplayHeight = nextHeight * (zoom / 100);
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
    syncShapes(
      shapesRef.current.map((shape) => ({
        ...shape,
        x: shape.x * scaleX,
        y: shape.y * scaleY,
        width: shape.width * scaleX,
        height: shape.height * scaleY,
        outlineWidth: shape.outlineWidth * Math.min(scaleX, scaleY),
        shadowBlur: shape.shadowBlur * Math.min(scaleX, scaleY),
        shadowX: shape.shadowX * scaleX,
        shadowY: shape.shadowY * scaleY,
      })),
    );
    setCanvasSize({ width: nextWidth, height: nextHeight });
    setPan((currentPan) => ({
      x: currentPan.x + (nextDisplayWidth - previousDisplayWidth) / 2,
      y: currentPan.y + (nextDisplayHeight - previousDisplayHeight) / 2,
    }));
    setFileMeta((meta) => ({ ...meta, size: `${nextWidth} × ${nextHeight}` }));
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
    const threshold = 32;
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
    captureHistory();
    toast.success("已移除與左上角相近的背景色");
  };

  const resetAdjustments = () => {
    setAdjustments({
      exposure: 0,
      contrast: 0,
      saturation: 100,
      opacity: 100,
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
      const previousDisplayWidth = canvasSize.width * (zoom / 100);
      const previousDisplayHeight = canvasSize.height * (zoom / 100);
      const nextDisplayWidth = width * (zoom / 100);
      const nextDisplayHeight = height * (zoom / 100);
      setPan((currentPan) => ({
        x: currentPan.x + (nextDisplayWidth - previousDisplayWidth) / 2,
        y: currentPan.y + (nextDisplayHeight - previousDisplayHeight) / 2,
      }));
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(image, 0, 0, width, height);
      setCanvasSize({ width, height });
      setFileMeta({ name: file.name, size: formatBytes(file.size) });
      setDocumentNameDraft(file.name);
      syncLayers([]);
      syncShapes([]);
      setSelectedTextId(null);
      setSelectedShapeId(null);
      setHasArtwork(true);
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
    shapesRef.current.forEach((shape) => {
      context.save();
      context.globalAlpha = (adjustments.opacity / 100) * (shape.opacity / 100);
      if (shape.shadow) {
        context.shadowColor = hexToRgba(shape.shadowColor, shape.shadowOpacity / 100);
        context.shadowBlur = shape.shadowBlur;
        context.shadowOffsetX = shape.shadowX;
        context.shadowOffsetY = shape.shadowY;
      }
      context.fillStyle = shape.fill;
      context.strokeStyle = shape.outline;
      context.lineWidth = shape.outlineWidth;
      context.translate(shape.x + shape.width / 2, shape.y + shape.height / 2);
      context.rotate((shape.rotation * Math.PI) / 180);
      context.beginPath();
      if (shape.kind === "rectangle") {
        context.roundRect(-shape.width / 2, -shape.height / 2, shape.width, shape.height, Math.min(shape.cornerRadius, Math.min(shape.width, shape.height) / 2));
      } else if (shape.kind === "circle") {
        context.ellipse(0, 0, shape.width / 2, shape.height / 2, 0, 0, Math.PI * 2);
      } else {
        if (shape.kind === "heart") {
          const w = shape.width; const h = shape.height; const x = -w / 2; const y = -h / 2;
          context.moveTo(0, y + h * 0.9);
          context.bezierCurveTo(x + w * 0.06, y + h * 0.62, x + w * 0.12, y + h * 0.16, x + w * 0.34, y + h * 0.2);
          context.bezierCurveTo(x + w * 0.45, y + h * 0.22, x + w * 0.49, y + h * 0.34, 0, y + h * 0.42);
          context.bezierCurveTo(x + w * 0.51, y + h * 0.34, x + w * 0.55, y + h * 0.22, x + w * 0.66, y + h * 0.2);
          context.bezierCurveTo(x + w * 0.88, y + h * 0.16, x + w * 0.94, y + h * 0.62, 0, y + h * 0.9);
          context.closePath();
        } else {
          const sides = shape.kind === "triangle" ? 3 : shape.kind === "pentagon" ? 5 : 10;
          for (let index = 0; index < sides; index += 1) {
            const angle = -Math.PI / 2 + (index * Math.PI * 2) / sides;
            const radius = shape.kind === "star" ? (index % 2 === 0 ? 0.48 : 0.22) : 0.46;
            const x = Math.cos(angle) * shape.width * radius;
            const y = Math.sin(angle) * shape.height * radius;
            if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
          }
          context.closePath();
        }
      }
      context.fill();
      if (shape.outlineWidth > 0) context.stroke();
      context.restore();
    });
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

  const saveDocumentName = (value: string) => {
    const nextName = value.trim() || "未命名畫布";
    setDocumentNameDraft(nextName);
    setFileMeta((meta) => ({ ...meta, name: nextName }));
  };

  const handleTextPointerDown = (event: ReactPointerEvent<HTMLDivElement>, layer: TextLayer) => {
    event.stopPropagation();
    const point = getCanvasPoint(event.clientX, event.clientY);
    setSelectedTextId(layer.id);
    setSelectedShapeId(null);
    textDragRef.current = {
      id: layer.id,
      offsetX: point.x - layer.x,
      offsetY: point.y - layer.y,
    };
  };

  const handleShapePointerDown = (event: ReactPointerEvent<SVGSVGElement>, shape: ShapeLayer) => {
    event.stopPropagation();
    if ((event.target as Element).classList.contains("shape-resize-handle")) return;
    const point = getCanvasPoint(event.clientX, event.clientY);
    setSelectedShapeId(shape.id);
    setSelectedTextId(null);
    shapeDragRef.current = {
      id: shape.id,
      offsetX: point.x - shape.x,
      offsetY: point.y - shape.y,
    };
  };

  const handleShapeResizePointerDown = (event: ReactPointerEvent<SVGRectElement>, shape: ShapeLayer, axis: ShapeResizeAxis) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event.clientX, event.clientY);
    setSelectedShapeId(shape.id);
    setSelectedTextId(null);
    textDragRef.current = null;
    shapeDragRef.current = null;
    shapeResizeRef.current = {
      id: shape.id,
      axis,
      startPointX: point.x,
      startPointY: point.y,
      startWidth: shape.width,
      startHeight: shape.height,
      startX: shape.x,
      startY: shape.y,
      aspectRatio: shape.width / Math.max(1, shape.height),
    };
  };

  const handleShapeRotatePointerDown = (event: ReactPointerEvent<SVGCircleElement>, shape: ShapeLayer) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event.clientX, event.clientY);
    const centerX = shape.x + shape.width / 2;
    const centerY = shape.y + shape.height / 2;
    setSelectedShapeId(shape.id);
    setSelectedTextId(null);
    textDragRef.current = null;
    shapeDragRef.current = null;
    shapeResizeRef.current = null;
    shapeRotateRef.current = {
      id: shape.id,
      centerX,
      centerY,
      startAngle: Math.atan2(point.y - centerY, point.x - centerX),
      startRotation: shape.rotation,
    };
  };

  const handleViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || event.target !== event.currentTarget) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panDragRef.current = { startX: event.clientX, startY: event.clientY, originX: pan.x, originY: pan.y };
    setIsPanning(true);
  };

  const handleViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = panDragRef.current;
    if (!drag) return;
    setPan({ x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY });
  };

  const finishPan = () => {
    if (!panDragRef.current) return;
    panDragRef.current = null;
    setIsPanning(false);
  };

  const currentZoomLabel = `${zoom}%`;

  return (
    <main className="studio-app">
      <header className="topbar">
        <div className="brand-lockup">
          <div className="brand-copy">
            <span className="brand-name">CoAi Paint</span>
          </div>
        </div>

        <div className="document-meta">
          <span className="document-kicker">WORKING FILE</span>
          <input
            className="document-name-input"
            value={documentNameDraft}
            onChange={(event) => setDocumentNameDraft(event.target.value)}
            onBlur={(event) => saveDocumentName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                saveDocumentName(event.currentTarget.value);
                event.currentTarget.blur();
              }
            }}
            aria-label="文件名稱"
          />
          <span className="document-size">{fileMeta.size === "—" ? `${canvasSize.width} × ${canvasSize.height}` : fileMeta.size}</span>
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
            <ToolButton label="新增文字" active={tool === "text"} icon={<Type size={18} />} onClick={() => setTool("text")} />
            <ToolButton label="新增圖形" active={tool === "shape"} icon={<Shapes size={18} />} onClick={() => setTool("shape")} />
            <ToolButton label="移除瑕疵" active={tool === "retouch"} icon={<WandSparkles size={18} />} onClick={() => setTool("retouch")} />
          </div>
          <div className="rail-rule" />
          <div className="tool-group rail-secondary">
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
              <span>{tool === "brush" ? "筆刷" : tool === "eraser" ? "橡皮擦" : tool === "fill" ? "填色桶" : tool === "text" ? "文字卡" : tool === "shape" ? "新增圖形" : "移除瑕疵"}</span>
              <span className="tool-hint">{tool === "text" ? "點擊畫布加入文字" : tool === "shape" ? "從右側選擇形狀" : tool === "retouch" ? "在瑕疵上塗抹修補" : "在畫布上落筆"}</span>
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
              <button type="button" className="ghost-button" onClick={() => { setZoom(68); setPan({ x: 0, y: 0 }); }} title="重設視角">
                <Maximize2 size={15} />
              </button>
            </div>
          </div>

          <div
            className={`canvas-viewport ${isPanning ? "is-panning" : ""}`}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={finishPan}
            onPointerCancel={finishPan}
          >
            <div className="stage-notes stage-note-top">PAPER / 01</div>
            <div className="stage-notes stage-note-bottom">{canvasSize.width} × {canvasSize.height}</div>
            <div
              className="canvas-shell-outer"
              style={{
                width: `${canvasSize.width * (zoom / 100)}px`,
                height: `${canvasSize.height * (zoom / 100)}px`,
                transform: `translate(${pan.x}px, ${pan.y}px)`,
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
                  {shapes.map((shape) => (
                    <svg
                      key={shape.id}
                      className={`shape-layer ${selectedShapeId === shape.id ? "is-selected" : ""}`}
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      style={{
                        left: `${shape.x}px`,
                        top: `${shape.y}px`,
                        width: `${shape.width}px`,
                        height: `${shape.height}px`,
                        transform: `rotate(${shape.rotation}deg)`,
                        opacity: shape.opacity / 100,
                        filter: shape.shadow ? `drop-shadow(${shape.shadowX}px ${shape.shadowY}px ${shape.shadowBlur}px ${hexToRgba(shape.shadowColor, shape.shadowOpacity / 100)})` : "none",
                      }}
                      onPointerDown={(event) => handleShapePointerDown(event, shape)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${SHAPE_LABELS[shape.kind]}圖形`}
                    >
                      {shape.kind === "rectangle" && <rect x="3" y="3" width="94" height="94" rx={Math.min(50, (shape.cornerRadius / Math.min(shape.width, shape.height)) * 100)} fill={shape.fill} stroke={shape.outline} strokeWidth={shape.outlineWidth * 0.8} />}
                      {shape.kind === "circle" && <circle cx="50" cy="50" r="46" fill={shape.fill} stroke={shape.outline} strokeWidth={shape.outlineWidth * 0.8} />}
                      {shape.kind === "star" && <polygon points={STAR_POINTS} fill={shape.fill} stroke={shape.outline} strokeWidth={shape.outlineWidth * 0.8} strokeLinejoin="round" />}
                      {shape.kind === "heart" && <path d="M50 88 C44 82 15 65 15 38 C15 18 39 14 50 33 C61 14 85 18 85 38 C85 65 56 82 50 88Z" fill={shape.fill} stroke={shape.outline} strokeWidth={shape.outlineWidth * 0.8} strokeLinejoin="round" />}
                      {shape.kind === "triangle" && <polygon points={TRIANGLE_POINTS} fill={shape.fill} stroke={shape.outline} strokeWidth={shape.outlineWidth * 0.8} strokeLinejoin="round" />}
                      {shape.kind === "pentagon" && <polygon points={PENTAGON_POINTS} fill={shape.fill} stroke={shape.outline} strokeWidth={shape.outlineWidth * 0.8} strokeLinejoin="round" />}
                      {selectedShapeId === shape.id && (
                        <>
                          <rect className="shape-resize-handle shape-resize-handle-left" x="-4" y="43" width="8" height="14" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "left")} />
                          <rect className="shape-resize-handle shape-resize-handle-right" x="96" y="43" width="8" height="14" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "right")} />
                          <rect className="shape-resize-handle shape-resize-handle-top" x="43" y="-4" width="14" height="8" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "top")} />
                          <rect className="shape-resize-handle shape-resize-handle-bottom" x="43" y="96" width="14" height="8" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "bottom")} />
                          <rect className="shape-resize-handle shape-resize-handle-corner shape-resize-handle-top-left" x="-6" y="-6" width="12" height="12" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "top-left")} />
                          <rect className="shape-resize-handle shape-resize-handle-corner shape-resize-handle-top-right" x="94" y="-6" width="12" height="12" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "top-right")} />
                          <rect className="shape-resize-handle shape-resize-handle-corner shape-resize-handle-bottom-left" x="-6" y="94" width="12" height="12" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "bottom-left")} />
                          <rect className="shape-resize-handle shape-resize-handle-corner shape-resize-handle-bottom-right" x="94" y="94" width="12" height="12" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "bottom-right")} />
                          <line className="shape-rotation-stem" x1="50" y1="0" x2="50" y2="-16" />
                          <circle className="shape-rotation-handle" cx="50" cy="-24" r="7" onPointerDown={(event) => handleShapeRotatePointerDown(event, shape)} />
                          <text className="shape-rotation-label" x="50" y="-34" textAnchor="middle">{Math.round(shape.rotation)}°</text>
                        </>
                      )}
                    </svg>
                  ))}
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

            {tool !== "text" && !selectedText && !selectedShape && (
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

            {(tool === "shape" || selectedShape) && (
              <div className="inspector-section shape-inspector-section">
                <SectionTitle eyebrow="SHAPES" title="圖形設定" action={<Shapes size={15} className="section-icon" />} />
                <div className="shape-choice-grid">
                  <button type="button" className={`shape-choice ${shapeKind === "rectangle" ? "is-active" : ""}`} onClick={() => { setShapeKind("rectangle"); addShape("rectangle"); }}><Square size={18} /><span>方塊</span></button>
                  <button type="button" className={`shape-choice ${shapeKind === "circle" ? "is-active" : ""}`} onClick={() => { setShapeKind("circle"); addShape("circle"); }}><Circle size={18} /><span>圓形</span></button>
                  <button type="button" className={`shape-choice ${shapeKind === "star" ? "is-active" : ""}`} onClick={() => { setShapeKind("star"); addShape("star"); }}><Star size={18} /><span>星星</span></button>
                  <button type="button" className={`shape-choice ${shapeKind === "heart" ? "is-active" : ""}`} onClick={() => { setShapeKind("heart"); addShape("heart"); }}><Heart size={18} /><span>愛心</span></button>
                  <button type="button" className={`shape-choice ${shapeKind === "triangle" ? "is-active" : ""}`} onClick={() => { setShapeKind("triangle"); addShape("triangle"); }}><Triangle size={18} /><span>三角形</span></button>
                  <button type="button" className={`shape-choice ${shapeKind === "pentagon" ? "is-active" : ""}`} onClick={() => { setShapeKind("pentagon"); addShape("pentagon"); }}><Pentagon size={18} /><span>五邊形</span></button>
                </div>
                {!selectedShape && <p className="empty-inspector">選擇圖形或按上方按鈕，把形狀放到畫布中央。</p>}
                {selectedShape && (
                  <>
                    <div className="color-row"><span className="field-label">填色</span><label className="color-picker"><input type="color" value={selectedShape.fill} onChange={(event) => updateShape({ fill: event.target.value })} aria-label="圖形填色" /><span style={{ backgroundColor: selectedShape.fill }} /></label></div>
                    <div className="color-row"><span className="field-label">輪廓</span><label className="color-picker"><input type="color" value={selectedShape.outline} onChange={(event) => updateShape({ outline: event.target.value })} aria-label="圖形輪廓顏色" /><span style={{ backgroundColor: selectedShape.outline }} /></label></div>
                    <RangeControl label="輪廓粗細" value={selectedShape.outlineWidth} min={0} max={16} suffix=" px" onChange={(value) => updateShape({ outlineWidth: value })} />
                    {selectedShape.kind === "rectangle" && <RangeControl label="圓角半徑" value={selectedShape.cornerRadius} min={0} max={Math.max(1, Math.floor(Math.min(selectedShape.width, selectedShape.height) / 2))} suffix=" px" onChange={(value) => updateShape({ cornerRadius: value })} />}
                    <div className="shape-rotation-readout"><span className="field-label">旋轉角度</span><span className="mono-value">{Math.round(selectedShape.rotation)}°</span></div>
                    <RangeControl label="圖形不透明度" value={selectedShape.opacity} min={1} max={100} suffix="%" onChange={(value) => updateShape({ opacity: value })} />
                    <label className="toggle-row"><span>陰影</span><input type="checkbox" checked={selectedShape.shadow} onChange={(event) => updateShape({ shadow: event.target.checked })} /></label>
                    {selectedShape.shadow && <RangeControl label="陰影柔化" value={selectedShape.shadowBlur} min={0} max={40} suffix=" px" onChange={(value) => updateShape({ shadowBlur: value })} />}
                    <div className="align-actions"><span className="field-label">置中對齊</span><div className="align-button-row"><button type="button" className="secondary-button" onClick={() => alignSelected("horizontal")}><AlignCenter size={14} /> 水平</button><button type="button" className="secondary-button" onClick={() => alignSelected("vertical")}><AlignVerticalJustifyCenter size={14} /> 垂直</button><button type="button" className="secondary-button" onClick={() => alignSelected("both")}>中央</button></div></div>
                    <button type="button" className="secondary-button full-width" onClick={deleteSelectedShape}><Trash2 size={14} /> 移除圖形</button>
                  </>
                )}
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
                          <option value="Noto Sans TC">思源黑體／Noto Sans TC</option>
                          <option value="Noto Serif TC">思源宋體／Noto Serif TC</option>
                          <option value="Noto Sans JP">Noto Sans JP（日文黑體）</option>
                          <option value="Noto Serif JP">Noto Serif JP（日文明朝體）</option>
                          <option value="Zen Kaku Gothic New">Zen Kaku Gothic New（日文）</option>
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
                    <div className="text-color-control">
                      <div className="text-color-heading">
                        <span className="field-label">文字顏色</span>
                        <label className="color-picker compact-color-picker">
                          <input type="color" value={selectedText.color} onChange={(event) => updateTextLayer({ color: event.target.value })} aria-label="自訂文字顏色" />
                          <span style={{ backgroundColor: selectedText.color }} />
                        </label>
                      </div>
                      <div className="text-palette" role="group" aria-label="文字顏色色票">
                        {["#000000", "#1F2528", "#555B5D", "#8C9290", "#FFFFFF", "#FFFDF8", "#E4513B", "#B72F34", "#F07C41", "#D59B42", "#F4C95D", "#2F855A", "#82A480", "#426B8A", "#2D5B9B", "#8B5CF6", "#D26A9C", "#F3A6C8"].map((color) => (
                          <button key={color} type="button" className={`text-swatch ${selectedText.color.toUpperCase() === color ? "is-selected" : ""}`} style={{ backgroundColor: color }} onClick={() => updateTextLayer({ color })} aria-label={`文字顏色 ${color}`} title={color} />
                        ))}
                      </div>
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

          </div>
        </aside>
      </div>
    </main>
  );
}
