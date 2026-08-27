# 瀏覽器端去背模型研究紀錄

更新日期：2026-08-27

## 已排除方案

`@imgly/background-removal` 可在瀏覽器執行，但專案採 AGPL-3.0；在未確認 AbiPaint 的授權相容性前，不納入公開網站。

來源：[IMG.LY Background Removal JS](https://github.com/imgly/background-removal-js)

## 可驗證替代方案

IS-Net general-use 是 DIS 專案為一般用途釋出的高精度二值分割模型。上游 DIS 專案採 Apache-2.0 授權，模型包含一般用途版本；公開 ONNX 轉換亦標示 Apache-2.0。

量化的 `isnet-general-use-q8.onnx` 可用於瀏覽器 WASM，文件標示大小為 44,436,071 bytes，輸入為 `1 × 3 × 1024 × 1024`，正規化方式為 `(pixel - 128) / 256`，輸出為 `0..1` 顯著性遮罩。此模型比目前 U²-NetP 的 320 × 320 推論解析度高，但只應在使用者點擊去背時按需下載；需驗證手機記憶體與首次下載時間。

來源：[DIS 官方專案](https://github.com/xuebinqin/DIS)、[IS-Net general-use ONNX 模型卡](https://huggingface.co/SacredNoir/isnet-general-use-onnx)、[上游 ONNX 匯出](https://huggingface.co/x-Liola-x/isnet-general-use-onnx)

## 人像專用備選

MODNet 是 Apache-2.0 的 RGB-only 即時人像 matting 模型，適合人像髮絲與透明邊緣，但不適合作為 Logo、圖示與一般物件的唯一模型。若 IS-Net 一般模式完成後仍需改善頭像邊緣，可再以人像模式作為選用功能。

來源：[MODNet 官方專案](https://github.com/ZHKKKe/MODNet)

## 瀏覽器端探針

2026-08-27 已確認量化 IS-Net 的公開模型網址會回傳可跨網域讀取的最終下載端點，且檔案大小約 44 MB。瀏覽器探針已在初次下載後成功完成一次 1024 × 1024 WASM 推論：輸入名稱為 `input`，輸出包含 `output`，其遮罩張量形狀為 `1 × 1 × 1024 × 1024`。後續整合仍需保留明確的下載／處理進度與可回退錯誤訊息。

同日從 `https://abipaint.abiting.cc/` 公開網域測試，直接 `fetch` 該模型可取得 `200` 與 `cors` 回應；以 ONNX Runtime Web 1.27.0 建立 `wasm` session 也成功，模型輸入為 `input`，輸出清單含 `output`。因此使用者截圖中的 `Failed to fetch` 較可能是短暫 CDN／網路下載中斷，而非固定的公開網域 CORS 阻擋。正式流程需要在 session 建立失敗時重試一次，並提供恢復原先已載入模型的回退。

ONNX Runtime Web 官方文件指出，WASM 支援所有 ONNX operator；模型檔大時可用 IndexedDB 快取，並可視需求調整 execution provider 或以 worker 避免主執行緒阻塞。IS-Net 目前的 1024 × 1024 WASM 推論與大尺寸遮罩合成會佔用主執行緒，應將預處理、推論與遮罩合成移至專用 Web Worker；主畫面僅接收輸出 PNG／遮罩，避免處理期間拖慢畫布。

來源：[ONNX Runtime Web 部署指南](https://onnxruntime.ai/docs/tutorials/web/deploy.html)、[ONNX Runtime Web 教學](https://onnxruntime.ai/docs/tutorials/web/)

公開頁面的 Chromium 環境雖存在 `navigator.gpu`，但實測無法取得 WebGPU adapter，不能把 GPU 作為可靠的預設效能方案。去背效能改善需以 WASM 及 Web Worker 為基準，並只在 adapter 真正可用時再選擇 WebGPU。

2026-08-27 另從公開 AbiPaint 網域以 `ort.env.wasm.proxy = true` 實測量化 IS-Net：模型 session 可建立，且成功完成一次 `1 × 3 × 1024 × 1024` 輸入與 `1 × 1 × 1024 × 1024` 輸出推論。此設定可讓 ONNX Runtime 將 WASM 工作移出畫布主執行緒，是降低處理中工作台卡頓的安全預設。
