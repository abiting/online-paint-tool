# 正式站資產與分析端點檢查

檢查日期：2026-08-30

## 實測結果

正式站 `https://painttool-uwbnkjhm.manus.space/` 載入的分析腳本為 `https://manus-analytics.com/umami`，並未出現字面上的 `%VITE_ANALYTICS_ENDPOINT%`。因此，原始 `client/index.html` 中的 `%VITE_ANALYTICS_ENDPOINT%` 是建置模板記號；在正式輸出中已正確替換。

進一步檢查確認，正式站的腳本已帶入網站識別碼 `30fbc44d-3998-46e8-a401-f2fd1e106b4e`，且頁面實際發出 `https://manus-analytics.com/api/send` 請求。沒有任何資源 URL 含未替換的 `%VITE_ANALYTICS_ENDPOINT%`。若先前觀察到 400，應另查該次請求的伺服器回應，而非將原始 HTML 模板記號視為正式站未替換。

主控台複核未見 Umami 的 400 錯誤；唯一命中的失敗資源仍是失效的背景材質 URL。

正式站確實嘗試請求下列不存在的背景材質，並得到失敗資源紀錄：

`https://painttool-uwbnkjhm.manus.space/manus-storage/workbench-paper-texture_df8fcf94.png`

目前 `.canvas-viewport` 的背景已回退為格線與漸層，功能不受影響，但應移除失效的背景材質 URL，以消除每次載入的 404。
