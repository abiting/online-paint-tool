/*
  Design reminder — 紙上工作室 / New Modern Craft:
  畫布是唯一主角；石墨黑工作台、暖紙白畫布與印刷朱砂 #E4513B 建立操作階層。
  左側工具 rail、中央工作區、右側 inspector 維持非對稱工作台；互動快速、可逆、可理解。
*/

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
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
  Move,
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

type Tool = "brush" | "eraser" | "fill" | "text" | "shape" | "retouch" | "move";
type DesktopCreativeTool = Extract<Tool, "brush" | "shape" | "text">;
type BrushKind = "oil" | "pencil" | "watercolor";
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
  exposure: number;
  contrast: number;
  saturation: number;
  fontFamily: "Noto Sans TC" | "Noto Serif TC" | "DFKai-SB" | "PMingLiU" | "Arial" | "DM Sans" | "IBM Plex Mono" | "Kaisei Decol" | "Klee One" | "Kosugi Maru" | "M PLUS Rounded 1c" | "Noto Sans JP" | "Noto Serif JP" | "Shippori Mincho" | "Times New Roman" | "Yomogi" | "Zen Kaku Gothic New";
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
  exposure: number;
  contrast: number;
  saturation: number;
  outline: string;
  outlineWidth: number;
  shadow: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowX: number;
  shadowY: number;
};

type ImageLayer = {
  id: string;
  name: string;
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  exposure: number;
  contrast: number;
  saturation: number;
};

type BrushStroke = {
  id: string;
  points: CanvasPoint[];
  x: number;
  y: number;
  color: string;
  size: number;
  opacity: number;
  kind: BrushKind;
};

type SnapGuides = {
  x: number | null;
  y: number | null;
};

type HistoryItem = {
  width: number;
  height: number;
  imageData: ImageData;
  layers: TextLayer[];
  shapes: ShapeLayer[];
  images: ImageLayer[];
  strokes: BrushStroke[];
};

type Adjustments = {
  exposure: number;
  contrast: number;
  saturation: number;
  opacity: number;
};
type AdjustmentPatch = Partial<Adjustments>;

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
const TEXT_FONT_OPTIONS: Array<{ value: TextLayer["fontFamily"]; label: string }> = [
  { value: "Noto Sans TC", label: "思源黑體" },
  { value: "Noto Serif TC", label: "思源宋體" },
  { value: "PMingLiU", label: "新細明體" },
  { value: "DFKai-SB", label: "標楷體" },
  { value: "Arial", label: "Arial" },
  { value: "DM Sans", label: "DM Sans" },
  { value: "IBM Plex Mono", label: "IBM Plex Mono" },
  { value: "Kaisei Decol", label: "Kaisei Decol" },
  { value: "Klee One", label: "Klee One" },
  { value: "Kosugi Maru", label: "Kosugi Maru" },
  { value: "M PLUS Rounded 1c", label: "M PLUS Rounded 1c" },
  { value: "Noto Sans JP", label: "Noto Sans JP" },
  { value: "Noto Serif JP", label: "Noto Serif JP" },
  { value: "Shippori Mincho", label: "Shippori Mincho" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Yomogi", label: "Yomogi" },
  { value: "Zen Kaku Gothic New", label: "Zen Kaku Gothic New" },
];
const makeAdjustmentFilter = (exposure: number, contrast: number, saturation: number) =>
  `brightness(${100 + exposure}%) contrast(${100 + contrast}%) saturate(${saturation}%)`;

const hexToRgba = (hex: string, opacity: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const loadImageElement = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = reject;
  image.src = src;
});

