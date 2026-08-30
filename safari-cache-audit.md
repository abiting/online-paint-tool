# Safari 載入快取診斷

日期：2026-08-30

自訂正式網域 `https://abipaint.abiting.cc/` 由 GitHub Pages 回應（`server: GitHub.com`），首頁與雜湊 JavaScript 資產均使用 `Cache-Control: max-age=600`。這使 Safari 在發佈切換的短暫窗口可能保留指向舊雜湊資產的 HTML；若該資產已被新部署移除，應用程式便無法啟動。

修正策略：入口頁在「雜湊 `/assets/` 模組載入失敗」時，只以帶時間戳網址重新取得一次首頁，避免重複重新整理；同時保留手機工作檔還原安全模式，避免大型暫存資料重複套用。無 Service Worker 或 Workbox 註冊被發現。
