# 靜態 SEO 驗證紀錄

## 繁中入口

重新載入首頁後，實際文件標題維持為「AbiPaint 線上修圖神器｜圖片尺寸縮放・免費影像調色」，描述維持使用者設定的繁中內容，且 canonical 為 `https://abipaint.abiting.cc/`。React 應用程式載入後未再覆寫這些靜態 HTML 標籤。

## 英文入口路徑發現

直接開啟 `/en` 時，目前的開發伺服器會先回傳繁中根目錄入口 HTML；移除動態 Hook 後，這個路徑不再會自動修正為英文。下一步需使 `/en` 明確導向 `/en/` 的英文靜態入口，確保標題、描述、canonical 與 lang 都由英文 HTML 提供。

## 英文靜態入口

直接開啟 `/en/` 後，文件標題為「AbiPaint – Free Online Photo Editor | Resize, Draw & Color Adjust」，description 為英文內容，canonical 為 `https://abipaint.abiting.cc/en`，且 `lang` 為 `en`。這些值在 React 載入完成後仍維持不變。