function ToolButton({
  label,
  active,
  icon,
  onClick,
  onDoubleActivate,
  disabled = false,
}: {
  label: string;
  active?: boolean;
  icon: React.ReactNode;
  onClick: () => void;
  onDoubleActivate?: () => void;
  disabled?: boolean;
}) {
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleClick = () => {
    if (!onDoubleActivate) {
      onClick();
      return;
    }
    if (clickTimerRef.current) {
      clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      onDoubleActivate();
      return;
    }
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null;
      onClick();
    }, 220);
  };
  return (
    <button
      type="button"
      className={`tool-button ${active ? "is-active" : ""}`}
      onClick={handleClick}
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
  const imageDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const imageResizeRef = useRef<{
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
  const imageRotateRef = useRef<{
    id: string;
    centerX: number;
    centerY: number;
    startAngle: number;
    startRotation: number;
  } | null>(null);
  const strokeDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const drawingStrokeRef = useRef<BrushStroke | null>(null);
  const historyRef = useRef<HistoryItem[]>([]);
  const historyIndexRef = useRef(-1);
  const layersRef = useRef<TextLayer[]>([]);
  const shapesRef = useRef<ShapeLayer[]>([]);
  const imagesRef = useRef<ImageLayer[]>([]);
  const strokesRef = useRef<BrushStroke[]>([]);
  const textLayerElementsRef = useRef(new Map<string, HTMLDivElement>());

  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 640 });
  const [scaleImagesWithCanvas, setScaleImagesWithCanvas] = useState(false);
  const [tool, setTool] = useState<Tool>("brush");
  const [brushKind, setBrushKind] = useState<BrushKind>("oil");
  const [brushColor, setBrushColor] = useState(BRAND_RED);
  const [brushSize, setBrushSize] = useState(18);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [openDesktopTool, setOpenDesktopTool] = useState<DesktopCreativeTool | null>(null);
  const [activeDesktopTool, setActiveDesktopTool] = useState<DesktopCreativeTool | null>(null);
  const [zoom, setZoom] = useState(68);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasArtwork, setHasArtwork] = useState(false);
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [shapes, setShapes] = useState<ShapeLayer[]>([]);
  const [images, setImages] = useState<ImageLayer[]>([]);
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const [drawingStroke, setDrawingStroke] = useState<BrushStroke | null>(null);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rectangle");
  const [shapeFill, setShapeFill] = useState(BRAND_RED);
  const [shapeOutline, setShapeOutline] = useState("#FFFDF8");
  const [shapeOutlineWidth, setShapeOutlineWidth] = useState(2);
  const [shapeShadow, setShapeShadow] = useState(true);
  const [shapeCornerRadius, setShapeCornerRadius] = useState(12);
  const [adjustments, setAdjustments] = useState<Adjustments>({
    exposure: 0,
    contrast: 0,
    saturation: 100,
    opacity: 100,
  });
  const [fileMeta, setFileMeta] = useState({ name: "未命名畫布", size: "—" });
  const [documentNameDraft, setDocumentNameDraft] = useState("未命名畫布");
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({ x: null, y: null });
  const [mobileDrawerHeight, setMobileDrawerHeight] = useState<number | null>(null);
  const [isMobileDrawerDragging, setIsMobileDrawerDragging] = useState(false);
  const [desktopToolPosition, setDesktopToolPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDesktopToolDragging, setIsDesktopToolDragging] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const clipboardTextRef = useRef<TextLayer | null>(null);
  const panDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const touchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchPanRef = useRef<{ startDistance: number; startCenterX: number; startCenterY: number; startZoom: number; originX: number; originY: number } | null>(null);
  const longPressPanRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; timer: number | null; active: boolean } | null>(null);
  const imageUpdateFrameRef = useRef<number | null>(null);
  const pendingImagesRef = useRef<ImageLayer[] | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const studioLayoutRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const desktopToolPanelRef = useRef<HTMLElement>(null);
  const desktopToolDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const drawerDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const hasInitializedPanRef = useRef(false);

  const selectedText = useMemo(
    () => layers.find((layer) => layer.id === selectedTextId) ?? null,
    [layers, selectedTextId],
  );
  const selectedShape = useMemo(
    () => shapes.find((shape) => shape.id === selectedShapeId) ?? null,
    [shapes, selectedShapeId],
  );
  const selectedImage = useMemo(
    () => images.find((image) => image.id === selectedImageId) ?? null,
    [images, selectedImageId],
  );
  const activeAdjustmentValues: Adjustments = selectedShape
    ? { exposure: selectedShape.exposure ?? 0, contrast: selectedShape.contrast ?? 0, saturation: selectedShape.saturation ?? 100, opacity: selectedShape.opacity }
    : selectedImage
      ? { exposure: selectedImage.exposure ?? 0, contrast: selectedImage.contrast ?? 0, saturation: selectedImage.saturation ?? 100, opacity: selectedImage.opacity }
      : selectedText
      ? { exposure: selectedText.exposure ?? 0, contrast: selectedText.contrast ?? 0, saturation: selectedText.saturation ?? 100, opacity: selectedText.opacity }
      : adjustments;
  const activeAdjustmentTarget = selectedShape ? "目前圖形" : selectedImage ? "目前圖片" : selectedText ? "目前文字卡" : "整個畫布";

  const canvasFilter = useMemo(
    () => makeAdjustmentFilter(adjustments.exposure, adjustments.contrast, adjustments.saturation),
    [adjustments],
  );

  const syncLayers = useCallback((nextLayers: TextLayer[]) => {
    const normalizedLayers = nextLayers.map((layer) => ({
      ...layer,
      exposure: layer.exposure ?? 0,
      contrast: layer.contrast ?? 0,
      saturation: layer.saturation ?? 100,
    }));
    layersRef.current = normalizedLayers;
    setLayers(normalizedLayers);
  }, []);

  const syncShapes = useCallback((nextShapes: ShapeLayer[]) => {
    const normalizedShapes = nextShapes.map((shape) => ({
      ...shape,
      exposure: shape.exposure ?? 0,
      contrast: shape.contrast ?? 0,
      saturation: shape.saturation ?? 100,
      rotation: shape.rotation ?? 0,
    }));
    shapesRef.current = normalizedShapes;
    setShapes(normalizedShapes);
  }, []);

  const syncImages = useCallback((nextImages: ImageLayer[]) => {
    const normalizedImages = nextImages.map((image) => ({
      ...image,
      exposure: image.exposure ?? 0,
      contrast: image.contrast ?? 0,
      saturation: image.saturation ?? 100,
      rotation: image.rotation ?? 0,
    }));
    imagesRef.current = normalizedImages;
    setImages(normalizedImages);
  }, []);

  const syncStrokes = useCallback((nextStrokes: BrushStroke[]) => {
    strokesRef.current = nextStrokes;
    setStrokes(nextStrokes);
  }, []);

  const scheduleImages = useCallback((nextImages: ImageLayer[]) => {
    pendingImagesRef.current = nextImages;
    if (imageUpdateFrameRef.current !== null) return;
    imageUpdateFrameRef.current = window.requestAnimationFrame(() => {
      imageUpdateFrameRef.current = null;
      const pendingImages = pendingImagesRef.current;
      pendingImagesRef.current = null;
      if (pendingImages) syncImages(pendingImages);
    });
  }, [syncImages]);

  const flushImageUpdates = useCallback(() => {
    if (imageUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(imageUpdateFrameRef.current);
      imageUpdateFrameRef.current = null;
    }
    const pendingImages = pendingImagesRef.current;
    pendingImagesRef.current = null;
    if (pendingImages) syncImages(pendingImages);
  }, [syncImages]);

  const getCanvasPoint = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: clamp(((clientX - rect.left) / rect.width) * canvas.width, 0, canvas.width),
      y: clamp(((clientY - rect.top) / rect.height) * canvas.height, 0, canvas.height),
    };
  }, []);

  const getSnappedPosition = useCallback((rawX: number, rawY: number, width: number, height: number) => {
    const threshold = 12 / Math.max(0.25, zoom / 100);
    const horizontalTargets = [
      { position: 0, guide: 0 },
      { position: canvasSize.width / 2 - width / 2, guide: canvasSize.width / 2 },
      { position: canvasSize.width - width, guide: canvasSize.width },
    ];
    const verticalTargets = [
      { position: 0, guide: 0 },
      { position: canvasSize.height / 2 - height / 2, guide: canvasSize.height / 2 },
      { position: canvasSize.height - height, guide: canvasSize.height },
    ];
    const closestX = horizontalTargets.reduce((nearest, target) => Math.abs(rawX - target.position) < Math.abs(rawX - nearest.position) ? target : nearest);
    const closestY = verticalTargets.reduce((nearest, target) => Math.abs(rawY - target.position) < Math.abs(rawY - nearest.position) ? target : nearest);
    const xIsSnapped = Math.abs(rawX - closestX.position) <= threshold;
    const yIsSnapped = Math.abs(rawY - closestY.position) <= threshold;
    return {
      x: xIsSnapped ? closestX.position : rawX,
      y: yIsSnapped ? closestY.position : rawY,
      guides: { x: xIsSnapped ? closestX.guide : null, y: yIsSnapped ? closestY.guide : null },
    };
  }, [canvasSize.height, canvasSize.width, zoom]);

  const getTextLayerDimensions = useCallback((layer: Pick<TextLayer, "id" | "text" | "fontFamily" | "fontWeight" | "fontSize">) => {
    const element = textLayerElementsRef.current.get(layer.id);
    if (element) return { width: element.offsetWidth, height: element.offsetHeight };
    const context = canvasRef.current?.getContext("2d");
    if (!context) return { width: Math.max(48, layer.text.length * layer.fontSize * 0.58), height: Math.ceil(layer.fontSize * 1.12) + 4 };
    context.save();
    context.font = `${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}", "Noto Sans TC", "Noto Sans JP", sans-serif`;
    const width = Math.max(48, Math.ceil(context.measureText(layer.text).width) + 8);
    context.restore();
    return { width, height: Math.ceil(layer.fontSize * 1.12) + 4 };
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
      images: imagesRef.current.map((image) => ({ ...image })),
      strokes: strokesRef.current.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) })),
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
      syncImages(item.images?.map((image) => ({ ...image })) ?? []);
      syncStrokes(item.strokes?.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) })) ?? []);
      setSelectedTextId(null);
      setSelectedShapeId(null);
      setSelectedImageId(null);
      setSelectedStrokeId(null);
      historyIndexRef.current = index;
    },
    [syncImages, syncLayers, syncShapes, syncStrokes],
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
    const viewport = viewportRef.current;
    if (!viewport || hasInitializedPanRef.current) return;
    const bounds = viewport.getBoundingClientRect();
    const displayWidth = canvasSize.width * (zoom / 100);
    const displayHeight = canvasSize.height * (zoom / 100);
    const isSmallViewport = bounds.width <= 560;
    setPan({
      x: Math.max(18, (bounds.width - displayWidth) / 2),
      y: isSmallViewport ? 16 : Math.max(18, (bounds.height - displayHeight) / 2),
    });
    hasInitializedPanRef.current = true;
  }, [canvasSize.height, canvasSize.width, zoom]);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const drag = textDragRef.current;
      const shapeDrag = shapeDragRef.current;
      const strokeDrag = strokeDragRef.current;
      const resize = shapeResizeRef.current;
      const rotate = shapeRotateRef.current;
      const imageDrag = imageDragRef.current;
      const imageResize = imageResizeRef.current;
      const imageRotate = imageRotateRef.current;
      const point = getCanvasPoint(event.clientX, event.clientY);
      if (imageRotate) {
        const currentAngle = Math.atan2(point.y - imageRotate.centerY, point.x - imageRotate.centerX);
        let nextRotation = imageRotate.startRotation + ((currentAngle - imageRotate.startAngle) * 180) / Math.PI;
        if (event.shiftKey) nextRotation = Math.round(nextRotation / 15) * 15;
        scheduleImages(imagesRef.current.map((image) => image.id === imageRotate.id ? { ...image, rotation: nextRotation } : image));
        return;
      }
      if (imageResize) {
        const nextImages = imagesRef.current.map((image) => {
          if (image.id !== imageResize.id) return image;
          const deltaX = point.x - imageResize.startPointX;
          const deltaY = point.y - imageResize.startPointY;
          const movesLeft = imageResize.axis.includes("left");
          const movesRight = imageResize.axis.includes("right");
          const movesTop = imageResize.axis.includes("top");
          const movesBottom = imageResize.axis.includes("bottom");
          const isCorner = (movesLeft || movesRight) && (movesTop || movesBottom);
          let nextWidth = movesLeft ? imageResize.startWidth - deltaX : movesRight ? imageResize.startWidth + deltaX : imageResize.startWidth;
          let nextHeight = movesTop ? imageResize.startHeight - deltaY : movesBottom ? imageResize.startHeight + deltaY : imageResize.startHeight;
          if (isCorner) {
            const widthScale = nextWidth / imageResize.startWidth;
            const heightScale = nextHeight / imageResize.startHeight;
            const dominantScale = Math.abs(deltaX / Math.max(1, imageResize.startWidth)) >= Math.abs(deltaY / Math.max(1, imageResize.startHeight)) ? widthScale : heightScale;
            const minimumScale = Math.max(60 / imageResize.startWidth, 60 / imageResize.startHeight);
            const scale = Math.max(minimumScale, dominantScale);
            nextWidth = imageResize.startWidth * scale;
            nextHeight = imageResize.startHeight * scale;
          } else if (event.shiftKey) {
            if (movesLeft || movesRight) nextHeight = nextWidth / imageResize.aspectRatio;
            if (movesTop || movesBottom) nextWidth = nextHeight * imageResize.aspectRatio;
          }
          const centerX = imageResize.startX + imageResize.startWidth / 2;
          const centerY = imageResize.startY + imageResize.startHeight / 2;
          nextWidth = clamp(nextWidth, 60, Number.POSITIVE_INFINITY);
          nextHeight = clamp(nextHeight, 60, Number.POSITIVE_INFINITY);
          const nextX = event.altKey ? centerX - nextWidth / 2 : movesLeft ? imageResize.startX + imageResize.startWidth - nextWidth : imageResize.startX;
          const nextY = event.altKey ? centerY - nextHeight / 2 : movesTop ? imageResize.startY + imageResize.startHeight - nextHeight : imageResize.startY;
          return {
            ...image,
            width: nextWidth,
            height: nextHeight,
            x: nextX,
            y: nextY,
          };
        });
        scheduleImages(nextImages);
        return;
      }
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
          const isCorner = (movesLeft || movesRight) && (movesTop || movesBottom);
          if (isCorner) {
            const widthScale = nextWidth / resize.startWidth;
            const heightScale = nextHeight / resize.startHeight;
            const dominantScale = Math.abs(deltaX / Math.max(1, resize.startWidth)) >= Math.abs(deltaY / Math.max(1, resize.startHeight)) ? widthScale : heightScale;
            const minimumScale = Math.max(60 / resize.startWidth, 60 / resize.startHeight);
            const scale = Math.max(minimumScale, dominantScale);
            nextWidth = resize.startWidth * scale;
            nextHeight = resize.startHeight * scale;
          } else if (event.shiftKey) {
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
        let nextGuides: SnapGuides = { x: null, y: null };
        const nextLayers = layersRef.current.map((layer) => {
          if (layer.id !== drag.id) return layer;
          const dimensions = getTextLayerDimensions(layer);
          const rawX = clamp(point.x - drag.offsetX, 0, canvasSize.width - dimensions.width);
          const rawY = clamp(point.y - drag.offsetY, 0, canvasSize.height - dimensions.height);
          const snapped = getSnappedPosition(rawX, rawY, dimensions.width, dimensions.height);
          nextGuides = snapped.guides;
          return { ...layer, x: snapped.x, y: snapped.y };
        });
        setSnapGuides(nextGuides);
        syncLayers(nextLayers);
      }
      if (shapeDrag) {
        let nextGuides: SnapGuides = { x: null, y: null };
        const nextShapes = shapesRef.current.map((shape) => {
          if (shape.id !== shapeDrag.id) return shape;
          const rawX = clamp(point.x - shapeDrag.offsetX, 0, canvasSize.width - shape.width);
          const rawY = clamp(point.y - shapeDrag.offsetY, 0, canvasSize.height - shape.height);
          const snapped = getSnappedPosition(rawX, rawY, shape.width, shape.height);
          nextGuides = snapped.guides;
          return { ...shape, x: snapped.x, y: snapped.y };
        });
        setSnapGuides(nextGuides);
        syncShapes(nextShapes);
      }
      if (strokeDrag) {
        let nextGuides: SnapGuides = { x: null, y: null };
        const nextStrokes = strokesRef.current.map((stroke) => {
          if (stroke.id !== strokeDrag.id) return stroke;
          const minX = Math.min(...stroke.points.map((item) => item.x));
          const maxX = Math.max(...stroke.points.map((item) => item.x));
          const minY = Math.min(...stroke.points.map((item) => item.y));
          const maxY = Math.max(...stroke.points.map((item) => item.y));
          const width = Math.max(1, maxX - minX);
          const height = Math.max(1, maxY - minY);
          const rawX = point.x - strokeDrag.offsetX;
          const rawY = point.y - strokeDrag.offsetY;
          const snapped = getSnappedPosition(rawX + minX, rawY + minY, width, height);
          nextGuides = snapped.guides;
          return { ...stroke, x: snapped.x - minX, y: snapped.y - minY };
        });
        setSnapGuides(nextGuides);
        syncStrokes(nextStrokes);
      }
      if (imageDrag) {
        const snapThreshold = 12 / Math.max(0.25, zoom / 100);
        let nextGuides: SnapGuides = { x: null, y: null };
        const nextImages = imagesRef.current.map((image) => {
          if (image.id !== imageDrag.id) return image;
          const rawX = point.x - imageDrag.offsetX;
          const rawY = point.y - imageDrag.offsetY;
          const horizontalTargets = [
            { position: 0, guide: 0 },
            { position: canvasSize.width / 2 - image.width / 2, guide: canvasSize.width / 2 },
            { position: canvasSize.width - image.width, guide: canvasSize.width },
          ];
          const verticalTargets = [
            { position: 0, guide: 0 },
            { position: canvasSize.height / 2 - image.height / 2, guide: canvasSize.height / 2 },
            { position: canvasSize.height - image.height, guide: canvasSize.height },
          ];
          const snapX = horizontalTargets.reduce((closest, target) =>
            Math.abs(rawX - target.position) < Math.abs(rawX - closest.position) ? target : closest,
          );
          const snapY = verticalTargets.reduce((closest, target) =>
            Math.abs(rawY - target.position) < Math.abs(rawY - closest.position) ? target : closest,
          );
          const xIsSnapped = Math.abs(rawX - snapX.position) <= snapThreshold;
          const yIsSnapped = Math.abs(rawY - snapY.position) <= snapThreshold;
          nextGuides = { x: xIsSnapped ? snapX.guide : null, y: yIsSnapped ? snapY.guide : null };
          return { ...image, x: xIsSnapped ? snapX.position : rawX, y: yIsSnapped ? snapY.position : rawY };
        });
        setSnapGuides((current) => current.x === nextGuides.x && current.y === nextGuides.y ? current : nextGuides);
        scheduleImages(nextImages);
      }
    };
    const handleUp = () => {
      if (!textDragRef.current && !shapeDragRef.current && !strokeDragRef.current && !shapeResizeRef.current && !shapeRotateRef.current && !imageDragRef.current && !imageResizeRef.current && !imageRotateRef.current) return;
      textDragRef.current = null;
      shapeDragRef.current = null;
      strokeDragRef.current = null;
      shapeResizeRef.current = null;
      shapeRotateRef.current = null;
      imageDragRef.current = null;
      imageResizeRef.current = null;
      imageRotateRef.current = null;
      setSnapGuides({ x: null, y: null });
      flushImageUpdates();
      captureHistory();
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [canvasSize.height, canvasSize.width, captureHistory, flushImageUpdates, getCanvasPoint, getSnappedPosition, scheduleImages, syncLayers, syncShapes, syncStrokes, zoom]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable) return;
      const key = event.key.toLowerCase();
      const modifier = event.ctrlKey || event.metaKey;
      if (key === "delete" || key === "backspace") {
        if (selectedTextId || selectedShapeId || selectedImageId || selectedStrokeId) {
          event.preventDefault();
          if (selectedTextId) deleteSelectedText(); else if (selectedShapeId) deleteSelectedShape(); else if (selectedImageId) deleteSelectedImage(); else {
            syncStrokes(strokesRef.current.filter((stroke) => stroke.id !== selectedStrokeId));
            setSelectedStrokeId(null);
            captureHistory();
          }
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
      if (key === "v") setTool("move");
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [selectedImageId, selectedShapeId, selectedTextId]);

  const drawStroke = (from: CanvasPoint, to: CanvasPoint) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const baseAlpha = brushOpacity / 100;
    const isPencil = brushKind === "pencil";
    const isWatercolor = brushKind === "watercolor";
    context.save();
    context.lineCap = isPencil ? "butt" : "round";
    context.lineJoin = "round";
    context.lineWidth = isPencil ? Math.max(1, brushSize * 0.52) : isWatercolor ? brushSize * 1.35 : brushSize;
    context.globalAlpha = isWatercolor ? baseAlpha * 0.34 : isPencil ? baseAlpha * 0.82 : baseAlpha;
    context.strokeStyle = brushColor;
    context.fillStyle = brushColor;
    context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
    if (isWatercolor && tool !== "eraser") {
      const jitter = Math.max(1, brushSize * 0.18);
      context.globalAlpha = baseAlpha * 0.12;
      context.lineWidth = brushSize * 0.72;
      context.beginPath();
      context.moveTo(from.x - jitter, from.y + jitter);
      context.lineTo(to.x - jitter, to.y + jitter);
      context.stroke();
      context.beginPath();
      context.moveTo(from.x + jitter, from.y - jitter);
      context.lineTo(to.x + jitter, to.y - jitter);
      context.stroke();
    }
    context.beginPath();
    context.globalAlpha = isWatercolor ? baseAlpha * 0.22 : isPencil ? baseAlpha * 0.7 : baseAlpha;
    context.arc(to.x, to.y, (isPencil ? brushSize * 0.28 : isWatercolor ? brushSize * 0.68 : brushSize / 2), 0, Math.PI * 2);
    context.fill();
    context.restore();
  };

  const renderBrushStroke = (context: CanvasRenderingContext2D, stroke: BrushStroke) => {
    if (stroke.points.length === 0) return;
    const baseAlpha = stroke.opacity / 100;
    const isPencil = stroke.kind === "pencil";
    const isWatercolor = stroke.kind === "watercolor";
    const points = stroke.points.map((point) => ({ x: point.x + stroke.x, y: point.y + stroke.y }));
    context.save();
    context.lineCap = isPencil ? "butt" : "round";
    context.lineJoin = "round";
    context.lineWidth = isPencil ? Math.max(1, stroke.size * 0.52) : isWatercolor ? stroke.size * 1.35 : stroke.size;
    context.globalAlpha = isWatercolor ? baseAlpha * 0.34 : isPencil ? baseAlpha * 0.82 : baseAlpha;
    context.strokeStyle = stroke.color;
    context.fillStyle = stroke.color;
    if (points.length === 1) {
      context.beginPath();
      context.arc(points[0].x, points[0].y, isPencil ? stroke.size * 0.28 : isWatercolor ? stroke.size * 0.68 : stroke.size / 2, 0, Math.PI * 2);
      context.fill();
    } else {
      context.beginPath();
      context.moveTo(points[0].x, points[0].y);
      points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
      if (isWatercolor) {
        const jitter = Math.max(1, stroke.size * 0.18);
        context.globalAlpha = baseAlpha * 0.12;
        context.lineWidth = stroke.size * 0.72;
        context.beginPath();
        context.moveTo(points[0].x - jitter, points[0].y + jitter);
        points.slice(1).forEach((point) => context.lineTo(point.x - jitter, point.y + jitter));
        context.stroke();
      }
    }
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
      cornerRadius: kind === "rectangle" ? shapeCornerRadius : 0,
      rotation: 0,
      fill: shapeFill,
      opacity: 100,
      exposure: 0,
      contrast: 0,
      saturation: 100,
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
    setSelectedImageId(null);
    setTool("shape");
    captureHistory();
    toast.success(`${SHAPE_LABELS[kind]} 已加入畫布`);
  };

  const addTextLayer = () => {
    const draftLayer: TextLayer = {
      id: makeId(),
      text: "在這裡輸入文字",
      x: 0,
      y: 0,
      fontSize: 52,
      fontWeight: 700,
      color: GRAPHITE,
      opacity: 100,
      exposure: 0,
      contrast: 0,
      saturation: 100,
      fontFamily: "Noto Sans TC",
    };
    const dimensions = getTextLayerDimensions(draftLayer);
    const nextLayer = {
      ...draftLayer,
      x: Math.max(24, (canvasSize.width - dimensions.width) / 2),
      y: Math.max(24, (canvasSize.height - dimensions.height) / 2),
    };
    syncLayers([...layersRef.current, nextLayer]);
    setSelectedTextId(nextLayer.id);
    setSelectedShapeId(null);
    setSelectedImageId(null);
    setTool("text");
    captureHistory();
    toast.success("文字已加入畫布");
  };

  const handleCanvasPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.stopPropagation();
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (tool === "move") return;
    if (tool === "fill") {
      floodFill(point);
      return;
    }
    if (tool === "shape") {
      return;
    }
    if (tool === "text") return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDrawing(true);
    setHasArtwork(true);
    lastPointRef.current = point;
    if (tool === "retouch") {
      healSpot(point);
    } else {
      const nextStroke: BrushStroke = { id: makeId("stroke"), points: [point], x: 0, y: 0, color: brushColor, size: brushSize, opacity: brushOpacity, kind: brushKind };
      drawingStrokeRef.current = nextStroke;
      setDrawingStroke(nextStroke);
    }
  };

  const handleCanvasPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !lastPointRef.current) return;
    const point = getCanvasPoint(event.clientX, event.clientY);
    if (tool === "retouch") {
      healSpot(point);
    } else {
      const currentStroke = drawingStrokeRef.current;
      if (currentStroke) {
        const nextStroke = { ...currentStroke, points: [...currentStroke.points, point] };
        drawingStrokeRef.current = nextStroke;
        setDrawingStroke(nextStroke);
      }
    }
    lastPointRef.current = point;
  };

  const finishStroke = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;
    const completedStroke = drawingStrokeRef.current;
    drawingStrokeRef.current = null;
    setDrawingStroke(null);
    if (completedStroke && completedStroke.points.length > 0) {
      syncStrokes([...strokesRef.current, completedStroke]);
      setSelectedStrokeId(completedStroke.id);
      setSelectedTextId(null);
      setSelectedShapeId(null);
      setSelectedImageId(null);
    }
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
      exposure: 0,
      contrast: 0,
      saturation: 100,
      fontFamily: "DM Sans",
      anchorShapeId: anchorShape?.id,
    };
    const nextLayers = [...layersRef.current, nextLayer];
    syncLayers(nextLayers);
    setSelectedTextId(nextLayer.id);
    setSelectedShapeId(null);
    setSelectedImageId(null);
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
        exposure: 0,
        contrast: 0,
        saturation: 100,
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

  const deleteSelectedImage = () => {
    if (!selectedImageId) return;
    syncImages(imagesRef.current.filter((image) => image.id !== selectedImageId));
    setSelectedImageId(null);
    captureHistory();
    toast.success("圖片素材已移除");
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
    const dimensions = getTextLayerDimensions(selectedText);
    updateTextLayer({
      ...(axis === "horizontal" || axis === "both" ? { x: target.x + (target.width - dimensions.width) / 2 } : {}),
      ...(axis === "vertical" || axis === "both" ? { y: target.y + (target.height - dimensions.height) / 2 } : {}),
    });
    captureHistory();
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
    const imageScale = scaleImagesWithCanvas ? Math.min(scaleX, scaleY) : 1;
    const imageOffsetX = scaleImagesWithCanvas ? (nextWidth - canvasSize.width * imageScale) / 2 : 0;
    const imageOffsetY = scaleImagesWithCanvas ? (nextHeight - canvasSize.height * imageScale) / 2 : 0;
    syncImages(
      imagesRef.current.map((image) => ({
        ...image,
        x: scaleImagesWithCanvas ? image.x * imageScale + imageOffsetX : image.x,
        y: scaleImagesWithCanvas ? image.y * imageScale + imageOffsetY : image.y,
        width: scaleImagesWithCanvas ? image.width * imageScale : image.width,
        height: scaleImagesWithCanvas ? image.height * imageScale : image.height,
      })),
    );
    setCanvasSize({ width: nextWidth, height: nextHeight });
    setFileMeta((meta) => ({ ...meta, size: `${nextWidth} × ${nextHeight}` }));
    captureHistory();
    toast.success(`畫布已調整為 ${nextWidth} × ${nextHeight}`);
  };

  const applyResolutionPreset = (width: number, height: number) => {
    const widthInput = document.getElementById("canvas-width") as HTMLInputElement | null;
    const heightInput = document.getElementById("canvas-height") as HTMLInputElement | null;
    if (!widthInput || !heightInput) return;
    widthInput.value = String(width);
    heightInput.value = String(height);
    resizeCanvas();
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

  const updateActiveAdjustment = (patch: AdjustmentPatch) => {
    if (selectedShapeId) {
      updateShape(patch);
      return;
    }
    if (selectedImageId) {
      syncImages(imagesRef.current.map((image) => image.id === selectedImageId ? { ...image, ...patch } : image));
      return;
    }
    if (selectedTextId) {
      updateTextLayer(patch);
      return;
    }
    setAdjustments((current) => ({ ...current, ...patch }));
  };

  const resetActiveAdjustment = () => {
    updateActiveAdjustment({ exposure: 0, contrast: 0, saturation: 100, opacity: 100 });
    toast.info(`${activeAdjustmentTarget}的影像調整已重設`);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const width = Math.max(1, image.naturalWidth);
      const height = Math.max(1, image.naturalHeight);
      const scaleX = width / canvasSize.width;
      const scaleY = height / canvasSize.height;
      const previousCanvas = document.createElement("canvas");
      previousCanvas.width = canvas.width;
      previousCanvas.height = canvas.height;
      previousCanvas.getContext("2d")?.drawImage(canvas, 0, 0);
      canvas.width = width;
      canvas.height = height;
      const canvasContext = canvas.getContext("2d");
      if (canvasContext) {
        canvasContext.fillStyle = PAPER;
        canvasContext.fillRect(0, 0, width, height);
        canvasContext.drawImage(previousCanvas, 0, 0, width, height);
      }
      const nextImage: ImageLayer = {
        id: makeId("image"),
        name: file.name,
        src: image.src,
        x: 0,
        y: 0,
        width,
        height,
        rotation: 0,
        opacity: 100,
        exposure: 0,
        contrast: 0,
        saturation: 100,
      };
      syncLayers(layersRef.current.map((layer) => ({ ...layer, x: layer.x * scaleX, y: layer.y * scaleY, fontSize: layer.fontSize * Math.min(scaleX, scaleY) })));
      syncShapes(shapesRef.current.map((shape) => ({ ...shape, x: shape.x * scaleX, y: shape.y * scaleY, width: shape.width * scaleX, height: shape.height * scaleY, outlineWidth: shape.outlineWidth * Math.min(scaleX, scaleY), shadowBlur: shape.shadowBlur * Math.min(scaleX, scaleY), shadowX: shape.shadowX * scaleX, shadowY: shape.shadowY * scaleY })));
      syncImages([...imagesRef.current.map((existing) => ({ ...existing, x: existing.x * scaleX, y: existing.y * scaleY, width: existing.width * scaleX, height: existing.height * scaleY })), nextImage]);
      setCanvasSize({ width, height });
      setFileMeta({ name: file.name, size: `${width} × ${height}` });
      setDocumentNameDraft(file.name);
      setSelectedImageId(nextImage.id);
      setSelectedTextId(null);
      setSelectedShapeId(null);
      setHasArtwork(true);
      captureHistory();
      toast.success(`影像已加入畫布，解析度 ${width} × ${height}`);
    };
    image.src = URL.createObjectURL(file);
    event.target.value = "";
  };

  const exportImage = async (format: "png" | "jpeg" = "png") => {
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
    strokesRef.current.forEach((stroke) => renderBrushStroke(context, stroke));
    const loadedImages = await Promise.all(imagesRef.current.map(async (image) => {
      try {
        return await loadImageElement(image.src);
      } catch {
        return null;
      }
    }));
    imagesRef.current.forEach((image, index) => {
      const imageElement = loadedImages[index];
      if (!imageElement) return;
      context.save();
      context.globalAlpha = (adjustments.opacity / 100) * (image.opacity / 100);
      context.filter = makeAdjustmentFilter(image.exposure, image.contrast, image.saturation);
      context.translate(image.x + image.width / 2, image.y + image.height / 2);
      context.rotate((image.rotation * Math.PI) / 180);
      context.drawImage(imageElement, -image.width / 2, -image.height / 2, image.width, image.height);
      context.restore();
    });
    shapesRef.current.forEach((shape) => {
      context.save();
      context.globalAlpha = (adjustments.opacity / 100) * (shape.opacity / 100);
      context.filter = makeAdjustmentFilter(shape.exposure, shape.contrast, shape.saturation);
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
      context.filter = makeAdjustmentFilter(layer.exposure, layer.contrast, layer.saturation);
      context.fillStyle = layer.color;
      context.font = `${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}", sans-serif`;
      context.textBaseline = "top";
      context.fillText(layer.text, layer.x, layer.y);
      context.restore();
    });
    const link = document.createElement("a");
    const extension = format === "jpeg" ? "jpg" : "png";
    link.download = `${fileMeta.name.replace(/\.[^.]+$/, "") || "coai"}.${extension}`;
    link.href = output.toDataURL(format === "jpeg" ? "image/jpeg" : "image/png", format === "jpeg" ? 0.92 : undefined);
    link.click();
    toast.success(`${extension.toUpperCase()} 已匯出`);
  };

  const saveDocumentName = (value: string) => {
    const nextName = value.trim() || "未命名畫布";
    setDocumentNameDraft(nextName);
    setFileMeta((meta) => ({ ...meta, name: nextName }));
  };

  const handleTextPointerDown = (event: ReactPointerEvent<HTMLDivElement>, layer: TextLayer) => {
    event.stopPropagation();
    if (editingTextId === layer.id) return;
    const point = getCanvasPoint(event.clientX, event.clientY);
    setSelectedTextId(layer.id);
    setSelectedShapeId(null);
    setSelectedImageId(null);
    setTool("text");
    setActiveDesktopTool("text");
    setOpenDesktopTool(null);
    textDragRef.current = {
      id: layer.id,
      offsetX: point.x - layer.x,
      offsetY: point.y - layer.y,
    };
  };

  const handleShapePointerDown = (event: ReactPointerEvent<SVGSVGElement>, shape: ShapeLayer) => {
    event.stopPropagation();
    event.preventDefault();
    if ((event.target as Element).classList.contains("shape-resize-handle")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event.clientX, event.clientY);
    setSelectedShapeId(shape.id);
    setSelectedTextId(null);
    setSelectedImageId(null);
    setTool("shape");
    setActiveDesktopTool("shape");
    setOpenDesktopTool(null);
    shapeDragRef.current = {
      id: shape.id,
      offsetX: point.x - shape.x,
      offsetY: point.y - shape.y,
    };
  };

  const handleShapeDoubleClick = (event: ReactMouseEvent<SVGSVGElement>, shape: ShapeLayer) => {
    event.stopPropagation();
    event.preventDefault();
    setSelectedShapeId(shape.id);
    setSelectedTextId(null);
    setSelectedImageId(null);
    setTool("shape");
    setActiveDesktopTool("shape");
    setOpenDesktopTool("shape");
  };

  const handleStrokePointerDown = (event: ReactPointerEvent<SVGSVGElement>, stroke: BrushStroke) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event.clientX, event.clientY);
    setSelectedStrokeId(stroke.id);
    setSelectedTextId(null);
    setSelectedShapeId(null);
    setSelectedImageId(null);
    setTool("brush");
    setActiveDesktopTool("brush");
    setOpenDesktopTool(null);
    strokeDragRef.current = { id: stroke.id, offsetX: point.x - stroke.x, offsetY: point.y - stroke.y };
  };

  const handleShapeResizePointerDown = (event: ReactPointerEvent<SVGRectElement>, shape: ShapeLayer, axis: ShapeResizeAxis) => {
    event.stopPropagation();
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event.clientX, event.clientY);
    setSelectedShapeId(shape.id);
    setSelectedTextId(null);
    setSelectedImageId(null);
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
    setSelectedImageId(null);
    textDragRef.current = null;
    shapeDragRef.current = null;
    shapeResizeRef.current = null;
    shapeRotateRef.current = {
      id: shape.id,
      centerX,
      centerY,
      startAngle: Math.atan2(point.y - centerY, point.x - centerX),
      startRotation: shape.rotation ?? 0,
    };
  };

  const handleImagePointerDown = (event: ReactPointerEvent<HTMLDivElement>, image: ImageLayer) => {
    event.stopPropagation();
    if ((event.target as Element).classList.contains("image-resize-handle") || (event.target as Element).classList.contains("image-rotation-handle")) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event.clientX, event.clientY);
    setSnapGuides({ x: null, y: null });
    setSelectedImageId(image.id);
    setSelectedTextId(null);
    setSelectedShapeId(null);
    imageDragRef.current = { id: image.id, offsetX: point.x - image.x, offsetY: point.y - image.y };
  };

  const handleImageResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>, image: ImageLayer, axis: ShapeResizeAxis) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event.clientX, event.clientY);
    setSelectedImageId(image.id);
    setSelectedTextId(null);
    setSelectedShapeId(null);
    imageDragRef.current = null;
    imageRotateRef.current = null;
    imageResizeRef.current = {
      id: image.id,
      axis,
      startPointX: point.x,
      startPointY: point.y,
      startWidth: image.width,
      startHeight: image.height,
      startX: image.x,
      startY: image.y,
      aspectRatio: image.width / Math.max(1, image.height),
    };
  };

  const handleImageRotatePointerDown = (event: ReactPointerEvent<HTMLDivElement>, image: ImageLayer) => {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event.clientX, event.clientY);
    const centerX = image.x + image.width / 2;
    const centerY = image.y + image.height / 2;
    setSelectedImageId(image.id);
    setSelectedTextId(null);
    setSelectedShapeId(null);
    imageDragRef.current = null;
    imageResizeRef.current = null;
    imageRotateRef.current = {
      id: image.id,
      centerX,
      centerY,
      startAngle: Math.atan2(point.y - centerY, point.x - centerX),
      startRotation: image.rotation ?? 0,
    };
  };

  const cancelLongPressPan = () => {
    const pending = longPressPanRef.current;
    if (pending?.timer !== null && pending?.timer !== undefined) window.clearTimeout(pending.timer);
    longPressPanRef.current = null;
  };

  const handleViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const target = event.target as HTMLElement;
    if (event.pointerType === "touch") {
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      event.currentTarget.setPointerCapture(event.pointerId);
      if (touchPointsRef.current.size === 2) {
        cancelLongPressPan();
        const points = Array.from(touchPointsRef.current.values());
        const centerX = (points[0].x + points[1].x) / 2;
        const centerY = (points[0].y + points[1].y) / 2;
        pinchPanRef.current = {
          startDistance: Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y),
          startCenterX: centerX,
          startCenterY: centerY,
          startZoom: zoom,
          originX: pan.x,
          originY: pan.y,
        };
        panDragRef.current = null;
        setIsPanning(true);
      } else {
        const pendingPan = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          originX: pan.x,
          originY: pan.y,
          timer: null as number | null,
          active: false,
        };
        pendingPan.timer = window.setTimeout(() => {
          if (longPressPanRef.current?.pointerId !== event.pointerId) return;
          longPressPanRef.current = { ...pendingPan, timer: null, active: true };
          panDragRef.current = { startX: pendingPan.startX, startY: pendingPan.startY, originX: pendingPan.originX, originY: pendingPan.originY };
          setIsPanning(true);
        }, 420);
        longPressPanRef.current = pendingPan;
      }
      return;
    }
    if (event.button !== 0 || target.closest(".image-layer, .shape-layer, .text-layer")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    panDragRef.current = { startX: event.clientX, startY: event.clientY, originX: pan.x, originY: pan.y };
    setIsPanning(true);
  };

  const handleViewportPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" && touchPointsRef.current.has(event.pointerId)) {
      touchPointsRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const pendingPan = longPressPanRef.current;
      if (pendingPan?.pointerId === event.pointerId && !pendingPan.active) {
        if (Math.hypot(event.clientX - pendingPan.startX, event.clientY - pendingPan.startY) > 10) cancelLongPressPan();
      }
      const points = Array.from(touchPointsRef.current.values());
      const pinchPan = pinchPanRef.current;
      if (pinchPan && points.length >= 2) {
        const centerX = (points[0].x + points[1].x) / 2;
        const centerY = (points[0].y + points[1].y) / 2;
        const distance = Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y);
        const nextZoom = clamp(Math.round(pinchPan.startZoom * (distance / Math.max(1, pinchPan.startDistance))), 25, 150);
        setZoom(nextZoom);
        setPan({
          x: pinchPan.originX + centerX - pinchPan.startCenterX,
          y: pinchPan.originY + centerY - pinchPan.startCenterY,
        });
      } else if (points.length === 1 && panDragRef.current) {
        const drag = panDragRef.current;
        setPan({ x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY });
      }
      return;
    }
    const drag = panDragRef.current;
    if (!drag) return;
    setPan({ x: drag.originX + event.clientX - drag.startX, y: drag.originY + event.clientY - drag.startY });
  };

  const finishPan = (event?: ReactPointerEvent<HTMLDivElement>) => {
    if (event?.pointerType === "touch") {
      touchPointsRef.current.delete(event.pointerId);
      if (longPressPanRef.current?.pointerId === event.pointerId) cancelLongPressPan();
      if (touchPointsRef.current.size < 2) {
        pinchPanRef.current = null;
        panDragRef.current = null;
        setIsPanning(false);
      }
    }
    if (!panDragRef.current) return;
    panDragRef.current = null;
    setIsPanning(false);
  };

  const currentZoomLabel = `${zoom}%`;
  const fitCanvasToViewport = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const availableWidth = Math.max(120, bounds.width - 32);
    const availableHeight = Math.max(120, bounds.height - 32);
    const nextZoom = clamp(Math.floor(Math.min(availableWidth / canvasSize.width, availableHeight / canvasSize.height) * 100), 25, 150);
    const displayWidth = canvasSize.width * (nextZoom / 100);
    const displayHeight = canvasSize.height * (nextZoom / 100);
    setZoom(nextZoom);
    setPan({
      x: Math.max(16, (bounds.width - displayWidth) / 2),
      y: Math.max(16, (bounds.height - displayHeight) / 2),
    });
  };
  const resetCanvasView = () => {
    const viewport = viewportRef.current;
    const nextZoom = 68;
    if (!viewport) {
      setZoom(nextZoom);
      setPan({ x: 0, y: 0 });
      return;
    }
    const bounds = viewport.getBoundingClientRect();
    const displayWidth = canvasSize.width * (nextZoom / 100);
    const displayHeight = canvasSize.height * (nextZoom / 100);
    setZoom(nextZoom);
    setPan({
      x: Math.max(18, (bounds.width - displayWidth) / 2),
      y: Math.max(18, (bounds.height - displayHeight) / 2),
    });
  };

  useEffect(() => {
    const handleDrawerMove = (event: PointerEvent) => {
      const drag = drawerDragRef.current;
      if (!drag) return;
      const maxHeight = Math.min(Math.round(window.innerHeight * 0.76), 560);
      setMobileDrawerHeight(clamp(drag.startHeight + drag.startY - event.clientY, 72, maxHeight));
    };
    const finishDrawerDrag = () => {
      if (!drawerDragRef.current) return;
      setMobileDrawerHeight((height) => (height !== null && height < 118 ? 72 : height));
      drawerDragRef.current = null;
      setIsMobileDrawerDragging(false);
    };
    window.addEventListener("pointermove", handleDrawerMove);
    window.addEventListener("pointerup", finishDrawerDrag);
    window.addEventListener("pointercancel", finishDrawerDrag);
    return () => {
      window.removeEventListener("pointermove", handleDrawerMove);
      window.removeEventListener("pointerup", finishDrawerDrag);
      window.removeEventListener("pointercancel", finishDrawerDrag);
    };
  }, []);

  useEffect(() => {
    const handleDesktopToolDragMove = (event: PointerEvent) => {
      const drag = desktopToolDragRef.current;
      const workspace = workspaceRef.current;
      const studioLayout = studioLayoutRef.current;
      const panel = desktopToolPanelRef.current;
      if (!drag || !workspace || !studioLayout || !panel) return;
      const workspaceBounds = workspace.getBoundingClientRect();
      const studioBounds = studioLayout.getBoundingClientRect();
      const panelBounds = panel.getBoundingClientRect();
      setDesktopToolPosition({
        x: clamp(drag.originX + event.clientX - drag.startX, 8, Math.max(8, studioBounds.right - workspaceBounds.left - panelBounds.width - 8)),
        y: clamp(drag.originY + event.clientY - drag.startY, 62, Math.max(62, studioBounds.bottom - workspaceBounds.top - panelBounds.height - 8)),
      });
    };
    const finishDesktopToolDrag = () => {
      if (!desktopToolDragRef.current) return;
      desktopToolDragRef.current = null;
      setIsDesktopToolDragging(false);
    };
    window.addEventListener("pointermove", handleDesktopToolDragMove);
    window.addEventListener("pointerup", finishDesktopToolDrag);
    window.addEventListener("pointercancel", finishDesktopToolDrag);
    return () => {
      window.removeEventListener("pointermove", handleDesktopToolDragMove);
      window.removeEventListener("pointerup", finishDesktopToolDrag);
      window.removeEventListener("pointercancel", finishDesktopToolDrag);
    };
  }, []);

  const handleMobileDrawerPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startHeight = inspectorRef.current?.getBoundingClientRect().height ?? 0;
    drawerDragRef.current = { startY: event.clientY, startHeight };
    setIsMobileDrawerDragging(true);
  };

  const handleDesktopToolPanelPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const workspace = workspaceRef.current;
    const panel = desktopToolPanelRef.current;
    if (!workspace || !panel) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const workspaceBounds = workspace.getBoundingClientRect();
    const panelBounds = panel.getBoundingClientRect();
    desktopToolDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: panelBounds.left - workspaceBounds.left,
      originY: panelBounds.top - workspaceBounds.top,
    };
    setIsDesktopToolDragging(true);
  };

  const mobileDrawerStyle = mobileDrawerHeight === null
    ? undefined
    : ({ "--mobile-drawer-height": `${mobileDrawerHeight}px` } as CSSProperties);
  const desktopToolPopoverStyle = desktopToolPosition === null
    ? undefined
    : ({ left: `${desktopToolPosition.x}px`, top: `${desktopToolPosition.y}px`, transform: "none" } as CSSProperties);
  const handleDesktopToolCreate = (nextTool: DesktopCreativeTool) => {
    setTool(nextTool);
    setActiveDesktopTool(nextTool);
    setOpenDesktopTool(nextTool);
    if (nextTool === "shape") addShape(shapeKind);
    if (nextTool === "text") addTextLayer();
  };
  const handleDesktopToolSettings = (nextTool: DesktopCreativeTool) => {
    setTool(nextTool);
    setActiveDesktopTool(nextTool);
    if (nextTool === "text" && !selectedText && layersRef.current.length > 0) {
      setSelectedTextId(layersRef.current[layersRef.current.length - 1].id);
      setSelectedShapeId(null);
      setSelectedImageId(null);
    }
    setOpenDesktopTool(nextTool);
  };
  const activeWorkspaceToolLabel = activeDesktopTool === "brush"
    ? "畫筆"
    : activeDesktopTool === "shape"
      ? "圖形"
      : activeDesktopTool === "text"
        ? "文字"
        : "解析度調整";
  const toolPanelTitle = selectedImage
    ? "圖片素材"
    : selectedShape
      ? "圖形設定"
      : selectedText
        ? "文字設定"
        : tool === "brush"
          ? "筆刷工具"
          : tool === "eraser"
            ? "橡皮擦工具"
            : tool === "fill"
              ? "填色桶工具"
              : tool === "text"
                ? "文字工具"
                : tool === "shape"
                  ? "圖形工具"
                  : tool === "retouch"
                    ? "瑕疵移除工具"
                    : "移動工具";

  return (
    <main className="studio-app" style={mobileDrawerStyle}>
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark brand-logo">
            <img src="/favicon.webp" alt="AbiPaint" />
          </span>
          <div className="brand-copy">
            <span className="brand-name">AbiPaint</span>
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
          <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()} title="匯入影像" aria-label="匯入影像">
            <Upload size={15} /> <span className="top-action-label">匯入影像</span>
          </button>
          <button type="button" className="primary-button" onClick={() => exportImage("png")} title="匯出 PNG" aria-label="匯出 PNG">
            <Download size={15} /> <span className="top-action-label">匯出 PNG</span>
          </button>
          <button type="button" className="primary-button" onClick={() => exportImage("jpeg")} title="匯出 JPG" aria-label="匯出 JPG">
            <Download size={15} /> <span className="top-action-label">匯出 JPG</span>
          </button>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImport} hidden />
      </header>

      <div ref={studioLayoutRef} className="studio-layout">
        <aside className="tool-rail desktop-creative-rail" aria-label="創作工具">
          <span className="rail-label">CREATIVE</span>
          <div className="tool-group">
            <ToolButton label="畫筆" active={activeDesktopTool === "brush"} icon={<Pencil size={18} />} onClick={() => handleDesktopToolCreate("brush")} onDoubleActivate={() => handleDesktopToolSettings("brush")} />
            <ToolButton label="圖形" active={activeDesktopTool === "shape"} icon={<Shapes size={18} />} onClick={() => handleDesktopToolCreate("shape")} onDoubleActivate={() => handleDesktopToolSettings("shape")} />
            <ToolButton label="文字" active={activeDesktopTool === "text"} icon={<Type size={18} />} onClick={() => handleDesktopToolCreate("text")} onDoubleActivate={() => handleDesktopToolSettings("text")} />
            <button type="button" className={`faq-rail-toggle ${isFaqOpen ? "is-active" : ""}`} onClick={() => setIsFaqOpen((open) => !open)} aria-expanded={isFaqOpen} aria-controls="abipaint-faq-panel">
              <span className="faq-rail-glyph">?</span>
              <span>FAQ</span>
              <ChevronDown size={11} aria-hidden="true" />
            </button>
          </div>
          {isFaqOpen && (
            <section id="abipaint-faq-panel" className="faq-panel" aria-label="AbiPaint 常見問題">
              <header className="faq-panel-header">
                <div>
                  <span className="faq-eyebrow">FAQ / FIELD NOTES</span>
                  <h2>使用說明</h2>
                </div>
                <button type="button" className="faq-close" onClick={() => setIsFaqOpen(false)} aria-label="關閉常見問題"><ChevronDown size={16} /></button>
              </header>
              <div className="faq-list">
                <details className="faq-item" open>
                  <summary><span>01</span>AbiPaint 是什麼？</summary>
                  <div className="faq-answer">AbiPaint 是免費線上圖片尺寸修改器，不用安裝 Adobe 或註冊 Canva，直接在瀏覽器調整照片尺寸、像素與解析度。</div>
                </details>
                <details className="faq-item">
                  <summary><span>02</span>什麼情況會使用 AbiPaint？</summary>
                  <div className="faq-answer">想修改圖片、照片的解析度，但手邊沒有 Photoshop、Illustrator 或 Canva 時，本工具可快速派上用場：<ul><li>將 1080 × 1080 的大頭照縮小為符合線上系統規範的尺寸</li><li>將遭 AI 工具壓縮失真的網站 Banner 校正並還原細節樣貌</li><li>將檔案肥大的 PNG 插畫修改並轉換為不佔空間的 JPG 圖檔</li></ul></div>
                </details>
                <details className="faq-item">
                  <summary><span>03</span>使用 AbiPaint 是否需要註冊帳號？</summary>
                  <div className="faq-answer">完全不需要！AbiPaint 提供免費、免註冊與免安裝的修圖服務，打開網頁即可直接使用，適合所有電腦、平板與手機用戶。</div>
                </details>
                <details className="faq-item">
                  <summary><span>04</span>AbiPaint 還有什麼功能？</summary>
                  <div className="faq-answer">除了修改圖片尺寸，AbiPaint 也提供畫筆、圖形與文字等多種素材，適合學生、教師、設計師、行銷人員等各行各業使用。</div>
                </details>
                <details className="faq-item">
                  <summary><span>05</span>發現錯誤資訊該怎麼辦？</summary>
                  <div className="faq-answer">若發現錯誤資訊，歡迎透過以下電子郵件聯繫開發人員：<a className="faq-email" href="mailto:abiting.ct@gmail.com">abiting.ct@gmail.com</a></div>
                </details>
                <div className="faq-banner">
                  <img src="/banner.webp" alt="線上圖片尺寸修改器" />
                </div>
              </div>
            </section>
          )}
        </aside>
        <section ref={workspaceRef} className="workspace" aria-label="畫布工作區">
          <div className="workspace-toolbar">
            <div className="active-tool-name">
              <span className="active-tool-marker" />
              <span>{activeWorkspaceToolLabel}</span>
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
              <button type="button" className="ghost-button view-action-button" onClick={fitCanvasToViewport} title="符合視窗">
                <Maximize2 size={15} />
                <span>符合</span>
              </button>
              <button type="button" className="ghost-button view-action-button" onClick={resetCanvasView} title="重設視角">
                <RotateCcw size={14} />
                <span>重設</span>
              </button>
            </div>
          </div>

          {openDesktopTool && (
            <section ref={desktopToolPanelRef} className={`desktop-tool-popover ${isDesktopToolDragging ? "is-dragging" : ""}`} style={desktopToolPopoverStyle} aria-label={`${activeWorkspaceToolLabel}設定`}>
              <div className="desktop-tool-popover-heading" onPointerDown={handleDesktopToolPanelPointerDown}>
                <div>
                  <span className="eyebrow">CREATIVE TOOL</span>
                  <h2>{activeWorkspaceToolLabel}設定</h2>
                </div>
                <button type="button" className="icon-button subtle" onClick={() => setOpenDesktopTool(null)} title="完成設定" aria-label="完成設定"><Check size={16} /></button>
              </div>

              {openDesktopTool === "brush" && (
                <div className="desktop-tool-popover-content">
                  <div className="color-row">
                    <div><span className="field-label">筆刷顏色</span><span className="field-help">從色票或自訂色開始繪製</span></div>
                    <label className="color-picker"><input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} aria-label="筆刷顏色" /><span style={{ backgroundColor: brushColor }} /></label>
                  </div>
                  <RangeControl label="筆刷大小" value={brushSize} min={2} max={160} suffix=" px" onChange={setBrushSize} />
                  <RangeControl label="筆刷不透明度" value={brushOpacity} min={1} max={100} suffix="%" onChange={setBrushOpacity} />
                  <div className="swatch-row floating-swatch-row" role="group" aria-label="筆刷色票">
                    {["#000000", "#1F2528", "#555B5D", "#FFFFFF", "#FFFDF8", "#E4513B", "#B72F34", "#F07C41", "#D59B42", "#2F855A", "#426B8A", "#2D5B9B", "#8B5CF6", "#D26A9C"].map((color) => (
                      <button key={color} type="button" className={`swatch ${brushColor === color ? "is-selected" : ""}`} style={{ backgroundColor: color }} onClick={() => setBrushColor(color)} aria-label={`選擇顏色 ${color}`} />
                    ))}
                  </div>
                </div>
              )}

              {openDesktopTool === "shape" && (
                <div className="desktop-tool-popover-content">
                  <div className="shape-choice-grid floating-shape-grid">
                    <button type="button" className={`shape-choice ${shapeKind === "rectangle" ? "is-active" : ""}`} onClick={() => { setShapeKind("rectangle"); addShape("rectangle"); }}><Square size={18} /><span>方塊</span></button>
                    <button type="button" className={`shape-choice ${shapeKind === "circle" ? "is-active" : ""}`} onClick={() => { setShapeKind("circle"); addShape("circle"); }}><Circle size={18} /><span>圓形</span></button>
                    <button type="button" className={`shape-choice ${shapeKind === "star" ? "is-active" : ""}`} onClick={() => { setShapeKind("star"); addShape("star"); }}><Star size={18} /><span>星星</span></button>
                    <button type="button" className={`shape-choice ${shapeKind === "heart" ? "is-active" : ""}`} onClick={() => { setShapeKind("heart"); addShape("heart"); }}><Heart size={18} /><span>愛心</span></button>
                    <button type="button" className={`shape-choice ${shapeKind === "triangle" ? "is-active" : ""}`} onClick={() => { setShapeKind("triangle"); addShape("triangle"); }}><Triangle size={18} /><span>三角形</span></button>
                    <button type="button" className={`shape-choice ${shapeKind === "pentagon" ? "is-active" : ""}`} onClick={() => { setShapeKind("pentagon"); addShape("pentagon"); }}><Pentagon size={18} /><span>五邊形</span></button>
                  </div>
                  <div className="color-row"><span className="field-label">填色</span><label className="color-picker"><input type="color" value={shapeFill} onChange={(event) => { setShapeFill(event.target.value); if (selectedShape) updateShape({ fill: event.target.value }); }} aria-label="圖形填色" /><span style={{ backgroundColor: shapeFill }} /></label></div>
                  <div className="color-row"><span className="field-label">輪廓</span><label className="color-picker"><input type="color" value={shapeOutline} onChange={(event) => { setShapeOutline(event.target.value); if (selectedShape) updateShape({ outline: event.target.value }); }} aria-label="圖形輪廓" /><span style={{ backgroundColor: shapeOutline }} /></label></div>
                  <RangeControl label="輪廓粗細" value={selectedShape?.outlineWidth ?? shapeOutlineWidth} min={0} max={16} suffix=" px" onChange={(value) => { setShapeOutlineWidth(value); if (selectedShape) updateShape({ outlineWidth: value }); }} />
                  <RangeControl label="圓角半徑" value={selectedShape?.kind === "rectangle" ? selectedShape.cornerRadius : shapeCornerRadius} min={0} max={72} suffix=" px" onChange={(value) => { setShapeCornerRadius(value); if (selectedShape?.kind === "rectangle") updateShape({ cornerRadius: value }); }} />
                  {selectedShape && <RangeControl label="圖形不透明度" value={selectedShape.opacity} min={1} max={100} suffix="%" onChange={(value) => updateShape({ opacity: value })} />}
                </div>
              )}

              {openDesktopTool === "text" && (
                <div className="desktop-tool-popover-content">
                  {!selectedText ? (
                    <p className="empty-inspector">點擊畫布上的文字即可開啟內容與樣式設定。</p>
                  ) : (
                    <>
                      <label className="field-label" htmlFor="desktop-text-content">文字內容</label>
                      <textarea id="desktop-text-content" className="text-input" value={selectedText.text} onChange={(event) => updateTextLayer({ text: event.target.value })} rows={3} />
                      <div className="select-row">
                        <label className="select-wrap">
                          <span className="field-label">字體</span>
                          <select value={selectedText.fontFamily} onChange={(event) => updateTextLayer({ fontFamily: event.target.value as TextLayer["fontFamily"] })}>
                            {TEXT_FONT_OPTIONS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
                          </select>
                          <ChevronDown size={14} />
                        </label>
                      </div>
                      <div className="text-color-control">
                        <div className="text-color-heading"><span className="field-label">文字顏色</span><label className="color-picker compact-color-picker"><input type="color" value={selectedText.color} onChange={(event) => updateTextLayer({ color: event.target.value })} aria-label="自訂文字顏色" /><span style={{ backgroundColor: selectedText.color }} /></label></div>
                        <div className="text-palette" role="group" aria-label="文字色票">
                          {["#000000", "#1F2528", "#555B5D", "#FFFFFF", "#FFFDF8", "#E4513B", "#B72F34", "#F07C41", "#D59B42", "#2F855A", "#426B8A", "#2D5B9B", "#8B5CF6", "#D26A9C"].map((color) => <button key={color} type="button" className={`text-swatch ${selectedText.color.toUpperCase() === color ? "is-selected" : ""}`} style={{ backgroundColor: color }} onClick={() => updateTextLayer({ color })} aria-label={`文字顏色 ${color}`} />)}
                        </div>
                      </div>
                      <RangeControl label="字級" value={selectedText.fontSize} min={12} max={180} suffix=" px" onChange={(value) => updateTextLayer({ fontSize: value })} />
                      <RangeControl label="文字不透明度" value={selectedText.opacity} min={1} max={100} suffix="%" onChange={(value) => updateTextLayer({ opacity: value })} />
                    </>
                  )}
                </div>
              )}
            </section>
          )}

          <div
            className={`canvas-viewport ${isPanning ? "is-panning" : ""}`}
            ref={viewportRef}
            onPointerDown={handleViewportPointerDown}
            onPointerMove={handleViewportPointerMove}
            onPointerUp={finishPan}
            onPointerCancel={finishPan}
          >
            <div className="stage-notes stage-note-bottom">{canvasSize.width} × {canvasSize.height}</div>
            <div
              className="canvas-shell-outer"
              style={{
                width: `${canvasSize.width * (zoom / 100)}px`,
                height: `${canvasSize.height * (zoom / 100)}px`,
                left: `${pan.x}px`,
                top: `${pan.y}px`,
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
                <div className="canvas-content">
                  <canvas
                    ref={canvasRef}
                    style={{ filter: canvasFilter, opacity: adjustments.opacity / 100, pointerEvents: activeDesktopTool === "brush" ? "auto" : "none" }}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={finishStroke}
                    onPointerCancel={finishStroke}
                    onPointerLeave={finishStroke}
                    aria-label="繪圖畫布"
                  />
                  {snapGuides.x !== null && <div className="snap-guide snap-guide-vertical" style={{ left: `${snapGuides.x}px` }} />}
                  {snapGuides.y !== null && <div className="snap-guide snap-guide-horizontal" style={{ top: `${snapGuides.y}px` }} />}
                  {[...strokes, ...(drawingStroke ? [drawingStroke] : [])].map((stroke) => {
                    const isDraftStroke = drawingStroke?.id === stroke.id;
                    const pathPoints = stroke.points.map((point) => `${point.x},${point.y}`).join(" ");
                    const isPencilStroke = stroke.kind === "pencil";
                    const isWatercolorStroke = stroke.kind === "watercolor";
                    const strokeWidth = isPencilStroke ? Math.max(1, stroke.size * 0.52) : isWatercolorStroke ? stroke.size * 1.35 : stroke.size;
                    return (
                      <svg
                        key={stroke.id}
                        className={`stroke-layer ${selectedStrokeId === stroke.id ? "is-selected" : ""} ${isDraftStroke ? "is-draft" : ""}`}
                        viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                        style={{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px` }}
                        onPointerDown={isDraftStroke ? undefined : (event) => handleStrokePointerDown(event, stroke)}
                        role={isDraftStroke ? undefined : "button"}
                        tabIndex={isDraftStroke ? -1 : 0}
                        aria-label="畫筆筆觸"
                      >
                        <g transform={`translate(${stroke.x} ${stroke.y})`}>
                          {stroke.points.length === 1 ? (
                            <>
                              <circle cx={stroke.points[0].x} cy={stroke.points[0].y} r={isPencilStroke ? stroke.size * 0.28 : isWatercolorStroke ? stroke.size * 0.68 : stroke.size / 2} fill={stroke.color} opacity={isWatercolorStroke ? stroke.opacity / 450 : stroke.opacity / 100} />
                              <circle className="stroke-hit-area" cx={stroke.points[0].x} cy={stroke.points[0].y} r={Math.max(12, strokeWidth)} />
                            </>
                          ) : (
                            <>
                              <polyline className="stroke-visible" points={pathPoints} fill="none" stroke={stroke.color} strokeWidth={strokeWidth} strokeLinecap={isPencilStroke ? "butt" : "round"} strokeLinejoin="round" opacity={isWatercolorStroke ? stroke.opacity / 300 : stroke.opacity / 100} />
                              {isWatercolorStroke && <polyline points={pathPoints} fill="none" stroke={stroke.color} strokeWidth={stroke.size * 0.72} strokeLinecap="round" strokeLinejoin="round" opacity={stroke.opacity / 800} transform={`translate(${Math.max(1, stroke.size * 0.18)} ${-Math.max(1, stroke.size * 0.18)})`} />}
                              <polyline className="stroke-hit-area" points={pathPoints} fill="none" strokeWidth={Math.max(18, strokeWidth + 12)} strokeLinecap="round" strokeLinejoin="round" />
                            </>
                          )}
                        </g>
                      </svg>
                    );
                  })}
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className={`image-layer ${selectedImageId === image.id ? "is-selected" : ""} ${selectedImageId === image.id && (snapGuides.x !== null || snapGuides.y !== null) ? "is-snapped" : ""}`}
                      style={{
                        left: `${image.x}px`,
                        top: `${image.y}px`,
                        width: `${image.width}px`,
                        height: `${image.height}px`,
                        transform: `rotate(${image.rotation}deg)`,
                        opacity: image.opacity / 100,
                        filter: makeAdjustmentFilter(image.exposure, image.contrast, image.saturation),
                      }}
                      onPointerDown={(event) => handleImagePointerDown(event, image)}
                      role="button"
                      tabIndex={0}
                      aria-label={`圖片素材：${image.name}`}
                    >
                      <img className="image-layer-content" src={image.src} alt={image.name} draggable={false} />
                      {selectedImageId === image.id && (
                        <>
                          <div className="image-resize-handle image-resize-handle-left" onPointerDown={(event) => handleImageResizePointerDown(event, image, "left")} />
                          <div className="image-resize-handle image-resize-handle-right" onPointerDown={(event) => handleImageResizePointerDown(event, image, "right")} />
                          <div className="image-resize-handle image-resize-handle-top" onPointerDown={(event) => handleImageResizePointerDown(event, image, "top")} />
                          <div className="image-resize-handle image-resize-handle-bottom" onPointerDown={(event) => handleImageResizePointerDown(event, image, "bottom")} />
                          <div className="image-resize-handle image-resize-handle-top-left" onPointerDown={(event) => handleImageResizePointerDown(event, image, "top-left")} />
                          <div className="image-resize-handle image-resize-handle-top-right" onPointerDown={(event) => handleImageResizePointerDown(event, image, "top-right")} />
                          <div className="image-resize-handle image-resize-handle-bottom-left" onPointerDown={(event) => handleImageResizePointerDown(event, image, "bottom-left")} />
                          <div className="image-resize-handle image-resize-handle-bottom-right" onPointerDown={(event) => handleImageResizePointerDown(event, image, "bottom-right")} />
                          <div className="image-rotation-stem" />
                          <div className="image-rotation-handle" onPointerDown={(event) => handleImageRotatePointerDown(event, image)} />
                          <div className="image-rotation-label">{Math.round(image.rotation)}°</div>
                        </>
                      )}
                    </div>
                  ))}
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
                        filter: [
                          makeAdjustmentFilter(shape.exposure, shape.contrast, shape.saturation),
                          shape.shadow ? `drop-shadow(${shape.shadowX}px ${shape.shadowY}px ${shape.shadowBlur}px ${hexToRgba(shape.shadowColor, shape.shadowOpacity / 100)})` : "",
                        ].filter(Boolean).join(" ") || "none",
                      }}
                      onPointerDown={(event) => handleShapePointerDown(event, shape)}
                      onDoubleClick={(event) => handleShapeDoubleClick(event, shape)}
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
                          <rect className="shape-resize-handle shape-resize-handle-corner shape-resize-handle-top-left" x="0" y="0" width="16" height="16" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "top-left")} />
                          <rect className="shape-resize-handle shape-resize-handle-corner shape-resize-handle-top-right" x="84" y="0" width="16" height="16" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "top-right")} />
                          <rect className="shape-resize-handle shape-resize-handle-corner shape-resize-handle-bottom-left" x="0" y="84" width="16" height="16" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "bottom-left")} />
                          <rect className="shape-resize-handle shape-resize-handle-corner shape-resize-handle-bottom-right" x="84" y="84" width="16" height="16" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "bottom-right")} />
                          <line className="shape-rotation-stem" x1="50" y1="0" x2="50" y2="16" />
                          <circle className="shape-rotation-handle" cx="50" cy="24" r="7" onPointerDown={(event) => handleShapeRotatePointerDown(event, shape)} />
                          <text className="shape-rotation-label" x="50" y="38" textAnchor="middle">{Math.round(shape.rotation)}°</text>
                        </>
                      )}
                    </svg>
                  ))}
                  {layers.map((layer) => (
                    <div
                      key={layer.id}
                      className={`text-layer ${selectedTextId === layer.id ? "is-selected" : ""}`}
                      ref={(element) => {
                        if (element) textLayerElementsRef.current.set(layer.id, element);
                        else textLayerElementsRef.current.delete(layer.id);
                      }}
                      style={{
                        left: `${layer.x}px`,
                        top: `${layer.y}px`,
                        color: layer.color,
                        fontSize: `${layer.fontSize}px`,
                        fontWeight: layer.fontWeight,
                      fontFamily: `"${layer.fontFamily}", "Noto Sans TC", "Noto Sans JP", sans-serif`,
                        opacity: layer.opacity / 100,
                        filter: makeAdjustmentFilter(layer.exposure, layer.contrast, layer.saturation),
                      }}
                      onPointerDown={(event) => handleTextPointerDown(event, layer)}
                      contentEditable={editingTextId === layer.id}
                      suppressContentEditableWarning
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        setSelectedTextId(layer.id);
                        setSelectedShapeId(null);
                        setSelectedImageId(null);
                        setTool("text");
                        setActiveDesktopTool("text");
                        setOpenDesktopTool("text");
                        setEditingTextId(layer.id);
                        window.requestAnimationFrame(() => event.currentTarget.focus());
                      }}
                      onInput={(event) => updateTextLayer({ text: event.currentTarget.textContent ?? "" })}
                      onBlur={() => setEditingTextId(null)}
                      onKeyDown={(event) => {
                        if (event.key === "Escape" || (event.key === "Enter" && (event.metaKey || event.ctrlKey))) {
                          event.preventDefault();
                          event.currentTarget.blur();
                        }
                      }}
                      role={editingTextId === layer.id ? "textbox" : "button"}
                      tabIndex={0}
                      aria-label={`文字卡：${layer.text}`}
                    >
                      {layer.text}
                      {selectedTextId === layer.id && <span className="text-layer-tag" contentEditable={false}>TEXT</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <footer className="workspace-footer product-footer" aria-label="AbiPaint 工具說明">
            <div className="product-footnote">
              <span className="product-footnote-label">ABOUT ABIPAINT</span>
              <p>阿比丁身為主攻《名偵探柯南》的網站經營者，時常有「調整照片尺寸」與「提高照片解析度」的需求。在沒安裝 Adobe 且不使用 Canva 的情況下，為了提高工作效率，索性開發了「AbiPaint 線上圖片尺寸修改器」，支援素材圖像的「大小縮放」、「像素校正」與「細節微調」。</p>
            </div>
            <p className="product-copyright">Copyright © 2026 <a href="https://abiting.cc" target="_blank" rel="noopener">阿比丁的第二個家</a></p>
          </footer>

        </section>

        <aside ref={inspectorRef} className={`inspector ${isMobileDrawerDragging ? "is-dragging" : ""}`} aria-label="屬性與調整">
          <button type="button" className="mobile-drawer-handle" onPointerDown={handleMobileDrawerPointerDown} aria-label="拖曳調整設定面板高度"><span /></button>
          <div className="inspector-scroll">
            {/*
              <div className="legacy-tool-settings">
                <SectionTitle
                  eyebrow="TOOL SETTINGS"
                  title={toolPanelTitle}
                  action={<button type="button" className="icon-button subtle" title="面板選項" aria-label="面板選項"><MoreHorizontal size={17} /></button>}
                />

            {(tool === "brush" || tool === "eraser") && !selectedText && !selectedShape && !selectedImage && (
              <div className="inspector-section">
                <div className="tool-panel-callout brush-lockup"><span className="field-label">油線筆</span><p>目前保留的繪筆工具，適合在調整尺寸後做簡單修飾。</p></div>
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
                  {["#000000", "#1F2528", "#555B5D", "#FFFFFF", "#FFFDF8", "#E4513B", "#B72F34", "#F07C41", "#D59B42", "#F4C95D", "#2F855A", "#82A480", "#426B8A", "#2D5B9B", "#8B5CF6", "#D26A9C"].map((color) => (
                    <button key={color} type="button" className={`swatch ${brushColor === color ? "is-selected" : ""}`} style={{ backgroundColor: color }} onClick={() => setBrushColor(color)} aria-label={`選擇顏色 ${color}`} />
                  ))}
                </div>
              </div>
            )}

            {tool === "fill" && !selectedText && !selectedShape && !selectedImage && (
              <div className="inspector-section">
                <div className="tool-panel-callout"><span className="field-label">填色桶</span><p>點擊畫布上的相鄰區域，使用目前前景色填滿。</p></div>
                <div className="color-row">
                  <div><span className="field-label">填色</span><span className="field-help">使用下方色票快速切換</span></div>
                  <label className="color-picker"><input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} aria-label="填色顏色" /><span style={{ backgroundColor: brushColor }} /></label>
                </div>
                <RangeControl label="填色不透明度" value={brushOpacity} min={1} max={100} suffix="%" onChange={setBrushOpacity} />
              </div>
            )}

            {tool === "move" && !selectedText && !selectedShape && !selectedImage && (
              <div className="inspector-section"><div className="tool-panel-callout"><span className="field-label">移動工具</span><p>點選圖片、圖形或文字卡後拖曳，可移動畫布上的物件。</p><span className="tool-key-hint">快捷鍵 V</span></div></div>
            )}

            {tool === "retouch" && !selectedText && !selectedShape && !selectedImage && (
              <div className="inspector-section">
                <div className="tool-panel-callout"><span className="field-label">移除瑕疵</span><p>在髒污、痘痘或小型浮水印上塗抹，使用周圍像素進行柔化修補。</p></div>
                <RangeControl label="修補筆刷大小" value={brushSize} min={4} max={160} suffix=" px" onChange={setBrushSize} />
                <RangeControl label="修補強度" value={brushOpacity} min={1} max={100} suffix="%" onChange={setBrushOpacity} />
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

            {selectedImage && (
              <div className="inspector-section image-inspector-section">
                <SectionTitle eyebrow="IMAGE LAYER" title="圖片素材" action={<ImagePlus size={15} className="section-icon" />} />
                <div className="image-layer-meta"><span>檔案</span><strong>{selectedImage.name}</strong></div>
                <p className="empty-inspector">可在畫布上拖曳圖片移動，使用邊角控制點拉伸，或拖曳旋轉控制點調整角度。</p>
                <button type="button" className="secondary-button full-width" onClick={deleteSelectedImage}><Trash2 size={14} /> 移除圖片</button>
              </div>
            )}

            {(tool === "text" || selectedText) && (
              <div className="inspector-section text-inspector-section">
                {!selectedText && <p className="empty-inspector">選擇畫布上的文字，或按左側「文字工具」建立文字卡。</p>}
                {selectedText && (
                  <>
                    <label className="field-label" htmlFor="text-content">文字內容</label>
                    <textarea id="text-content" className="text-input" value={selectedText.text} onChange={(event) => updateTextLayer({ text: event.target.value })} rows={3} />
                    <div className="select-row">
                      <label className="select-wrap">
                        <span className="field-label">字型</span>
                        <select value={selectedText.fontFamily} onChange={(event) => updateTextLayer({ fontFamily: event.target.value as TextLayer["fontFamily"] })}>
                          {TEXT_FONT_OPTIONS.map((font) => <option key={font.value} value={font.value}>{font.label}</option>)}
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
              </div>
            )}
            */}

            <div className="inspector-divider" />

            <div className="inspector-section">
              <SectionTitle eyebrow="CANVAS" title="畫布尺寸" action={<Maximize2 size={15} className="section-icon" />} />
              <div className="dimension-grid">
                <label><span>寬度</span><input id="canvas-width" type="number" min={240} max={2400} defaultValue={canvasSize.width} key={`width-${canvasSize.width}`} /></label>
                <span className="dimension-mark">×</span>
                <label><span>高度</span><input id="canvas-height" type="number" min={180} max={1800} defaultValue={canvasSize.height} key={`height-${canvasSize.height}`} /></label>
              </div>
              <button type="button" className="secondary-button full-width" onClick={resizeCanvas}>套用解析度</button>
              <label className="toggle-row resolution-scale-toggle">
                <span>等比例縮放圖片</span>
                <input type="checkbox" checked={scaleImagesWithCanvas} onChange={(event) => setScaleImagesWithCanvas(event.target.checked)} />
              </label>
              <div className="resolution-preset-row">
                <button type="button" className="resolution-preset" onClick={() => applyResolutionPreset(800, 800)}>800 × 800</button>
                <button type="button" className="resolution-preset" onClick={() => applyResolutionPreset(1200, 800)}>1200 × 800</button>
                <button type="button" className="resolution-preset" onClick={() => applyResolutionPreset(1280, 720)}>1280 × 720</button>
              </div>
              <div className="canvas-meta"><span>比例</span><span className="mono-value">{(canvasSize.width / canvasSize.height).toFixed(2)} : 1</span></div>
            </div>

            <div className="inspector-divider" />

            <div className="inspector-section">
              <SectionTitle eyebrow="IMAGE ADJUSTMENTS" title="影像調整" action={<SlidersHorizontal size={15} className="section-icon" />} />
              <RangeControl label="曝光" value={activeAdjustmentValues.exposure} min={-60} max={60} suffix="%" onChange={(value) => updateActiveAdjustment({ exposure: value })} />
              <RangeControl label="對比" value={activeAdjustmentValues.contrast} min={-60} max={60} suffix="%" onChange={(value) => updateActiveAdjustment({ contrast: value })} />
              <RangeControl label="飽和度" value={activeAdjustmentValues.saturation} min={0} max={200} suffix="%" onChange={(value) => updateActiveAdjustment({ saturation: value })} />
              <RangeControl label="不透明度" value={activeAdjustmentValues.opacity} min={1} max={100} suffix="%" onChange={(value) => updateActiveAdjustment({ opacity: value })} />
              <button type="button" className="link-button" onClick={resetActiveAdjustment}><RotateCcw size={13} /> 重設目前調整</button>
            </div>

            <div className="inspector-divider" />

          </div>
        </aside>
      </div>
    </main>
  );
}
