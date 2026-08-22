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
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Crop,
  Download,
  Eraser,
  ExternalLink,
  GripVertical,
  Heart,
  ImagePlus,
  Layers,
  Lock,
  Fullscreen,
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
  SquareDashed,
  Star,
  Triangle,
  Pentagon,
  Trash2,
  Type,
  Unlock,
  Undo2,
  Upload,
  UserRound,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import { toCanvas } from "html-to-image";
import type * as Ort from "onnxruntime-web";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Tool = "brush" | "eraser" | "fill" | "text" | "shape" | "retouch" | "move" | "crop";
type DesktopCreativeTool = Extract<Tool, "brush" | "shape" | "text"> | "outline";
type BrushKind = "oil" | "pencil" | "brush";
type ShapeKind = "rectangle" | "circle" | "star" | "heart" | "triangle" | "pentagon";
type ShapeResizeAxis = "left" | "right" | "top" | "bottom" | "top-left" | "top-right" | "bottom-left" | "bottom-right";
type CropHandleAxis = ShapeResizeAxis | "move";
type Locale = "zh-Hant" | "en";
type MaterialType = "stroke" | "image" | "shape" | "text";
type DesktopToolPanel = DesktopCreativeTool | "object";
type ExportFormat = "png" | "jpeg" | "pdf";
type KofiWidgetOverlay = {
  draw: (pageId: string, configuration: Record<string, string>) => void;
};
type KofiWindow = Window & typeof globalThis & {
  kofiWidgetOverlay?: KofiWidgetOverlay;
  __abiPaintKofiMounted?: boolean;
};

const localeCopy = {
  "zh-Hant": {
    title: "AbiPaint 線上圖片尺寸修改器｜照片像素調整・圖像解析度縮放",
    description: "AbiPaint 是免費線上圖片尺寸修改器，不用安裝 Adobe 或註冊 Canva，直接在瀏覽器調整照片尺寸、像素與解析度。",
    canonical: "https://abipaint.abiting.cc/",
    documentName: "未命名畫布",
    importImage: "匯入影像",
    exportImage: "匯出影像",
    project: "檔案",
    exportProject: "匯出專案",
    importProject: "匯入專案",
    resetWorkingFile: "全部重置",
    resetWorkingFileTitle: "確定要重置當前畫布嗎？",
    resetWorkingFileDescription: "",
    cancel: "取消",
    confirmResetWorkingFile: "確定",
    workingFileReset: "目前工作檔已重置",
    exportPng: "匯出 PNG",
    exportJpg: "匯出 JPG",
    exportPdf: "匯出 PDF",
    undo: "復原",
    redo: "重做",
    language: "EN",
    languageLabel: "Switch to English",
    creative: "創作工具",
    select: "選取",
    brush: "筆刷",
    shape: "圖形",
    text: "文字",
    settings: "設定",
    openSettings: "開啟已選取物件設定",
    canvasWorkspace: "畫布工作區",
    resolution: "解析度調整",
    workspaceSignature: "本工具由阿比丁開發製作",
    fit: "展開",
    reset: "重設",
    canvasSize: "畫布尺寸",
    width: "寬度",
    height: "高度",
    applyResolution: "套用解析度",
    scaleImages: "等比例縮放圖片",
    businessCardTemplates: "設計模板",
    asiaBusinessCard: "亞洲名片標準",
    westernBusinessCard: "歐美名片標準",
    businessCardBleed: "3 mm 出血線",
    imageAdjustments: "影像調色",
    exposure: "曝光度",
    contrast: "對比度",
    saturation: "飽和度",
    vibrancy: "亮麗度",
    opacity: "不透明度",
    faqTitle: "使用說明",
    faqClose: "關閉常見問題",
    faqAria: "AbiPaint 常見問題",
    developer: "開發者",
    developerTitle: "阿比丁",
    developerClose: "關閉開發者介紹",
    developerAria: "AbiPaint 開發者介紹",
    developerBio: "台灣開發者兼創作者，畢業於國立陽明交通大學。曾獨立製作多款免費線上工具，希望能透過技術造福更多人類。",
    developerWorks: "其他代表作",
    faq: [
      ["AbiPaint 是什麼？", "AbiPaint 是免費線上圖片尺寸修改器，不用安裝 Adobe 或註冊 Canva，直接在瀏覽器調整照片尺寸、像素與解析度。"],
      ["什麼情況會使用 AbiPaint？", "想修改圖片、照片的解析度，但手邊沒有 Photoshop、Illustrator 或 Canva 時，本工具可快速派上用場："],
      ["使用 AbiPaint 是否需要註冊帳號？", "完全不需要！AbiPaint 提供免費、免註冊與免安裝的修圖服務，打開網頁即可直接使用，適合所有電腦、平板與手機用戶。"],
      ["AbiPaint 還有什麼功能？", "除了修改圖片尺寸，AbiPaint 也提供畫筆、圖形與文字等多種素材，適合學生、教師、設計師、行銷人員等各行各業使用。"],
      ["發現錯誤資訊該怎麼辦？", "若發現錯誤資訊，歡迎透過以下電子郵件聯繫開發人員："],
    ],
    faqList: ["將 1080 × 1080 的大頭照縮小為符合線上系統規範的尺寸", "將遭 AI 工具壓縮失真的網站 Banner 校正並還原細節樣貌", "將檔案肥大的 PNG 插畫修改並轉換為不佔空間的 JPG 圖檔"],
  },
  en: {
    title: "AbiPaint Online Image Resizer | Resize Photos, Pixels & Resolution",
    description: "AbiPaint is a free online image resizer. Resize photos, adjust pixels and resolution directly in your browser—no Adobe installation or Canva account required.",
    canonical: "https://abipaint.abiting.cc/en",
    documentName: "Untitled canvas",
    importImage: "Import image",
    exportImage: "Export image",
    project: "File",
    exportProject: "Export project",
    importProject: "Import project",
    resetWorkingFile: "Reset all",
    resetWorkingFileTitle: "Clear the current Working File?",
    resetWorkingFileDescription: "Warning: This removes images, text, shapes, strokes, and layers from the current Working File and restores a blank canvas.",
    cancel: "Cancel",
    confirmResetWorkingFile: "Confirm",
    workingFileReset: "Current Working File reset",
    exportPng: "Export PNG",
    exportJpg: "Export JPG",
    exportPdf: "Export PDF",
    undo: "Undo",
    redo: "Redo",
    language: "繁中",
    languageLabel: "切換至繁體中文",
    creative: "CREATIVE",
    select: "Select",
    brush: "Brush",
    shape: "Shapes",
    text: "Text",
    settings: "Settings",
    openSettings: "Open selected object settings",
    canvasWorkspace: "Canvas workspace",
    resolution: "Resolution",
    workspaceSignature: "Developed by Abiting",
    fit: "Expand",
    reset: "Reset",
    canvasSize: "Canvas size",
    width: "Width",
    height: "Height",
    applyResolution: "Apply resolution",
    scaleImages: "Scale images proportionally",
    businessCardTemplates: "Design templates",
    asiaBusinessCard: "Asia Business Card",
    westernBusinessCard: "Western Business Card",
    businessCardBleed: "3 mm bleed guide",
    imageAdjustments: "Image adjustments",
    exposure: "Exposure",
    contrast: "Contrast",
    saturation: "Saturation",
    vibrancy: "Vibrancy",
    opacity: "Opacity",
    faqTitle: "How it works",
    faqClose: "Close FAQ",
    faqAria: "AbiPaint frequently asked questions",
    developer: "Developer",
    developerTitle: "Abiting",
    developerClose: "Close developer profile",
    developerAria: "AbiPaint developer profile",
    developerBio: "Taiwanese developer and creator, graduate of National Yang Ming Chiao Tung University. Has independently created a range of free online tools, with the hope of benefiting more people through technology.",
    developerWorks: "Other featured projects",
    faq: [
      ["What is AbiPaint?", "AbiPaint is a free online image resizer. Resize photos, adjust pixels and resolution right in your browser—no Adobe installation or Canva account required."],
      ["When should I use AbiPaint?", "Use AbiPaint when you need to resize or refine an image but do not have Photoshop, Illustrator, or Canva nearby:"],
      ["Do I need an account?", "No. AbiPaint is free, registration-free, and installation-free, so it works immediately on computers, tablets, and phones."],
      ["What else can AbiPaint do?", "Beyond resizing images, AbiPaint includes brush, shape, and text materials for students, teachers, designers, marketers, and everyday creators."],
      ["How do I report an issue?", "If you find an issue, contact the developer by email:"],
    ],
    faqList: ["Resize a 1080 × 1080 profile photo to match an online system requirement", "Refine a web banner softened by an AI image tool", "Convert a large PNG illustration into a lighter JPG file"],
  },
} as const;

const developerWorks = [
  { href: "https://coai.abiting.cc/japan-address-generator", zh: "日本地址產生器", en: "Japan Address Generator" },
  { href: "https://coai.abiting.cc/blank-line-generator", zh: "空白符號產生器", en: "Blank Line Generator" },
  { href: "https://coai.abiting.cc/traditional_simplified_converter", zh: "繁簡中文轉換器", en: "Chinese Traditional/Simplified Converter" },
  { href: "https://abitingpokedex.com", zh: "寶可夢能力點數計算器", en: "Pokémon Stat Points Calculator" },
  { href: "https://coai.abiting.cc", zh: "名偵探柯南集數列表", en: "List of Detective Conan episodes" },
] as const;

type EasterEggEntry = {
  id: string;
  dateTime: string;
  dateLabel: string;
  src: string;
  alt: string;
  zhCaption: string;
  enCaption: string;
};

const easterEggArchive: readonly EasterEggEntry[] = [
  {
    id: "abi-2026-08-16",
    dateTime: "2026-08-16",
    dateLabel: "2026.08.16",
    src: "https://coai.abiting.cc/wp-content/uploads/2026/08/Bazaart_FBDC2594-967A-4E63-B52D-0B174FF3D65A.jpeg",
    alt: "線上圖片尺寸修改",
    zhCaption: "白底虎斑貓 Abi 今年九歲 😼",
    enCaption: "Abi, a nine-year-old white-and-tabby cat 😼",
  },
];

type CanvasPoint = {
  x: number;
  y: number;
};

type OutlineAdjustments = {
  outlineWidth?: number;
  outlineExposure?: number;
  outlineContrast?: number;
  outlineSaturation?: number;
  outlineVibrancy?: number;
  outlineOpacity?: number;
};

type TextLayer = OutlineAdjustments & {
  id: string;
  paintLayerId: string;
  stackOrder?: number;
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
  vibrancy: number;
  shadowOpacity: number;
  outlineColor?: string;
  fontFamily: "Noto Sans TC" | "Noto Serif TC" | "LXGW WenKai TC" | "PMingLiU" | "Arial" | "DM Sans" | "IBM Plex Mono" | "Kaisei Decol" | "Klee One" | "Kosugi Maru" | "M PLUS Rounded 1c" | "Shippori Mincho" | "Times New Roman" | "Yomogi" | "Zen Kaku Gothic New";
  anchorShapeId?: string;
  rasterDataUrl?: string;
  rasterWidth?: number;
  rasterHeight?: number;
  rasterVersion?: number;
};

type ShapeLayer = OutlineAdjustments & {
  id: string;
  paintLayerId: string;
  stackOrder?: number;
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
  vibrancy: number;
  outline: string;
  outlineWidth: number;
  shadow: boolean;
  shadowColor: string;
  shadowOpacity: number;
  shadowBlur: number;
  shadowX: number;
  shadowY: number;
};

type ImageLayer = OutlineAdjustments & {
  id: string;
  paintLayerId: string;
  stackOrder?: number;
  name: string;
  src: string;
  backgroundSource?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  exposure: number;
  contrast: number;
  saturation: number;
  vibrancy: number;
  shadowOpacity: number;
  outlineColor?: string;
  crop?: ImageCrop;
};

type ImageCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type BackgroundRepairState = {
  imageId: string;
  mode: "keep" | "remove";
  brushSize: number;
};

type BrushStroke = {
  id: string;
  paintLayerId: string;
  stackOrder?: number;
  points: CanvasPoint[];
  x: number;
  y: number;
  color: string;
  size: number;
  opacity: number;
  kind: BrushKind;
  shadowOpacity?: number;
  outlineColor?: string;
  outlineWidth?: number;
  outlineExposure?: number;
  outlineContrast?: number;
  outlineSaturation?: number;
  outlineVibrancy?: number;
  outlineOpacity?: number;
};

type PaintLayer = {
  id: string;
  name: string;
  locked: boolean;
};

type MaterialStackEntry = {
  type: MaterialType;
  id: string;
  paintLayerId: string;
  stackOrder: number;
};

type ObjectClipboard =
  | { type: "text"; item: TextLayer }
  | { type: "shape"; item: ShapeLayer }
  | { type: "image"; item: ImageLayer }
  | { type: "stroke"; item: BrushStroke };

type BleedGuide = {
  inset: number;
};

type SnapGuides = {
  x: number | null;
  y: number | null;
};

type HistoryItem = {
  width: number;
  height: number;
  imageData: ImageData;
  backgroundColor?: string;
  bleedGuide?: BleedGuide | null;
  layers: TextLayer[];
  shapes: ShapeLayer[];
  images: ImageLayer[];
  strokes: BrushStroke[];
};

type Adjustments = {
  exposure: number;
  contrast: number;
  saturation: number;
  vibrancy: number;
  opacity: number;
};
type AdjustmentPatch = Partial<Adjustments>;

type AbiPaintProject = {
  format: "abipaint-project";
  version: 1 | 2 | 3 | 4 | 5;
  savedAt: string;
  hasArtwork: boolean;
  canvas: {
    width: number;
    height: number;
    baseImage: string;
    bleedGuide: BleedGuide | null;
    adjustments: Adjustments;
  };
  document: {
    name: string;
    fileMeta: { name: string; size: string };
    scaleImagesWithCanvas: boolean;
  };
  paintLayers: PaintLayer[];
  activePaintLayerId: string;
  materials: {
    layers: TextLayer[];
    shapes: ShapeLayer[];
    images: ImageLayer[];
    strokes: BrushStroke[];
  };
  tools: {
    brushKind: BrushKind;
    brushColor: string;
    brushSize: number;
    brushOpacity: number;
    shapeKind: ShapeKind;
    shapeFill: string;
    shapeOutline: string;
    shapeOutlineWidth: number;
    shapeShadow: boolean;
    shapeOpacity: number;
    shapeShadowOpacity: number;
    shapeCornerRadius: number;
  };
};

type WorkingFile = {
  id: string;
  project: AbiPaintProject;
};

type AbiPaintWorkspace = {
  format: "abipaint-workspace";
  version: 1;
  activeWorkingFileId: string;
  files: WorkingFile[];
};

const BRAND_RED = "#E4513B";
const PAPER = "#FFFDF8";
const GRAPHITE = "#1F2528";
const MAX_PAINT_LAYERS = 5;
const MOBILE_VIEWPORT_MEDIA_QUERY = "(max-width: 960px), (pointer: coarse) and (max-height: 600px)";
const TEXT_RASTER_VERSION = 4;
const BASE_PAINT_LAYER_ID = "paint-layer-base";
const U2NETP_MODEL_URL = "https://cdn.jsdelivr.net/npm/modern-rembg@0.1.2/dist/u2netp.onnx";
const ONNX_RUNTIME_WASM_URL = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.27.0/dist/";
const BACKGROUND_REMOVAL_MAX_EDGE = 2560;
const BACKGROUND_REMOVAL_MASK_THRESHOLD = 0.25;
const BACKGROUND_REMOVAL_DETAIL_THRESHOLD = 0.1;
const AUTOSAVE_DB_NAME = "abipaint-project-storage";
const AUTOSAVE_DB_STORE = "projects";
const AUTOSAVE_PROJECT_KEY = "current-project";
const AUTOSAVE_WORKSPACE_KEY = "current-workspace";
const MAX_WORKING_FILES = 3;
const MATERIAL_STACK_BASE: Record<MaterialType, number> = {
  stroke: 0,
  image: 1000,
  shape: 2000,
  text: 3000,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const fillEnclosedMaskHoles = (mask: Uint8Array, width: number, height: number) => {
  const reachableBackground = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  let head = 0;
  let tail = 0;
  const enqueueBackground = (index: number) => {
    if (mask[index] || reachableBackground[index]) return;
    reachableBackground[index] = 1;
    queue[tail] = index;
    tail += 1;
  };

  for (let x = 0; x < width; x += 1) {
    enqueueBackground(x);
    enqueueBackground((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueueBackground(y * width);
    enqueueBackground(y * width + width - 1);
  }

  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueueBackground(index - 1);
    if (x < width - 1) enqueueBackground(index + 1);
    if (y > 0) enqueueBackground(index - width);
    if (y < height - 1) enqueueBackground(index + width);
  }

  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] && !reachableBackground[index]) mask[index] = 1;
  }
};

const preserveConnectedMaskDetails = (mask: Uint8Array, confidence: Float32Array, width: number, height: number) => {
  const queue = new Int32Array(mask.length);
  let head = 0;
  let tail = 0;
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index]) {
      queue[tail] = index;
      tail += 1;
    }
  }
  const addDetail = (index: number) => {
    if (mask[index] || confidence[index] < BACKGROUND_REMOVAL_DETAIL_THRESHOLD) return;
    mask[index] = 1;
    queue[tail] = index;
    tail += 1;
  };
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) addDetail(index - 1);
    if (x < width - 1) addDetail(index + 1);
    if (y > 0) addDetail(index - width);
    if (y < height - 1) addDetail(index + width);
  }
};

const closeThinMaskGaps = (mask: Uint8Array, width: number, height: number) => {
  const repaired = new Uint8Array(mask);
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = y * width + x;
      if (mask[index]) continue;
      const horizontal = mask[index - 1] && mask[index + 1];
      const vertical = mask[index - width] && mask[index + width];
      const diagonalDown = mask[index - width - 1] && mask[index + width + 1];
      const diagonalUp = mask[index - width + 1] && mask[index + width - 1];
      if (horizontal || vertical || diagonalDown || diagonalUp) repaired[index] = 1;
    }
  }
  mask.set(repaired);
};

const refineMaskAgainstUniformBackground = (source: ImageData, mask: ImageData, width: number, height: number) => {
  const sampleIndices: number[] = [];
  const step = Math.max(1, Math.floor(Math.min(width, height) / 48));
  for (let x = 0; x < width; x += step) {
    sampleIndices.push(x, (height - 1) * width + x);
  }
  for (let y = step; y < height - 1; y += step) {
    sampleIndices.push(y * width, y * width + width - 1);
  }
  if (!sampleIndices.length) return;
  const background = [0, 0, 0];
  for (const index of sampleIndices) {
    const offset = index * 4;
    background[0] += source.data[offset];
    background[1] += source.data[offset + 1];
    background[2] += source.data[offset + 2];
  }
  background[0] /= sampleIndices.length;
  background[1] /= sampleIndices.length;
  background[2] /= sampleIndices.length;
  let deviation = 0;
  for (const index of sampleIndices) {
    const offset = index * 4;
    deviation += Math.abs(source.data[offset] - background[0]) + Math.abs(source.data[offset + 1] - background[1]) + Math.abs(source.data[offset + 2] - background[2]);
  }
  deviation /= sampleIndices.length * 3;
  if (deviation > 16) return;
  const distanceLimit = Math.max(38, deviation * 5);
  const isBackgroundLike = (index: number) => {
    const offset = index * 4;
    const distance = Math.abs(source.data[offset] - background[0]) + Math.abs(source.data[offset + 1] - background[1]) + Math.abs(source.data[offset + 2] - background[2]);
    return distance <= distanceLimit;
  };
  const reachable = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const enqueue = (index: number) => {
    if (reachable[index] || !isBackgroundLike(index)) return;
    reachable[index] = 1;
    queue[tail] = index;
    tail += 1;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head];
    head += 1;
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x < width - 1) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y < height - 1) enqueue(index + width);
  }
  for (let index = 0; index < reachable.length; index += 1) {
    if (reachable[index]) mask.data[index * 4 + 3] = 0;
  }
};

const normalizeProjectSaturation = (value: unknown, version: AbiPaintProject["version"]) => {
  const rawValue = typeof value === "number" ? value : version <= 2 ? 100 : 0;
  if (version <= 2) return clamp(rawValue - 100, -100, 100);
  if (version === 3) return clamp(rawValue + 100, -100, 100);
  return clamp(rawValue, -100, 100);
};

const normalizeProjectVibrancy = (value: unknown) =>
  clamp(typeof value === "number" ? value : 0, -100, 100);

const migrateProjectAdjustments = (project: AbiPaintProject): AbiPaintProject => {
  if (project.version === 5) return project;
  const migrate = (value: unknown) => normalizeProjectSaturation(value, project.version);
  return {
    ...project,
    version: 5,
    canvas: {
      ...project.canvas,
      adjustments: { ...project.canvas.adjustments, saturation: migrate(project.canvas.adjustments?.saturation), vibrancy: normalizeProjectVibrancy(project.canvas.adjustments?.vibrancy) },
    },
    materials: {
      layers: project.materials.layers.map((layer) => ({ ...layer, saturation: migrate(layer.saturation), vibrancy: normalizeProjectVibrancy(layer.vibrancy) })),
      shapes: project.materials.shapes.map((shape) => ({ ...shape, saturation: migrate(shape.saturation), vibrancy: normalizeProjectVibrancy(shape.vibrancy) })),
      images: project.materials.images.map((image) => ({ ...image, saturation: migrate(image.saturation), vibrancy: normalizeProjectVibrancy(image.vibrancy) })),
      strokes: project.materials.strokes,
    },
  };
};

const openProjectDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = window.indexedDB.open(AUTOSAVE_DB_NAME, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(AUTOSAVE_DB_STORE)) {
      request.result.createObjectStore(AUTOSAVE_DB_STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const readAutoSavedProject = async () => {
  const database = await openProjectDatabase();
  return new Promise<unknown>((resolve, reject) => {
    const request = database.transaction(AUTOSAVE_DB_STORE, "readonly").objectStore(AUTOSAVE_DB_STORE).get(AUTOSAVE_PROJECT_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
};

const writeAutoSavedProject = async (project: AbiPaintProject) => {
  const database = await openProjectDatabase();
  return new Promise<void>((resolve, reject) => {
    const request = database.transaction(AUTOSAVE_DB_STORE, "readwrite").objectStore(AUTOSAVE_DB_STORE).put(project, AUTOSAVE_PROJECT_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
};

const readAutoSavedWorkspace = async () => {
  const database = await openProjectDatabase();
  return new Promise<unknown>((resolve, reject) => {
    const request = database.transaction(AUTOSAVE_DB_STORE, "readonly").objectStore(AUTOSAVE_DB_STORE).get(AUTOSAVE_WORKSPACE_KEY);
    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
};

const writeAutoSavedWorkspace = async (workspace: AbiPaintWorkspace) => {
  const database = await openProjectDatabase();
  return new Promise<void>((resolve, reject) => {
    const request = database.transaction(AUTOSAVE_DB_STORE, "readwrite").objectStore(AUTOSAVE_DB_STORE).put(workspace, AUTOSAVE_WORKSPACE_KEY);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }).finally(() => database.close());
};

const isAbiPaintProject = (value: unknown): value is AbiPaintProject => {
  if (!value || typeof value !== "object") return false;
  const project = value as Partial<AbiPaintProject>;
  return project.format === "abipaint-project"
    && (project.version === 1 || project.version === 2 || project.version === 3 || project.version === 4 || project.version === 5)
    && Boolean(project.canvas)
    && Boolean(project.document)
    && Boolean(project.materials)
    && Array.isArray(project.paintLayers)
    && Array.isArray(project.materials?.layers)
    && Array.isArray(project.materials?.shapes)
    && Array.isArray(project.materials?.images)
    && Array.isArray(project.materials?.strokes);
};

const isAbiPaintWorkspace = (value: unknown): value is AbiPaintWorkspace => {
  if (!value || typeof value !== "object") return false;
  const workspace = value as Partial<AbiPaintWorkspace>;
  return workspace.format === "abipaint-workspace"
    && workspace.version === 1
    && typeof workspace.activeWorkingFileId === "string"
    && Array.isArray(workspace.files)
    && workspace.files.length > 0
    && workspace.files.length <= MAX_WORKING_FILES
    && workspace.files.every((file) => typeof file?.id === "string" && isAbiPaintProject(file.project));
};

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
const FULL_IMAGE_CROP: ImageCrop = { x: 0, y: 0, width: 1, height: 1 };
const SHAPE_LABELS: Record<ShapeKind, string> = {
  rectangle: "方塊",
  circle: "圓形",
  star: "星星",
  heart: "愛心",
  triangle: "三角形",
  pentagon: "五邊形",
};
const TEXT_FONT_OPTIONS: Array<{ value: TextLayer["fontFamily"]; label: string; labelEn?: string }> = [
  { value: "Noto Sans TC", label: "思源黑體", labelEn: "Noto Sans TC" },
  { value: "Noto Serif TC", label: "思源宋體", labelEn: "Noto Serif TC" },
  { value: "PMingLiU", label: "新細明體", labelEn: "PMingLiU" },
  { value: "LXGW WenKai TC", label: "楷體", labelEn: "Kai" },
  { value: "Arial", label: "Arial" },
  { value: "DM Sans", label: "DM Sans" },
  { value: "IBM Plex Mono", label: "IBM Plex Mono" },
  { value: "Kaisei Decol", label: "Kaisei Decol" },
  { value: "Klee One", label: "Klee One" },
  { value: "Kosugi Maru", label: "Kosugi Maru" },
  { value: "M PLUS Rounded 1c", label: "M PLUS Rounded 1c" },
  { value: "Shippori Mincho", label: "Shippori Mincho" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Yomogi", label: "Yomogi" },
  { value: "Zen Kaku Gothic New", label: "Zen Kaku Gothic New" },
];
const makeAdjustmentFilter = (exposure: number, contrast: number, saturation: number, vibrancy = 0) => {
  const vibrancySaturation = vibrancy >= 0 ? vibrancy * 0.35 : vibrancy * 0.5;
  return `brightness(${100 + exposure}%) contrast(${100 + contrast}%) saturate(${100 + saturation + vibrancySaturation}%)`;
};

const hexToRgba = (hex: string, opacity: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const makeOutlineColor = (hex: string, exposure = 0, contrast = 0, saturation = 0, vibrancy = 0, opacity = 100) => {
  const source = hexToRgb(hex);
  const applyExposureAndContrast = (channel: number) => clamp(((channel + exposure * 2.55 - 128) * (1 + contrast / 100)) + 128, 0, 255);
  const exposed = {
    r: applyExposureAndContrast(source.r),
    g: applyExposureAndContrast(source.g),
    b: applyExposureAndContrast(source.b),
  };
  const luma = exposed.r * 0.2126 + exposed.g * 0.7152 + exposed.b * 0.0722;
  const colorfulness = (Math.max(exposed.r, exposed.g, exposed.b) - Math.min(exposed.r, exposed.g, exposed.b)) / 255;
  const saturationFactor = Math.max(0, 1 + saturation / 100 + (vibrancy / 100) * 0.35 * (1 - colorfulness));
  const adjusted = (channel: number) => Math.round(clamp(luma + (channel - luma) * saturationFactor, 0, 255));
  return `rgba(${adjusted(exposed.r)}, ${adjusted(exposed.g)}, ${adjusted(exposed.b)}, ${clamp(opacity, 0, 100) / 100})`;
};

const makeAlphaOutlineFilter = (color: string, width: number) => {
  if (width <= 0) return "";
  const segments = Math.max(16, Math.min(48, Math.ceil(width * 2)));
  return Array.from({ length: segments }, (_, index) => {
    const angle = (Math.PI * 2 * index) / segments;
    return `drop-shadow(${Math.cos(angle) * width}px ${Math.sin(angle) * width}px 0 ${color})`;
  }).join(" ");
};

const drawAlphaOutline = (context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, color: string, thickness: number) => {
  if (thickness <= 0) return;
  const surface = document.createElement("canvas");
  surface.width = Math.max(1, Math.ceil(width));
  surface.height = Math.max(1, Math.ceil(height));
  const surfaceContext = surface.getContext("2d");
  if (!surfaceContext) return;
  surfaceContext.drawImage(image, 0, 0, width, height);
  surfaceContext.globalCompositeOperation = "source-in";
  surfaceContext.fillStyle = color;
  surfaceContext.fillRect(0, 0, width, height);
  const segments = Math.max(16, Math.min(48, Math.ceil(thickness * 2)));
  for (let index = 0; index < segments; index += 1) {
    const angle = (Math.PI * 2 * index) / segments;
    context.drawImage(surface, -width / 2 + Math.cos(angle) * thickness, -height / 2 + Math.sin(angle) * thickness, width, height);
  }
};

const getMaterialStackOrder = (
  type: MaterialType,
  item: { stackOrder?: number },
  index: number,
) => item.stackOrder ?? MATERIAL_STACK_BASE[type] + index;

const drawBrushBristles = (
  context: CanvasRenderingContext2D,
  from: CanvasPoint,
  to: CanvasPoint,
  color: string,
  size: number,
  opacity: number,
) => {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < 0.25) return;
  const unitX = deltaX / distance;
  const unitY = deltaY / distance;
  const normalX = -unitY;
  const normalY = unitX;
  const tailLength = Math.min(size * 0.8, Math.max(1, distance * 0.46));
  const bristles = [-0.28, 0, 0.28];

  context.save();
  context.strokeStyle = color;
  context.lineCap = "round";
  bristles.forEach((offset, index) => {
    const spread = offset * size;
    context.globalAlpha = opacity * (index === 1 ? 0.32 : 0.2);
    context.lineWidth = Math.max(0.8, size * (index === 1 ? 0.15 : 0.1));
    context.beginPath();
    context.moveTo(from.x + normalX * spread, from.y + normalY * spread);
    context.lineTo(to.x - unitX * tailLength + normalX * spread, to.y - unitY * tailLength + normalY * spread);
    context.stroke();
  });
  context.restore();
};

const getBrushSegmentShape = (from: CanvasPoint, to: CanvasPoint, size: number) => {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < 0.25) return null;
  const unitX = deltaX / distance;
  const unitY = deltaY / distance;
  const normalX = -unitY;
  const normalY = unitX;
  const startHalfWidth = size * 0.5;
  const endHalfWidth = Math.max(1, size * 0.47);
  return {
    startLeft: { x: from.x + normalX * startHalfWidth, y: from.y + normalY * startHalfWidth },
    startRight: { x: from.x - normalX * startHalfWidth, y: from.y - normalY * startHalfWidth },
    endLeft: { x: to.x + normalX * endHalfWidth, y: to.y + normalY * endHalfWidth },
    endRight: { x: to.x - normalX * endHalfWidth, y: to.y - normalY * endHalfWidth },
  };
};

const drawBrushCalligraphySegment = (
  context: CanvasRenderingContext2D,
  from: CanvasPoint,
  to: CanvasPoint,
  color: string,
  size: number,
  opacity: number,
) => {
  const segment = getBrushSegmentShape(from, to, size);
  if (!segment) return;
  context.save();
  context.fillStyle = color;
  context.globalAlpha = opacity * 0.86;
  context.beginPath();
  context.moveTo(segment.startLeft.x, segment.startLeft.y);
  context.lineTo(segment.endLeft.x, segment.endLeft.y);
  context.lineTo(segment.endRight.x, segment.endRight.y);
  context.lineTo(segment.startRight.x, segment.startRight.y);
  context.closePath();
  context.fill();
  context.restore();
};

const drawPencilTexture = (
  context: CanvasRenderingContext2D,
  from: CanvasPoint,
  to: CanvasPoint,
  color: string,
  size: number,
  opacity: number,
) => {
  const deltaX = to.x - from.x;
  const deltaY = to.y - from.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < 0.25) return;
  const normalX = -deltaY / distance;
  const normalY = deltaX / distance;
  const seed = Math.abs(Math.floor(from.x * 7 + from.y * 13 + to.x * 3 + to.y));
  const grainOffsets = [-0.34, -0.12, 0.18, 0.39];
  context.save();
  context.strokeStyle = color;
  context.lineCap = "butt";
  context.lineWidth = Math.max(0.7, size * 0.075);
  grainOffsets.forEach((offset, index) => {
    if ((seed + index) % 3 === 0) return;
    const shift = offset * size;
    const inset = ((seed + index * 5) % 7) / 16;
    context.globalAlpha = opacity * (index % 2 === 0 ? 0.19 : 0.13);
    context.beginPath();
    context.moveTo(from.x + normalX * shift + deltaX * inset, from.y + normalY * shift + deltaY * inset);
    context.lineTo(to.x + normalX * shift - deltaX * inset, to.y + normalY * shift - deltaY * inset);
    context.stroke();
  });
  context.restore();
};

const getBrushTerminalTaper = (points: CanvasPoint[], size: number) => {
  if (points.length < 2) return null;
  const end = points[points.length - 1];
  const start = points[Math.max(0, points.length - 3)];
  const deltaX = end.x - start.x;
  const deltaY = end.y - start.y;
  const distance = Math.hypot(deltaX, deltaY);
  if (distance < 0.25) return null;
  const unitX = deltaX / distance;
  const unitY = deltaY / distance;
  const normalX = -unitY;
  const normalY = unitX;
  const baseHalfWidth = size * 0.48;
  const tipHalfWidth = Math.max(1, size * 0.12);
  const tailLength = Math.min(size * 0.95, Math.max(size * 0.42, distance * 0.5));
  return {
    baseLeft: { x: end.x + normalX * baseHalfWidth, y: end.y + normalY * baseHalfWidth },
    baseRight: { x: end.x - normalX * baseHalfWidth, y: end.y - normalY * baseHalfWidth },
    tipLeft: { x: end.x + unitX * tailLength + normalX * tipHalfWidth, y: end.y + unitY * tailLength + normalY * tipHalfWidth },
    tipCenter: { x: end.x + unitX * (tailLength + tipHalfWidth * 0.45), y: end.y + unitY * (tailLength + tipHalfWidth * 0.45) },
    tipRight: { x: end.x + unitX * tailLength - normalX * tipHalfWidth, y: end.y + unitY * tailLength - normalY * tipHalfWidth },
  };
};

const drawBrushTerminalTaper = (
  context: CanvasRenderingContext2D,
  points: CanvasPoint[],
  color: string,
  size: number,
  opacity: number,
) => {
  const taper = getBrushTerminalTaper(points, size);
  if (!taper) return;
  context.save();
  context.fillStyle = color;
  context.globalAlpha = opacity * 0.76;
  context.beginPath();
  context.moveTo(taper.baseLeft.x, taper.baseLeft.y);
  context.quadraticCurveTo(taper.tipLeft.x, taper.tipLeft.y, taper.tipCenter.x, taper.tipCenter.y);
  context.quadraticCurveTo(taper.tipRight.x, taper.tipRight.y, taper.baseRight.x, taper.baseRight.y);
  context.closePath();
  context.fill();
  context.restore();
};

const traceSmoothPath = (context: CanvasRenderingContext2D, points: CanvasPoint[]) => {
  if (!points.length) return;
  context.beginPath();
  context.moveTo(points[0].x, points[0].y);
  if (points.length === 1) return;
  if (points.length === 2) {
    context.lineTo(points[1].x, points[1].y);
    return;
  }
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    context.quadraticCurveTo(current.x, current.y, (current.x + next.x) / 2, (current.y + next.y) / 2);
  }
  const last = points[points.length - 1];
  context.lineTo(last.x, last.y);
};

const buildSmoothSvgPath = (points: CanvasPoint[]) => {
  if (!points.length) return "";
  let path = `M ${points[0].x} ${points[0].y}`;
  if (points.length === 1) return path;
  if (points.length === 2) return `${path} L ${points[1].x} ${points[1].y}`;
  for (let index = 1; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    path += ` Q ${current.x} ${current.y} ${(current.x + next.x) / 2} ${(current.y + next.y) / 2}`;
  }
  const last = points[points.length - 1];
  return `${path} L ${last.x} ${last.y}`;
};

type BrushStamp = CanvasPoint & { angle: number; scale: number };

const buildBrushStamps = (points: CanvasPoint[], size: number): BrushStamp[] => {
  if (!points.length) return [];
  if (points.length === 1) return [{ ...points[0], angle: 0, scale: 1 }];
  const stamps: BrushStamp[] = [];
  const stepLength = Math.max(2.4, size * 0.42);
  points.slice(1).forEach((point, index) => {
    const previous = points[index];
    const deltaX = point.x - previous.x;
    const deltaY = point.y - previous.y;
    const distance = Math.hypot(deltaX, deltaY);
    if (distance < 0.08) return;
    const steps = Math.max(1, Math.ceil(distance / stepLength));
    const angle = Math.atan2(deltaY, deltaX);
    for (let step = index === 0 ? 0 : 1; step <= steps; step += 1) {
      const progress = step / steps;
      stamps.push({ x: previous.x + deltaX * progress, y: previous.y + deltaY * progress, angle, scale: 1 });
    }
  });
  const taperLength = Math.min(5, stamps.length);
  stamps.forEach((stamp, index) => {
    const fromEnd = stamps.length - 1 - index;
    if (fromEnd < taperLength) stamp.scale = 0.46 + (fromEnd / Math.max(1, taperLength - 1)) * 0.54;
  });
  return stamps;
};

const drawSmoothCanvasStroke = (
  context: CanvasRenderingContext2D,
  points: CanvasPoint[],
  color: string,
  size: number,
  opacity: number,
  kind: BrushKind,
) => {
  if (!points.length) return;
  const isPencil = kind === "pencil";
  const isBrush = kind === "brush";
  context.save();
  context.strokeStyle = color;
  context.fillStyle = color;
  if (isBrush) {
    buildBrushStamps(points, size).forEach((stamp, index) => {
      context.save();
      context.translate(stamp.x, stamp.y);
      context.rotate(stamp.angle);
      context.scale(stamp.scale, stamp.scale);
      context.globalAlpha = opacity * (index % 4 === 0 ? 0.31 : 0.36);
      context.beginPath();
      context.ellipse(0, 0, size * 0.66, size * 0.5, 0, 0, Math.PI * 2);
      context.fill();
      context.globalAlpha = opacity * 0.08;
      context.beginPath();
      context.ellipse(size * 0.06, -size * 0.32, size * 0.48, Math.max(0.6, size * 0.055), 0, 0, Math.PI * 2);
      context.ellipse(size * 0.06, size * 0.32, size * 0.48, Math.max(0.6, size * 0.055), 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    });
    context.restore();
    return;
  }
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = isPencil ? Math.max(1, size * 0.78) : size;
  context.globalAlpha = isPencil ? opacity * 0.56 : opacity;
  traceSmoothPath(context, points);
  context.stroke();
  if (points.length === 1) {
    context.beginPath();
    context.arc(points[0].x, points[0].y, context.lineWidth / 2, 0, Math.PI * 2);
    context.fill();
  }
  if (isPencil && points.length > 1) {
    [-0.85, 0.7].forEach((offset, index) => {
      context.save();
      context.translate(offset, index === 0 ? 0.45 : -0.45);
      context.globalAlpha = opacity * (index === 0 ? 0.26 : 0.19);
      context.lineWidth = Math.max(0.65, size * 0.14);
      context.setLineDash([Math.max(0.8, size * 0.09), Math.max(1.8, size * 0.24)]);
      traceSmoothPath(context, points);
      context.stroke();
      context.restore();
    });
  }
  context.restore();
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
  emphasis = false,
}: {
  eyebrow: string;
  title?: string;
  action?: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className={`section-title ${emphasis ? "section-title-emphasis" : ""}`}>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        {title && <h2>{title}</h2>}
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
  editable = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  editable?: boolean;
  onChange: (value: number) => void;
}) {
  const [draftValue, setDraftValue] = useState(() => String(value));

  useEffect(() => {
    setDraftValue(String(value));
  }, [value]);

  const commitValue = (rawValue: string) => {
    const parsedValue = Number(rawValue);
    if (!Number.isFinite(parsedValue)) {
      setDraftValue(String(value));
      return;
    }
    const boundedValue = clamp(parsedValue, min, max);
    const steppedValue = min + Math.round((boundedValue - min) / step) * step;
    const nextValue = Number(clamp(steppedValue, min, max).toFixed(6));
    setDraftValue(String(nextValue));
    onChange(nextValue);
  };

  return (
    <label className="range-control">
      <span className="range-heading">
        <span>{label}</span>
        {editable ? (
          <span className="range-number-field">
            <input
              className="range-number-input"
              type="number"
              min={min}
              max={max}
              step={step}
              value={draftValue}
              inputMode="decimal"
              aria-label={`${label}${suffix}`}
              onChange={(event) => setDraftValue(event.target.value)}
              onBlur={(event) => commitValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") event.currentTarget.blur();
                if (event.key === "Escape") {
                  event.currentTarget.value = String(value);
                  event.currentTarget.blur();
                }
              }}
            />
            {suffix && <span>{suffix}</span>}
          </span>
        ) : (
          <span className="mono-value">
            {value}
            {suffix}
          </span>
        )}
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
  const locale: Locale = window.location.pathname.replace(/\/$/, "") === "/en" ? "en" : "zh-Hant";
  const copy = localeCopy[locale];
  const isEnglish = locale === "en";
  const tr = useCallback((zh: string, en: string) => (isEnglish ? en : zh), [isEnglish]);
  const [easterEggIndex, setEasterEggIndex] = useState(0);
  const activeEasterEgg = easterEggArchive[easterEggIndex] ?? easterEggArchive[0];

  useEffect(() => {
    const desktopQuery = window.matchMedia("(min-width: 768px)");
    const kofiWindow = window as KofiWindow;
    let isDisposed = false;

    const initializeKofi = () => {
      if (isDisposed || !desktopQuery.matches || kofiWindow.__abiPaintKofiMounted || !kofiWindow.kofiWidgetOverlay) return;

      kofiWindow.kofiWidgetOverlay.draw("abiting168", {
        type: "floating-chat",
        "floating-chat.donateButton.text": "Donate",
        "floating-chat.donateButton.background-color": "#348f37",
        "floating-chat.donateButton.text-color": "#fff",
      });
      kofiWindow.__abiPaintKofiMounted = true;
    };

    if (desktopQuery.matches && kofiWindow.kofiWidgetOverlay) {
      initializeKofi();
    } else if (desktopQuery.matches) {
      const existingScript = document.getElementById("abipaint-kofi-widget-script") as HTMLScriptElement | null;
      if (existingScript) {
        existingScript.addEventListener("load", initializeKofi, { once: true });
      } else {
        const script = document.createElement("script");
        script.id = "abipaint-kofi-widget-script";
        script.src = "https://storage.ko-fi.com/cdn/scripts/overlay-widget.js";
        script.async = true;
        script.onload = initializeKofi;
        document.body.appendChild(script);
      }
    }

    return () => {
      isDisposed = true;
    };
  }, []);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastPointRef = useRef<CanvasPoint | null>(null);
  const textDragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
  } | null>(null);
  const textResizeRef = useRef<{
    id: string;
    axis: "top-left" | "top-right" | "bottom-left" | "bottom-right";
    startPointX: number;
    startPointY: number;
    startFontSize: number;
    startWidth: number;
    startHeight: number;
    startX: number;
    startY: number;
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
  const cropDragRef = useRef<{
    imageId: string;
    axis: CropHandleAxis;
    startPointerX: number;
    startPointerY: number;
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const cropUpdateFrameRef = useRef<number | null>(null);
  const pendingCropDraftRef = useRef<(ImageCrop & { imageId: string }) | null>(null);
  const strokeDragRef = useRef<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const drawingStrokeRef = useRef<BrushStroke | null>(null);
  const historyRef = useRef<HistoryItem[]>([]);
  const historyIndexRef = useRef(-1);
  const layersRef = useRef<TextLayer[]>([]);
  const shapesRef = useRef<ShapeLayer[]>([]);
  const imagesRef = useRef<ImageLayer[]>([]);
  const strokesRef = useRef<BrushStroke[]>([]);
  const textLayerElementsRef = useRef(new Map<string, HTMLDivElement>());
  const textRasterTimersRef = useRef(new Map<string, number>());
  const projectImportInputRef = useRef<HTMLInputElement>(null);
  const isProjectHydratedRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const workingFilesRef = useRef<WorkingFile[]>([]);
  const activeWorkingFileIdRef = useRef("");
  const isApplyingWorkingFileRef = useRef(false);

  const [canvasSize, setCanvasSize] = useState({ width: 960, height: 640 });
  const [bleedGuide, setBleedGuide] = useState<BleedGuide | null>(null);
  const [scaleImagesWithCanvas, setScaleImagesWithCanvas] = useState(false);

  const [tool, setTool] = useState<Tool>("move");
  const [brushKind, setBrushKind] = useState<BrushKind>("oil");
  const [brushColor, setBrushColor] = useState(BRAND_RED);
  const [brushSize, setBrushSize] = useState(18);
  const [brushOpacity, setBrushOpacity] = useState(100);
  const [openDesktopTool, setOpenDesktopTool] = useState<DesktopToolPanel | null>(null);
  const [activeDesktopTool, setActiveDesktopTool] = useState<DesktopCreativeTool | null>(null);
  const [zoom, setZoom] = useState(68);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasArtwork, setHasArtwork] = useState(false);
  const [projectRevision, setProjectRevision] = useState(0);
  const [layers, setLayers] = useState<TextLayer[]>([]);
  const [shapes, setShapes] = useState<ShapeLayer[]>([]);
  const [images, setImages] = useState<ImageLayer[]>([]);
  const [strokes, setStrokes] = useState<BrushStroke[]>([]);
  const [drawingStroke, setDrawingStroke] = useState<BrushStroke | null>(null);
  const [paintLayers, setPaintLayers] = useState<PaintLayer[]>(() => [{ id: BASE_PAINT_LAYER_ID, name: isEnglish ? "Layer 1" : "圖層 1", locked: false }]);
  const [activePaintLayerId, setActivePaintLayerId] = useState(BASE_PAINT_LAYER_ID);
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [imageEditingId, setImageEditingId] = useState<string | null>(null);
  const [cropDraft, setCropDraft] = useState<(ImageCrop & { imageId: string }) | null>(null);
  const [backgroundRemovalImageId, setBackgroundRemovalImageId] = useState<string | null>(null);
  const [backgroundRemovalNotice, setBackgroundRemovalNotice] = useState<{ kind: "loading" | "processing" | "success" | "error"; message: string } | null>(null);
  const [backgroundRepair, setBackgroundRepair] = useState<BackgroundRepairState | null>(null);
  const [selectedStrokeId, setSelectedStrokeId] = useState<string | null>(null);
  const [resetWorkingFileDialogOpen, setResetWorkingFileDialogOpen] = useState(false);
  const [shapeKind, setShapeKind] = useState<ShapeKind>("rectangle");
  const [shapeFill, setShapeFill] = useState(BRAND_RED);
  const [shapeOutline, setShapeOutline] = useState("#FFFDF8");
  const [shapeOutlineWidth, setShapeOutlineWidth] = useState(2);
  const [shapeShadow, setShapeShadow] = useState(true);
  const [shapeOpacity, setShapeOpacity] = useState(100);
  const [shapeShadowOpacity, setShapeShadowOpacity] = useState(20);
  const [shapeCornerRadius, setShapeCornerRadius] = useState(12);
  const [adjustments, setAdjustments] = useState<Adjustments>({
    exposure: 0,
    contrast: 0,
    saturation: 0,
    vibrancy: 0,
    opacity: 100,
  });
  const [fileMeta, setFileMeta] = useState<{ name: string; size: string }>({ name: copy.documentName, size: "—" });
  const [documentNameDraft, setDocumentNameDraft] = useState<string>(copy.documentName);
  const [workingFiles, setWorkingFiles] = useState<WorkingFile[]>([]);
  const [activeWorkingFileId, setActiveWorkingFileId] = useState("");
  const [snapGuides, setSnapGuides] = useState<SnapGuides>({ x: null, y: null });
  const [mobileDrawerHeight, setMobileDrawerHeight] = useState<number | null>(null);
  const [isMobileDrawerDragging, setIsMobileDrawerDragging] = useState(false);
  const [desktopToolPosition, setDesktopToolPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDesktopToolDragging, setIsDesktopToolDragging] = useState(false);
  const [isFaqOpen, setIsFaqOpen] = useState(false);
  const [isDeveloperOpen, setIsDeveloperOpen] = useState(false);
  const [isEasterEggOpen, setIsEasterEggOpen] = useState(false);
  const [mobileMiniToolPosition, setMobileMiniToolPosition] = useState({ x: 14, y: 14 });
  const [isMobileMiniToolDragging, setIsMobileMiniToolDragging] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(() => window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY).matches);
  const [isExportRendering, setIsExportRendering] = useState(false);
  const [exportPreview, setExportPreview] = useState<{ url: string; format: ExportFormat; width: number; height: number } | null>(null);
  const objectClipboardRef = useRef<ObjectClipboard | null>(null);
  const backgroundRemovalSessionRef = useRef<Ort.InferenceSession | null>(null);
  const backgroundRemovalRuntimeRef = useRef<typeof import("onnxruntime-web") | null>(null);
  const backgroundRepairSessionRef = useRef<{ imageId: string; source: HTMLImageElement; current: HTMLImageElement } | null>(null);
  const backgroundRepairPointerRef = useRef<{ imageId: string; pointerId: number; x: number; y: number } | null>(null);
  const backgroundRepairCanvasRefs = useRef(new Map<string, HTMLCanvasElement>());
  const panDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const touchPointsRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchPanRef = useRef<{ startDistance: number; startCenterX: number; startCenterY: number; startZoom: number; originX: number; originY: number } | null>(null);
  const longPressPanRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; timer: number | null; active: boolean } | null>(null);
  const imageUpdateFrameRef = useRef<number | null>(null);
  const pendingImagesRef = useRef<ImageLayer[] | null>(null);
  const shapeUpdateFrameRef = useRef<number | null>(null);
  const pendingShapesRef = useRef<ShapeLayer[] | null>(null);
  const layerUpdateFrameRef = useRef<number | null>(null);
  const pendingLayersRef = useRef<TextLayer[] | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const studioLayoutRef = useRef<HTMLDivElement>(null);
  const workspaceRef = useRef<HTMLElement>(null);
  const desktopToolPanelRef = useRef<HTMLElement>(null);
  const desktopToolDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const drawerDragRef = useRef<{ startY: number; startHeight: number } | null>(null);
  const mobileMiniToolRef = useRef<HTMLDivElement>(null);
  const mobileMiniToolDragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const mobileMiniToolHasCustomPositionRef = useRef(false);
  const hasInitializedPanRef = useRef(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia(MOBILE_VIEWPORT_MEDIA_QUERY);
    const updateMobileViewport = () => setIsMobileViewport(mobileQuery.matches);
    updateMobileViewport();
    mobileQuery.addEventListener("change", updateMobileViewport);
    return () => mobileQuery.removeEventListener("change", updateMobileViewport);
  }, []);

  useEffect(() => {
    const repair = backgroundRepair;
    const session = backgroundRepairSessionRef.current;
    if (!repair || !session || repair.imageId !== session.imageId) return;
    const canvas = backgroundRepairCanvasRefs.current.get(repair.imageId);
    if (!canvas) return;
    const width = Math.max(1, session.current.naturalWidth || session.current.width);
    const height = Math.max(1, session.current.naturalHeight || session.current.height);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.drawImage(session.current, 0, 0, width, height);
  }, [backgroundRepair?.imageId]);

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
  const selectedStroke = useMemo(
    () => strokes.find((stroke) => stroke.id === selectedStrokeId) ?? null,
    [selectedStrokeId, strokes],
  );
  const materialStackEntries = useMemo<MaterialStackEntry[]>(() => [
    ...strokes.map((stroke, index) => ({ type: "stroke" as const, id: stroke.id, paintLayerId: stroke.paintLayerId, stackOrder: getMaterialStackOrder("stroke", stroke, index) })),
    ...images.map((image, index) => ({ type: "image" as const, id: image.id, paintLayerId: image.paintLayerId, stackOrder: getMaterialStackOrder("image", image, index) })),
    ...shapes.map((shape, index) => ({ type: "shape" as const, id: shape.id, paintLayerId: shape.paintLayerId, stackOrder: getMaterialStackOrder("shape", shape, index) })),
    ...layers.map((layer, index) => ({ type: "text" as const, id: layer.id, paintLayerId: layer.paintLayerId, stackOrder: getMaterialStackOrder("text", layer, index) })),
  ].sort((first, second) => first.stackOrder - second.stackOrder), [images, layers, shapes, strokes]);
  const selectedMaterialStackEntry = useMemo(() => {
    const selectedMaterial = selectedTextId
      ? { type: "text" as const, id: selectedTextId }
      : selectedShapeId
        ? { type: "shape" as const, id: selectedShapeId }
        : selectedImageId
          ? { type: "image" as const, id: selectedImageId }
          : selectedStrokeId
            ? { type: "stroke" as const, id: selectedStrokeId }
            : null;
    return selectedMaterial
      ? materialStackEntries.find((entry) => entry.type === selectedMaterial.type && entry.id === selectedMaterial.id) ?? null
      : null;
  }, [materialStackEntries, selectedImageId, selectedShapeId, selectedStrokeId, selectedTextId]);
  const activePaintLayer = useMemo(
    () => paintLayers.find((layer) => layer.id === activePaintLayerId) ?? paintLayers[0] ?? null,
    [activePaintLayerId, paintLayers],
  );
  const isPaintLayerLocked = useCallback(
    (paintLayerId?: string) => paintLayers.find((layer) => layer.id === (paintLayerId ?? BASE_PAINT_LAYER_ID))?.locked ?? false,
    [paintLayers],
  );
  const activeAdjustmentValues: Adjustments = selectedShape
    ? { exposure: selectedShape.exposure ?? 0, contrast: selectedShape.contrast ?? 0, saturation: selectedShape.saturation ?? 0, vibrancy: selectedShape.vibrancy ?? 0, opacity: selectedShape.opacity }
    : selectedImage
      ? { exposure: selectedImage.exposure ?? 0, contrast: selectedImage.contrast ?? 0, saturation: selectedImage.saturation ?? 0, vibrancy: selectedImage.vibrancy ?? 0, opacity: selectedImage.opacity }
      : selectedText
      ? { exposure: selectedText.exposure ?? 0, contrast: selectedText.contrast ?? 0, saturation: selectedText.saturation ?? 0, vibrancy: selectedText.vibrancy ?? 0, opacity: selectedText.opacity }
      : adjustments;
  const activeShadowOpacity = selectedShape ? selectedShape.shadowOpacity : selectedImage ? selectedImage.shadowOpacity : selectedText ? selectedText.shadowOpacity : null;
  const activeOutlineSettings = selectedShape
    ? { color: selectedShape.outline, width: selectedShape.outlineWidth ?? 0, exposure: selectedShape.outlineExposure ?? 0, contrast: selectedShape.outlineContrast ?? 0, saturation: selectedShape.outlineSaturation ?? 0, vibrancy: selectedShape.outlineVibrancy ?? 0, opacity: selectedShape.outlineOpacity ?? 100 }
    : selectedText
      ? { color: selectedText.outlineColor ?? "#FFFDF8", width: selectedText.outlineWidth ?? 0, exposure: selectedText.outlineExposure ?? 0, contrast: selectedText.outlineContrast ?? 0, saturation: selectedText.outlineSaturation ?? 0, vibrancy: selectedText.outlineVibrancy ?? 0, opacity: selectedText.outlineOpacity ?? 100 }
      : selectedImage
        ? { color: selectedImage.outlineColor ?? "#FFFDF8", width: selectedImage.outlineWidth ?? 0, exposure: selectedImage.outlineExposure ?? 0, contrast: selectedImage.outlineContrast ?? 0, saturation: selectedImage.outlineSaturation ?? 0, vibrancy: selectedImage.outlineVibrancy ?? 0, opacity: selectedImage.outlineOpacity ?? 100 }
        : selectedStroke
          ? { color: selectedStroke.outlineColor ?? "#FFFDF8", width: selectedStroke.outlineWidth ?? 0, exposure: selectedStroke.outlineExposure ?? 0, contrast: selectedStroke.outlineContrast ?? 0, saturation: selectedStroke.outlineSaturation ?? 0, vibrancy: selectedStroke.outlineVibrancy ?? 0, opacity: selectedStroke.outlineOpacity ?? 100 }
          : null;
  const activeAdjustmentTarget = selectedShape ? tr("目前圖形", "Current shape") : selectedImage ? tr("目前圖片", "Current image") : selectedText ? tr("目前文字卡", "Current text") : tr("整個畫布", "Entire canvas");

  const canvasFilter = useMemo(
    () => makeAdjustmentFilter(adjustments.exposure, adjustments.contrast, adjustments.saturation, adjustments.vibrancy),
    [adjustments],
  );

  const syncLayers = useCallback((nextLayers: TextLayer[]) => {
    const normalizedLayers = nextLayers.map((layer) => ({
      ...layer,
      paintLayerId: layer.paintLayerId ?? BASE_PAINT_LAYER_ID,
      exposure: layer.exposure ?? 0,
      contrast: layer.contrast ?? 0,
      saturation: layer.saturation ?? 0,
      vibrancy: layer.vibrancy ?? 0,
      shadowOpacity: layer.shadowOpacity ?? 0,
      outlineColor: layer.outlineColor ?? "#FFFDF8",
      outlineWidth: layer.outlineWidth ?? 0,
      outlineExposure: layer.outlineExposure ?? 0,
      outlineContrast: layer.outlineContrast ?? 0,
      outlineSaturation: layer.outlineSaturation ?? 0,
      outlineVibrancy: layer.outlineVibrancy ?? 0,
      outlineOpacity: layer.outlineOpacity ?? 100,
    }));
    layersRef.current = normalizedLayers;
    setLayers(normalizedLayers);
  }, []);

  const syncShapes = useCallback((nextShapes: ShapeLayer[]) => {
    const normalizedShapes = nextShapes.map((shape) => ({
      ...shape,
      paintLayerId: shape.paintLayerId ?? BASE_PAINT_LAYER_ID,
      exposure: shape.exposure ?? 0,
      contrast: shape.contrast ?? 0,
      saturation: shape.saturation ?? 0,
      vibrancy: shape.vibrancy ?? 0,
      rotation: shape.rotation ?? 0,
      outlineWidth: shape.outlineWidth ?? 0,
      outlineExposure: shape.outlineExposure ?? 0,
      outlineContrast: shape.outlineContrast ?? 0,
      outlineSaturation: shape.outlineSaturation ?? 0,
      outlineVibrancy: shape.outlineVibrancy ?? 0,
      outlineOpacity: shape.outlineOpacity ?? 100,
    }));
    shapesRef.current = normalizedShapes;
    setShapes(normalizedShapes);
  }, []);

  const syncImages = useCallback((nextImages: ImageLayer[]) => {
    const normalizedImages = nextImages.map((image) => ({
      ...image,
      paintLayerId: image.paintLayerId ?? BASE_PAINT_LAYER_ID,
      exposure: image.exposure ?? 0,
      contrast: image.contrast ?? 0,
      saturation: image.saturation ?? 0,
      vibrancy: image.vibrancy ?? 0,
      shadowOpacity: clamp(typeof image.shadowOpacity === "number" ? image.shadowOpacity : 0, 0, 100),
      rotation: image.rotation ?? 0,
      crop: image.crop ?? FULL_IMAGE_CROP,
      outlineColor: image.outlineColor ?? "#FFFDF8",
      outlineWidth: image.outlineWidth ?? 0,
      outlineExposure: image.outlineExposure ?? 0,
      outlineContrast: image.outlineContrast ?? 0,
      outlineSaturation: image.outlineSaturation ?? 0,
      outlineVibrancy: image.outlineVibrancy ?? 0,
      outlineOpacity: image.outlineOpacity ?? 100,
    }));
    imagesRef.current = normalizedImages;
    setImages(normalizedImages);
  }, []);

  const syncStrokes = useCallback((nextStrokes: BrushStroke[]) => {
    const normalizedStrokes = nextStrokes.map((stroke) => ({
      ...stroke,
      paintLayerId: stroke.paintLayerId ?? BASE_PAINT_LAYER_ID,
      shadowOpacity: stroke.shadowOpacity ?? 0,
      outlineColor: stroke.outlineColor ?? "#FFFDF8",
      outlineWidth: stroke.outlineWidth ?? 0,
      outlineExposure: stroke.outlineExposure ?? 0,
      outlineContrast: stroke.outlineContrast ?? 0,
      outlineSaturation: stroke.outlineSaturation ?? 0,
      outlineVibrancy: stroke.outlineVibrancy ?? 0,
      outlineOpacity: stroke.outlineOpacity ?? 100,
    }));
    strokesRef.current = normalizedStrokes;
    setStrokes(normalizedStrokes);
  }, []);

  const syncWorkingFiles = useCallback((nextFiles: WorkingFile[]) => {
    workingFilesRef.current = nextFiles;
    setWorkingFiles(nextFiles);
  }, []);

  const getNextMaterialStackOrder = () => {
    const currentStackOrders = [
      ...strokesRef.current.map((stroke, index) => getMaterialStackOrder("stroke", stroke, index)),
      ...imagesRef.current.map((image, index) => getMaterialStackOrder("image", image, index)),
      ...shapesRef.current.map((shape, index) => getMaterialStackOrder("shape", shape, index)),
      ...layersRef.current.map((layer, index) => getMaterialStackOrder("text", layer, index)),
    ];
    return currentStackOrders.length ? Math.max(...currentStackOrders) + 1 : 1;
  };

  const selectedLayerStackEntries = selectedMaterialStackEntry
    ? materialStackEntries.filter((entry) => entry.paintLayerId === selectedMaterialStackEntry.paintLayerId)
    : [];
  const selectedMaterialStackIndex = selectedMaterialStackEntry
    ? selectedLayerStackEntries.findIndex((entry) => entry.type === selectedMaterialStackEntry.type && entry.id === selectedMaterialStackEntry.id)
    : -1;
  const selectedMaterialIsLocked = selectedMaterialStackEntry ? isPaintLayerLocked(selectedMaterialStackEntry.paintLayerId) : true;
  const canBringSelectedMaterialForward = selectedMaterialStackIndex >= 0 && selectedMaterialStackIndex < selectedLayerStackEntries.length - 1 && !selectedMaterialIsLocked;
  const canSendSelectedMaterialBackward = selectedMaterialStackIndex > 0 && !selectedMaterialIsLocked;

  const moveSelectedMaterialInStack = (direction: "forward" | "backward") => {
    if (!selectedMaterialStackEntry || selectedMaterialIsLocked) return;
    const targetIndex = selectedMaterialStackIndex + (direction === "forward" ? 1 : -1);
    const targetEntry = selectedLayerStackEntries[targetIndex];
    if (!targetEntry) return;
    const currentEntry = selectedMaterialStackEntry;
    const resolveSwappedOrder = (type: MaterialType, id: string, currentOrder: number) => {
      if (type === currentEntry.type && id === currentEntry.id) return targetEntry.stackOrder;
      if (type === targetEntry.type && id === targetEntry.id) return currentEntry.stackOrder;
      return currentOrder;
    };
    syncStrokes(strokesRef.current.map((stroke, index) => ({
      ...stroke,
      stackOrder: resolveSwappedOrder("stroke", stroke.id, getMaterialStackOrder("stroke", stroke, index)),
    })));
    syncImages(imagesRef.current.map((image, index) => ({
      ...image,
      stackOrder: resolveSwappedOrder("image", image.id, getMaterialStackOrder("image", image, index)),
    })));
    syncShapes(shapesRef.current.map((shape, index) => ({
      ...shape,
      stackOrder: resolveSwappedOrder("shape", shape.id, getMaterialStackOrder("shape", shape, index)),
    })));
    syncLayers(layersRef.current.map((layer, index) => ({
      ...layer,
      stackOrder: resolveSwappedOrder("text", layer.id, getMaterialStackOrder("text", layer, index)),
    })));
    captureHistory();
    toast.success(direction === "forward"
      ? tr("素材已向前一層", "Material brought forward")
      : tr("素材已向後一層", "Material sent backward"));
  };

  const addPaintLayer = () => {
    if (paintLayers.length >= MAX_PAINT_LAYERS) {
      toast.info(tr("最多可建立 5 個圖層", "You can create up to 5 layers"));
      return;
    }
    const nextLayer: PaintLayer = {
      id: makeId("paint-layer"),
      name: isEnglish ? `Layer ${paintLayers.length + 1}` : `圖層 ${paintLayers.length + 1}`,
      locked: false,
    };
    setPaintLayers((current) => [...current, nextLayer]);
    setActivePaintLayerId(nextLayer.id);
  };

  const togglePaintLayerLock = (id: string) => {
    setPaintLayers((current) => current.map((layer) => layer.id === id ? { ...layer, locked: !layer.locked } : layer));
    const isLocking = !paintLayers.find((layer) => layer.id === id)?.locked;
    if (!isLocking) return;
    if (selectedText?.paintLayerId === id) setSelectedTextId(null);
    if (selectedShape?.paintLayerId === id) setSelectedShapeId(null);
    if (selectedImage?.paintLayerId === id) setSelectedImageId(null);
    if (strokes.find((stroke) => stroke.id === selectedStrokeId)?.paintLayerId === id) setSelectedStrokeId(null);
    if (layers.find((layer) => layer.id === editingTextId)?.paintLayerId === id) setEditingTextId(null);
  };

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

  const scheduleShapes = useCallback((nextShapes: ShapeLayer[]) => {
    shapesRef.current = nextShapes;
    pendingShapesRef.current = nextShapes;
    if (shapeUpdateFrameRef.current !== null) return;
    shapeUpdateFrameRef.current = window.requestAnimationFrame(() => {
      shapeUpdateFrameRef.current = null;
      const pendingShapes = pendingShapesRef.current;
      pendingShapesRef.current = null;
      if (pendingShapes) setShapes(pendingShapes);
    });
  }, []);

  const flushShapeUpdates = useCallback(() => {
    if (shapeUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(shapeUpdateFrameRef.current);
      shapeUpdateFrameRef.current = null;
    }
    const pendingShapes = pendingShapesRef.current;
    pendingShapesRef.current = null;
    if (pendingShapes) setShapes(pendingShapes);
  }, []);

  const scheduleLayers = useCallback((nextLayers: TextLayer[]) => {
    layersRef.current = nextLayers;
    pendingLayersRef.current = nextLayers;
    if (layerUpdateFrameRef.current !== null) return;
    layerUpdateFrameRef.current = window.requestAnimationFrame(() => {
      layerUpdateFrameRef.current = null;
      const pendingLayers = pendingLayersRef.current;
      pendingLayersRef.current = null;
      if (pendingLayers) setLayers(pendingLayers);
    });
  }, []);

  const flushLayerUpdates = useCallback(() => {
    if (layerUpdateFrameRef.current !== null) {
      window.cancelAnimationFrame(layerUpdateFrameRef.current);
      layerUpdateFrameRef.current = null;
    }
    const pendingLayers = pendingLayersRef.current;
    pendingLayersRef.current = null;
    if (pendingLayers) setLayers(pendingLayers);
  }, []);

  const getCanvasPoint = useCallback((clientX: number, clientY: number, allowOutside = false) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * canvas.width;
    const y = ((clientY - rect.top) / rect.height) * canvas.height;
    return allowOutside ? { x, y } : { x: clamp(x, 0, canvas.width), y: clamp(y, 0, canvas.height) };
  }, []);

  const getSnappedPosition = useCallback((rawX: number, rawY: number, width: number, height: number, excludedShapeId?: string) => {
    const threshold = 8 / Math.max(0.25, zoom / 100);
    const canvasHorizontalTargets = [
      { position: 0, guide: 0 },
      { position: canvasSize.width / 2 - width / 2, guide: canvasSize.width / 2 },
      { position: canvasSize.width - width, guide: canvasSize.width },
    ];
    const canvasVerticalTargets = [
      { position: 0, guide: 0 },
      { position: canvasSize.height / 2 - height / 2, guide: canvasSize.height / 2 },
      { position: canvasSize.height - height, guide: canvasSize.height },
    ];
    const frameHorizontalTargets = shapesRef.current
      .filter((shape) => shape.id !== excludedShapeId)
      .flatMap((shape) => [
        { position: shape.x, guide: shape.x },
        { position: shape.x + shape.width / 2 - width / 2, guide: shape.x + shape.width / 2 },
        { position: shape.x + shape.width - width, guide: shape.x + shape.width },
      ]);
    const frameVerticalTargets = shapesRef.current
      .filter((shape) => shape.id !== excludedShapeId)
      .flatMap((shape) => [
        { position: shape.y, guide: shape.y },
        { position: shape.y + shape.height / 2 - height / 2, guide: shape.y + shape.height / 2 },
        { position: shape.y + shape.height - height, guide: shape.y + shape.height },
      ]);
    const horizontalTargets = [...canvasHorizontalTargets, ...frameHorizontalTargets];
    const verticalTargets = [...canvasVerticalTargets, ...frameVerticalTargets];
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

  const getTextVisualCenterOffset = (layer: Pick<TextLayer, "text" | "fontFamily" | "fontWeight" | "fontSize">) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return Math.round(layer.fontSize * 0.06);
    context.save();
    context.font = `${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}", "Noto Sans TC", sans-serif`;
    const lineHeight = layer.fontSize * 1.12;
    const offsets = layer.text.split("\n").filter(Boolean).map((line) => {
      const metrics = context.measureText(line);
      const fontAscent = metrics.fontBoundingBoxAscent || layer.fontSize * 0.82;
      const fontDescent = metrics.fontBoundingBoxDescent || layer.fontSize * 0.18;
      const actualAscent = metrics.actualBoundingBoxAscent || layer.fontSize * 0.8;
      const actualDescent = metrics.actualBoundingBoxDescent || layer.fontSize * 0.2;
      const glyphCenter = (lineHeight - fontAscent - fontDescent) / 2 + fontAscent - (actualAscent - actualDescent) / 2;
      return glyphCenter - lineHeight / 2;
    });
    context.restore();
    return offsets.length ? offsets.reduce((sum, offset) => sum + offset, 0) / offsets.length : 0;
  };

  const getTextLayerDimensions = useCallback((layer: Pick<TextLayer, "id" | "text" | "fontFamily" | "fontWeight" | "fontSize">) => {
    const element = textLayerElementsRef.current.get(layer.id);
    if (element) return { width: element.offsetWidth, height: element.offsetHeight };
    const context = canvasRef.current?.getContext("2d");
    if (!context) return { width: Math.max(48, layer.text.length * layer.fontSize * 0.58), height: Math.ceil(layer.fontSize * 1.12) + 4 };
    context.save();
    context.font = `${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}", "Noto Sans TC", sans-serif`;
    const width = Math.max(48, Math.ceil(context.measureText(layer.text).width) + 8);
    context.restore();
    return { width, height: Math.ceil(layer.fontSize * 1.12) + 4 };
  }, []);

  const mobileSelectionToolbar = useMemo(() => {
    if (!isMobileViewport || selectedMaterialIsLocked) return null;
    let bounds: { x: number; y: number; width: number; height: number } | null = null;
    if (selectedImage) bounds = { x: selectedImage.x, y: selectedImage.y, width: selectedImage.width, height: selectedImage.height };
    else if (selectedShape) bounds = { x: selectedShape.x, y: selectedShape.y, width: selectedShape.width, height: selectedShape.height };
    else if (selectedText) {
      const dimensions = getTextLayerDimensions(selectedText);
      bounds = { x: selectedText.x, y: selectedText.y, ...dimensions };
    } else if (selectedStroke && selectedStroke.points.length) {
      const xValues = selectedStroke.points.map((point) => point.x + selectedStroke.x);
      const yValues = selectedStroke.points.map((point) => point.y + selectedStroke.y);
      const padding = Math.max(18, selectedStroke.size * 1.4);
      const minX = Math.min(...xValues) - padding;
      const minY = Math.min(...yValues) - padding;
      bounds = { x: minX, y: minY, width: Math.max(1, Math.max(...xValues) - Math.min(...xValues) + padding * 2), height: Math.max(1, Math.max(...yValues) - Math.min(...yValues) + padding * 2) };
    }
    if (!bounds) return null;
    return {
      x: clamp(bounds.x + bounds.width / 2, 58, canvasSize.width - 58),
      y: Math.max(10, bounds.y - 14),
    };
  }, [canvasSize.width, getTextLayerDimensions, isMobileViewport, selectedImage, selectedMaterialIsLocked, selectedShape, selectedStroke, selectedText]);

  const centerTextLayerByVisibleBounds = (textId: string, target: { x: number; y: number; width: number; height: number }, axis: "horizontal" | "vertical" | "both" = "both") => {
    window.requestAnimationFrame(() => {
      void (async () => {
        const layer = layersRef.current.find((item) => item.id === textId);
        const element = textLayerElementsRef.current.get(textId);
        if (!layer || !element) return;
        try {
          const width = Math.max(1, element.offsetWidth);
          const height = Math.max(1, element.offsetHeight);
          const snapshot = await toCanvas(element, {
            width,
            height,
            pixelRatio: 1,
            cacheBust: false,
            skipFonts: true,
            style: { transform: "none", left: "0", top: "0" },
            filter: (node) => !(node instanceof HTMLElement) || !node.matches(".text-resize-handle"),
          });
          const context = snapshot.getContext("2d");
          if (!context) return;
          const pixels = context.getImageData(0, 0, snapshot.width, snapshot.height).data;
          let minX = snapshot.width;
          let minY = snapshot.height;
          let maxX = -1;
          let maxY = -1;
          for (let y = 0; y < snapshot.height; y += 1) {
            for (let x = 0; x < snapshot.width; x += 1) {
              if (pixels[(y * snapshot.width + x) * 4 + 3] < 16) continue;
              minX = Math.min(minX, x);
              minY = Math.min(minY, y);
              maxX = Math.max(maxX, x);
              maxY = Math.max(maxY, y);
            }
          }
          if (maxX < minX || maxY < minY) return;
          const visibleCenterX = (minX + maxX + 1) / 2;
          const visibleCenterY = (minY + maxY + 1) / 2;
          const nextX = target.x + target.width / 2 - visibleCenterX;
          const nextY = target.y + target.height / 2 - visibleCenterY;
          syncLayers(layersRef.current.map((item) => item.id === textId ? {
            ...item,
            ...(axis === "horizontal" || axis === "both" ? { x: nextX } : {}),
            ...(axis === "vertical" || axis === "both" ? { y: nextY } : {}),
          } : item));
        } catch {
          // 無法建立文字快照時，保留前一步字型度量計算的定位。
        }
      })();
    });
  };

  const rasterizeTextLayer = useCallback((textId: string) => {
    const previousTimer = textRasterTimersRef.current.get(textId);
    if (previousTimer) window.clearTimeout(previousTimer);
    const timer = window.setTimeout(() => {
      textRasterTimersRef.current.delete(textId);
      const layer = layersRef.current.find((item) => item.id === textId);
      const element = textLayerElementsRef.current.get(textId);
      if (!layer || !element || editingTextId === textId) return;
      const width = Math.max(1, element.offsetWidth);
      const height = Math.max(1, element.offsetHeight);
      const scale = 2;
      const raster = document.createElement("canvas");
      raster.width = Math.ceil(width * scale);
      raster.height = Math.ceil(height * scale);
      const rasterContext = raster.getContext("2d");
      if (!rasterContext) return;
      rasterContext.scale(scale, scale);
      rasterContext.font = `${layer.fontWeight} ${layer.fontSize}px "${layer.fontFamily}", "Noto Sans TC", sans-serif`;
      rasterContext.textBaseline = "alphabetic";
      rasterContext.lineJoin = "round";
      rasterContext.fillStyle = layer.color;
      rasterContext.strokeStyle = makeOutlineColor(layer.outlineColor ?? "#FFFDF8", layer.outlineExposure, layer.outlineContrast, layer.outlineSaturation, layer.outlineVibrancy, layer.outlineOpacity);
      rasterContext.lineWidth = layer.outlineWidth ?? 0;
      const metrics = rasterContext.measureText("Mg");
      const ascent = metrics.fontBoundingBoxAscent || layer.fontSize * 0.82;
      const descent = metrics.fontBoundingBoxDescent || layer.fontSize * 0.18;
      const lineHeight = layer.fontSize * 1.12;
      const firstBaseline = (lineHeight - ascent - descent) / 2 + ascent;
      layer.text.split("\n").forEach((line, index) => {
        const baselineY = firstBaseline + lineHeight * index;
        if ((layer.outlineWidth ?? 0) > 0) rasterContext.strokeText(line, 4, baselineY);
        rasterContext.fillText(line, 4, baselineY);
      });
      const imageData = rasterContext.getImageData(0, 0, raster.width, raster.height).data;
      let minX = raster.width; let minY = raster.height; let maxX = -1; let maxY = -1;
      for (let y = 0; y < raster.height; y += 1) for (let x = 0; x < raster.width; x += 1) {
        if (imageData[(y * raster.width + x) * 4 + 3] < 16) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      if (maxX < minX || maxY < minY) return;
      const padding = 2 * scale;
      const visibleWidth = maxX - minX + 1;
      const visibleHeight = maxY - minY + 1;
      const cropped = document.createElement("canvas");
      cropped.width = visibleWidth + padding * 2;
      cropped.height = visibleHeight + padding * 2;
      const croppedContext = cropped.getContext("2d");
      if (!croppedContext) return;
      croppedContext.drawImage(raster, minX, minY, visibleWidth, visibleHeight, padding, padding, visibleWidth, visibleHeight);
      const croppedWidth = cropped.width / scale;
      const croppedHeight = cropped.height / scale;
      const anchorShape = layer.anchorShapeId ? shapesRef.current.find((shape) => shape.id === layer.anchorShapeId) : undefined;
      const nextX = anchorShape
        ? anchorShape.x + (anchorShape.width - croppedWidth) / 2
        : layer.x + minX / scale - padding / scale;
      const nextY = anchorShape
        ? anchorShape.y + (anchorShape.height - croppedHeight) / 2
        : layer.y + minY / scale - padding / scale;
      const dataUrl = cropped.toDataURL("image/png");
      syncLayers(layersRef.current.map((item) => item.id === textId ? {
        ...item,
        x: nextX,
        y: nextY,
        rasterDataUrl: dataUrl,
        rasterWidth: croppedWidth,
        rasterHeight: croppedHeight,
        rasterVersion: TEXT_RASTER_VERSION,
      } : item));
    }, 80);
    textRasterTimersRef.current.set(textId, timer);
  }, [editingTextId, syncLayers]);

  useEffect(() => {
    layers.forEach((layer) => {
      if ((!layer.rasterDataUrl || layer.rasterVersion !== TEXT_RASTER_VERSION) && editingTextId !== layer.id) rasterizeTextLayer(layer.id);
    });
  }, [layers, editingTextId, rasterizeTextLayer]);

  const captureHistory = useCallback((guide = bleedGuide) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const item: HistoryItem = {
      width: canvas.width,
      height: canvas.height,
      imageData: context.getImageData(0, 0, canvas.width, canvas.height),
      bleedGuide: guide,
      layers: layersRef.current.map((layer) => ({ ...layer })),
      shapes: shapesRef.current.map((shape) => ({ ...shape })),
      images: imagesRef.current.map((image) => ({ ...image })),
      strokes: strokesRef.current.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) })),
    };
    const current = historyRef.current.slice(0, historyIndexRef.current + 1);
    const next = [...current, item].slice(-24);
    historyRef.current = next;
    historyIndexRef.current = next.length - 1;
    setProjectRevision((revision) => revision + 1);
  }, [bleedGuide]);

  const restoreHistory = useCallback(
    (index: number) => {
      const item = historyRef.current[index];
      const canvas = canvasRef.current;
      if (!item || !canvas) return;
      canvas.width = item.width;
      canvas.height = item.height;
      canvas.getContext("2d")?.putImageData(item.imageData, 0, 0);
      setCanvasSize({ width: item.width, height: item.height });
      setBleedGuide(item.bleedGuide ?? null);
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

  const createProjectSnapshot = useCallback((): AbiPaintProject | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    try {
      return {
        format: "abipaint-project",
        version: 5,
        savedAt: new Date().toISOString(),
        hasArtwork,
        canvas: {
          width: canvas.width,
          height: canvas.height,
          baseImage: canvas.toDataURL("image/png"),
          bleedGuide: bleedGuide ? { ...bleedGuide } : null,
          adjustments: { ...adjustments },
        },
        document: {
          name: documentNameDraft,
          fileMeta: { ...fileMeta },
          scaleImagesWithCanvas,
        },
        paintLayers: paintLayers.map((layer) => ({ ...layer })),
        activePaintLayerId,
        materials: {
          layers: layersRef.current.map((layer) => ({ ...layer })),
          shapes: shapesRef.current.map((shape) => ({ ...shape })),
          images: imagesRef.current.map((image) => ({ ...image, crop: image.crop ? { ...image.crop } : undefined })),
          strokes: strokesRef.current.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) })),
        },
        tools: {
          brushKind,
          brushColor,
          brushSize,
          brushOpacity,
          shapeKind,
          shapeFill,
          shapeOutline,
          shapeOutlineWidth,
          shapeShadow,
          shapeOpacity,
          shapeShadowOpacity,
          shapeCornerRadius,
        },
      };
    } catch {
      return null;
    }
  }, [activePaintLayerId, adjustments, bleedGuide, brushColor, brushKind, brushOpacity, brushSize, documentNameDraft, fileMeta, hasArtwork, paintLayers, scaleImagesWithCanvas, shapeCornerRadius, shapeFill, shapeKind, shapeOpacity, shapeOutline, shapeOutlineWidth, shapeShadow, shapeShadowOpacity]);

  const createBlankProject = useCallback((fileNumber: number): AbiPaintProject => {
    const width = 960;
    const height = 640;
    const surface = document.createElement("canvas");
    surface.width = width;
    surface.height = height;
    const context = surface.getContext("2d");
    if (context) context.fillStyle = PAPER;
    context?.fillRect(0, 0, width, height);
    const name = isEnglish ? `Untitled canvas ${fileNumber}` : `未命名畫布 ${fileNumber}`;
    return {
      format: "abipaint-project",
      version: 5,
      savedAt: new Date().toISOString(),
      hasArtwork: false,
      canvas: {
        width,
        height,
        baseImage: surface.toDataURL("image/png"),
        bleedGuide: null,
        adjustments: { exposure: 0, contrast: 0, saturation: 0, vibrancy: 0, opacity: 100 },
      },
      document: {
        name,
        fileMeta: { name, size: `${width} × ${height}` },
        scaleImagesWithCanvas: false,
      },
      paintLayers: [{ id: BASE_PAINT_LAYER_ID, name: isEnglish ? "Layer 1" : "圖層 1", locked: false }],
      activePaintLayerId: BASE_PAINT_LAYER_ID,
      materials: { layers: [], shapes: [], images: [], strokes: [] },
      tools: {
        brushKind: "oil",
        brushColor: BRAND_RED,
        brushSize: 18,
        brushOpacity: 100,
        shapeKind: "rectangle",
        shapeFill: BRAND_RED,
        shapeOutline: "#FFFDF8",
        shapeOutlineWidth: 2,
        shapeShadow: true,
        shapeOpacity: 100,
        shapeShadowOpacity: 20,
        shapeCornerRadius: 12,
      },
    };
  }, [isEnglish]);

  const applyProjectSnapshot = useCallback(async (project: AbiPaintProject, showNotice = false) => {
    const canvas = canvasRef.current;
    if (!canvas) throw new Error("Canvas unavailable");

    const width = Math.round(Number(project.canvas.width));
    const height = Math.round(Number(project.canvas.height));
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1 || width * height > 36_000_000) {
      throw new Error("Invalid project canvas size");
    }

    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable");
    context.fillStyle = PAPER;
    context.fillRect(0, 0, width, height);
    if (typeof project.canvas.baseImage === "string" && project.canvas.baseImage) {
      try {
        const baseImage = await loadImageElement(project.canvas.baseImage);
        context.drawImage(baseImage, 0, 0, width, height);
      } catch {
        // 保留乾淨底圖並繼續復原其他可編輯素材。
      }
    }

    const nextPaintLayers = project.paintLayers.slice(0, MAX_PAINT_LAYERS).map((layer, index) => ({
      id: typeof layer.id === "string" && layer.id ? layer.id : `${BASE_PAINT_LAYER_ID}-${index}`,
      name: typeof layer.name === "string" && layer.name ? layer.name : (isEnglish ? `Layer ${index + 1}` : `圖層 ${index + 1}`),
      locked: Boolean(layer.locked),
    }));
    const resolvedPaintLayers = nextPaintLayers.length
      ? nextPaintLayers
      : [{ id: BASE_PAINT_LAYER_ID, name: isEnglish ? "Layer 1" : "圖層 1", locked: false }];
    const resolvedActivePaintLayerId = resolvedPaintLayers.some((layer) => layer.id === project.activePaintLayerId)
      ? project.activePaintLayerId
      : resolvedPaintLayers[0].id;

    setCanvasSize({ width, height });
    setBleedGuide(project.canvas.bleedGuide ? { ...project.canvas.bleedGuide } : null);
    setAdjustments({
      exposure: typeof project.canvas.adjustments?.exposure === "number" ? project.canvas.adjustments.exposure : 0,
      contrast: typeof project.canvas.adjustments?.contrast === "number" ? project.canvas.adjustments.contrast : 0,
      saturation: normalizeProjectSaturation(project.canvas.adjustments?.saturation, project.version),
      vibrancy: normalizeProjectVibrancy(project.canvas.adjustments?.vibrancy),
      opacity: clamp(typeof project.canvas.adjustments?.opacity === "number" ? project.canvas.adjustments.opacity : 100, 1, 100),
    });
    setScaleImagesWithCanvas(Boolean(project.document.scaleImagesWithCanvas));
    setDocumentNameDraft(project.document.name?.trim() || copy.documentName);
    setFileMeta(project.document.fileMeta ?? { name: project.document.name?.trim() || copy.documentName, size: `${width} × ${height}` });
    setPaintLayers(resolvedPaintLayers);
    setActivePaintLayerId(resolvedActivePaintLayerId);
    syncLayers(project.materials.layers.map((layer) => ({ ...layer, saturation: normalizeProjectSaturation(layer.saturation, project.version), vibrancy: normalizeProjectVibrancy(layer.vibrancy) })));
    syncShapes(project.materials.shapes.map((shape) => ({ ...shape, saturation: normalizeProjectSaturation(shape.saturation, project.version), vibrancy: normalizeProjectVibrancy(shape.vibrancy) })));
    syncImages(project.materials.images.map((image) => ({ ...image, saturation: normalizeProjectSaturation(image.saturation, project.version), vibrancy: normalizeProjectVibrancy(image.vibrancy), crop: image.crop ? { ...image.crop } : undefined })));
    syncStrokes(project.materials.strokes.map((stroke) => ({ ...stroke, points: stroke.points.map((point) => ({ ...point })) })));
    setBrushKind(project.tools?.brushKind ?? "oil");
    setBrushColor(project.tools?.brushColor ?? BRAND_RED);
    setBrushSize(project.tools?.brushSize ?? 18);
    setBrushOpacity(project.tools?.brushOpacity ?? 100);
    setShapeKind(project.tools?.shapeKind ?? "rectangle");
    setShapeFill(project.tools?.shapeFill ?? BRAND_RED);
    setShapeOutline(project.tools?.shapeOutline ?? "#FFFDF8");
    setShapeOutlineWidth(project.tools?.shapeOutlineWidth ?? 2);
    setShapeShadow(project.tools?.shapeShadow ?? true);
    setShapeOpacity(project.tools?.shapeOpacity ?? 100);
    setShapeShadowOpacity(project.tools?.shapeShadowOpacity ?? 20);
    setShapeCornerRadius(project.tools?.shapeCornerRadius ?? 12);
    setHasArtwork(Boolean(project.hasArtwork || project.materials.layers.length || project.materials.shapes.length || project.materials.images.length || project.materials.strokes.length));
    setSelectedTextId(null);
    setSelectedShapeId(null);
    setSelectedImageId(null);
    setSelectedStrokeId(null);
    setEditingTextId(null);
    setImageEditingId(null);
    setCropDraft(null);
    setOpenDesktopTool(null);
    historyRef.current = [];
    historyIndexRef.current = -1;
    captureHistory(project.canvas.bleedGuide ?? null);
    if (showNotice) toast.success(tr("專案已載入", "Project loaded"));
  }, [copy.documentName, isEnglish, syncImages, syncLayers, syncShapes, syncStrokes]);

  const exportProject = () => {
    const project = createProjectSnapshot();
    if (!project) {
      toast.error(tr("專案暫時無法匯出，請再試一次", "Project export is unavailable. Please try again."));
      return;
    }
    const blob = new Blob([JSON.stringify(project)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${(documentNameDraft || "abipaint").replace(/[\\/:*?\"<>|]/g, "-")}.abipaint`;
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success(tr("專案檔已匯出", "Project file exported"));
  };

  const handleProjectImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isAbiPaintProject(parsed)) throw new Error("Invalid project file");
      await applyProjectSnapshot(parsed, true);
    } catch {
      toast.error(tr("無法讀取此專案檔，請確認檔案未損毀", "This project file could not be read. Please check that it is intact."));
    } finally {
      event.target.value = "";
    }
  };

  const writeWorkingFileSnapshot = useCallback((snapshot = createProjectSnapshot()) => {
    const currentId = activeWorkingFileIdRef.current;
    if (!snapshot || !currentId) return workingFilesRef.current;
    const nextFiles = workingFilesRef.current.map((file) => file.id === currentId ? { ...file, project: snapshot } : file);
    syncWorkingFiles(nextFiles);
    return nextFiles;
  }, [createProjectSnapshot, syncWorkingFiles]);

  const persistWorkspace = useCallback((files: WorkingFile[] = workingFilesRef.current, activeId = activeWorkingFileIdRef.current) => {
    if (!files.length || !activeId) return;
    void writeAutoSavedWorkspace({
      format: "abipaint-workspace",
      version: 1,
      activeWorkingFileId: activeId,
      files,
    }).catch(() => undefined);
  }, []);

  const switchWorkingFile = useCallback(async (workingFileId: string) => {
    if (!workingFileId || workingFileId === activeWorkingFileIdRef.current) return;
    const nextFiles = writeWorkingFileSnapshot();
    const target = nextFiles.find((file) => file.id === workingFileId);
    if (!target) return;
    activeWorkingFileIdRef.current = target.id;
    setActiveWorkingFileId(target.id);
    isApplyingWorkingFileRef.current = true;
    try {
      await applyProjectSnapshot(target.project);
      persistWorkspace(nextFiles, target.id);
    } finally {
      isApplyingWorkingFileRef.current = false;
    }
  }, [applyProjectSnapshot, persistWorkspace, writeWorkingFileSnapshot]);

  const createWorkingFile = async () => {
    if (workingFilesRef.current.length >= MAX_WORKING_FILES) {
      toast.info(tr("最多可同時開啟 3 個工作檔", "You can open up to 3 Working Files"));
      return;
    }
    const nextFiles = writeWorkingFileSnapshot();
    const nextFile: WorkingFile = {
      id: makeId("working-file"),
      project: createBlankProject(nextFiles.length + 1),
    };
    const filesWithNew = [...nextFiles, nextFile];
    syncWorkingFiles(filesWithNew);
    activeWorkingFileIdRef.current = nextFile.id;
    setActiveWorkingFileId(nextFile.id);
    isApplyingWorkingFileRef.current = true;
    try {
      await applyProjectSnapshot(nextFile.project);
      persistWorkspace(filesWithNew, nextFile.id);
    } finally {
      isApplyingWorkingFileRef.current = false;
    }
  };

  const resetCurrentWorkingFile = async () => {
    const currentId = activeWorkingFileIdRef.current;
    if (!currentId) return;
    const currentIndex = Math.max(0, workingFilesRef.current.findIndex((file) => file.id === currentId));
    const blankProject = createBlankProject(currentIndex + 1);
    const nextFiles = workingFilesRef.current.map((file) => file.id === currentId ? { ...file, project: blankProject } : file);
    syncWorkingFiles(nextFiles);
    isApplyingWorkingFileRef.current = true;
    try {
      await applyProjectSnapshot(blankProject);
      persistWorkspace(nextFiles, currentId);
      toast.success(copy.workingFileReset);
    } finally {
      isApplyingWorkingFileRef.current = false;
      setResetWorkingFileDialogOpen(false);
    }
  };

  const closeWorkingFile = async (event: ReactMouseEvent<HTMLButtonElement>, workingFileId: string) => {
    event.stopPropagation();
    const currentFiles = writeWorkingFileSnapshot();
    if (currentFiles.length <= 1) {
      toast.info(tr("至少保留一個工作檔", "Keep at least one Working File open"));
      return;
    }
    const closingIndex = currentFiles.findIndex((file) => file.id === workingFileId);
    if (closingIndex < 0) return;
    const nextFiles = currentFiles.filter((file) => file.id !== workingFileId);
    syncWorkingFiles(nextFiles);
    if (workingFileId !== activeWorkingFileIdRef.current) {
      persistWorkspace(nextFiles);
      return;
    }
    const nextActive = nextFiles[Math.max(0, closingIndex - 1)] ?? nextFiles[0];
    activeWorkingFileIdRef.current = nextActive.id;
    setActiveWorkingFileId(nextActive.id);
    isApplyingWorkingFileRef.current = true;
    try {
      await applyProjectSnapshot(nextActive.project);
      persistWorkspace(nextFiles, nextActive.id);
    } finally {
      isApplyingWorkingFileRef.current = false;
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const savedWorkspace = await readAutoSavedWorkspace();
        let workspace: AbiPaintWorkspace | null = isAbiPaintWorkspace(savedWorkspace) ? savedWorkspace : null;
        if (!workspace) {
          const legacyProject = await readAutoSavedProject();
          const initialProject = isAbiPaintProject(legacyProject) ? legacyProject : createBlankProject(1);
          const initialId = makeId("working-file");
          workspace = {
            format: "abipaint-workspace",
            version: 1,
            activeWorkingFileId: initialId,
            files: [{ id: initialId, project: initialProject }],
          };
        }
        const migratedFiles = workspace.files.map((file) => ({ ...file, project: migrateProjectAdjustments(file.project) }));
        workspace = { ...workspace, files: migratedFiles };
        const activeFile = workspace.files.find((file) => file.id === workspace.activeWorkingFileId) ?? workspace.files[0];
        if (!cancelled && activeFile) {
          syncWorkingFiles(workspace.files);
          activeWorkingFileIdRef.current = activeFile.id;
          setActiveWorkingFileId(activeFile.id);
          isApplyingWorkingFileRef.current = true;
          await applyProjectSnapshot(activeFile.project);
          void writeAutoSavedWorkspace(workspace).catch(() => undefined);
        }
      } catch {
        // 本機暫存不可用時，維持既有的新畫布流程。
      } finally {
        if (!cancelled) {
          isApplyingWorkingFileRef.current = false;
          isProjectHydratedRef.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyProjectSnapshot, createBlankProject, syncWorkingFiles]);

  useEffect(() => {
    if (!isProjectHydratedRef.current || isApplyingWorkingFileRef.current) return;
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => {
      const snapshot = createProjectSnapshot();
      if (!snapshot) return;
      const nextFiles = writeWorkingFileSnapshot(snapshot);
      persistWorkspace(nextFiles);
    }, 700);
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [activePaintLayerId, adjustments, bleedGuide, brushColor, brushKind, brushOpacity, brushSize, canvasSize.height, canvasSize.width, createProjectSnapshot, documentNameDraft, fileMeta, hasArtwork, images, layers, paintLayers, persistWorkspace, projectRevision, scaleImagesWithCanvas, shapeCornerRadius, shapeFill, shapeKind, shapeOutline, shapeOutlineWidth, shapeShadow, shapes, strokes, writeWorkingFileSnapshot]);

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
      const textResize = textResizeRef.current;
      const point = getCanvasPoint(event.clientX, event.clientY, true);
      if (textResize) {
        const nextLayers = layersRef.current.map((layer) => {
          if (layer.id !== textResize.id) return layer;
          const deltaX = point.x - textResize.startPointX;
          const deltaY = point.y - textResize.startPointY;
          const widthScale = (textResize.startWidth + (textResize.axis.includes("left") ? -deltaX : deltaX)) / Math.max(1, textResize.startWidth);
          const heightScale = (textResize.startHeight + (textResize.axis.includes("top") ? -deltaY : deltaY)) / Math.max(1, textResize.startHeight);
          const dominantScale = Math.abs(deltaX / Math.max(1, textResize.startWidth)) >= Math.abs(deltaY / Math.max(1, textResize.startHeight)) ? widthScale : heightScale;
          const nextFontSize = clamp(Math.round(textResize.startFontSize * Math.max(0.2, dominantScale)), 12, 360);
          const nextWidth = textResize.startWidth * Math.max(0.2, dominantScale);
          const nextHeight = textResize.startHeight * Math.max(0.2, dominantScale);
          return {
            ...layer,
            fontSize: nextFontSize,
            x: textResize.axis.includes("left") ? textResize.startX + textResize.startWidth - nextWidth : textResize.startX,
            y: textResize.axis.includes("top") ? textResize.startY + textResize.startHeight - nextHeight : textResize.startY,
            rasterDataUrl: undefined,
            rasterWidth: undefined,
            rasterHeight: undefined,
          };
        });
        scheduleLayers(nextLayers);
        return;
      }
      if (imageRotate) {
        const currentAngle = Math.atan2(point.y - imageRotate.centerY, point.x - imageRotate.centerX);
        let nextRotation = imageRotate.startRotation + ((currentAngle - imageRotate.startAngle) * 180) / Math.PI;
        if (event.shiftKey) nextRotation = Math.round(nextRotation / 15) * 15;
        scheduleImages(imagesRef.current.map((image) => image.id === imageRotate.id ? { ...image, rotation: nextRotation } : image));
        return;
      }
      if (imageResize) {
        let resizeGuides: SnapGuides = { x: null, y: null };
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
          let nextX = event.altKey ? centerX - nextWidth / 2 : movesLeft ? imageResize.startX + imageResize.startWidth - nextWidth : imageResize.startX;
          let nextY = event.altKey ? centerY - nextHeight / 2 : movesTop ? imageResize.startY + imageResize.startHeight - nextHeight : imageResize.startY;
          if (!event.altKey) {
            const snapThreshold = 14 / Math.max(0.25, zoom / 100);
            if (movesLeft && point.x <= snapThreshold) {
              nextWidth = imageResize.startX + imageResize.startWidth;
              nextX = 0;
              resizeGuides.x = 0;
            } else if (movesRight && point.x >= canvasSize.width - snapThreshold) {
              nextWidth = canvasSize.width - nextX;
              resizeGuides.x = canvasSize.width;
            }
            if (movesTop && point.y <= snapThreshold) {
              nextHeight = imageResize.startY + imageResize.startHeight;
              nextY = 0;
              resizeGuides.y = 0;
            } else if (movesBottom && point.y >= canvasSize.height - snapThreshold) {
              nextHeight = canvasSize.height - nextY;
              resizeGuides.y = canvasSize.height;
            }
          }
          return {
            ...image,
            width: nextWidth,
            height: nextHeight,
            x: nextX,
            y: nextY,
          };
        });
        setSnapGuides((current) => current.x === resizeGuides.x && current.y === resizeGuides.y ? current : resizeGuides);
        scheduleImages(nextImages);
        return;
      }
      if (rotate) {
        const currentAngle = Math.atan2(point.y - rotate.centerY, point.x - rotate.centerX);
        let nextRotation = rotate.startRotation + ((currentAngle - rotate.startAngle) * 180) / Math.PI;
        if (event.shiftKey) nextRotation = Math.round(nextRotation / 15) * 15;
        scheduleShapes(shapesRef.current.map((shape) => shape.id === rotate.id ? { ...shape, rotation: nextRotation } : shape));
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
          if (shape.kind === "circle") {
            const centerX = resize.startX + resize.startWidth / 2;
            const centerY = resize.startY + resize.startHeight / 2;
            const startingDiameter = (resize.startWidth + resize.startHeight) / 2;
            const radialDelta = movesLeft ? -deltaX : movesRight ? deltaX : movesTop ? -deltaY : deltaY;
            const maxMaterialSize = Math.max(6000, canvasSize.width * 4, canvasSize.height * 4);
            const diameter = clamp(startingDiameter + radialDelta * 2, 60, maxMaterialSize);
            return {
              ...shape,
              width: diameter,
              height: diameter,
              x: centerX - diameter / 2,
              y: centerY - diameter / 2,
              cornerRadius: 0,
            };
          }
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
          const maxMaterialSize = Math.max(6000, canvasSize.width * 4, canvasSize.height * 4);
          nextWidth = clamp(nextWidth, 60, maxMaterialSize);
          nextHeight = clamp(nextHeight, 60, maxMaterialSize);
          const nextX = event.altKey ? centerX - nextWidth / 2 : movesLeft ? resize.startX + resize.startWidth - nextWidth : resize.startX;
          const nextY = event.altKey ? centerY - nextHeight / 2 : movesTop ? resize.startY + resize.startHeight - nextHeight : resize.startY;
          return {
            ...shape,
            width: nextWidth,
            height: nextHeight,
            x: nextX,
            y: nextY,
            cornerRadius: Math.min(shape.cornerRadius, Math.min(nextWidth, nextHeight) / 2),
          };
        });
        scheduleShapes(nextShapes);
        if (layersRef.current.some((layer) => layer.anchorShapeId === resize.id)) {
          scheduleLayers(layersRef.current.map((layer) => layer.anchorShapeId === resize.id ? {
            ...layer,
            rasterDataUrl: undefined,
            rasterWidth: undefined,
            rasterHeight: undefined,
          } : layer));
        }
        return;
      }
      if (drag) {
        let nextGuides: SnapGuides = { x: null, y: null };
        const nextLayers = layersRef.current.map((layer) => {
          if (layer.id !== drag.id) return layer;
          const dimensions = getTextLayerDimensions(layer);
          const rawX = point.x - drag.offsetX;
          const rawY = point.y - drag.offsetY;
          const snapped = getSnappedPosition(rawX, rawY, dimensions.width, dimensions.height);
          nextGuides = snapped.guides;
          return { ...layer, x: snapped.x, y: snapped.y };
        });
        setSnapGuides((current) => current.x === nextGuides.x && current.y === nextGuides.y ? current : nextGuides);
        scheduleLayers(nextLayers);
      }
      if (shapeDrag) {
        let nextGuides: SnapGuides = { x: null, y: null };
        const originalShape = shapesRef.current.find((shape) => shape.id === shapeDrag.id);
        const nextShapes = shapesRef.current.map((shape) => {
          if (shape.id !== shapeDrag.id) return shape;
          const rawX = point.x - shapeDrag.offsetX;
          const rawY = point.y - shapeDrag.offsetY;
          const snapped = getSnappedPosition(rawX, rawY, shape.width, shape.height, shape.id);
          nextGuides = snapped.guides;
          return { ...shape, x: snapped.x, y: snapped.y };
        });
        setSnapGuides((current) => current.x === nextGuides.x && current.y === nextGuides.y ? current : nextGuides);
        scheduleShapes(nextShapes);
        const movedShape = nextShapes.find((shape) => shape.id === shapeDrag.id);
        if (originalShape && movedShape) {
          const deltaX = movedShape.x - originalShape.x;
          const deltaY = movedShape.y - originalShape.y;
          scheduleLayers(layersRef.current.map((layer) => layer.anchorShapeId === shapeDrag.id
            ? { ...layer, x: layer.x + deltaX, y: layer.y + deltaY }
            : layer));
        }
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
        let nextGuides: SnapGuides = { x: null, y: null };
        const nextImages = imagesRef.current.map((image) => {
          if (image.id !== imageDrag.id) return image;
          const rawX = point.x - imageDrag.offsetX;
          const rawY = point.y - imageDrag.offsetY;
          const snapped = getSnappedPosition(rawX, rawY, image.width, image.height);
          nextGuides = snapped.guides;
          return { ...image, x: snapped.x, y: snapped.y };
        });
        setSnapGuides((current) => current.x === nextGuides.x && current.y === nextGuides.y ? current : nextGuides);
        scheduleImages(nextImages);
      }
    };
    const handleUp = () => {
      if (!textDragRef.current && !textResizeRef.current && !shapeDragRef.current && !strokeDragRef.current && !shapeResizeRef.current && !shapeRotateRef.current && !imageDragRef.current && !imageResizeRef.current && !imageRotateRef.current) return;
      textDragRef.current = null;
      textResizeRef.current = null;
      shapeDragRef.current = null;
      strokeDragRef.current = null;
      shapeResizeRef.current = null;
      shapeRotateRef.current = null;
      imageDragRef.current = null;
      imageResizeRef.current = null;
      imageRotateRef.current = null;
      setSnapGuides({ x: null, y: null });
      flushImageUpdates();
      flushShapeUpdates();
      flushLayerUpdates();
      captureHistory();
    };
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [canvasSize.height, canvasSize.width, captureHistory, flushImageUpdates, flushLayerUpdates, flushShapeUpdates, getCanvasPoint, getSnappedPosition, getTextLayerDimensions, scheduleImages, scheduleLayers, scheduleShapes, syncStrokes, zoom]);

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
            const selectedStroke = strokesRef.current.find((stroke) => stroke.id === selectedStrokeId);
            if (!selectedStroke || isPaintLayerLocked(selectedStroke.paintLayerId)) return;
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
        const hasNativeTextSelection = Boolean(window.getSelection()?.toString().trim());
        if (hasNativeTextSelection || (!selectedTextId && !selectedShapeId && !selectedImageId && !selectedStrokeId)) return;
        event.preventDefault();
        void copySelection();
        return;
      }
      if (modifier && key === "v") {
        event.preventDefault();
        void pasteSelection();
        return;
      }
      if (key === "escape" && cropDraft) {
        event.preventDefault();
        cancelImageCrop();
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
  }, [captureHistory, cropDraft, isPaintLayerLocked, selectedImageId, selectedShapeId, selectedStrokeId, selectedTextId, syncStrokes]);

  const drawStroke = (from: CanvasPoint, to: CanvasPoint) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    context.save();
    context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    drawSmoothCanvasStroke(context, [from, to], brushColor, brushSize, brushOpacity / 100, brushKind);
    context.restore();
  };

  const renderBrushStroke = (context: CanvasRenderingContext2D, stroke: BrushStroke) => {
    if (stroke.points.length === 0) return;
    const points = stroke.points.map((point) => ({ x: point.x + stroke.x, y: point.y + stroke.y }));
    const outlineWidth = stroke.outlineWidth ?? 0;
    if (outlineWidth > 0) {
      drawSmoothCanvasStroke(
        context,
        points,
        makeOutlineColor(stroke.outlineColor ?? "#FFFDF8", stroke.outlineExposure, stroke.outlineContrast, stroke.outlineSaturation, stroke.outlineVibrancy, stroke.outlineOpacity),
        stroke.size + outlineWidth * 2,
        1,
        stroke.kind,
      );
    }
    if ((stroke.shadowOpacity ?? 0) > 0) {
      context.save();
      context.shadowColor = `rgba(0, 0, 0, ${(stroke.shadowOpacity ?? 0) / 100})`;
      context.shadowBlur = 10;
      context.shadowOffsetX = 0;
      context.shadowOffsetY = 0;
      drawSmoothCanvasStroke(context, points, stroke.color, stroke.size, stroke.opacity / 100, stroke.kind);
      context.restore();
      return;
    }
    drawSmoothCanvasStroke(context, points, stroke.color, stroke.size, stroke.opacity / 100, stroke.kind);
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
    if (activePaintLayer?.locked) {
      toast.info(tr("目前圖層已鎖定，請先解除鎖定", "This layer is locked. Unlock it before adding artwork"));
      return;
    }
    const isSquareDefault = ["rectangle", "circle", "star", "heart", "pentagon"].includes(kind);
    const width = isSquareDefault ? 190 : 220;
    const height = isSquareDefault ? 190 : 150;
    const nextShape: ShapeLayer = {
      id: makeId("shape"),
      paintLayerId: activePaintLayer?.id ?? BASE_PAINT_LAYER_ID,
      stackOrder: getNextMaterialStackOrder(),
      kind,
      x: (canvasSize.width - width) / 2,
      y: (canvasSize.height - height) / 2,
      width,
      height,
      cornerRadius: kind === "rectangle" ? shapeCornerRadius : 0,
      rotation: 0,
      fill: shapeFill,
      opacity: shapeOpacity,
      exposure: 0,
      contrast: 0,
      saturation: 0,
      vibrancy: 0,
      outline: shapeOutline,
      outlineWidth: shapeOutlineWidth,
      shadow: shapeShadow,
      shadowColor: "#000000",
      shadowOpacity: shapeShadowOpacity,
      shadowBlur: 14,
      shadowX: 0,
      shadowY: 0,
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
    if (activePaintLayer?.locked) {
      toast.info(tr("目前圖層已鎖定，請先解除鎖定", "This layer is locked. Unlock it before adding artwork"));
      return;
    }
    const draftLayer: TextLayer = {
      id: makeId(),
      paintLayerId: activePaintLayer?.id ?? BASE_PAINT_LAYER_ID,
      stackOrder: getNextMaterialStackOrder(),
      text: tr("在這裡輸入文字", "Type here"),
      x: 0,
      y: 0,
      fontSize: 52,
      fontWeight: 700,
      color: GRAPHITE,
      opacity: 100,
        exposure: 0,
        contrast: 0,
        saturation: 0,
        vibrancy: 0,
        shadowOpacity: 0,
        fontFamily: "Noto Sans TC",
    };
    const dimensions = getTextLayerDimensions(draftLayer);
    const nextLayer = {
      ...draftLayer,
      x: Math.max(24, (canvasSize.width - dimensions.width) / 2),
      y: Math.max(24, (canvasSize.height - dimensions.height) / 2 - getTextVisualCenterOffset(draftLayer)),
    };
    syncLayers([...layersRef.current, nextLayer]);
    centerTextLayerByVisibleBounds(nextLayer.id, { x: 0, y: 0, width: canvasSize.width, height: canvasSize.height });
    setSelectedTextId(nextLayer.id);
    setSelectedShapeId(null);
    setSelectedImageId(null);
    setTool("text");
    captureHistory();
    toast.success(tr("文字已加入畫布", "Text added to canvas"));
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
    if (tool === "brush" && activePaintLayer?.locked) {
      toast.info(tr("目前圖層已鎖定，請先解除鎖定", "This layer is locked. Unlock it before drawing"));
      return;
    }
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDrawing(true);
    setHasArtwork(true);
    lastPointRef.current = point;
    if (tool === "retouch") {
      healSpot(point);
    } else {
      const nextStroke: BrushStroke = { id: makeId("stroke"), paintLayerId: activePaintLayer?.id ?? BASE_PAINT_LAYER_ID, stackOrder: getNextMaterialStackOrder(), points: [point], x: 0, y: 0, color: brushColor, size: brushSize, opacity: brushOpacity, kind: brushKind };
      drawingStrokeRef.current = nextStroke;
      setDrawingStroke(nextStroke);
    }
  };

  const clearSelectedObjects = () => {
    setSelectedStrokeId(null);
    setSelectedTextId(null);
    setSelectedShapeId(null);
    setSelectedImageId(null);
    setEditingTextId(null);
    setImageEditingId(null);
    setCropDraft(null);
    setSnapGuides({ x: null, y: null });
  };

  const handleCanvasBlankPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (target.closest(".image-layer, .shape-layer, .stroke-layer, .text-layer, .shape-control-layer, .text-resize-handle, .image-resize-handle, .image-rotation-handle, .shape-control-handle, .shape-control-rotation-handle")) return;
    if (cropDraft) {
      void applyImageCrop();
      return;
    }
    clearSelectedObjects();
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
      setSelectedStrokeId(null);
      setSelectedTextId(null);
      setSelectedShapeId(null);
      setSelectedImageId(null);
    }
    captureHistory();
  };

  const updateTextLayer = (patch: Partial<TextLayer>) => {
    if (!selectedTextId) return;
    const selectedLayer = layersRef.current.find((layer) => layer.id === selectedTextId);
    if (!selectedLayer || isPaintLayerLocked(selectedLayer.paintLayerId)) return;
    const updatesPixels = ["text", "fontFamily", "fontWeight", "fontSize", "color", "outlineColor", "outlineWidth", "outlineExposure", "outlineContrast", "outlineSaturation", "outlineVibrancy", "outlineOpacity"].some((key) => key in patch);
    const nextLayers = layersRef.current.map((layer) =>
      layer.id === selectedTextId ? {
        ...layer,
        ...patch,
        ...(updatesPixels ? { rasterDataUrl: undefined, rasterWidth: undefined, rasterHeight: undefined } : {}),
      } : layer,
    );
    syncLayers(nextLayers);
    const updatedLayer = nextLayers.find((layer) => layer.id === selectedTextId);
    const anchorShape = updatedLayer?.anchorShapeId ? shapesRef.current.find((shape) => shape.id === updatedLayer.anchorShapeId) : undefined;
    if (updatedLayer && anchorShape && ("text" in patch || "fontFamily" in patch || "fontWeight" in patch || "fontSize" in patch)) {
      centerTextLayerByVisibleBounds(updatedLayer.id, anchorShape);
    }
  };

  const startImageEditing = () => {
    if (!selectedImage || isPaintLayerLocked(selectedImage.paintLayerId)) return;
    setImageEditingId(selectedImage.id);
    setCropDraft(null);
  };

  const beginImageCrop = () => {
    if (!selectedImage || imageEditingId !== selectedImage.id || isPaintLayerLocked(selectedImage.paintLayerId)) return;
    const crop = selectedImage.crop ?? FULL_IMAGE_CROP;
    setCropDraft({ imageId: selectedImage.id, ...crop });
  };

  const updateCropDraft = (patch: Partial<ImageCrop>) => {
    setCropDraft((current) => {
      if (!current) return current;
      const next = { ...current, ...patch };
      next.x = clamp(next.x, 0, 0.9);
      next.y = clamp(next.y, 0, 0.9);
      next.width = clamp(next.width, 0.1, 1 - next.x);
      next.height = clamp(next.height, 0.1, 1 - next.y);
      return next;
    });
  };

  const handleCropHandlePointerDown = (event: ReactPointerEvent<HTMLDivElement>, image: ImageLayer, axis: CropHandleAxis) => {
    event.stopPropagation();
    event.preventDefault();
    if (!cropDraft || cropDraft.imageId !== image.id) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 部分觸控與合成指標環境不支援捕捉，仍由全域指標事件持續追蹤。
    }
    const point = getCanvasPoint(event.clientX, event.clientY);
    cropDragRef.current = {
      imageId: image.id,
      axis,
      startPointerX: point.x,
      startPointerY: point.y,
      startX: cropDraft.x,
      startY: cropDraft.y,
      startWidth: cropDraft.width,
      startHeight: cropDraft.height,
    };
  };

  const cancelImageCrop = () => {
    setCropDraft(null);
    setTool("move");
  };

  const applyImageCrop = async () => {
    if (!cropDraft) return;
    const image = imagesRef.current.find((item) => item.id === cropDraft.imageId);
    if (!image || isPaintLayerLocked(image.paintLayerId)) return;
    try {
      const source = await loadImageElement(image.src);
      const sourceWidth = Math.max(1, source.naturalWidth || source.width);
      const sourceHeight = Math.max(1, source.naturalHeight || source.height);
      const cropped = document.createElement("canvas");
      cropped.width = Math.max(1, Math.round(sourceWidth * cropDraft.width));
      cropped.height = Math.max(1, Math.round(sourceHeight * cropDraft.height));
      const context = cropped.getContext("2d");
      if (!context) return;
      context.drawImage(source, Math.round(sourceWidth * cropDraft.x), Math.round(sourceHeight * cropDraft.y), cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
      syncImages(imagesRef.current.map((item) => item.id === image.id ? {
        ...item,
        src: cropped.toDataURL("image/png"),
        x: item.x + item.width * cropDraft.x,
        y: item.y + item.height * cropDraft.y,
        width: item.width * cropDraft.width,
        height: item.height * cropDraft.height,
        crop: FULL_IMAGE_CROP,
      } : item));
      setCropDraft(null);
      setImageEditingId(image.id);
      setTool("move");
      captureHistory();
      toast.success(tr("圖片已裁切", "Image cropped"));
    } catch {
      toast.error(tr("圖片裁切失敗，請再試一次", "Image crop failed. Please try again"));
    }
  };

  useEffect(() => {
    const applyCropOnEnter = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT" || target?.isContentEditable) return;
      if (event.key === "Enter" && cropDraft) {
        event.preventDefault();
        void applyImageCrop();
      }
    };
    window.addEventListener("keydown", applyCropOnEnter);
    return () => window.removeEventListener("keydown", applyCropOnEnter);
  }, [cropDraft]);

  const addTextCard = () => {
    if (activePaintLayer?.locked) {
      toast.info(tr("目前圖層已鎖定，請先解除鎖定", "This layer is locked. Unlock it before adding artwork"));
      return;
    }
    const anchorShape = selectedShapeId ? shapesRef.current.find((shape) => shape.id === selectedShapeId) : undefined;
    const draftLayer: TextLayer = {
      id: makeId("text"),
      paintLayerId: activePaintLayer?.id ?? BASE_PAINT_LAYER_ID,
      stackOrder: getNextMaterialStackOrder(),
      text: "標題文字",
      x: canvasSize.width * 0.16,
      y: canvasSize.height * 0.18,
      fontSize: 64,
      fontWeight: 700,
      color: BRAND_RED,
      opacity: 100,
      exposure: 0,
      contrast: 0,
      saturation: 0,
      vibrancy: 0,
      shadowOpacity: 0,
      fontFamily: "DM Sans",
      anchorShapeId: anchorShape?.id,
    };
    const dimensions = getTextLayerDimensions(draftLayer);
    const nextLayer: TextLayer = anchorShape
      ? {
        ...draftLayer,
        x: anchorShape.x + (anchorShape.width - dimensions.width) / 2,
        y: anchorShape.y + (anchorShape.height - dimensions.height) / 2 - getTextVisualCenterOffset(draftLayer),
      }
      : draftLayer;
    const nextLayers = [...layersRef.current, nextLayer];
    syncLayers(nextLayers);
    if (anchorShape) centerTextLayerByVisibleBounds(nextLayer.id, anchorShape);
    setSelectedTextId(nextLayer.id);
    setSelectedShapeId(null);
    setSelectedImageId(null);
    toast.success(tr("已新增文字卡，現在可以直接編輯", "Text added — you can edit it now"));
    captureHistory();
  };

  const copySelection = async () => {
    const source = selectedText
      ? { type: "text" as const, item: { ...selectedText } }
      : selectedShape
        ? { type: "shape" as const, item: { ...selectedShape } }
        : selectedImage
          ? { type: "image" as const, item: { ...selectedImage, crop: selectedImage.crop ? { ...selectedImage.crop } : undefined } }
          : selectedStroke
            ? { type: "stroke" as const, item: { ...selectedStroke, points: selectedStroke.points.map((point) => ({ ...point })) } }
            : null;
    if (!source) {
      toast.info(tr("請先選取素材", "Select an object first"));
      return;
    }
    objectClipboardRef.current = source;
    if (source.type === "text") {
      try {
        await navigator.clipboard?.writeText(source.item.text);
      } catch {
        // 瀏覽器未授權 clipboard 時仍保留工作台內部複製內容。
      }
    }
    toast.success(tr("素材已複製", "Object copied"));
  };

  const pasteSelection = async () => {
    let clipboardText = "";
    try {
      clipboardText = (await navigator.clipboard?.readText()) ?? "";
    } catch {
      // 使用工作台內部剪貼簿作為 fallback。
    }
    const source = objectClipboardRef.current;
    if (source?.type === "shape") {
      const nextShape: ShapeLayer = { ...source.item, id: makeId("shape"), paintLayerId: activePaintLayer?.id ?? BASE_PAINT_LAYER_ID, stackOrder: getNextMaterialStackOrder(), x: source.item.x + 24, y: source.item.y + 24 };
      syncShapes([...shapesRef.current, nextShape]);
      setSelectedShapeId(nextShape.id); setSelectedTextId(null); setSelectedImageId(null); setSelectedStrokeId(null);
      setTool("move"); captureHistory(); toast.success(tr("圖形已貼上", "Shape pasted"));
      return;
    }
    if (source?.type === "image") {
      const nextImage: ImageLayer = { ...source.item, id: makeId("image"), paintLayerId: activePaintLayer?.id ?? BASE_PAINT_LAYER_ID, stackOrder: getNextMaterialStackOrder(), x: source.item.x + 24, y: source.item.y + 24, crop: source.item.crop ? { ...source.item.crop } : undefined };
      syncImages([...imagesRef.current, nextImage]);
      setSelectedImageId(nextImage.id); setSelectedTextId(null); setSelectedShapeId(null); setSelectedStrokeId(null);
      setImageEditingId(nextImage.id); setTool("move"); captureHistory(); toast.success(tr("圖片已貼上", "Image pasted"));
      return;
    }
    if (source?.type === "stroke") {
      const nextStroke: BrushStroke = { ...source.item, id: makeId("stroke"), paintLayerId: activePaintLayer?.id ?? BASE_PAINT_LAYER_ID, stackOrder: getNextMaterialStackOrder(), x: source.item.x + 24, y: source.item.y + 24, points: source.item.points.map((point) => ({ x: point.x + 24, y: point.y + 24 })) };
      syncStrokes([...strokesRef.current, nextStroke]);
      setSelectedStrokeId(nextStroke.id); setSelectedTextId(null); setSelectedShapeId(null); setSelectedImageId(null);
      setTool("move"); captureHistory(); toast.success(tr("筆觸已貼上", "Brush stroke pasted"));
      return;
    }
    if (!source && !clipboardText) {
      toast.info(tr("請先複製素材或文字", "Copy an object or text first"));
      return;
    }
    const textSource = source?.type === "text" ? source.item : null;
    const nextLayer: TextLayer = {
      ...(textSource ?? {
        id: makeId("text"),
        paintLayerId: activePaintLayer?.id ?? BASE_PAINT_LAYER_ID,
        text: clipboardText,
        x: canvasSize.width * 0.2,
        y: canvasSize.height * 0.2,
        fontSize: 52,
        fontWeight: 700,
        color: GRAPHITE,
        opacity: 100,
        exposure: 0,
        contrast: 0,
        saturation: 0,
        vibrancy: 0,
        shadowOpacity: 0,
        fontFamily: "Noto Sans TC" as TextLayer["fontFamily"],
      }),
      id: makeId("text"),
      paintLayerId: activePaintLayer?.id ?? BASE_PAINT_LAYER_ID,
      stackOrder: getNextMaterialStackOrder(),
      text: clipboardText || textSource?.text || "貼上的文字",
      x: (textSource?.x ?? canvasSize.width * 0.2) + 24,
      y: (textSource?.y ?? canvasSize.height * 0.2) + 24,
      anchorShapeId: undefined,
    };
    syncLayers([...layersRef.current, nextLayer]);
    setSelectedTextId(nextLayer.id);
    setSelectedShapeId(null); setSelectedImageId(null); setSelectedStrokeId(null);
    setTool("move");
    captureHistory();
    toast.success(tr("文字卡已貼上", "Text object pasted"));
  };

  const deleteSelectedText = () => {
    if (!selectedTextId) return;
    const selectedLayer = layersRef.current.find((layer) => layer.id === selectedTextId);
    if (!selectedLayer || isPaintLayerLocked(selectedLayer.paintLayerId)) return;
    syncLayers(layersRef.current.filter((layer) => layer.id !== selectedTextId));
    setSelectedTextId(null);
    captureHistory();
    toast.success(tr("文字卡已移除", "Text object removed"));
  };

  const updateShape = (patch: Partial<ShapeLayer>) => {
    if (!selectedShapeId) return;
    const selectedLayer = shapesRef.current.find((shape) => shape.id === selectedShapeId);
    if (!selectedLayer || isPaintLayerLocked(selectedLayer.paintLayerId)) return;
    const nextShapes = shapesRef.current.map((shape) =>
      shape.id === selectedShapeId ? { ...shape, ...patch } : shape,
    );
    syncShapes(nextShapes);
  };

  const updateStroke = (patch: Partial<BrushStroke>) => {
    if (!selectedStrokeId) return;
    const selectedLayer = strokesRef.current.find((stroke) => stroke.id === selectedStrokeId);
    if (!selectedLayer || isPaintLayerLocked(selectedLayer.paintLayerId)) return;
    syncStrokes(strokesRef.current.map((stroke) => stroke.id === selectedStrokeId ? { ...stroke, ...patch } : stroke));
  };

  const deleteSelectedShape = () => {
    if (!selectedShapeId) return;
    const selectedLayer = shapesRef.current.find((shape) => shape.id === selectedShapeId);
    if (!selectedLayer || isPaintLayerLocked(selectedLayer.paintLayerId)) return;
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
    const selectedLayer = imagesRef.current.find((image) => image.id === selectedImageId);
    if (!selectedLayer || isPaintLayerLocked(selectedLayer.paintLayerId)) return;
    syncImages(imagesRef.current.filter((image) => image.id !== selectedImageId));
    setSelectedImageId(null);
    captureHistory();
    toast.success("圖片素材已移除");
  };

  const deleteSelectedMaterial = () => {
    if (selectedTextId) {
      deleteSelectedText();
      return;
    }
    if (selectedShapeId) {
      deleteSelectedShape();
      return;
    }
    if (selectedImageId) {
      deleteSelectedImage();
      return;
    }
    if (!selectedStrokeId) return;
    const selectedLayer = strokesRef.current.find((stroke) => stroke.id === selectedStrokeId);
    if (!selectedLayer || isPaintLayerLocked(selectedLayer.paintLayerId)) return;
    syncStrokes(strokesRef.current.filter((stroke) => stroke.id !== selectedStrokeId));
    setSelectedStrokeId(null);
    captureHistory();
    toast.success(tr("筆觸已移除", "Brush stroke removed"));
  };

  const duplicateSelectedMaterial = () => {
    const offset = 24;
    if (selectedShape && !isPaintLayerLocked(selectedShape.paintLayerId)) {
      const nextShape: ShapeLayer = { ...selectedShape, id: makeId("shape"), stackOrder: getNextMaterialStackOrder(), x: selectedShape.x + offset, y: selectedShape.y + offset };
      syncShapes([...shapesRef.current, nextShape]);
      setSelectedShapeId(nextShape.id); setSelectedTextId(null); setSelectedImageId(null); setSelectedStrokeId(null);
      setTool("move"); captureHistory(); toast.success(tr("圖形已複製", "Shape duplicated"));
      return;
    }
    if (selectedImage && !isPaintLayerLocked(selectedImage.paintLayerId)) {
      const nextImage: ImageLayer = { ...selectedImage, id: makeId("image"), stackOrder: getNextMaterialStackOrder(), x: selectedImage.x + offset, y: selectedImage.y + offset, crop: selectedImage.crop ? { ...selectedImage.crop } : undefined };
      syncImages([...imagesRef.current, nextImage]);
      setSelectedImageId(nextImage.id); setSelectedTextId(null); setSelectedShapeId(null); setSelectedStrokeId(null);
      setImageEditingId(nextImage.id); setTool("move"); captureHistory(); toast.success(tr("圖片已複製", "Image duplicated"));
      return;
    }
    if (selectedStroke && !isPaintLayerLocked(selectedStroke.paintLayerId)) {
      const nextStroke: BrushStroke = { ...selectedStroke, id: makeId("stroke"), stackOrder: getNextMaterialStackOrder(), x: selectedStroke.x + offset, y: selectedStroke.y + offset, points: selectedStroke.points.map((point) => ({ ...point })) };
      syncStrokes([...strokesRef.current, nextStroke]);
      setSelectedStrokeId(nextStroke.id); setSelectedTextId(null); setSelectedShapeId(null); setSelectedImageId(null);
      setTool("move"); captureHistory(); toast.success(tr("筆觸已複製", "Brush stroke duplicated"));
      return;
    }
    if (selectedText && !isPaintLayerLocked(selectedText.paintLayerId)) {
      const nextText: TextLayer = { ...selectedText, id: makeId("text"), stackOrder: getNextMaterialStackOrder(), x: selectedText.x + offset, y: selectedText.y + offset, anchorShapeId: undefined };
      syncLayers([...layersRef.current, nextText]);
      setSelectedTextId(nextText.id); setSelectedShapeId(null); setSelectedImageId(null); setSelectedStrokeId(null);
      setTool("move"); captureHistory(); toast.success(tr("文字已複製", "Text duplicated"));
    }
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
      ...(axis === "vertical" || axis === "both" ? { y: target.y + (target.height - dimensions.height) / 2 - getTextVisualCenterOffset(selectedText) } : {}),
    });
    centerTextLayerByVisibleBounds(selectedText.id, target, axis);
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
    const scaleX = nextWidth / canvasSize.width;
    const scaleY = nextHeight / canvasSize.height;
    const materialScale = Math.min(scaleX, scaleY);
    const contentOffsetX = (nextWidth - canvasSize.width * materialScale) / 2;
    const contentOffsetY = (nextHeight - canvasSize.height * materialScale) / 2;
    tempContext.fillStyle = PAPER;
    tempContext.fillRect(0, 0, nextWidth, nextHeight);
    tempContext.drawImage(oldCanvas, contentOffsetX, contentOffsetY, canvasSize.width * materialScale, canvasSize.height * materialScale);
    oldCanvas.width = nextWidth;
    oldCanvas.height = nextHeight;
    oldCanvas.getContext("2d")?.drawImage(temp, 0, 0);
    syncLayers(
      layersRef.current.map((layer) => ({
        ...layer,
        x: layer.x * materialScale + contentOffsetX,
        y: layer.y * materialScale + contentOffsetY,
        fontSize: layer.fontSize * materialScale,
        rasterDataUrl: undefined,
        rasterWidth: undefined,
        rasterHeight: undefined,
      })),
    );
    syncShapes(
      shapesRef.current.map((shape) => ({
        ...shape,
        x: shape.x * materialScale + contentOffsetX,
        y: shape.y * materialScale + contentOffsetY,
        width: shape.width * materialScale,
        height: shape.height * materialScale,
        outlineWidth: shape.outlineWidth * materialScale,
        shadowBlur: shape.shadowBlur * materialScale,
        shadowX: shape.shadowX * materialScale,
        shadowY: shape.shadowY * materialScale,
      })),
    );
    const imageScale = scaleImagesWithCanvas ? materialScale : 1;
    const imageOffsetX = scaleImagesWithCanvas ? contentOffsetX : 0;
    const imageOffsetY = scaleImagesWithCanvas ? contentOffsetY : 0;
    syncImages(
      imagesRef.current.map((image) => ({
        ...image,
        x: scaleImagesWithCanvas ? image.x * imageScale + imageOffsetX : image.x,
        y: scaleImagesWithCanvas ? image.y * imageScale + imageOffsetY : image.y,
        width: scaleImagesWithCanvas ? image.width * imageScale : image.width,
        height: scaleImagesWithCanvas ? image.height * imageScale : image.height,
      })),
    );
    syncStrokes(
      strokesRef.current.map((stroke) => ({
        ...stroke,
        x: stroke.x * materialScale + contentOffsetX,
        y: stroke.y * materialScale + contentOffsetY,
        size: stroke.size * materialScale,
        outlineWidth: (stroke.outlineWidth ?? 0) * materialScale,
        points: stroke.points.map((point) => ({ ...point, x: point.x * materialScale, y: point.y * materialScale })),
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

  const applyBusinessCardTemplate = (format: "asia" | "western") => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    const width = format === "asia" ? 1063 : 1050;
    const height = format === "asia" ? 638 : 600;
    const bleedInset = 36;
    const templateName = format === "asia" ? copy.asiaBusinessCard : copy.westernBusinessCard;
    const content = format === "asia"
      ? [
        { text: "公司名稱 / COMPANY", x: 90, y: 88, fontSize: 31, fontWeight: 700, color: BRAND_RED, fontFamily: "DM Sans" as TextLayer["fontFamily"] },
        { text: "姓名 Name", x: 90, y: 188, fontSize: 64, fontWeight: 700, color: GRAPHITE, fontFamily: "Noto Sans TC" as TextLayer["fontFamily"] },
        { text: "職稱｜部門", x: 94, y: 273, fontSize: 27, fontWeight: 500, color: "#555B5D", fontFamily: "Noto Sans TC" as TextLayer["fontFamily"] },
        { text: "電話  02 1234 5678", x: 90, y: 425, fontSize: 25, fontWeight: 400, color: GRAPHITE, fontFamily: "Noto Sans TC" as TextLayer["fontFamily"] },
        { text: "Email  hello@company.com", x: 90, y: 468, fontSize: 25, fontWeight: 400, color: GRAPHITE, fontFamily: "Noto Sans TC" as TextLayer["fontFamily"] },
        { text: "地址  台北市○○區○○路 123 號", x: 90, y: 511, fontSize: 23, fontWeight: 400, color: "#555B5D", fontFamily: "Noto Sans TC" as TextLayer["fontFamily"] },
      ]
      : [
        { text: "COMPANY NAME", x: 82, y: 84, fontSize: 31, fontWeight: 700, color: BRAND_RED, fontFamily: "DM Sans" as TextLayer["fontFamily"] },
        { text: "YOUR NAME", x: 82, y: 182, fontSize: 63, fontWeight: 700, color: GRAPHITE, fontFamily: "DM Sans" as TextLayer["fontFamily"] },
        { text: "TITLE / DEPARTMENT", x: 85, y: 264, fontSize: 25, fontWeight: 500, color: "#555B5D", fontFamily: "DM Sans" as TextLayer["fontFamily"] },
        { text: "+1 234 567 890", x: 82, y: 404, fontSize: 24, fontWeight: 400, color: GRAPHITE, fontFamily: "DM Sans" as TextLayer["fontFamily"] },
        { text: "hello@company.com", x: 82, y: 445, fontSize: 24, fontWeight: 400, color: GRAPHITE, fontFamily: "DM Sans" as TextLayer["fontFamily"] },
        { text: "123 Main Street, City, Country", x: 82, y: 486, fontSize: 21, fontWeight: 400, color: "#555B5D", fontFamily: "DM Sans" as TextLayer["fontFamily"] },
      ];
    canvas.width = width;
    canvas.height = height;
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, width, height);
    const templateTexts: TextLayer[] = content.map((item, index) => ({
      id: makeId("template-text"),
      paintLayerId: BASE_PAINT_LAYER_ID,
      stackOrder: index + 1,
      ...item,
      opacity: 100,
      exposure: 0,
      contrast: 0,
      saturation: 0,
      vibrancy: 0,
      shadowOpacity: 0,
    }));
    syncLayers(templateTexts);
    syncShapes([]);
    syncImages([]);
    syncStrokes([]);
    setCanvasSize({ width, height });
    setBleedGuide({ inset: bleedInset });
    setPaintLayers((current) => current.map((layer) => layer.id === BASE_PAINT_LAYER_ID ? { ...layer, locked: false } : layer));
    setActivePaintLayerId(BASE_PAINT_LAYER_ID);
    setSelectedTextId(templateTexts[1]?.id ?? templateTexts[0]?.id ?? null);
    setSelectedShapeId(null);
    setSelectedImageId(null);
    setSelectedStrokeId(null);
    setImageEditingId(null);
    setCropDraft(null);
    setTool("move");
    setActiveDesktopTool(null);
    setOpenDesktopTool(null);
    setHasArtwork(true);
    setFileMeta({ name: templateName, size: `${width} × ${height}` });
    setDocumentNameDraft(templateName);
    captureHistory({ inset: bleedInset });
    window.requestAnimationFrame(fitCanvasToViewport);
    toast.success(tr(`${templateName} 已套用`, `${templateName} applied`));
  };

  const removeSelectedImageBackground = async () => {
    const image = selectedImage;
    if (!image || backgroundRemovalImageId || isPaintLayerLocked(image.paintLayerId)) return;

    setBackgroundRemovalImageId(image.id);
    setBackgroundRemovalNotice({ kind: "loading", message: tr("正在準備去背模型…", "Preparing background-removal model…") });
    try {
      const source = await loadImageElement(image.src);
      const sourceWidth = Math.max(1, source.naturalWidth || source.width);
      const sourceHeight = Math.max(1, source.naturalHeight || source.height);
      const scale = Math.min(1, BACKGROUND_REMOVAL_MAX_EDGE / Math.max(sourceWidth, sourceHeight));
      const outputWidth = Math.max(1, Math.round(sourceWidth * scale));
      const outputHeight = Math.max(1, Math.round(sourceHeight * scale));

      const modelCanvas = document.createElement("canvas");
      modelCanvas.width = 320;
      modelCanvas.height = 320;
      const modelContext = modelCanvas.getContext("2d", { willReadFrequently: true });
      if (!modelContext) throw new Error("Canvas is unavailable");
      modelContext.drawImage(source, 0, 0, 320, 320);
      const pixels = modelContext.getImageData(0, 0, 320, 320).data;
      const input = new Float32Array(1 * 3 * 320 * 320);
      const planeSize = 320 * 320;
      for (let index = 0; index < planeSize; index += 1) {
        const offset = index * 4;
        input[index] = (pixels[offset] / 255 - 0.485) / 0.229;
        input[planeSize + index] = (pixels[offset + 1] / 255 - 0.456) / 0.224;
        input[planeSize * 2 + index] = (pixels[offset + 2] / 255 - 0.406) / 0.225;
      }

      setBackgroundRemovalNotice({ kind: "loading", message: tr("正在載入本機去背引擎…", "Loading local removal engine…") });
      const runtime = backgroundRemovalRuntimeRef.current ?? await import("onnxruntime-web/wasm");
      backgroundRemovalRuntimeRef.current = runtime;
      if (!backgroundRemovalSessionRef.current) {
        runtime.env.wasm.numThreads = 1;
        runtime.env.wasm.proxy = false;
        runtime.env.wasm.wasmPaths = ONNX_RUNTIME_WASM_URL;
        setBackgroundRemovalNotice({ kind: "loading", message: tr("正在下載主體辨識模型（約 5 MB）…", "Downloading subject model (~5 MB)…") });
        backgroundRemovalSessionRef.current = await runtime.InferenceSession.create(U2NETP_MODEL_URL, {
          executionProviders: ["wasm"],
          graphOptimizationLevel: "all",
        });
      }

      const session = backgroundRemovalSessionRef.current;
      setBackgroundRemovalNotice({ kind: "processing", message: tr("正在辨識人物或物品主體…", "Detecting the foreground subject…") });
      const results = await session.run({ [session.inputNames[0]]: new runtime.Tensor("float32", input, [1, 3, 320, 320]) });
      const output = results[session.outputNames.includes("d0") ? "d0" : session.outputNames[0]];
      if (!output?.data) throw new Error("Subject mask is unavailable");

      const values = output.data as Float32Array;
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < planeSize; index += 1) {
        min = Math.min(min, values[index]);
        max = Math.max(max, values[index]);
      }
      const range = Math.max(0.00001, max - min);
      const mask = modelContext.createImageData(320, 320);
      const foregroundMask = new Uint8Array(planeSize);
      const confidenceMask = new Float32Array(planeSize);
      for (let index = 0; index < planeSize; index += 1) {
        const confidence = clamp((values[index] - min) / range, 0, 1);
        confidenceMask[index] = confidence;
        foregroundMask[index] = confidence >= BACKGROUND_REMOVAL_MASK_THRESHOLD ? 1 : 0;
      }
      preserveConnectedMaskDetails(foregroundMask, confidenceMask, 320, 320);
      closeThinMaskGaps(foregroundMask, 320, 320);
      fillEnclosedMaskHoles(foregroundMask, 320, 320);
      for (let index = 0; index < planeSize; index += 1) {
        const offset = index * 4;
        mask.data[offset] = 255;
        mask.data[offset + 1] = 255;
        mask.data[offset + 2] = 255;
        mask.data[offset + 3] = foregroundMask[index] ? 255 : 0;
      }
      modelContext.putImageData(mask, 0, 0);

      const scaledMaskCanvas = document.createElement("canvas");
      scaledMaskCanvas.width = outputWidth;
      scaledMaskCanvas.height = outputHeight;
      const scaledMaskContext = scaledMaskCanvas.getContext("2d", { willReadFrequently: true });
      if (!scaledMaskContext) throw new Error("Canvas is unavailable");
      scaledMaskContext.imageSmoothingEnabled = true;
      scaledMaskContext.drawImage(modelCanvas, 0, 0, outputWidth, outputHeight);
      const scaledMask = scaledMaskContext.getImageData(0, 0, outputWidth, outputHeight);
      for (let index = 0; index < scaledMask.data.length; index += 4) {
        scaledMask.data[index] = 255;
        scaledMask.data[index + 1] = 255;
        scaledMask.data[index + 2] = 255;
        scaledMask.data[index + 3] = scaledMask.data[index + 3] >= 128 ? 255 : 0;
      }
      const sourceRefineCanvas = document.createElement("canvas");
      sourceRefineCanvas.width = outputWidth;
      sourceRefineCanvas.height = outputHeight;
      const sourceRefineContext = sourceRefineCanvas.getContext("2d", { willReadFrequently: true });
      if (!sourceRefineContext) throw new Error("Canvas is unavailable");
      sourceRefineContext.drawImage(source, 0, 0, outputWidth, outputHeight);
      refineMaskAgainstUniformBackground(sourceRefineContext.getImageData(0, 0, outputWidth, outputHeight), scaledMask, outputWidth, outputHeight);
      scaledMaskContext.putImageData(scaledMask, 0, 0);

      const resultCanvas = document.createElement("canvas");
      resultCanvas.width = outputWidth;
      resultCanvas.height = outputHeight;
      const resultContext = resultCanvas.getContext("2d");
      if (!resultContext) throw new Error("Canvas is unavailable");
      resultContext.drawImage(source, 0, 0, outputWidth, outputHeight);
      resultContext.globalCompositeOperation = "destination-in";
      resultContext.drawImage(scaledMaskCanvas, 0, 0);
      resultContext.globalCompositeOperation = "source-over";
      const composited = resultContext.getImageData(0, 0, outputWidth, outputHeight);
      const alpha = new Uint8Array(outputWidth * outputHeight);
      for (let index = 0; index < alpha.length; index += 1) alpha[index] = composited.data[index * 4 + 3];
      for (let y = 1; y < outputHeight - 1; y += 1) {
        for (let x = 1; x < outputWidth - 1; x += 1) {
          const index = y * outputWidth + x;
          if (!alpha[index]) continue;
          const touchesTransparent = !alpha[index - 1] || !alpha[index + 1] || !alpha[index - outputWidth] || !alpha[index + outputWidth];
          if (!touchesTransparent) continue;
          const offset = index * 4;
          const red = composited.data[offset];
          const green = composited.data[offset + 1];
          const blue = composited.data[offset + 2];
          if (blue > red + 16 && blue > green + 6) composited.data[offset + 3] = 0;
        }
      }
      resultContext.putImageData(composited, 0, 0);

      const transparentSource = resultCanvas.toDataURL("image/png");
      syncImages(imagesRef.current.map((item) => item.id === image.id ? {
        ...item,
        src: transparentSource,
        backgroundSource: item.backgroundSource ?? image.src,
        crop: FULL_IMAGE_CROP,
      } : item));
      setHasArtwork(true);
      captureHistory();
      setBackgroundRemovalNotice({ kind: "success", message: tr("去背完成", "Background removed") });
      window.setTimeout(() => {
        setBackgroundRemovalNotice((current) => current?.kind === "success" ? null : current);
      }, 2600);
      toast.success(tr("去背完成", "Background removed"));
    } catch (error) {
      console.error("Background removal failed", error);
      const reason = error instanceof Error && error.message ? error.message : tr("無法初始化本機模型", "Unable to initialize the local model");
      setBackgroundRemovalNotice({ kind: "error", message: tr(`去背失敗：${reason}`, `Background removal failed: ${reason}`) });
      toast.error(tr("去背失敗，請確認網路後再試一次", "Background removal failed. Check your connection and try again"));
    } finally {
      setBackgroundRemovalImageId(null);
    }
  };

  const startBackgroundRepair = async () => {
    const image = selectedImage;
    if (!image?.backgroundSource || isPaintLayerLocked(image.paintLayerId)) return;
    try {
      const [source, current] = await Promise.all([loadImageElement(image.backgroundSource), loadImageElement(image.src)]);
      backgroundRepairSessionRef.current = { imageId: image.id, source, current };
      setCropDraft(null);
      setImageEditingId(image.id);
      setBackgroundRepair({ imageId: image.id, mode: "keep", brushSize: 24 });
      toast.info(tr("使用保留筆補回主體，移除筆清除殘留背景", "Use Keep to restore the subject and Remove to erase leftover background"));
    } catch {
      toast.error(tr("無法準備去背修補畫布", "Unable to prepare the background repair canvas"));
    }
  };

  const paintBackgroundRepair = (canvas: HTMLCanvasElement, from: { x: number; y: number }, to: { x: number; y: number }) => {
    const repair = backgroundRepair;
    const session = backgroundRepairSessionRef.current;
    if (!repair || !session || repair.imageId !== session.imageId) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const radius = Math.max(2, repair.brushSize);
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const length = Math.hypot(deltaX, deltaY);
    const angle = length > 0.001 ? Math.atan2(deltaY, deltaX) : 0;
    context.save();
    context.beginPath();
    context.moveTo(from.x + Math.cos(angle + Math.PI / 2) * radius, from.y + Math.sin(angle + Math.PI / 2) * radius);
    context.lineTo(to.x + Math.cos(angle + Math.PI / 2) * radius, to.y + Math.sin(angle + Math.PI / 2) * radius);
    context.arc(to.x, to.y, radius, angle + Math.PI / 2, angle - Math.PI / 2, false);
    context.lineTo(from.x + Math.cos(angle - Math.PI / 2) * radius, from.y + Math.sin(angle - Math.PI / 2) * radius);
    context.arc(from.x, from.y, radius, angle - Math.PI / 2, angle + Math.PI / 2, false);
    context.closePath();
    if (repair.mode === "keep") {
      context.clip();
      context.drawImage(session.source, 0, 0, canvas.width, canvas.height);
    } else {
      context.globalCompositeOperation = "destination-out";
      context.strokeStyle = "#000";
      context.fill();
    }
    context.restore();
  };

  const getBackgroundRepairPoint = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: clamp(((event.clientX - bounds.left) / Math.max(1, bounds.width)) * canvas.width, 0, canvas.width),
      y: clamp(((event.clientY - bounds.top) / Math.max(1, bounds.height)) * canvas.height, 0, canvas.height),
    };
  };

  const handleBackgroundRepairPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>, image: ImageLayer) => {
    if (!backgroundRepair || backgroundRepair.imageId !== image.id || event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getBackgroundRepairPoint(event);
    backgroundRepairPointerRef.current = { imageId: image.id, pointerId: event.pointerId, ...point };
    paintBackgroundRepair(event.currentTarget, point, point);
  };

  const handleBackgroundRepairPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>, image: ImageLayer) => {
    const drag = backgroundRepairPointerRef.current;
    if (!drag || drag.imageId !== image.id || drag.pointerId !== event.pointerId) return;
    const point = getBackgroundRepairPoint(event);
    paintBackgroundRepair(event.currentTarget, drag, point);
    backgroundRepairPointerRef.current = { ...drag, ...point };
  };

  const finishBackgroundRepairStroke = (event?: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event && backgroundRepairPointerRef.current?.pointerId !== event.pointerId) return;
    backgroundRepairPointerRef.current = null;
  };

  const commitBackgroundRepair = async () => {
    const repair = backgroundRepair;
    const session = backgroundRepairSessionRef.current;
    if (!repair || !session || repair.imageId !== session.imageId) return;
    const canvas = document.querySelector<HTMLCanvasElement>(`canvas[data-background-repair-id="${repair.imageId}"]`);
    if (!canvas) return;
    const nextSource = canvas.toDataURL("image/png");
    try {
      session.current = await loadImageElement(nextSource);
      syncImages(imagesRef.current.map((image) => image.id === repair.imageId ? { ...image, src: nextSource } : image));
      captureHistory();
      setBackgroundRepair(null);
      backgroundRepairPointerRef.current = null;
      toast.success(tr("去背修補已完成", "Background repair applied"));
    } catch {
      toast.error(tr("無法儲存去背修補", "Unable to save background repair"));
    }
  };

  const cancelBackgroundRepair = () => {
    setBackgroundRepair(null);
    backgroundRepairPointerRef.current = null;
  };

  const resetAdjustments = () => {
    setAdjustments({
      exposure: 0,
      contrast: 0,
      saturation: 0,
      vibrancy: 0,
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

  const updateActiveShadowOpacity = (value: number) => {
    if (selectedShape) {
      updateShape({ shadow: value > 0, shadowOpacity: value, shadowX: 0, shadowY: 0 });
      return;
    }
    if (selectedImage) {
      syncImages(imagesRef.current.map((image) => image.id === selectedImage.id ? { ...image, shadowOpacity: value } : image));
      return;
    }
    if (selectedText) updateTextLayer({ shadowOpacity: value });
    if (selectedStroke) updateStroke({ shadowOpacity: value });
  };

  const updateActiveOutline = (patch: { color?: string; width?: number; exposure?: number; contrast?: number; saturation?: number; vibrancy?: number; opacity?: number }) => {
    if (selectedShape) {
      updateShape({
        ...(patch.color !== undefined ? { outline: patch.color } : {}),
        ...(patch.width !== undefined ? { outlineWidth: patch.width } : {}),
        ...(patch.exposure !== undefined ? { outlineExposure: patch.exposure } : {}),
        ...(patch.contrast !== undefined ? { outlineContrast: patch.contrast } : {}),
        ...(patch.saturation !== undefined ? { outlineSaturation: patch.saturation } : {}),
        ...(patch.vibrancy !== undefined ? { outlineVibrancy: patch.vibrancy } : {}),
        ...(patch.opacity !== undefined ? { outlineOpacity: patch.opacity } : {}),
      });
      return;
    }
    if (selectedText) {
      updateTextLayer({
        ...(patch.color !== undefined ? { outlineColor: patch.color } : {}),
        ...(patch.width !== undefined ? { outlineWidth: patch.width } : {}),
        ...(patch.exposure !== undefined ? { outlineExposure: patch.exposure } : {}),
        ...(patch.contrast !== undefined ? { outlineContrast: patch.contrast } : {}),
        ...(patch.saturation !== undefined ? { outlineSaturation: patch.saturation } : {}),
        ...(patch.vibrancy !== undefined ? { outlineVibrancy: patch.vibrancy } : {}),
        ...(patch.opacity !== undefined ? { outlineOpacity: patch.opacity } : {}),
      });
      return;
    }
    if (selectedImage) {
      syncImages(imagesRef.current.map((image) => image.id === selectedImage.id ? {
        ...image,
        ...(patch.color !== undefined ? { outlineColor: patch.color } : {}),
        ...(patch.width !== undefined ? { outlineWidth: patch.width } : {}),
        ...(patch.exposure !== undefined ? { outlineExposure: patch.exposure } : {}),
        ...(patch.contrast !== undefined ? { outlineContrast: patch.contrast } : {}),
        ...(patch.saturation !== undefined ? { outlineSaturation: patch.saturation } : {}),
        ...(patch.vibrancy !== undefined ? { outlineVibrancy: patch.vibrancy } : {}),
        ...(patch.opacity !== undefined ? { outlineOpacity: patch.opacity } : {}),
      } : image));
      return;
    }
    if (selectedStroke) {
      updateStroke({
        ...(patch.color !== undefined ? { outlineColor: patch.color } : {}),
        ...(patch.width !== undefined ? { outlineWidth: patch.width } : {}),
        ...(patch.exposure !== undefined ? { outlineExposure: patch.exposure } : {}),
        ...(patch.contrast !== undefined ? { outlineContrast: patch.contrast } : {}),
        ...(patch.saturation !== undefined ? { outlineSaturation: patch.saturation } : {}),
        ...(patch.vibrancy !== undefined ? { outlineVibrancy: patch.vibrancy } : {}),
        ...(patch.opacity !== undefined ? { outlineOpacity: patch.opacity } : {}),
      });
    }
  };

  const resetActiveAdjustment = () => {
    updateActiveAdjustment({ exposure: 0, contrast: 0, saturation: 0, vibrancy: 0, opacity: 100 });
    toast.info(`${activeAdjustmentTarget}的影像調整已重設`);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (activePaintLayer?.locked) {
      toast.info(tr("目前圖層已鎖定，請先解除鎖定", "This layer is locked. Unlock it before importing an image"));
      event.target.value = "";
      return;
    }
    const image = new Image();
    image.onload = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const sourceWidth = Math.max(1, image.naturalWidth);
      const sourceHeight = Math.max(1, image.naturalHeight);
      const isFirstImportedImage = imagesRef.current.length === 0;
      const targetCanvasWidth = isFirstImportedImage ? sourceWidth : canvasSize.width;
      const targetCanvasHeight = isFirstImportedImage ? sourceHeight : canvasSize.height;
      const fitScale = isFirstImportedImage ? 1 : Math.min(1, targetCanvasWidth / sourceWidth, targetCanvasHeight / sourceHeight);
      const width = sourceWidth * fitScale;
      const height = sourceHeight * fitScale;

      if (isFirstImportedImage) {
        const scaleX = targetCanvasWidth / canvasSize.width;
        const scaleY = targetCanvasHeight / canvasSize.height;
        const previousCanvas = document.createElement("canvas");
        previousCanvas.width = canvas.width;
        previousCanvas.height = canvas.height;
        previousCanvas.getContext("2d")?.drawImage(canvas, 0, 0);
        canvas.width = targetCanvasWidth;
        canvas.height = targetCanvasHeight;
        const canvasContext = canvas.getContext("2d");
        if (canvasContext) {
          canvasContext.fillStyle = PAPER;
          canvasContext.fillRect(0, 0, targetCanvasWidth, targetCanvasHeight);
          canvasContext.drawImage(previousCanvas, 0, 0, targetCanvasWidth, targetCanvasHeight);
        }
        syncLayers(layersRef.current.map((layer) => ({ ...layer, x: layer.x * scaleX, y: layer.y * scaleY, fontSize: layer.fontSize * Math.min(scaleX, scaleY) })));
        syncShapes(shapesRef.current.map((shape) => ({ ...shape, x: shape.x * scaleX, y: shape.y * scaleY, width: shape.width * scaleX, height: shape.height * scaleY, outlineWidth: shape.outlineWidth * Math.min(scaleX, scaleY), shadowBlur: shape.shadowBlur * Math.min(scaleX, scaleY), shadowX: shape.shadowX * scaleX, shadowY: shape.shadowY * scaleY })));
        syncImages(imagesRef.current.map((existing) => ({ ...existing, x: existing.x * scaleX, y: existing.y * scaleY, width: existing.width * scaleX, height: existing.height * scaleY })));
        setCanvasSize({ width: targetCanvasWidth, height: targetCanvasHeight });
        setFileMeta({ name: file.name, size: `${targetCanvasWidth} × ${targetCanvasHeight}` });
        setDocumentNameDraft(file.name);
      }
      const nextImage: ImageLayer = {
        id: makeId("image"),
        paintLayerId: activePaintLayer?.id ?? BASE_PAINT_LAYER_ID,
        stackOrder: getNextMaterialStackOrder(),
        name: file.name,
        src: image.src,
        x: (targetCanvasWidth - width) / 2,
        y: (targetCanvasHeight - height) / 2,
        width,
        height,
        rotation: 0,
        opacity: 100,
        exposure: 0,
        contrast: 0,
        saturation: 0,
        vibrancy: 0,
        shadowOpacity: 0,
      };
      syncImages([...imagesRef.current, nextImage]);
      setSelectedImageId(nextImage.id);
      setSelectedTextId(null);
      setSelectedShapeId(null);
      setHasArtwork(true);
      captureHistory();
      toast.success(isFirstImportedImage
        ? tr(`影像已加入畫布，解析度 ${targetCanvasWidth} × ${targetCanvasHeight}`, `Image added. Canvas set to ${targetCanvasWidth} × ${targetCanvasHeight}`)
        : tr("影像已等比例置入既有畫布", "Image placed proportionally on the existing canvas"));
    };
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") image.src = reader.result;
    };
    reader.onerror = () => toast.error(tr("影像讀取失敗，請再試一次", "Image could not be read. Please try again."));
    reader.readAsDataURL(file);
    event.target.value = "";
  };

  const renderExportCanvas = async () => {
    const source = canvasRef.current;
    if (!source) throw new Error("Canvas workspace unavailable");
    await document.fonts?.ready;
    const output = document.createElement("canvas");
    output.width = source.width;
    output.height = source.height;
    const context = output.getContext("2d");
    if (!context) throw new Error("Export canvas context unavailable");
    context.filter = canvasFilter;
    context.globalAlpha = adjustments.opacity / 100;
    context.drawImage(source, 0, 0);
    context.filter = "none";
    context.globalAlpha = 1;

    const loadedImages = await Promise.all(imagesRef.current.map(async (image) => {
      try { return await loadImageElement(image.src); } catch { return null; }
    }));
    const imageElements = new Map(imagesRef.current.map((image, index) => [image.id, loadedImages[index]]));
    const loadedTextRasters = await Promise.all(layersRef.current.map(async (layer) => {
      if (!layer.rasterDataUrl) return null;
      try { return await loadImageElement(layer.rasterDataUrl); } catch { return null; }
    }));
    const textRasterElements = new Map(layersRef.current.map((layer, index) => [layer.id, loadedTextRasters[index]]));
    const renderQueue = [
      ...strokesRef.current.map((stroke, index) => ({ type: "stroke" as const, item: stroke, stackOrder: getMaterialStackOrder("stroke", stroke, index) })),
      ...imagesRef.current.map((image, index) => ({ type: "image" as const, item: image, stackOrder: getMaterialStackOrder("image", image, index) })),
      ...shapesRef.current.map((shape, index) => ({ type: "shape" as const, item: shape, stackOrder: getMaterialStackOrder("shape", shape, index) })),
      ...layersRef.current.map((layer, index) => ({ type: "text" as const, item: layer, stackOrder: getMaterialStackOrder("text", layer, index) })),
    ].sort((first, second) => first.stackOrder - second.stackOrder);

    const findVisibleBounds = (canvas: HTMLCanvasElement) => {
      const rasterContext = canvas.getContext("2d");
      if (!rasterContext) return null;
      const pixels = rasterContext.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width; let minY = canvas.height; let maxX = -1; let maxY = -1;
      for (let y = 0; y < canvas.height; y += 1) for (let x = 0; x < canvas.width; x += 1) {
        if (pixels[(y * canvas.width + x) * 4 + 3] < 16) continue;
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
      return maxX < minX || maxY < minY ? null : { centerX: (minX + maxX + 1) / 2, centerY: (minY + maxY + 1) / 2 };
    };

    for (const entry of renderQueue) {
      if (isPaintLayerLocked(entry.item.paintLayerId)) continue;
      if (entry.type === "stroke") {
        context.save();
        context.globalAlpha = adjustments.opacity / 100;
        renderBrushStroke(context, entry.item);
        context.restore();
        continue;
      }
      if (entry.type === "image") {
        const imageElement = imageElements.get(entry.item.id);
        if (!imageElement) continue;
        const crop = entry.item.crop ?? FULL_IMAGE_CROP;
        context.save();
        context.globalAlpha = (adjustments.opacity / 100) * (entry.item.opacity / 100);
        context.filter = makeAdjustmentFilter(entry.item.exposure, entry.item.contrast, entry.item.saturation, entry.item.vibrancy);
        context.translate(entry.item.x + entry.item.width / 2, entry.item.y + entry.item.height / 2);
        context.rotate((entry.item.rotation * Math.PI) / 180);
        if (entry.item.shadowOpacity > 0) {
          context.shadowColor = `rgba(0, 0, 0, ${entry.item.shadowOpacity / 100})`;
          context.shadowBlur = 14;
        }
        context.drawImage(imageElement, imageElement.naturalWidth * crop.x, imageElement.naturalHeight * crop.y, imageElement.naturalWidth * crop.width, imageElement.naturalHeight * crop.height, -entry.item.width / 2, -entry.item.height / 2, entry.item.width, entry.item.height);
        context.restore();
        continue;
      }
      if (entry.type === "text") {
        const rasterElement = textRasterElements.get(entry.item.id);
        if (rasterElement && entry.item.rasterWidth && entry.item.rasterHeight) {
          context.save();
          context.globalAlpha = (adjustments.opacity / 100) * (entry.item.opacity / 100);
          context.filter = makeAdjustmentFilter(entry.item.exposure, entry.item.contrast, entry.item.saturation, entry.item.vibrancy);
          if (entry.item.shadowOpacity > 0) { context.shadowColor = `rgba(0, 0, 0, ${entry.item.shadowOpacity / 100})`; context.shadowBlur = 14; }
          context.drawImage(rasterElement, entry.item.x, entry.item.y, entry.item.rasterWidth, entry.item.rasterHeight);
          context.restore();
          continue;
        }
        const textRaster = document.createElement("canvas");
        textRaster.width = output.width; textRaster.height = output.height;
        const textContext = textRaster.getContext("2d");
        if (!textContext) continue;
        textContext.font = `${entry.item.fontWeight} ${entry.item.fontSize}px "${entry.item.fontFamily}", "Noto Sans TC", sans-serif`;
        textContext.textBaseline = "alphabetic";
        textContext.lineJoin = "round";
        textContext.fillStyle = entry.item.color;
        textContext.strokeStyle = makeOutlineColor(entry.item.outlineColor ?? "#FFFDF8", entry.item.outlineExposure, entry.item.outlineContrast, entry.item.outlineSaturation, entry.item.outlineVibrancy, entry.item.outlineOpacity);
        textContext.lineWidth = entry.item.outlineWidth ?? 0;
        const metrics = textContext.measureText("Mg");
        const ascent = metrics.fontBoundingBoxAscent || entry.item.fontSize * 0.82;
        const descent = metrics.fontBoundingBoxDescent || entry.item.fontSize * 0.18;
        const lineHeight = entry.item.fontSize * 1.12;
        const firstBaseline = entry.item.y + 2 + (lineHeight - ascent - descent) / 2 + ascent;
        entry.item.text.split("\n").forEach((line, index) => {
          const baselineY = firstBaseline + lineHeight * index;
          if ((entry.item.outlineWidth ?? 0) > 0) textContext.strokeText(line, entry.item.x + 4, baselineY);
          textContext.fillText(line, entry.item.x + 4, baselineY);
        });
        const visibleBounds = findVisibleBounds(textRaster);
        const anchorShape = entry.item.anchorShapeId ? shapesRef.current.find((shape) => shape.id === entry.item.anchorShapeId) : undefined;
        const offsetX = anchorShape && visibleBounds ? anchorShape.x + anchorShape.width / 2 - visibleBounds.centerX : 0;
        const offsetY = anchorShape && visibleBounds ? anchorShape.y + anchorShape.height / 2 - visibleBounds.centerY : 0;
        context.save();
        context.globalAlpha = (adjustments.opacity / 100) * (entry.item.opacity / 100);
        context.filter = makeAdjustmentFilter(entry.item.exposure, entry.item.contrast, entry.item.saturation, entry.item.vibrancy);
        if (entry.item.shadowOpacity > 0) { context.shadowColor = `rgba(0, 0, 0, ${entry.item.shadowOpacity / 100})`; context.shadowBlur = 14; }
        context.drawImage(textRaster, offsetX, offsetY);
        context.restore();
        continue;
      }
      const shape = entry.item;
      context.save();
      context.globalAlpha = (adjustments.opacity / 100) * (shape.opacity / 100);
      context.filter = makeAdjustmentFilter(shape.exposure, shape.contrast, shape.saturation, shape.vibrancy);
      if (shape.shadow && shape.shadowOpacity > 0) { context.shadowColor = hexToRgba(shape.shadowColor, shape.shadowOpacity / 100); context.shadowBlur = shape.shadowBlur; }
      context.fillStyle = shape.fill;
      context.strokeStyle = makeOutlineColor(shape.outline, shape.outlineExposure, shape.outlineContrast, shape.outlineSaturation, shape.outlineVibrancy, shape.outlineOpacity);
      context.lineWidth = shape.outlineWidth;
      context.translate(shape.x + shape.width / 2, shape.y + shape.height / 2);
      context.rotate((shape.rotation * Math.PI) / 180);
      if (shape.kind === "rectangle") {
        const radius = Math.min(shape.cornerRadius, Math.min(shape.width, shape.height) / 2);
        context.beginPath(); context.roundRect(-shape.width / 2, -shape.height / 2, shape.width, shape.height, radius); context.fill();
        if (shape.outlineWidth > 0) { const inset = shape.outlineWidth / 2; context.beginPath(); context.roundRect(-shape.width / 2 + inset, -shape.height / 2 + inset, Math.max(0, shape.width - shape.outlineWidth), Math.max(0, shape.height - shape.outlineWidth), Math.max(0, radius - inset)); context.stroke(); }
      } else {
        context.beginPath();
        if (shape.kind === "circle") context.ellipse(0, 0, shape.width / 2, shape.height / 2, 0, 0, Math.PI * 2);
        else if (shape.kind === "heart") {
          const w = shape.width;
          const h = shape.height;
          const x = -w / 2;
          const y = -h / 2;
          // 與工作台 SVG 的 M50 88 C44 82… 路徑一一對應，避免輸出使用不同的愛心比例。
          context.moveTo(x + w * 0.5, y + h * 0.88);
          context.bezierCurveTo(x + w * 0.44, y + h * 0.82, x + w * 0.15, y + h * 0.65, x + w * 0.15, y + h * 0.38);
          context.bezierCurveTo(x + w * 0.15, y + h * 0.18, x + w * 0.39, y + h * 0.14, x + w * 0.5, y + h * 0.33);
          context.bezierCurveTo(x + w * 0.61, y + h * 0.14, x + w * 0.85, y + h * 0.18, x + w * 0.85, y + h * 0.38);
          context.bezierCurveTo(x + w * 0.85, y + h * 0.65, x + w * 0.56, y + h * 0.82, x + w * 0.5, y + h * 0.88);
          context.closePath();
        }
        else { const sides = shape.kind === "triangle" ? 3 : shape.kind === "pentagon" ? 5 : 10; for (let index = 0; index < sides; index += 1) { const angle = -Math.PI / 2 + (index * Math.PI * 2) / sides; const radius = shape.kind === "star" ? (index % 2 === 0 ? 0.48 : 0.22) : 0.46; const x = Math.cos(angle) * shape.width * radius; const y = Math.sin(angle) * shape.height * radius; if (index === 0) context.moveTo(x, y); else context.lineTo(x, y); } context.closePath(); }
        context.fill(); if (shape.outlineWidth > 0) context.stroke();
      }
      context.restore();
    }
    return output;
  };

  const exportImage = async (format: ExportFormat = "png") => {
    setIsExportRendering(true);
    try {
      const output = await renderExportCanvas();
      const baseName = fileMeta.name.replace(/\.[^.]+$/, "") || "abipaint";
      const isMobileExport = window.matchMedia("(max-width: 767px)").matches;
      const shareOrDownload = async (blob: Blob, filename: string) => {
        const file = new File([blob], filename, { type: blob.type });
        if (isMobileExport && typeof navigator.share === "function" && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
          try {
            await navigator.share({ files: [file], title: filename });
            toast.success(tr("已儲存", "Saved"), { className: "export-toast" });
            return;
          } catch (error) {
            if (error instanceof DOMException && error.name === "AbortError") return;
          }
        }
        const link = document.createElement("a");
        link.download = filename;
        link.href = URL.createObjectURL(blob);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
        toast.success(tr("檔案已下載", "File downloaded"), { className: "export-toast" });
      };
      if (format === "pdf") {
        const pdf = new jsPDF({ orientation: output.width >= output.height ? "landscape" : "portrait", unit: "px", format: [output.width, output.height], compress: true });
        pdf.addImage(output.toDataURL("image/jpeg", 0.94), "JPEG", 0, 0, output.width, output.height, undefined, "FAST");
        await shareOrDownload(pdf.output("blob"), `${baseName}.pdf`);
      } else {
        const extension = format === "jpeg" ? "jpg" : "png";
        const mimeType = format === "jpeg" ? "image/jpeg" : "image/png";
        const blob = await new Promise<Blob>((resolve, reject) => {
          output.toBlob((result) => result ? resolve(result) : reject(new Error("Export image could not be created")), mimeType, format === "jpeg" ? 0.92 : undefined);
        });
        await shareOrDownload(blob, `${baseName}.${extension}`);
      }
    } catch (error) {
      console.error("AbiPaint export preview render failed", error);
      toast.error(tr("無法建立匯出預覽，請再試一次", "Export preview could not be created. Please try again."), { className: "export-toast" });
    } finally {
      setIsExportRendering(false);
    }
  };

  const downloadExportPreview = () => {
    if (!exportPreview) return;
    const baseName = fileMeta.name.replace(/\.[^.]+$/, "") || "abipaint";
    if (exportPreview.format === "pdf") {
      const pdf = new jsPDF({
        orientation: exportPreview.width >= exportPreview.height ? "landscape" : "portrait",
        unit: "px",
        format: [exportPreview.width, exportPreview.height],
        compress: true,
      });
      pdf.addImage(exportPreview.url, "PNG", 0, 0, exportPreview.width, exportPreview.height, undefined, "FAST");
      pdf.save(`${baseName}.pdf`);
      toast.success(tr("PDF 已匯出", "PDF exported"), { className: "export-toast" });
    } else {
      const link = document.createElement("a");
      const extension = exportPreview.format === "jpeg" ? "jpg" : "png";
      link.download = `${baseName}.${extension}`;
      link.href = exportPreview.url;
      link.click();
      toast.success(tr(`${extension.toUpperCase()} 已匯出`, `${extension.toUpperCase()} exported`), { className: "export-toast" });
    }
    setExportPreview(null);
  };

  const saveDocumentName = (value: string) => {
    const nextName = value.trim() || copy.documentName;
    setDocumentNameDraft(nextName);
    setFileMeta((meta) => ({ ...meta, name: nextName }));
  };

  const handleTextPointerDown = (event: ReactPointerEvent<HTMLDivElement>, layer: TextLayer) => {
    event.stopPropagation();
    if (isPaintLayerLocked(layer.paintLayerId)) return;
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

  const handleTextResizePointerDown = (event: ReactPointerEvent<HTMLSpanElement>, layer: TextLayer, axis: "top-left" | "top-right" | "bottom-left" | "bottom-right") => {
    event.stopPropagation();
    event.preventDefault();
    if (isPaintLayerLocked(layer.paintLayerId) || editingTextId === layer.id) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event.clientX, event.clientY, true);
    const dimensions = layer.rasterDataUrl && layer.rasterWidth && layer.rasterHeight
      ? { width: layer.rasterWidth, height: layer.rasterHeight }
      : getTextLayerDimensions(layer);
    setSelectedTextId(layer.id);
    setSelectedShapeId(null);
    setSelectedImageId(null);
    textDragRef.current = null;
    textResizeRef.current = {
      id: layer.id,
      axis,
      startPointX: point.x,
      startPointY: point.y,
      startFontSize: layer.fontSize,
      startWidth: dimensions.width,
      startHeight: dimensions.height,
      startX: layer.x,
      startY: layer.y,
    };
  };

  const handleShapePointerDown = (event: ReactPointerEvent<SVGSVGElement>, shape: ShapeLayer) => {
    event.stopPropagation();
    event.preventDefault();
    if (isPaintLayerLocked(shape.paintLayerId)) return;
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
    if (isPaintLayerLocked(shape.paintLayerId)) return;
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
    if (isPaintLayerLocked(stroke.paintLayerId)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event.clientX, event.clientY);
    setSelectedStrokeId(stroke.id);
    setSelectedTextId(null);
    setSelectedShapeId(null);
    setSelectedImageId(null);
    setTool("move");
    setActiveDesktopTool(null);
    setOpenDesktopTool(null);
    strokeDragRef.current = { id: stroke.id, offsetX: point.x - stroke.x, offsetY: point.y - stroke.y };
  };

  const handleShapeResizePointerDown = (event: ReactPointerEvent<SVGRectElement | HTMLDivElement>, shape: ShapeLayer, axis: ShapeResizeAxis) => {
    event.stopPropagation();
    event.preventDefault();
    if (isPaintLayerLocked(shape.paintLayerId)) return;
    if (shape.kind === "circle" && axis.includes("-")) return;
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

  const handleShapeRotatePointerDown = (event: ReactPointerEvent<SVGCircleElement | HTMLDivElement>, shape: ShapeLayer) => {
    event.stopPropagation();
    event.preventDefault();
    if (isPaintLayerLocked(shape.paintLayerId)) return;
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
    if (isPaintLayerLocked(image.paintLayerId)) return;
    if ((event.target as Element).classList.contains("image-resize-handle") || (event.target as Element).classList.contains("image-rotation-handle")) return;
    event.preventDefault();
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // 部分觸控與合成指標環境不支援捕捉，裁切仍由全域指標事件持續追蹤。
    }
    const point = getCanvasPoint(event.clientX, event.clientY);
    setSnapGuides({ x: null, y: null });
    setSelectedImageId(image.id);
    setSelectedTextId(null);
    setSelectedShapeId(null);
    if (tool === "crop" && cropDraft?.imageId === image.id) return;
    if (imageEditingId !== image.id) {
      setImageEditingId(image.id);
      setCropDraft(null);
      return;
    }
    imageDragRef.current = { id: image.id, offsetX: point.x - image.x, offsetY: point.y - image.y };
  };

  const handleImageResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>, image: ImageLayer, axis: ShapeResizeAxis) => {
    event.stopPropagation();
    event.preventDefault();
    if (isPaintLayerLocked(image.paintLayerId)) return;
    if (imageEditingId !== image.id) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasPoint(event.clientX, event.clientY, true);
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
    event.preventDefault();
    if (isPaintLayerLocked(image.paintLayerId)) return;
    if (imageEditingId !== image.id) return;
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

  useEffect(() => {
    const flushCropDraft = () => {
      cropUpdateFrameRef.current = null;
      const next = pendingCropDraftRef.current;
      pendingCropDraftRef.current = null;
      if (next) setCropDraft(next);
    };
    const handleCropMove = (event: PointerEvent) => {
      const drag = cropDragRef.current;
      if (!drag) return;
      const image = imagesRef.current.find((item) => item.id === drag.imageId);
      if (!image) return;
      const point = getCanvasPoint(event.clientX, event.clientY);
      const deltaX = (point.x - drag.startPointerX) / Math.max(1, image.width);
      const deltaY = (point.y - drag.startPointerY) / Math.max(1, image.height);
      const minimum = 0.1;
      let left = drag.startX;
      let top = drag.startY;
      let right = drag.startX + drag.startWidth;
      let bottom = drag.startY + drag.startHeight;
      if (drag.axis === "move") {
        left = clamp(drag.startX + deltaX, 0, 1 - drag.startWidth);
        top = clamp(drag.startY + deltaY, 0, 1 - drag.startHeight);
        right = left + drag.startWidth;
        bottom = top + drag.startHeight;
      } else {
        if (drag.axis.includes("left")) left = clamp(drag.startX + deltaX, 0, right - minimum);
        if (drag.axis.includes("right")) right = clamp(drag.startX + drag.startWidth + deltaX, left + minimum, 1);
        if (drag.axis.includes("top")) top = clamp(drag.startY + deltaY, 0, bottom - minimum);
        if (drag.axis.includes("bottom")) bottom = clamp(drag.startY + drag.startHeight + deltaY, top + minimum, 1);
      }
      pendingCropDraftRef.current = {
        imageId: image.id,
        x: left,
        y: top,
        width: right - left,
        height: bottom - top,
      };
      if (cropUpdateFrameRef.current === null) cropUpdateFrameRef.current = window.requestAnimationFrame(flushCropDraft);
    };
    const handleCropUp = () => {
      cropDragRef.current = null;
      if (cropUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(cropUpdateFrameRef.current);
        flushCropDraft();
      }
    };
    window.addEventListener("pointermove", handleCropMove);
    window.addEventListener("pointerup", handleCropUp);
    return () => {
      window.removeEventListener("pointermove", handleCropMove);
      window.removeEventListener("pointerup", handleCropUp);
      if (cropUpdateFrameRef.current !== null) {
        window.cancelAnimationFrame(cropUpdateFrameRef.current);
        cropUpdateFrameRef.current = null;
      }
    };
  }, [getCanvasPoint]);

  const cancelLongPressPan = () => {
    const pending = longPressPanRef.current;
    if (pending?.timer !== null && pending?.timer !== undefined) window.clearTimeout(pending.timer);
    longPressPanRef.current = null;
  };

  const handleViewportPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const target = event.target as HTMLElement;
    if (cropDraft && !target.closest(".image-layer, .image-crop-preview, .crop-handle")) {
      void applyImageCrop();
      return;
    }
    if (target.closest("canvas, .canvas-content, .canvas-shell, .image-layer, .shape-layer, .text-layer, .stroke-layer")) return;
    clearSelectedObjects();
    if (event.pointerType === "touch" && isMobileViewport) return;
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
  const fitCanvasToViewport = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const bounds = viewport.getBoundingClientRect();
    const bottomInset = Number.parseFloat(window.getComputedStyle(viewport).paddingBottom) || 0;
    const availableWidth = Math.max(120, bounds.width - 32);
    const availableHeight = Math.max(120, bounds.height - bottomInset - 32);
    const mobileToolbarReserve = isMobileViewport ? 60 : 0;
    const canvasAvailableHeight = Math.max(120, availableHeight - mobileToolbarReserve);
    const nextZoom = clamp(Math.floor(Math.min(availableWidth / canvasSize.width, canvasAvailableHeight / canvasSize.height) * 100), 25, 150);
    const displayWidth = canvasSize.width * (nextZoom / 100);
    const displayHeight = canvasSize.height * (nextZoom / 100);
    const nextPan = {
      x: Math.max(16, (bounds.width - displayWidth) / 2),
      y: mobileToolbarReserve + Math.max(8, (canvasAvailableHeight - displayHeight) / 2),
    };
    setZoom(nextZoom);
    setPan(nextPan);
    if (isMobileViewport && !mobileMiniToolHasCustomPositionRef.current) {
      const toolbarWidth = 226;
      const toolbarHeight = 44;
      const canSitAboveCanvas = nextPan.y >= toolbarHeight + 14;
      const belowCanvasY = nextPan.y + displayHeight + 8;
      const canSitBelowCanvas = belowCanvasY + toolbarHeight <= availableHeight;
      setMobileMiniToolPosition({
        x: clamp(nextPan.x + (displayWidth - toolbarWidth) / 2, 8, Math.max(8, bounds.width - toolbarWidth - 8)),
        y: canSitAboveCanvas ? nextPan.y - toolbarHeight - 8 : canSitBelowCanvas ? belowCanvasY : 8,
      });
    }
  }, [canvasSize.height, canvasSize.width, isMobileViewport]);

  useEffect(() => {
    if (!isMobileViewport) return;
    const frame = window.requestAnimationFrame(fitCanvasToViewport);
    let refitFrame: number | null = null;
    let rotationTimer: number | null = null;
    const refit = () => {
      if (refitFrame !== null) window.cancelAnimationFrame(refitFrame);
      refitFrame = window.requestAnimationFrame(() => {
        refitFrame = null;
        fitCanvasToViewport();
      });
    };
    const refitAfterRotation = () => {
      if (rotationTimer !== null) window.clearTimeout(rotationTimer);
      rotationTimer = window.setTimeout(() => {
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
        refit();
      }, 220);
    };
    window.addEventListener("resize", refit);
    window.addEventListener("orientationchange", refitAfterRotation);
    return () => {
      window.cancelAnimationFrame(frame);
      if (refitFrame !== null) window.cancelAnimationFrame(refitFrame);
      if (rotationTimer !== null) window.clearTimeout(rotationTimer);
      window.removeEventListener("resize", refit);
      window.removeEventListener("orientationchange", refitAfterRotation);
    };
  }, [fitCanvasToViewport, isMobileViewport, mobileDrawerHeight]);
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

  useEffect(() => {
    const moveMobileMiniTool = (event: PointerEvent) => {
      const drag = mobileMiniToolDragRef.current;
      const viewport = viewportRef.current;
      const toolbar = mobileMiniToolRef.current;
      if (!drag || !viewport || !toolbar) return;
      const bounds = viewport.getBoundingClientRect();
      const toolBounds = toolbar.getBoundingClientRect();
      setMobileMiniToolPosition({
        x: clamp(drag.originX + event.clientX - drag.startX, 8, Math.max(8, bounds.width - toolBounds.width - 8)),
        y: clamp(drag.originY + event.clientY - drag.startY, 8, Math.max(8, bounds.height - toolBounds.height - 8)),
      });
    };
    const finishMobileMiniToolDrag = () => {
      if (!mobileMiniToolDragRef.current) return;
      mobileMiniToolDragRef.current = null;
      setIsMobileMiniToolDragging(false);
    };
    window.addEventListener("pointermove", moveMobileMiniTool);
    window.addEventListener("pointerup", finishMobileMiniToolDrag);
    window.addEventListener("pointercancel", finishMobileMiniToolDrag);
    return () => {
      window.removeEventListener("pointermove", moveMobileMiniTool);
      window.removeEventListener("pointerup", finishMobileMiniToolDrag);
      window.removeEventListener("pointercancel", finishMobileMiniToolDrag);
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

  const handleMobileMiniToolPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const toolbar = mobileMiniToolRef.current;
    const viewport = viewportRef.current;
    if (!toolbar || !viewport) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const toolBounds = toolbar.getBoundingClientRect();
    const viewportBounds = viewport.getBoundingClientRect();
    mobileMiniToolDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: toolBounds.left - viewportBounds.left,
      originY: toolBounds.top - viewportBounds.top,
    };
    mobileMiniToolHasCustomPositionRef.current = true;
    setIsMobileMiniToolDragging(true);
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
  const mobileMiniToolsStyle = ({ left: `${mobileMiniToolPosition.x}px`, top: `${mobileMiniToolPosition.y}px` } as CSSProperties);
  const handleDesktopToolCreate = (nextTool: DesktopCreativeTool) => {
    setTool(nextTool === "outline" ? "move" : nextTool);
    setActiveDesktopTool(nextTool);
    setOpenDesktopTool(nextTool);
    if (nextTool === "text") addTextLayer();
  };
  const handleDesktopToolSettings = (nextTool: DesktopCreativeTool) => {
    setTool(nextTool === "outline" ? "move" : nextTool);
    setActiveDesktopTool(nextTool);
    if (nextTool === "text" && !selectedText && layersRef.current.length > 0) {
      setSelectedTextId(layersRef.current[layersRef.current.length - 1].id);
      setSelectedShapeId(null);
      setSelectedImageId(null);
    }
    setOpenDesktopTool(nextTool);
  };
  const handleMobileMiniToolCreate = (nextTool: DesktopCreativeTool) => {
    setTool(nextTool === "outline" ? "move" : nextTool);
    setActiveDesktopTool(nextTool);
    setOpenDesktopTool(nextTool);
    if (nextTool === "text") addTextLayer();
  };
  const handleMobileMiniToolSettings = () => {
    if (!activeDesktopTool) {
      toast("請先選擇畫筆、圖形或文字工具");
      return;
    }
    handleDesktopToolSettings(activeDesktopTool);
  };
  const activateStrokeMoveMode = () => {
    setTool("move");
    setActiveDesktopTool(null);
    setOpenDesktopTool(null);
    setSelectedTextId(null);
    setSelectedShapeId(null);
    setSelectedImageId(null);
    setSelectedStrokeId(null);
  };
  const isCropToolAvailable = Boolean(selectedImage && imageEditingId === selectedImage.id && !isPaintLayerLocked(selectedImage.paintLayerId));
  const handleCropTool = () => {
    if (!isCropToolAvailable) return;
    if (cropDraft?.imageId === selectedImage?.id) {
      void applyImageCrop();
      return;
    }
    setTool("crop");
    beginImageCrop();
    toast.info(tr("拖曳裁切框或控制點調整範圍；再次點擊裁切即可套用，按 Esc 可取消", "Drag the crop frame or its handles to adjust the area. Click Crop again to apply, or press Esc to cancel"));
  };
  const activeWorkspaceToolLabel = activeDesktopTool === "brush"
    ? copy.brush
    : activeDesktopTool === "shape"
      ? copy.shape
      : activeDesktopTool === "text"
        ? copy.text
        : activeDesktopTool === "outline"
          ? tr("輪廓", "Outline")
        : copy.workspaceSignature;
  const hasMovableArtwork = layers.length > 0 || shapes.length > 0 || images.length > 0 || strokes.length > 0;
  const hasSelectedObject = Boolean(selectedTextId || selectedShapeId || selectedImageId || selectedStrokeId);
  const handleSelectedObjectSettings = () => {
    if (selectedText) {
      handleDesktopToolSettings("text");
      return;
    }
    if (selectedShape) {
      handleDesktopToolSettings("shape");
      return;
    }
    if (selectedStrokeId) {
      setTool("move");
      setActiveDesktopTool(null);
      setOpenDesktopTool("object");
      return;
    }
    if (selectedImageId) {
      setTool("move");
      setActiveDesktopTool(null);
      setOpenDesktopTool("object");
    }
  };
  const toolPanelTitle = selectedImage
    ? "圖片素材"
    : selectedShape
      ? "圖形"
    : selectedText
        ? "文字"
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
  const desktopToolPanelTitle = openDesktopTool === "object"
    ? tr("素材設定", "Object settings")
    : activeWorkspaceToolLabel;

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
          <button
            type="button"
            className="working-file-add"
            onClick={() => void createWorkingFile()}
            disabled={!isProjectHydratedRef.current || workingFiles.length >= MAX_WORKING_FILES}
            title={tr("新增工作檔", "New Working File")}
            aria-label={tr("新增工作檔", "New Working File")}
          >
            <Plus size={15} />
          </button>
          <span className="document-kicker">{isEnglish ? "WORKING FILE" : "工作檔"}</span>
          <div className="working-file-tabs" aria-label={tr("工作檔切換", "Working File switcher")}>
            {workingFiles.length ? workingFiles.map((file) => {
              const isActive = file.id === activeWorkingFileId;
              return isActive ? (
                <div key={file.id} className="working-file-tab is-active">
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
                    aria-label={isEnglish ? "Document name" : "文件名稱"}
                  />
                  {workingFiles.length > 1 && (
                    <button type="button" className="working-file-close" onClick={(event) => void closeWorkingFile(event, file.id)} aria-label={tr("關閉工作檔", "Close Working File")}>
                      <span>×</span>
                    </button>
                  )}
                </div>
              ) : (
                <button key={file.id} type="button" className="working-file-tab" onClick={() => void switchWorkingFile(file.id)} title={file.project.document.name}>
                  {file.project.document.name || copy.documentName}
                </button>
              );
            }) : (
              <div className="working-file-tab is-active">
                <input
                  className="document-name-input"
                  value={documentNameDraft}
                  onChange={(event) => setDocumentNameDraft(event.target.value)}
                  onBlur={(event) => saveDocumentName(event.target.value)}
                  aria-label={isEnglish ? "Document name" : "文件名稱"}
                />
              </div>
            )}
          </div>
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
          <a className="language-switch" href={isEnglish ? "/" : "/en"} aria-label={copy.languageLabel}>{copy.language}</a>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="secondary-button project-menu-trigger" title={copy.project} aria-label={copy.project}>
                <MoreHorizontal size={17} /><span className="top-action-label">{copy.project}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="export-menu-content">
              <DropdownMenuItem onSelect={() => projectImportInputRef.current?.click()}><Upload size={15} /><span>{copy.importProject}</span></DropdownMenuItem>
              <DropdownMenuItem onSelect={exportProject}><Download size={15} /><span>{copy.exportProject}</span></DropdownMenuItem>
              <DropdownMenuItem className="project-reset-menu-item" onSelect={() => setResetWorkingFileDialogOpen(true)}><Trash2 size={15} /><span>{copy.resetWorkingFile}</span></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" className="secondary-button" onClick={() => fileInputRef.current?.click()} title={copy.importImage} aria-label={copy.importImage}>
            <Upload size={15} /> <span className="top-action-label">{copy.importImage}</span>
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="primary-button export-menu-trigger" title={copy.exportImage} aria-label={copy.exportImage}>
                <Download size={15} /> <span className="top-action-label">{copy.exportImage}</span><ChevronDown size={14} aria-hidden="true" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="export-menu-content">
              <DropdownMenuItem disabled={isExportRendering} onSelect={() => void exportImage("png")}><Download size={15} /><span>PNG</span></DropdownMenuItem>
              <DropdownMenuItem disabled={isExportRendering} onSelect={() => void exportImage("jpeg")}><Download size={15} /><span>JPG</span></DropdownMenuItem>
              <DropdownMenuItem disabled={isExportRendering} onSelect={() => void exportImage("pdf")}><Download size={15} /><span>PDF</span></DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImport} hidden />
        <input ref={projectImportInputRef} type="file" accept="application/json,.abipaint" onChange={handleProjectImport} hidden />
      </header>

      <div ref={studioLayoutRef} className="studio-layout">
        <aside className="tool-rail desktop-creative-rail" aria-label={copy.creative}>
          <div className="tool-group">
            <ToolButton label={copy.select} active={tool === "move"} icon={<Move size={18} />} onClick={activateStrokeMoveMode} disabled={!hasMovableArtwork} />
            <ToolButton label={copy.brush} active={activeDesktopTool === "brush"} icon={<Pencil size={18} />} onClick={() => handleDesktopToolCreate("brush")} onDoubleActivate={() => handleDesktopToolSettings("brush")} />
            <ToolButton label={copy.shape} active={activeDesktopTool === "shape"} icon={<Shapes size={18} />} onClick={() => handleDesktopToolCreate("shape")} onDoubleActivate={() => handleDesktopToolSettings("shape")} />
            <ToolButton label={copy.text} active={activeDesktopTool === "text"} icon={<Type size={18} />} onClick={() => handleDesktopToolCreate("text")} onDoubleActivate={() => handleDesktopToolSettings("text")} />
            <ToolButton label={tr("輪廓", "Outline")} active={activeDesktopTool === "outline"} icon={<SquareDashed size={18} />} onClick={() => handleDesktopToolSettings("outline")} disabled={!hasSelectedObject} />
            <ToolButton label={cropDraft ? tr("套用裁切", "Apply crop") : tr("裁切", "Crop")} active={tool === "crop"} icon={<Crop size={18} />} onClick={handleCropTool} disabled={!isCropToolAvailable} />
            <ToolButton label={tr("去背", "Remove BG")} icon={<WandSparkles size={18} />} onClick={() => void removeSelectedImageBackground()} disabled={!selectedImage || selectedMaterialIsLocked || backgroundRemovalImageId === selectedImage.id} />
            <button type="button" className="tool-button tool-settings-entry" onClick={handleSelectedObjectSettings} disabled={!hasSelectedObject} aria-label={copy.openSettings} title={copy.openSettings}><SlidersHorizontal size={18} /><span>{copy.settings}</span></button>
          </div>
          <div className="rail-support-group" aria-label={tr("輔助資訊", "Help and information")}>
            <button type="button" className={`faq-rail-toggle ${isFaqOpen ? "is-active" : ""}`} onClick={() => { setIsFaqOpen((open) => !open); setIsDeveloperOpen(false); setIsEasterEggOpen(false); }} aria-expanded={isFaqOpen} aria-controls="abipaint-faq-panel">
              <span className="faq-rail-glyph">?</span>
              <span>FAQ</span>
              <ChevronDown size={11} aria-hidden="true" />
            </button>
            <button type="button" className={`faq-rail-toggle developer-rail-toggle ${isDeveloperOpen ? "is-active" : ""}`} onClick={() => { setIsDeveloperOpen((open) => !open); setIsFaqOpen(false); setIsEasterEggOpen(false); }} aria-expanded={isDeveloperOpen} aria-controls="abipaint-developer-panel">
              <span className="faq-rail-glyph"><UserRound size={11} aria-hidden="true" /></span>
              <span>{copy.developer}</span>
              <ChevronDown size={11} aria-hidden="true" />
            </button>
            <button type="button" className={`faq-rail-toggle easter-egg-rail-toggle ${isEasterEggOpen ? "is-active" : ""}`} onClick={() => { setIsEasterEggOpen((open) => !open); setIsFaqOpen(false); setIsDeveloperOpen(false); }} aria-expanded={isEasterEggOpen} aria-controls="abipaint-easter-egg-panel" aria-label={tr("開啟彩蛋", "Open surprise")} title={tr("開啟彩蛋", "Open surprise")}>
              <span className="faq-rail-glyph">✦</span>
            </button>
          </div>
          {isFaqOpen && (
            <section id="abipaint-faq-panel" className="faq-panel" aria-label={copy.faqAria}>
              <header className="faq-panel-header">
                <div>
                  <h2>{copy.faqTitle}</h2>
                </div>
                <button type="button" className="faq-close" onClick={() => setIsFaqOpen(false)} aria-label={copy.faqClose}><ChevronDown size={16} /></button>
              </header>
              <div className="faq-list">
                {copy.faq.map(([question, answer], index) => (
                  <details key={question} className="faq-item" open={index === 0}>
                    <summary><span>{String(index + 1).padStart(2, "0")}</span>{question}</summary>
                    <div className="faq-answer">
                      {answer}
                      {index === 1 && <ul>{copy.faqList.map((item) => <li key={item}>{item}</li>)}</ul>}
                      {index === 4 && <a className="faq-email" href="mailto:abiting.ct@gmail.com">abiting.ct@gmail.com</a>}
                    </div>
                  </details>
                ))}
                <div className="faq-banner">
                  <img src="/banner.webp" alt={isEnglish ? "Online image size editor" : "線上圖片尺寸修改器"} />
                </div>
              </div>
            </section>
          )}
          {isDeveloperOpen && (
            <section id="abipaint-developer-panel" className="faq-panel developer-panel" aria-label={copy.developerAria}>
              <header className="faq-panel-header">
                <div>
                  <h2>{copy.developerTitle}</h2>
                </div>
                <div className="developer-header-actions">
                  <a className="developer-social-link developer-social-facebook" href="https://www.facebook.com/shimokitazawa.news/" target="_blank" rel="noopener noreferrer" aria-label="Facebook" title="Facebook">f</a>
                  <a className="developer-social-link developer-social-linkedin" href="https://www.linkedin.com/in/abiting1998/" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" title="LinkedIn">in</a>
                  <button type="button" className="faq-close" onClick={() => setIsDeveloperOpen(false)} aria-label={copy.developerClose}><ChevronDown size={16} /></button>
                </div>
              </header>
              <div className="developer-content">
                <p className="developer-bio">{copy.developerBio}</p>
                <section className="developer-projects" aria-labelledby="developer-projects-title">
                  <h3 id="developer-projects-title">{copy.developerWorks}</h3>
                  <div className="developer-work-list">
                    {developerWorks.map((work) => {
                      const workTitle = isEnglish ? work.en : work.zh;
                      return (
                        <a key={work.href} className="developer-work" href={work.href} target="_blank" rel="noopener noreferrer">
                          <span className="developer-work-title">{workTitle}</span>
                          <ExternalLink size={13} aria-hidden="true" />
                        </a>
                      );
                    })}
                  </div>
                  <div className="developer-showcase">
                    <img src="https://coai.abiting.cc/wp-content/uploads/2026/01/watercolor_style.webp" alt="AbiPaint 免費修圖" loading="lazy" decoding="async" />
                  </div>
                </section>
              </div>
            </section>
          )}
          {isEasterEggOpen && (
            <section id="abipaint-easter-egg-panel" className="faq-panel easter-egg-panel" aria-label={tr("AbiPaint 彩蛋", "AbiPaint surprise")}>
              <header className="faq-panel-header">
                <div>
                  <h2>{tr("彩蛋", "Surprise")}</h2>
                </div>
                <div className="easter-egg-header-actions">
                  {easterEggArchive.length > 1 && (
                    <div className="easter-egg-pagination" aria-label={tr("瀏覽歷次彩蛋", "Browse past surprises")}>
                      <button type="button" onClick={() => setEasterEggIndex((index) => (index - 1 + easterEggArchive.length) % easterEggArchive.length)} aria-label={tr("上一則彩蛋", "Previous surprise")}><ChevronLeft size={14} /></button>
                      <span>{easterEggIndex + 1} / {easterEggArchive.length}</span>
                      <button type="button" onClick={() => setEasterEggIndex((index) => (index + 1) % easterEggArchive.length)} aria-label={tr("下一則彩蛋", "Next surprise")}><ChevronRight size={14} /></button>
                    </div>
                  )}
                  <button type="button" className="faq-close" onClick={() => setIsEasterEggOpen(false)} aria-label={tr("關閉彩蛋", "Close surprise")}><ChevronDown size={16} /></button>
                </div>
              </header>
              <div className="easter-egg-content">
                <img src={activeEasterEgg.src} alt={activeEasterEgg.alt} loading="lazy" decoding="async" />
                <div className="easter-egg-caption">
                  <p>{isEnglish ? activeEasterEgg.enCaption : activeEasterEgg.zhCaption}</p>
                  <time dateTime={activeEasterEgg.dateTime}>{activeEasterEgg.dateLabel}</time>
                </div>
              </div>
            </section>
          )}
        </aside>
        <section ref={workspaceRef} className="workspace" aria-label={copy.canvasWorkspace}>
          <div className="workspace-toolbar">
            <div className="active-tool-name">
              <span className="active-tool-marker" />
              {activeDesktopTool ? (
                <span>{activeWorkspaceToolLabel}</span>
              ) : isEnglish ? (
                <span>Developed by <a className="workspace-signature-link" href="https://abiting.cc" target="_blank" rel="noopener">Abiting</a></span>
              ) : (
                <span>本工具由<a className="workspace-signature-link" href="https://abiting.cc" target="_blank" rel="noopener">阿比丁</a>開發製作</span>
              )}
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
              <button type="button" className="ghost-button view-action-button" onClick={fitCanvasToViewport} title={copy.fit}>
                <Fullscreen size={15} />
                <span>{copy.fit}</span>
              </button>
              <button type="button" className="ghost-button view-action-button" onClick={resetCanvasView} title={copy.reset}>
                <RotateCcw size={14} />
                <span>{copy.reset}</span>
              </button>
            </div>
          </div>

          <aside className="paint-layer-panel" aria-label={tr("畫筆圖層", "Paint layers")}>
            <div className="paint-layer-panel-heading">
              <span><Layers size={13} /> {tr("圖層", "Layers")}</span>
              <button type="button" className="paint-layer-add" onClick={addPaintLayer} disabled={paintLayers.length >= MAX_PAINT_LAYERS} title={tr("新增圖層", "Add layer")} aria-label={tr("新增圖層", "Add layer")}><Plus size={13} /></button>
            </div>
            <div className="paint-layer-list">
              {[...paintLayers].reverse().map((layer) => (
                <div key={layer.id} className={`paint-layer-row ${activePaintLayerId === layer.id ? "is-active" : ""} ${layer.locked ? "is-locked" : ""}`}>
                  <button type="button" className="paint-layer-select" onClick={() => setActivePaintLayerId(layer.id)} aria-pressed={activePaintLayerId === layer.id}>
                    <span className="paint-layer-swatch" />
                    <span>{layer.name}</span>
                  </button>
                  <button type="button" className="paint-layer-lock" onClick={() => togglePaintLayerLock(layer.id)} title={layer.locked ? tr("解除鎖定", "Unlock layer") : tr("鎖定圖層", "Lock layer")} aria-label={layer.locked ? tr("解除鎖定", "Unlock layer") : tr("鎖定圖層", "Lock layer")}>
                    {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </button>
                </div>
              ))}
            </div>
            <span className="paint-layer-limit">{paintLayers.length} / {MAX_PAINT_LAYERS}</span>
          </aside>

          {openDesktopTool && (
            <section ref={desktopToolPanelRef} className={`desktop-tool-popover ${isDesktopToolDragging ? "is-dragging" : ""}`} style={desktopToolPopoverStyle} aria-label={desktopToolPanelTitle}>
              <div className="desktop-tool-popover-heading" onPointerDown={handleDesktopToolPanelPointerDown}>
                <div>
                  <span className="eyebrow">CREATIVE TOOL</span>
                  <h2>{desktopToolPanelTitle}</h2>
                </div>
                <div className="desktop-tool-popover-header-actions">
                  {selectedMaterialStackEntry && openDesktopTool !== "outline" && (
                    <>
                      <button type="button" className="icon-button subtle" onClick={duplicateSelectedMaterial} disabled={selectedMaterialIsLocked} title={tr("在原物件旁建立相同素材", "Duplicate object")} aria-label={tr("複製目前素材", "Duplicate selected object")}><Copy size={15} /></button>
                      <button type="button" className="icon-button subtle material-delete-icon-button" onClick={deleteSelectedMaterial} disabled={selectedMaterialIsLocked} title={tr("刪除目前素材", "Delete object")} aria-label={tr("刪除目前素材", "Delete selected object")}><Trash2 size={15} /></button>
                    </>
                  )}
                  <button type="button" className="icon-button subtle" onClick={() => setOpenDesktopTool(null)} title={tr("完成設定", "Done")} aria-label={tr("完成設定", "Done")}><Check size={16} /></button>
                </div>
              </div>

              {selectedMaterialStackEntry && openDesktopTool !== "outline" && (
                <div className="material-stack-controls" aria-label={tr("素材位置", "Stack order")}>
                  <span className="field-label">{tr("素材位置", "Stack order")}</span>
                  <div className="material-stack-actions">
                    <button type="button" className="secondary-button" onClick={() => moveSelectedMaterialInStack("forward")} disabled={!canBringSelectedMaterialForward} title={tr("向前一層", "Bring forward")}>
                      <ArrowUp size={14} /> {tr("向前", "Forward")}
                    </button>
                    <button type="button" className="secondary-button" onClick={() => moveSelectedMaterialInStack("backward")} disabled={!canSendSelectedMaterialBackward} title={tr("向後一層", "Send backward")}>
                      <ArrowDown size={14} /> {tr("向後", "Backward")}
                    </button>
                  </div>
                </div>
              )}

              {openDesktopTool === "object" && selectedStroke && (
                <div className="desktop-tool-popover-content">
                  <p className="empty-inspector compact-object-note">{tr("筆觸樣式", "Stroke appearance")}</p>
                  <RangeControl label={tr("不透明度", "Opacity")} value={selectedStroke.opacity} min={1} max={100} suffix="%" onChange={(value) => updateStroke({ opacity: value })} />
                </div>
              )}

              {openDesktopTool === "brush" && (
                <div className="desktop-tool-popover-content">
                  <div className="brush-choice-grid" role="group" aria-label={tr("選擇筆刷", "Choose brush")}> 
                    <button type="button" className={`brush-choice ${brushKind === "oil" ? "is-active" : ""}`} onClick={() => setBrushKind("oil")}>
                      <span>{tr("油線筆", "Oil liner")}</span>
                    </button>
                    <button type="button" className={`brush-choice ${brushKind === "pencil" ? "is-active" : ""}`} onClick={() => setBrushKind("pencil")}>
                      <span>{tr("鉛筆", "Pencil")}</span>
                    </button>
                    <button type="button" className={`brush-choice ${brushKind === "brush" ? "is-active" : ""}`} onClick={() => setBrushKind("brush")}>
                      <span>{tr("毛筆", "Ink")}</span>
                    </button>
                  </div>
                  <div className="color-row">
                    <span className="field-label">{tr("顏色", "Color")}</span>
                    <label className="color-picker"><input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} aria-label={tr("顏色", "Color")} /><span style={{ backgroundColor: brushColor }} /></label>
                  </div>
                  <RangeControl label={tr("大小", "Size")} value={brushSize} min={2} max={160} suffix=" px" onChange={setBrushSize} />
                  <RangeControl label={tr("透明度", "Opacity")} value={brushOpacity} min={1} max={100} suffix="%" onChange={setBrushOpacity} />
                  <div className="swatch-row floating-swatch-row" role="group" aria-label={tr("色票", "Swatches")}>
                    {["#000000", "#1F2528", "#555B5D", "#FFFFFF", "#FFFDF8", "#E4513B", "#B72F34", "#F07C41", "#D59B42", "#2F855A", "#426B8A", "#2D5B9B", "#8B5CF6", "#D26A9C"].map((color) => (
                      <button key={color} type="button" className={`swatch ${brushColor === color ? "is-selected" : ""}`} style={{ backgroundColor: color }} onClick={() => setBrushColor(color)} aria-label={`${tr("選擇顏色", "Choose color")} ${color}`} />
                    ))}
                  </div>
                </div>
              )}

              {openDesktopTool === "shape" && (
                <div className="desktop-tool-popover-content">
                  <div className="shape-choice-grid floating-shape-grid">
                    <button type="button" className={`shape-choice ${shapeKind === "rectangle" ? "is-active" : ""}`} onClick={() => { setShapeKind("rectangle"); addShape("rectangle"); }}><Square size={18} /><span>{tr("方塊", "Rectangle")}</span></button>
                    <button type="button" className={`shape-choice ${shapeKind === "circle" ? "is-active" : ""}`} onClick={() => { setShapeKind("circle"); addShape("circle"); }}><Circle size={18} /><span>{tr("圓形", "Circle")}</span></button>
                    <button type="button" className={`shape-choice ${shapeKind === "star" ? "is-active" : ""}`} onClick={() => { setShapeKind("star"); addShape("star"); }}><Star size={18} /><span>{tr("星星", "Star")}</span></button>
                    <button type="button" className={`shape-choice ${shapeKind === "heart" ? "is-active" : ""}`} onClick={() => { setShapeKind("heart"); addShape("heart"); }}><Heart size={18} /><span>{tr("愛心", "Heart")}</span></button>
                    <button type="button" className={`shape-choice ${shapeKind === "triangle" ? "is-active" : ""}`} onClick={() => { setShapeKind("triangle"); addShape("triangle"); }}><Triangle size={18} /><span>{tr("三角形", "Triangle")}</span></button>
                    <button type="button" className={`shape-choice ${shapeKind === "pentagon" ? "is-active" : ""}`} onClick={() => { setShapeKind("pentagon"); addShape("pentagon"); }}><Pentagon size={18} /><span>{tr("五邊形", "Pentagon")}</span></button>
                  </div>
                  <div className="color-row"><span className="field-label">{tr("顏色", "Color")}</span><label className="color-picker"><input type="color" value={shapeFill} onChange={(event) => { setShapeFill(event.target.value); if (selectedShape) updateShape({ fill: event.target.value }); }} aria-label={tr("圖形顏色", "Shape color")} /><span style={{ backgroundColor: shapeFill }} /></label></div>
                  {(selectedShape?.kind ?? shapeKind) === "rectangle" && <RangeControl label={tr("圓角半徑", "Corner radius")} value={selectedShape?.kind === "rectangle" ? selectedShape.cornerRadius : shapeCornerRadius} min={0} max={72} suffix=" px" onChange={(value) => { setShapeCornerRadius(value); if (selectedShape?.kind === "rectangle") updateShape({ cornerRadius: value }); }} />}
                  <RangeControl label={tr("不透明度", "Opacity")} value={selectedShape?.opacity ?? shapeOpacity} min={1} max={100} suffix="%" onChange={(value) => { setShapeOpacity(value); if (selectedShape) updateShape({ opacity: value }); }} />
                  <RangeControl label={tr("陰影強度", "Shadow")} value={selectedShape?.shadowOpacity ?? shapeShadowOpacity} min={0} max={100} suffix="%" onChange={(value) => { setShapeShadowOpacity(value); setShapeShadow(value > 0); if (selectedShape) updateShape({ shadow: value > 0, shadowOpacity: value, shadowX: 0, shadowY: 0 }); }} />
                </div>
              )}

              {openDesktopTool === "outline" && (
                <div className="desktop-tool-popover-content">
                  {!activeOutlineSettings ? (
                    <p className="empty-inspector">{tr("請先選取圖片、圖形或文字，再設定輪廓。", "Select an image, shape, or text object to configure its outline.")}</p>
                  ) : (
                    <>
                      <div className="color-row"><span className="field-label">{tr("顏色", "Color")}</span><label className="color-picker"><input type="color" value={activeOutlineSettings.color} onChange={(event) => updateActiveOutline({ color: event.target.value })} aria-label={tr("輪廓顏色", "Outline color")} /><span style={{ backgroundColor: activeOutlineSettings.color }} /></label></div>
                      <RangeControl label={tr("粗細", "Width")} value={activeOutlineSettings.width} min={0} max={32} suffix=" px" onChange={(value) => updateActiveOutline({ width: value })} />
                      <RangeControl label={tr("曝光度", "Exposure")} value={activeOutlineSettings.exposure} min={-100} max={100} suffix="%" onChange={(value) => updateActiveOutline({ exposure: value })} />
                      <RangeControl label={tr("對比度", "Contrast")} value={activeOutlineSettings.contrast} min={-100} max={100} suffix="%" onChange={(value) => updateActiveOutline({ contrast: value })} />
                      <RangeControl label={tr("飽和度", "Saturation")} value={activeOutlineSettings.saturation} min={-100} max={100} suffix="%" onChange={(value) => updateActiveOutline({ saturation: value })} />
                      <RangeControl label={tr("亮麗度", "Vibrancy")} value={activeOutlineSettings.vibrancy} min={-100} max={100} suffix="%" onChange={(value) => updateActiveOutline({ vibrancy: value })} />
                      <RangeControl label={tr("不透明度", "Opacity")} value={activeOutlineSettings.opacity} min={0} max={100} suffix="%" onChange={(value) => updateActiveOutline({ opacity: value })} />
                    </>
                  )}
                </div>
              )}

              {openDesktopTool === "text" && (
                <div className="desktop-tool-popover-content">
                  {!selectedText ? (
                    <p className="empty-inspector">{tr("點擊畫布上的文字即可開啟內容與樣式設定。", "Click a text object on the canvas to edit its content and style.")}</p>
                  ) : (
                    <>
                      <label className="field-label" htmlFor="desktop-text-content">{tr("內容", "Content")}</label>
                      <textarea id="desktop-text-content" className="text-input" value={selectedText.text} onChange={(event) => updateTextLayer({ text: event.target.value })} rows={3} />
                      <div className="select-row">
                        <label className="select-wrap">
                          <span className="field-label">{tr("字體", "Font")}</span>
                          <select value={selectedText.fontFamily} onChange={(event) => updateTextLayer({ fontFamily: event.target.value as TextLayer["fontFamily"] })}>
                            {TEXT_FONT_OPTIONS.map((font) => <option key={font.value} value={font.value}>{isEnglish ? font.labelEn ?? font.label : font.label}</option>)}
                          </select>
                          <ChevronDown size={14} />
                        </label>
                      </div>
                      <div className="text-color-control">
                        <div className="text-color-heading"><span className="field-label">{tr("顏色", "Color")}</span><label className="color-picker compact-color-picker"><input type="color" value={selectedText.color} onChange={(event) => updateTextLayer({ color: event.target.value })} aria-label={tr("顏色", "Color")} /><span style={{ backgroundColor: selectedText.color }} /></label></div>
                        <div className="text-palette" role="group" aria-label={tr("色票", "Color swatches")}>
                          {["#000000", "#1F2528", "#555B5D", "#FFFFFF", "#FFFDF8", "#E4513B", "#B72F34", "#F07C41", "#D59B42", "#2F855A", "#426B8A", "#2D5B9B", "#8B5CF6", "#D26A9C"].map((color) => <button key={color} type="button" className={`text-swatch ${selectedText.color.toUpperCase() === color ? "is-selected" : ""}`} style={{ backgroundColor: color }} onClick={() => updateTextLayer({ color })} aria-label={`${tr("顏色", "Color")} ${color}`} />)}
                        </div>
                      </div>
                      <RangeControl label={tr("字級", "Font size")} value={selectedText.fontSize} min={12} max={180} suffix=" px" onChange={(value) => updateTextLayer({ fontSize: value })} />
                      <RangeControl label={tr("不透明度", "Opacity")} value={selectedText.opacity} min={1} max={100} suffix="%" onChange={(value) => updateTextLayer({ opacity: value })} />
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
            {backgroundRemovalNotice && (
              <div className={`background-removal-status is-${backgroundRemovalNotice.kind}`} role="status" aria-live="polite">
                <WandSparkles size={16} />
                <span>{backgroundRemovalNotice.message}</span>
              </div>
            )}
            <div
              ref={mobileMiniToolRef}
              className={`mobile-mini-tools ${isMobileMiniToolDragging ? "is-dragging" : ""}`}
              style={mobileMiniToolsStyle}
              onPointerDown={(event) => event.stopPropagation()}
              aria-label="手機迷你創作工具欄"
            >
              <button type="button" className="mobile-mini-drag-handle" onPointerDown={handleMobileMiniToolPointerDown} aria-label="拖曳移動工具欄" title="拖曳移動工具欄"><GripVertical size={16} /></button>
              <span className="mobile-mini-separator" />
              <button type="button" className={`mobile-mini-tool ${tool === "move" ? "is-active" : ""}`} onClick={activateStrokeMoveMode} disabled={!hasMovableArtwork} aria-label="選取並移動筆觸" title="選取並移動筆觸"><Move size={16} /></button>
              <button type="button" className={`mobile-mini-tool ${activeDesktopTool === "brush" ? "is-active" : ""}`} onClick={() => handleMobileMiniToolCreate("brush")} aria-label="畫筆" title="畫筆"><Pencil size={16} /></button>
              <button type="button" className={`mobile-mini-tool ${activeDesktopTool === "shape" ? "is-active" : ""}`} onClick={() => handleMobileMiniToolCreate("shape")} aria-label="新增圖形" title="新增圖形"><Shapes size={16} /></button>
              <button type="button" className={`mobile-mini-tool ${activeDesktopTool === "text" ? "is-active" : ""}`} onClick={() => handleMobileMiniToolCreate("text")} aria-label="新增文字" title="新增文字"><Type size={16} /></button>
              <button type="button" className={`mobile-mini-tool ${activeDesktopTool === "outline" ? "is-active" : ""}`} onClick={() => handleDesktopToolSettings("outline")} disabled={!hasSelectedObject} aria-label="輪廓" title="輪廓"><SquareDashed size={16} /></button>
              <button type="button" className={`mobile-mini-tool ${tool === "crop" ? "is-active" : ""}`} onClick={handleCropTool} disabled={!isCropToolAvailable} aria-label="裁切" title="裁切"><Crop size={16} /></button>
              <button type="button" className="mobile-mini-tool mobile-mini-background-remove" onClick={() => void removeSelectedImageBackground()} disabled={!selectedImage || selectedMaterialIsLocked || backgroundRemovalImageId === selectedImage.id} aria-label={tr("去背", "Remove background")} title={tr("去背", "Remove background")}><WandSparkles size={16} /></button>
              <span className="mobile-mini-separator" />
              <button type="button" className="mobile-mini-tool mobile-mini-settings" onClick={hasSelectedObject ? handleSelectedObjectSettings : handleMobileMiniToolSettings} disabled={!hasSelectedObject && !activeDesktopTool} aria-label="開啟工具設定" title="開啟工具設定"><SlidersHorizontal size={16} /></button>
            </div>
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
                <div ref={canvasContentRef} className="canvas-content" onPointerDown={handleCanvasBlankPointerDown}>
                  <canvas
                    ref={canvasRef}
                    style={{ filter: canvasFilter, opacity: adjustments.opacity / 100, pointerEvents: tool === "brush" ? "auto" : "none" }}
                    onPointerDown={handleCanvasPointerDown}
                    onPointerMove={handleCanvasPointerMove}
                    onPointerUp={finishStroke}
                    onPointerCancel={finishStroke}
                    onPointerLeave={finishStroke}
                    aria-label="繪圖畫布"
                  />
                  {bleedGuide && (
                    <div
                      className="bleed-guide"
                      style={{ left: `${bleedGuide.inset}px`, top: `${bleedGuide.inset}px`, right: `${bleedGuide.inset}px`, bottom: `${bleedGuide.inset}px` }}
                      aria-label={copy.businessCardBleed}
                    >
                      <span>{copy.businessCardBleed}</span>
                    </div>
                  )}
                  {snapGuides.x !== null && <div className="snap-guide snap-guide-vertical" style={{ left: `${snapGuides.x}px` }} />}
                  {snapGuides.y !== null && <div className="snap-guide snap-guide-horizontal" style={{ top: `${snapGuides.y}px` }} />}
                  {[...strokes, ...(drawingStroke ? [drawingStroke] : [])].map((stroke, index) => {
                    const isDraftStroke = drawingStroke?.id === stroke.id;
                    const isStrokeLayerLocked = paintLayers.find((layer) => layer.id === stroke.paintLayerId)?.locked ?? false;
                    const isStrokeSelectable = !isDraftStroke && tool === "move" && !isStrokeLayerLocked;
                    const smoothPath = buildSmoothSvgPath(stroke.points);
                    const isPencilStroke = stroke.kind === "pencil";
                    const isBrushStroke = stroke.kind === "brush";
                    const strokeWidth = isPencilStroke ? Math.max(1, stroke.size * 0.78) : isBrushStroke ? Math.max(2, stroke.size * 1.32) : stroke.size;
                    const brushStamps = isBrushStroke ? buildBrushStamps(stroke.points, stroke.size) : [];
                    const outlineWidth = stroke.outlineWidth ?? 0;
                    const outlineColor = makeOutlineColor(stroke.outlineColor ?? "#FFFDF8", stroke.outlineExposure, stroke.outlineContrast, stroke.outlineSaturation, stroke.outlineVibrancy, stroke.outlineOpacity);
                    const shadowFilter = (stroke.shadowOpacity ?? 0) > 0 ? `drop-shadow(0 0 10px rgba(0, 0, 0, ${(stroke.shadowOpacity ?? 0) / 100}))` : undefined;
                    return (
                      <svg
                        key={stroke.id}
                        className={`stroke-layer ${selectedStrokeId === stroke.id ? "is-selected" : ""} ${isDraftStroke ? "is-draft" : ""} ${isStrokeLayerLocked ? "is-locked" : ""}`}
                        viewBox={`0 0 ${canvasSize.width} ${canvasSize.height}`}
                        style={{ width: `${canvasSize.width}px`, height: `${canvasSize.height}px`, zIndex: getMaterialStackOrder("stroke", stroke, index), pointerEvents: "none" }}
                        onPointerDown={isStrokeSelectable ? (event) => handleStrokePointerDown(event, stroke) : undefined}
                        role={isStrokeSelectable ? "button" : undefined}
                        tabIndex={isStrokeSelectable ? 0 : -1}
                        aria-label="畫筆筆觸"
                      >
                        <g transform={`translate(${stroke.x} ${stroke.y})`} style={{ filter: shadowFilter }}>
                          {stroke.points.length === 1 ? (
                            <>
                              {outlineWidth > 0 && (isBrushStroke ? <ellipse cx={stroke.points[0].x} cy={stroke.points[0].y} rx={stroke.size * 0.66 + outlineWidth} ry={stroke.size * 0.5 + outlineWidth} fill={outlineColor} /> : <circle cx={stroke.points[0].x} cy={stroke.points[0].y} r={strokeWidth / 2 + outlineWidth} fill={outlineColor} />)}
                              {isBrushStroke ? <ellipse cx={stroke.points[0].x} cy={stroke.points[0].y} rx={stroke.size * 0.66} ry={stroke.size * 0.5} fill={stroke.color} opacity={(stroke.opacity / 100) * 0.44} /> : <circle cx={stroke.points[0].x} cy={stroke.points[0].y} r={strokeWidth / 2} fill={stroke.color} opacity={isPencilStroke ? (stroke.opacity / 100) * 0.56 : stroke.opacity / 100} />}
                              {isStrokeSelectable && <circle className="stroke-hit-area" cx={stroke.points[0].x} cy={stroke.points[0].y} r={Math.max(12, strokeWidth)} />}
                            </>
                          ) : (
                            <>
                              {!isBrushStroke && outlineWidth > 0 && <path d={smoothPath} fill="none" stroke={outlineColor} strokeWidth={strokeWidth + outlineWidth * 2} strokeLinecap="round" strokeLinejoin="round" />}
                              {!isBrushStroke && <path className="stroke-visible" d={smoothPath} fill="none" stroke={stroke.color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" opacity={isPencilStroke ? (stroke.opacity / 100) * 0.56 : stroke.opacity / 100} />}
                              {isPencilStroke && [-0.85, 0.7].map((offset, index) => <path key={`grain-${index}`} d={smoothPath} transform={`translate(${offset} ${index === 0 ? 0.45 : -0.45})`} fill="none" stroke={stroke.color} strokeWidth={Math.max(0.65, stroke.size * 0.14)} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={`${Math.max(0.8, stroke.size * 0.09)} ${Math.max(1.8, stroke.size * 0.24)}`} opacity={(stroke.opacity / 100) * (index === 0 ? 0.26 : 0.19)} />)}
                              {isBrushStroke && outlineWidth > 0 && brushStamps.map((stamp, index) => <ellipse key={`brush-outline-${index}`} cx={stamp.x} cy={stamp.y} rx={stroke.size * 0.66 * stamp.scale + outlineWidth} ry={stroke.size * 0.5 * stamp.scale + outlineWidth} fill={outlineColor} />)}
                              {isBrushStroke && brushStamps.map((stamp, index) => <g key={`brush-stamp-${index}`} transform={`translate(${stamp.x} ${stamp.y}) rotate(${(stamp.angle * 180) / Math.PI}) scale(${stamp.scale})`}><ellipse cx="0" cy="0" rx={stroke.size * 0.66} ry={stroke.size * 0.5} fill={stroke.color} opacity={(stroke.opacity / 100) * (index % 4 === 0 ? 0.31 : 0.36)} /><ellipse cx={stroke.size * 0.06} cy={-stroke.size * 0.32} rx={stroke.size * 0.48} ry={Math.max(0.6, stroke.size * 0.055)} fill={stroke.color} opacity={(stroke.opacity / 100) * 0.08} /><ellipse cx={stroke.size * 0.06} cy={stroke.size * 0.32} rx={stroke.size * 0.48} ry={Math.max(0.6, stroke.size * 0.055)} fill={stroke.color} opacity={(stroke.opacity / 100) * 0.08} /></g>)}
                              {isStrokeSelectable && <path className="stroke-hit-area" d={smoothPath} fill="none" strokeWidth={Math.max(18, strokeWidth + 12)} strokeLinecap="round" strokeLinejoin="round" />}
                            </>
                          )}
                        </g>
                      </svg>
                    );
                  })}
                  {images.map((image, index) => (
                    <div
                      key={image.id}
                      className={`image-layer ${selectedImageId === image.id ? "is-selected" : ""} ${selectedImageId === image.id && (snapGuides.x !== null || snapGuides.y !== null) ? "is-snapped" : ""} ${isPaintLayerLocked(image.paintLayerId) ? "is-locked" : ""} ${imageEditingId === image.id ? "is-editing" : "is-passive"} ${cropDraft?.imageId === image.id ? "is-cropping" : ""}`}
                      style={{
                        left: 0,
                        top: 0,
                        width: `${image.width}px`,
                        height: `${image.height}px`,
                        transform: `translate3d(${image.x}px, ${image.y}px, 0) rotate(${image.rotation}deg)`,
                        "--image-control-scale": 100 / zoom,
                        "--image-rotation-stem-length": `${18 * (100 / zoom)}px`,
                        "--image-rotation-handle-offset": `${24 * (100 / zoom)}px`,
                        "--image-rotation-label-offset": `${40 * (100 / zoom)}px`,
                        zIndex: getMaterialStackOrder("image", image, index),
                        opacity: image.opacity / 100,
                        filter: [
                          makeAdjustmentFilter(image.exposure, image.contrast, image.saturation, image.vibrancy),
                          makeAlphaOutlineFilter(makeOutlineColor(image.outlineColor ?? "#FFFDF8", image.outlineExposure, image.outlineContrast, image.outlineSaturation, image.outlineVibrancy, image.outlineOpacity), image.outlineWidth ?? 0),
                          image.shadowOpacity > 0 ? `drop-shadow(0 0 14px rgba(0, 0, 0, ${image.shadowOpacity / 100}))` : "",
                        ].filter((value) => value && value !== "none").join(" ") || "none",
                      } as CSSProperties}
                      onPointerDown={(event) => handleImagePointerDown(event, image)}
                      role="button"
                      tabIndex={0}
                      aria-label={`圖片素材：${image.name}`}
                    >
                      <img className="image-layer-content" src={image.src} alt={image.name} draggable={false} />
                      {backgroundRepair?.imageId === image.id && (
                        <canvas
                          ref={(node) => {
                            if (node) backgroundRepairCanvasRefs.current.set(image.id, node);
                            else backgroundRepairCanvasRefs.current.delete(image.id);
                          }}
                          className={`background-repair-canvas is-${backgroundRepair.mode}`}
                          data-background-repair-id={image.id}
                          onPointerDown={(event) => handleBackgroundRepairPointerDown(event, image)}
                          onPointerMove={(event) => handleBackgroundRepairPointerMove(event, image)}
                          onPointerUp={finishBackgroundRepairStroke}
                          onPointerCancel={finishBackgroundRepairStroke}
                          aria-label={backgroundRepair.mode === "keep" ? tr("保留筆修補遮罩", "Keep brush mask repair") : tr("移除筆修補遮罩", "Remove brush mask repair")}
                        />
                      )}
                      {cropDraft?.imageId === image.id && (
                        <div
                          className="image-crop-preview"
                          style={{ left: `${cropDraft.x * 100}%`, top: `${cropDraft.y * 100}%`, width: `${cropDraft.width * 100}%`, height: `${cropDraft.height * 100}%` }}
                          onPointerDown={(event) => handleCropHandlePointerDown(event, image, "move")}
                        >
                          <span>{tr("拖曳控制點調整裁切範圍", "Drag handles to adjust crop")}</span>
                          <div className="crop-handle crop-handle-left" onPointerDown={(event) => handleCropHandlePointerDown(event, image, "left")} />
                          <div className="crop-handle crop-handle-right" onPointerDown={(event) => handleCropHandlePointerDown(event, image, "right")} />
                          <div className="crop-handle crop-handle-top" onPointerDown={(event) => handleCropHandlePointerDown(event, image, "top")} />
                          <div className="crop-handle crop-handle-bottom" onPointerDown={(event) => handleCropHandlePointerDown(event, image, "bottom")} />
                          <div className="crop-handle crop-handle-top-left" onPointerDown={(event) => handleCropHandlePointerDown(event, image, "top-left")} />
                          <div className="crop-handle crop-handle-top-right" onPointerDown={(event) => handleCropHandlePointerDown(event, image, "top-right")} />
                          <div className="crop-handle crop-handle-bottom-left" onPointerDown={(event) => handleCropHandlePointerDown(event, image, "bottom-left")} />
                          <div className="crop-handle crop-handle-bottom-right" onPointerDown={(event) => handleCropHandlePointerDown(event, image, "bottom-right")} />
                        </div>
                      )}
                      {selectedImageId === image.id && imageEditingId === image.id && !isPaintLayerLocked(image.paintLayerId) && !cropDraft && (
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
                  {shapes.map((shape, index) => (
                    <svg
                      key={shape.id}
                      className={`shape-layer ${selectedShapeId === shape.id ? "is-selected" : ""} ${shape.kind === "circle" ? "is-circle" : ""} ${isPaintLayerLocked(shape.paintLayerId) ? "is-locked" : ""}`}
                      viewBox="0 0 100 100"
                      preserveAspectRatio="none"
                      style={{
                        left: 0,
                        top: 0,
                        width: `${shape.width}px`,
                        height: `${shape.height}px`,
                        zIndex: getMaterialStackOrder("shape", shape, index),
                        transform: `translate3d(${shape.x}px, ${shape.y}px, 0) rotate(${shape.rotation}deg)`,
                        opacity: shape.opacity / 100,
                        filter: [
                          makeAdjustmentFilter(shape.exposure, shape.contrast, shape.saturation, shape.vibrancy),
                          shape.shadow && shape.shadowOpacity > 0 ? `drop-shadow(0 0 ${shape.shadowBlur}px ${hexToRgba(shape.shadowColor, shape.shadowOpacity / 100)})` : "",
                        ].filter((value) => value && value !== "none").join(" ") || "none",
                      }}
                      onPointerDown={(event) => handleShapePointerDown(event, shape)}
                      onDoubleClick={(event) => handleShapeDoubleClick(event, shape)}
                      role="button"
                      tabIndex={0}
                      aria-label={`${SHAPE_LABELS[shape.kind]}圖形`}
                    >
                      {shape.kind === "rectangle" && (
                        <rect
                          x="0"
                          y="0"
                          width="100"
                          height="100"
                          rx={Math.min(50, (shape.cornerRadius / Math.max(1, shape.width)) * 100)}
                          ry={Math.min(50, (shape.cornerRadius / Math.max(1, shape.height)) * 100)}
                          fill={shape.fill}
                        />
                      )}
                      {shape.kind === "rectangle" && shape.outlineWidth > 0 && (
                        <rect
                          x={(shape.outlineWidth / 2 / Math.max(1, shape.width)) * 100}
                          y={(shape.outlineWidth / 2 / Math.max(1, shape.height)) * 100}
                          width={100 - (shape.outlineWidth / Math.max(1, shape.width)) * 100}
                          height={100 - (shape.outlineWidth / Math.max(1, shape.height)) * 100}
                          rx={Math.max(0, Math.min(50, ((shape.cornerRadius - shape.outlineWidth / 2) / Math.max(1, shape.width)) * 100))}
                          ry={Math.max(0, Math.min(50, ((shape.cornerRadius - shape.outlineWidth / 2) / Math.max(1, shape.height)) * 100))}
                          fill="none"
                          stroke={makeOutlineColor(shape.outline, shape.outlineExposure, shape.outlineContrast, shape.outlineSaturation, shape.outlineVibrancy, shape.outlineOpacity)}
                          strokeWidth={shape.outlineWidth}
                          vectorEffect="non-scaling-stroke"
                        />
                      )}
                      {shape.kind === "circle" && <circle cx="50" cy="50" r="50" fill={shape.fill} stroke={makeOutlineColor(shape.outline, shape.outlineExposure, shape.outlineContrast, shape.outlineSaturation, shape.outlineVibrancy, shape.outlineOpacity)} strokeWidth={shape.outlineWidth * 0.8} vectorEffect="non-scaling-stroke" />}
                      {shape.kind === "star" && <polygon points={STAR_POINTS} fill={shape.fill} stroke={makeOutlineColor(shape.outline, shape.outlineExposure, shape.outlineContrast, shape.outlineSaturation, shape.outlineVibrancy, shape.outlineOpacity)} strokeWidth={shape.outlineWidth * 0.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
                      {shape.kind === "heart" && <path d="M50 88 C44 82 15 65 15 38 C15 18 39 14 50 33 C61 14 85 18 85 38 C85 65 56 82 50 88Z" fill={shape.fill} stroke={makeOutlineColor(shape.outline, shape.outlineExposure, shape.outlineContrast, shape.outlineSaturation, shape.outlineVibrancy, shape.outlineOpacity)} strokeWidth={shape.outlineWidth * 0.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
                      {shape.kind === "triangle" && <polygon points={TRIANGLE_POINTS} fill={shape.fill} stroke={makeOutlineColor(shape.outline, shape.outlineExposure, shape.outlineContrast, shape.outlineSaturation, shape.outlineVibrancy, shape.outlineOpacity)} strokeWidth={shape.outlineWidth * 0.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
                      {shape.kind === "pentagon" && <polygon points={PENTAGON_POINTS} fill={shape.fill} stroke={makeOutlineColor(shape.outline, shape.outlineExposure, shape.outlineContrast, shape.outlineSaturation, shape.outlineVibrancy, shape.outlineOpacity)} strokeWidth={shape.outlineWidth * 0.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />}
                    </svg>
                  ))}
                  {shapes.filter((shape) => shape.id === selectedShapeId && !isPaintLayerLocked(shape.paintLayerId)).map((shape) => (
                    <div
                      key={`${shape.id}-controls`}
                      className={`shape-control-layer ${shape.kind === "circle" ? "is-circle" : ""}`}
                      style={{
                        left: 0,
                        top: 0,
                        width: `${shape.width}px`,
                        height: `${shape.height}px`,
                        zIndex: getMaterialStackOrder("shape", shape, shapes.findIndex((item) => item.id === shape.id)) + 10000,
                        transform: `translate3d(${shape.x}px, ${shape.y}px, 0) rotate(${shape.rotation}deg)`,
                        "--shape-control-scale": 100 / zoom,
                        "--shape-rotation-stem-length": `${18 * (100 / zoom)}px`,
                        "--shape-rotation-handle-offset": `${24 * (100 / zoom)}px`,
                        "--shape-rotation-label-offset": `${40 * (100 / zoom)}px`,
                      } as CSSProperties}
                      aria-label={`${SHAPE_LABELS[shape.kind]}圖形控制點`}
                    >
                      <div className="shape-control-handle shape-control-handle-left" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "left")} />
                      <div className="shape-control-handle shape-control-handle-right" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "right")} />
                      <div className="shape-control-handle shape-control-handle-top" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "top")} />
                      <div className="shape-control-handle shape-control-handle-bottom" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "bottom")} />
                      <div className="shape-control-handle shape-control-handle-top-left" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "top-left")} />
                      <div className="shape-control-handle shape-control-handle-top-right" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "top-right")} />
                      <div className="shape-control-handle shape-control-handle-bottom-left" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "bottom-left")} />
                      <div className="shape-control-handle shape-control-handle-bottom-right" onPointerDown={(event) => handleShapeResizePointerDown(event, shape, "bottom-right")} />
                      <div className="shape-control-rotation-stem" />
                      <div className="shape-control-rotation-handle" onPointerDown={(event) => handleShapeRotatePointerDown(event, shape)} />
                      <div className="shape-control-rotation-label">{Math.round(shape.rotation)}°</div>
                    </div>
                  ))}
                  {layers.map((layer, index) => (
                    <div
                      key={layer.id}
                      className={`text-layer ${selectedTextId === layer.id ? "is-selected" : ""} ${(layer.outlineWidth ?? 0) > 0 ? "has-outline" : ""} ${isPaintLayerLocked(layer.paintLayerId) ? "is-locked" : ""}`}
                      ref={(element) => {
                        if (element) textLayerElementsRef.current.set(layer.id, element);
                        else textLayerElementsRef.current.delete(layer.id);
                      }}
                      style={{
                        left: 0,
                        top: 0,
                        transform: `translate3d(${layer.x}px, ${layer.y}px, 0)`,
                        ...(layer.rasterDataUrl && editingTextId !== layer.id ? { width: `${layer.rasterWidth ?? 0}px`, height: `${layer.rasterHeight ?? 0}px`, minWidth: 0, minHeight: 0, padding: 0, lineHeight: 1 } : {}),
                        zIndex: getMaterialStackOrder("text", layer, index),
                        color: hexToRgba(layer.color, layer.opacity / 100),
                        fontSize: `${layer.fontSize}px`,
                        fontWeight: layer.fontWeight,
                        fontFamily: `"${layer.fontFamily}", "Noto Sans TC", sans-serif`,
                        opacity: 1,
                        filter: [
                          makeAdjustmentFilter(layer.exposure, layer.contrast, layer.saturation, layer.vibrancy),
                          layer.shadowOpacity > 0 ? `drop-shadow(0 0 14px rgba(0, 0, 0, ${layer.shadowOpacity / 100}))` : "",
                        ].filter((value) => value && value !== "none").join(" ") || "none",
                        WebkitTextStroke: (layer.outlineWidth ?? 0) > 0 ? `${layer.outlineWidth}px ${makeOutlineColor(layer.outlineColor ?? "#FFFDF8", layer.outlineExposure, layer.outlineContrast, layer.outlineSaturation, layer.outlineVibrancy, layer.outlineOpacity)}` : "0 transparent",
                        paintOrder: "stroke fill",
                        "--export-text-outline-width": `${layer.outlineWidth ?? 0}px`,
                        "--export-text-outline-negative-width": `-${layer.outlineWidth ?? 0}px`,
                        "--export-text-outline-color": makeOutlineColor(layer.outlineColor ?? "#FFFDF8", layer.outlineExposure, layer.outlineContrast, layer.outlineSaturation, layer.outlineVibrancy, layer.outlineOpacity),
                        "--text-control-scale": 100 / zoom,
                      } as CSSProperties}
                      onPointerDown={(event) => handleTextPointerDown(event, layer)}
                      contentEditable={editingTextId === layer.id && !isPaintLayerLocked(layer.paintLayerId)}
                      suppressContentEditableWarning
                      onDoubleClick={(event) => {
                        event.stopPropagation();
                        if (isPaintLayerLocked(layer.paintLayerId)) return;
                        const textElement = event.currentTarget;
                        setSelectedTextId(layer.id);
                        setSelectedShapeId(null);
                        setSelectedImageId(null);
                        setTool("text");
                        setActiveDesktopTool("text");
                        setOpenDesktopTool("text");
                        setEditingTextId(layer.id);
                        window.requestAnimationFrame(() => {
                          if (textElement.isConnected) textElement.focus();
                        });
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
                      {layer.rasterDataUrl && editingTextId !== layer.id ? (
                        <img className="text-layer-raster" src={layer.rasterDataUrl} alt="" draggable={false} style={{ opacity: layer.opacity / 100 }} />
                      ) : layer.text}
                      {selectedTextId === layer.id && editingTextId !== layer.id && !isPaintLayerLocked(layer.paintLayerId) && (
                        <>
                          <span className="text-resize-handle text-resize-handle-top-left" contentEditable={false} onPointerDown={(event) => handleTextResizePointerDown(event, layer, "top-left")} />
                          <span className="text-resize-handle text-resize-handle-top-right" contentEditable={false} onPointerDown={(event) => handleTextResizePointerDown(event, layer, "top-right")} />
                          <span className="text-resize-handle text-resize-handle-bottom-left" contentEditable={false} onPointerDown={(event) => handleTextResizePointerDown(event, layer, "bottom-left")} />
                          <span className="text-resize-handle text-resize-handle-bottom-right" contentEditable={false} onPointerDown={(event) => handleTextResizePointerDown(event, layer, "bottom-right")} />
                        </>
                      )}
                    </div>
                  ))}
                  {mobileSelectionToolbar && (
                    <div
                      className="mobile-object-toolbar"
                      style={{ left: `${mobileSelectionToolbar.x}px`, top: `${mobileSelectionToolbar.y}px`, "--mobile-object-toolbar-scale": 100 / zoom } as CSSProperties}
                      onPointerDown={(event) => event.stopPropagation()}
                      aria-label={tr("素材操作", "Object actions")}
                    >
                      <button type="button" onClick={duplicateSelectedMaterial} title={tr("在原物件旁建立相同素材", "Duplicate object")} aria-label={tr("複製目前素材", "Duplicate selected object")}><Copy size={23} /></button>
                      <button type="button" onClick={deleteSelectedMaterial} title={tr("刪除目前素材", "Delete object")} aria-label={tr("刪除目前素材", "Delete selected object")}><Trash2 size={24} /></button>
                      <button type="button" onClick={handleSelectedObjectSettings} title={tr("更多設定", "More settings")} aria-label={tr("更多設定", "More settings")}><MoreHorizontal size={25} /></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <footer className="workspace-footer product-footer" aria-label="AbiPaint 工具說明">
            <div className="product-footnote">
              <span className="product-footnote-label">{isEnglish ? "A NOTE FROM THE DEVELOPER" : "開發者的話"}</span>
              <p>{isEnglish
                ? "Abiting has run a Detective Conan fan site for years, often needing to resize images, add text, and fine-tune colors. Rather than pay for Adobe or deal with bloated, sign-up-required Canva, the answer was AbiPaint. No fees, no sign-up, no install. Just resize, color, design, and export, right in the browser."
                : "阿比丁經營《名偵探柯南》相關網站多年，常需調整圖片尺寸、加註文字、微調色彩。不想被昂貴的 Adobe 綁架，也嫌 Canva 臃腫又要註冊，於是自行開發了 AbiPaint。免付費、免註冊、免安裝，直接在瀏覽器完成縮放、調色、設計與匯出。"}</p>
            </div>
            <div className="product-footer-meta">
              <p className="product-copyright">Copyright © 2026 <a href={isEnglish ? "/en" : "/"}>AbiPaint</a></p>
              <div className="product-build-meta" aria-label="AbiPaint version 1.0.2">
                <a className="product-version-label" href="https://abiting.cc/abipaint" target="_blank" rel="noopener noreferrer">v1.0.2</a>
                <a
                  className="startupbase-badge"
                  href="https://startupbase.io/products/abipaint?utm_source=startupbase&utm_medium=badge&utm_campaign=launch-badge-light"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <img src="https://statics.startupbase.io/site/badges/launched-on-sb.svg" alt="Launched on StartupBase" />
                </a>
              </div>
            </div>
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
                    <input type="color" value={brushColor} onChange={(event) => setBrushColor(event.target.value)} aria-label={tr("顏色", "Color")} />
                    <span style={{ backgroundColor: brushColor }} />
                  </label>
                </div>
                <RangeControl label={tr("大小", "Size")} value={brushSize} min={2} max={160} suffix=" px" onChange={setBrushSize} />
                <RangeControl label={tr("透明度", "Opacity")} value={brushOpacity} min={1} max={100} suffix="%" onChange={setBrushOpacity} />
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
                <SectionTitle eyebrow="SHAPES" title={tr("圖形", "Shapes")} action={<Shapes size={15} className="section-icon" />} />
                <div className="shape-choice-grid">
                  <button type="button" className={`shape-choice ${shapeKind === "rectangle" ? "is-active" : ""}`} onClick={() => { setShapeKind("rectangle"); addShape("rectangle"); }}><Square size={18} /><span>{tr("方塊", "Rectangle")}</span></button>
                  <button type="button" className={`shape-choice ${shapeKind === "circle" ? "is-active" : ""}`} onClick={() => { setShapeKind("circle"); addShape("circle"); }}><Circle size={18} /><span>{tr("圓形", "Circle")}</span></button>
                  <button type="button" className={`shape-choice ${shapeKind === "star" ? "is-active" : ""}`} onClick={() => { setShapeKind("star"); addShape("star"); }}><Star size={18} /><span>{tr("星星", "Star")}</span></button>
                  <button type="button" className={`shape-choice ${shapeKind === "heart" ? "is-active" : ""}`} onClick={() => { setShapeKind("heart"); addShape("heart"); }}><Heart size={18} /><span>{tr("愛心", "Heart")}</span></button>
                  <button type="button" className={`shape-choice ${shapeKind === "triangle" ? "is-active" : ""}`} onClick={() => { setShapeKind("triangle"); addShape("triangle"); }}><Triangle size={18} /><span>{tr("三角形", "Triangle")}</span></button>
                  <button type="button" className={`shape-choice ${shapeKind === "pentagon" ? "is-active" : ""}`} onClick={() => { setShapeKind("pentagon"); addShape("pentagon"); }}><Pentagon size={18} /><span>{tr("五邊形", "Pentagon")}</span></button>
                </div>
                {!selectedShape && <p className="empty-inspector">{tr("選擇圖形或按上方按鈕，把形狀放到畫布中央。", "Select a shape or use a button above to place one in the center of the canvas.")}</p>}
                {selectedShape && (
                  <>
                    <div className="color-row"><span className="field-label">{tr("顏色", "Color")}</span><label className="color-picker"><input type="color" value={selectedShape.fill} onChange={(event) => updateShape({ fill: event.target.value })} aria-label={tr("圖形顏色", "Shape color")} /><span style={{ backgroundColor: selectedShape.fill }} /></label></div>
                    {selectedShape.kind === "rectangle" && <RangeControl label={tr("圓角半徑", "Corner radius")} value={selectedShape.cornerRadius} min={0} max={Math.max(1, Math.floor(Math.min(selectedShape.width, selectedShape.height) / 2))} suffix=" px" onChange={(value) => updateShape({ cornerRadius: value })} />}
                    <div className="shape-rotation-readout"><span className="field-label">{tr("旋轉角度", "Rotation")}</span><span className="mono-value">{Math.round(selectedShape.rotation)}°</span></div>
                    <RangeControl label={tr("不透明度", "Opacity")} value={selectedShape.opacity} min={1} max={100} suffix="%" onChange={(value) => updateShape({ opacity: value })} />
                    <div className="align-actions"><span className="field-label">{tr("置中對齊", "Align")}</span><div className="align-button-row"><button type="button" className="secondary-button" onClick={() => alignSelected("horizontal")}><AlignCenter size={14} /> {tr("水平", "Horizontal")}</button><button type="button" className="secondary-button" onClick={() => alignSelected("vertical")}><AlignVerticalJustifyCenter size={14} /> {tr("垂直", "Vertical")}</button><button type="button" className="secondary-button" onClick={() => alignSelected("both")}>{tr("中央", "Center")}</button></div></div>
                    <button type="button" className="secondary-button full-width" onClick={deleteSelectedShape}><Trash2 size={14} /> {tr("移除圖形", "Remove shape")}</button>
                  </>
                )}
              </div>
            )}

            {selectedImage && (
              <div className="inspector-section image-inspector-section">
                <SectionTitle eyebrow="IMAGE LAYER" title={tr("圖片素材", "Image layer")} action={<ImagePlus size={15} className="section-icon" />} />
                <div className="image-layer-meta"><span>{tr("檔案", "File")}</span><strong>{selectedImage.name}</strong></div>
                {!imageEditingId && <p className="empty-inspector">{tr("圖片目前鎖定，點擊下方按鈕後才可移動、縮放、旋轉或裁切。", "This image is locked. Start editing to move, resize, rotate, or crop it.")}</p>}
                {imageEditingId === selectedImage.id && !cropDraft && <p className="empty-inspector">{tr("可在畫布上拖曳圖片移動，使用邊角控制點縮放，或開啟裁切模式保留所需範圍。", "Drag on the canvas to move it, use the corner handles to resize it, or crop it to keep the area you need.")}</p>}
                {!imageEditingId && <button type="button" className="secondary-button full-width" onClick={startImageEditing}><ImagePlus size={14} /> {tr("開始編輯圖片", "Edit image")}</button>}
                {imageEditingId === selectedImage.id && !cropDraft && <><button type="button" className="secondary-button full-width" onClick={beginImageCrop}><Crop size={14} /> {tr("裁切圖片", "Crop image")}</button><button type="button" className="secondary-button full-width" onClick={() => setImageEditingId(null)}><Lock size={14} /> {tr("完成編輯並鎖定", "Finish editing & lock")}</button></>}
                {cropDraft?.imageId === selectedImage.id && <><RangeControl label={tr("裁切左側", "Crop left")} value={Math.round(cropDraft.x * 100)} min={0} max={90} suffix="%" onChange={(value) => updateCropDraft({ x: value / 100 })} /><RangeControl label={tr("裁切上方", "Crop top")} value={Math.round(cropDraft.y * 100)} min={0} max={90} suffix="%" onChange={(value) => updateCropDraft({ y: value / 100 })} /><RangeControl label={tr("裁切寬度", "Crop width")} value={Math.round(cropDraft.width * 100)} min={10} max={Math.max(10, Math.round((1 - cropDraft.x) * 100))} suffix="%" onChange={(value) => updateCropDraft({ width: value / 100 })} /><RangeControl label={tr("裁切高度", "Crop height")} value={Math.round(cropDraft.height * 100)} min={10} max={Math.max(10, Math.round((1 - cropDraft.y) * 100))} suffix="%" onChange={(value) => updateCropDraft({ height: value / 100 })} /><button type="button" className="primary-button full-width" onClick={() => void applyImageCrop()}><Check size={14} /> {tr("套用裁切", "Apply crop")}</button><button type="button" className="secondary-button full-width" onClick={cancelImageCrop}>{tr("取消裁切", "Cancel crop")}</button></>}
                {selectedImage.backgroundSource && !backgroundRepair && <button type="button" className="secondary-button full-width" onClick={() => void startBackgroundRepair()}><Pencil size={14} /> {tr("修補去背", "Repair background")}</button>}
                {backgroundRepair?.imageId === selectedImage.id && (
                  <div className="background-repair-controls">
                    <div className="background-repair-mode-row">
                      <button type="button" className={`secondary-button ${backgroundRepair.mode === "keep" ? "is-active" : ""}`} onClick={() => setBackgroundRepair((current) => current ? { ...current, mode: "keep" } : current)}><Pencil size={14} /> {tr("保留筆", "Keep")}</button>
                      <button type="button" className={`secondary-button ${backgroundRepair.mode === "remove" ? "is-active" : ""}`} onClick={() => setBackgroundRepair((current) => current ? { ...current, mode: "remove" } : current)}><Eraser size={14} /> {tr("移除筆", "Remove")}</button>
                    </div>
                    <RangeControl label={tr("筆刷大小", "Brush size")} value={backgroundRepair.brushSize} min={4} max={120} suffix=" px" onChange={(value) => setBackgroundRepair((current) => current ? { ...current, brushSize: value } : current)} />
                    <button type="button" className="primary-button full-width" onClick={() => void commitBackgroundRepair()}><Check size={14} /> {tr("完成修補", "Apply repair")}</button>
                    <button type="button" className="secondary-button full-width" onClick={cancelBackgroundRepair}>{tr("取消修補", "Cancel repair")}</button>
                  </div>
                )}
                <button type="button" className="secondary-button full-width" onClick={deleteSelectedImage}><Trash2 size={14} /> {tr("移除圖片", "Remove image")}</button>
              </div>
            )}

            {(tool === "text" || selectedText) && (
              <div className="inspector-section text-inspector-section">
                {!selectedText && <p className="empty-inspector">選擇畫布上的文字，或按左側「文字工具」建立文字卡。</p>}
                {selectedText && (
                  <>
                    <label className="field-label" htmlFor="text-content">{tr("內容", "Content")}</label>
                    <textarea id="text-content" className="text-input" value={selectedText.text} onChange={(event) => updateTextLayer({ text: event.target.value })} rows={3} />
                    <div className="select-row">
                      <label className="select-wrap">
                        <span className="field-label">{tr("字型", "Font")}</span>
                        <select value={selectedText.fontFamily} onChange={(event) => updateTextLayer({ fontFamily: event.target.value as TextLayer["fontFamily"] })}>
                          {TEXT_FONT_OPTIONS.map((font) => <option key={font.value} value={font.value}>{isEnglish ? font.labelEn ?? font.label : font.label}</option>)}
                        </select>
                        <ChevronDown size={14} />
                      </label>
                      <label className="select-wrap small-select">
                        <span className="field-label">{tr("粗細", "Weight")}</span>
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
                        <span className="field-label">{tr("顏色", "Color")}</span>
                        <label className="color-picker compact-color-picker">
                          <input type="color" value={selectedText.color} onChange={(event) => updateTextLayer({ color: event.target.value })} aria-label={tr("顏色", "Color")} />
                          <span style={{ backgroundColor: selectedText.color }} />
                        </label>
                      </div>
                      <div className="text-palette" role="group" aria-label={tr("色票", "Color swatches")}>
                        {["#000000", "#1F2528", "#555B5D", "#8C9290", "#FFFFFF", "#FFFDF8", "#E4513B", "#B72F34", "#F07C41", "#D59B42", "#F4C95D", "#2F855A", "#82A480", "#426B8A", "#2D5B9B", "#8B5CF6", "#D26A9C", "#F3A6C8"].map((color) => (
                          <button key={color} type="button" className={`text-swatch ${selectedText.color.toUpperCase() === color ? "is-selected" : ""}`} style={{ backgroundColor: color }} onClick={() => updateTextLayer({ color })} aria-label={`${tr("顏色", "Color")} ${color}`} title={color} />
                        ))}
                      </div>
                    </div>
                    <RangeControl label={tr("字級", "Font size")} value={selectedText.fontSize} min={12} max={180} suffix=" px" onChange={(value) => updateTextLayer({ fontSize: value })} />
                    <RangeControl label={tr("不透明度", "Opacity")} value={selectedText.opacity} min={1} max={100} suffix="%" onChange={(value) => updateTextLayer({ opacity: value })} />
                    <div className="text-actions">
                      <button type="button" className="secondary-button full-width" onClick={deleteSelectedText}><Trash2 size={14} /> {tr("移除文字卡", "Remove text")}</button>
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
              <SectionTitle eyebrow={copy.canvasSize} emphasis action={<Maximize2 size={15} className="section-icon" />} />
              <div className="dimension-grid">
                <label><span>{copy.width}</span><input id="canvas-width" type="number" min={240} max={2400} defaultValue={canvasSize.width} key={`width-${canvasSize.width}`} /></label>
                <span className="dimension-mark">×</span>
                <label><span>{copy.height}</span><input id="canvas-height" type="number" min={180} max={1800} defaultValue={canvasSize.height} key={`height-${canvasSize.height}`} /></label>
              </div>
              <button type="button" className="secondary-button full-width" onClick={resizeCanvas}>{copy.applyResolution}</button>
              <label className="toggle-row resolution-scale-toggle">
                <span>{copy.scaleImages}</span>
                <input type="checkbox" checked={scaleImagesWithCanvas} onChange={(event) => setScaleImagesWithCanvas(event.target.checked)} />
              </label>
              <div className="resolution-preset-row">
                <button type="button" className="resolution-preset" onClick={() => applyResolutionPreset(800, 800)}>800 × 800</button>
                <button type="button" className="resolution-preset" onClick={() => applyResolutionPreset(1200, 800)}>1200 × 800</button>
                <button type="button" className="resolution-preset" onClick={() => applyResolutionPreset(1280, 720)}>1280 × 720</button>
              </div>
              <div className="business-card-template-block">
                <div className="business-card-template-heading"><span>{copy.businessCardTemplates}</span><small>{copy.businessCardBleed}</small></div>
                <div className="business-card-template-grid">
                  <button type="button" onClick={() => applyBusinessCardTemplate("asia")}>
                    <strong>{copy.asiaBusinessCard}</strong>
                    <span>1063 × 638</span>
                  </button>
                  <button type="button" onClick={() => applyBusinessCardTemplate("western")}>
                    <strong>{copy.westernBusinessCard}</strong>
                    <span>1050 × 600</span>
                  </button>
                </div>
              </div>
              <div className="canvas-meta"><span>{isEnglish ? "Ratio" : "比例"}</span><span className="mono-value">{(canvasSize.width / canvasSize.height).toFixed(2)} : 1</span></div>
            </div>

            <div className="inspector-divider" />

            <div className="inspector-section">
              <SectionTitle eyebrow={copy.imageAdjustments} emphasis action={<SlidersHorizontal size={15} className="section-icon" />} />
              <RangeControl label={copy.exposure} value={activeAdjustmentValues.exposure} min={-100} max={100} suffix="%" editable onChange={(value) => updateActiveAdjustment({ exposure: value })} />
              <RangeControl label={copy.contrast} value={activeAdjustmentValues.contrast} min={-100} max={100} suffix="%" editable onChange={(value) => updateActiveAdjustment({ contrast: value })} />
              <RangeControl label={copy.saturation} value={activeAdjustmentValues.saturation} min={-100} max={100} suffix="%" editable onChange={(value) => updateActiveAdjustment({ saturation: value })} />
              <RangeControl label={copy.vibrancy} value={activeAdjustmentValues.vibrancy} min={-100} max={100} suffix="%" editable onChange={(value) => updateActiveAdjustment({ vibrancy: value })} />
              <RangeControl label={copy.opacity} value={activeAdjustmentValues.opacity} min={1} max={100} suffix="%" editable onChange={(value) => updateActiveAdjustment({ opacity: value })} />
              {activeShadowOpacity !== null ? (
                <RangeControl label={tr("陰影強度", "Shadow")} value={activeShadowOpacity} min={0} max={100} suffix="%" editable onChange={updateActiveShadowOpacity} />
              ) : (
                <div className="range-control shadow-control-hint"><span className="range-heading"><span>{tr("陰影強度", "Shadow")}</span><span className="mono-value">—</span></span><p>{tr("選取圖片、圖形或文字後可調整", "Select an image, shape, or text object to adjust")}</p></div>
              )}
              <button type="button" className="link-button" onClick={resetActiveAdjustment}><RotateCcw size={13} /> {isEnglish ? "Reset adjustments" : "重設目前調整"}</button>
            </div>

            <div className="inspector-divider" />
          </div>
        </aside>
      </div>
      <AlertDialog open={resetWorkingFileDialogOpen} onOpenChange={setResetWorkingFileDialogOpen}>
        <AlertDialogContent className="reset-working-file-dialog max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] border-[rgba(228,81,59,0.56)] bg-[#24221d] text-[#f5f0e5] sm:w-full">
          <AlertDialogHeader>
            <AlertDialogTitle>{copy.resetWorkingFileTitle}</AlertDialogTitle>
            {copy.resetWorkingFileDescription && <AlertDialogDescription className="text-[#b8b8af]">{copy.resetWorkingFileDescription}</AlertDialogDescription>}
          </AlertDialogHeader>
          <AlertDialogFooter className="reset-working-file-footer flex-row justify-end gap-3 sm:justify-end">
            <AlertDialogCancel className="h-12 flex-1 justify-center sm:w-[108px] sm:flex-none">{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction className="h-12 flex-1 justify-center bg-[#b72f34] text-white hover:bg-[#d54045] sm:w-[108px] sm:flex-none" onClick={() => void resetCurrentWorkingFile()}>{copy.confirmResetWorkingFile}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={Boolean(exportPreview)} onOpenChange={(open) => { if (!open) setExportPreview(null); }}>
        <AlertDialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-[rgba(228,81,59,0.56)] bg-[#24221d] text-[#f5f0e5]">
          <AlertDialogHeader>
            <AlertDialogTitle>{tr("匯出前預覽", "Export preview")}</AlertDialogTitle>
          </AlertDialogHeader>
          {exportPreview && <div className="overflow-hidden rounded-[5px] border border-[rgba(227,213,187,0.2)] bg-[#fffdf8]"><img className="block h-auto max-h-[58vh] w-full object-contain" src={exportPreview.url} alt={tr("匯出前預覽", "Export preview")} /></div>}
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel className="w-[108px] justify-center">{copy.cancel}</AlertDialogCancel>
            <AlertDialogAction className="w-[128px] justify-center bg-[#e4513b] text-white hover:bg-[#f16049]" onClick={downloadExportPreview}>{tr("確認匯出", "Export")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
