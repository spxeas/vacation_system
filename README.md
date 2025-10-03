# 員工排休管理 App

基於 Expo Router 的 React Native 應用程式，協助門市或餐飲單位的員工快速送出 30 天內的排休需求，並提供 Flask + MySQL 後端 API 儲存假期申請資料。

## 專案簡介
- 前端使用 Expo（React Native）開發，可透過 Expo Go、Android 模擬器或 iOS 模擬器進行預覽。
- 登入畫面提供 1~10 號員工帳號的快速驗證，成功登入後導向排休畫面。
- 排休畫面會根據 GMT+8 時區計算今日日期，限制本週與部分下週的可選日期，並即時提示送出結果。
- 後端以 Flask 建立 REST API，啟動時會自動建立資料表並匯入預設員工名單，可透過 `/vacation-requests` 端點寫入與查詢假單。

## 專案架構
- `app/index.tsx`：員工登入頁；驗證員工編號與預設密碼後導向排休頁。
- `app/vacation.tsx`：排休日期選擇頁；提供 30 日行事曆、時間區間設定，並串接 Flask API 送出排休申請。
- `app/_layout.tsx`：Expo Router 堆疊導覽設定。
- `constants/config.ts`：前端 API 基底網址與路由常數（預設指向 `http://127.0.0.1:5000`，可透過環境變數覆寫或指向 ngrok URL）。
- `lib/orderingApi.ts`：封裝通用 `fetch` 輔助函式，可作為串接 Flask API 的範本。
- `server/app.py`：Flask 主程式，提供健康檢查、員工清單與假單 CRUD API。
- `order_db/`：MySQL 連線與 schema 初始程式，啟動時建立資料表並載入預設員工資料（`vacation` 表以 `employee_id + vacation_date` 為主鍵）。
- `server/run_flask.ps1`：Windows 方便啟動腳本，可自動啟用 `.venv`、選擇性安裝依賴並啟動 Flask。
- `scripts/reset-project.js`：Expo 範本提供的重置腳本，如無需求可忽略或刪除。

## 環境需求
- Node.js 18 或以上版本、npm 9+（建議使用 `nvm` 或 `fnm` 管理版本）。
- Expo CLI（透過 `npx expo start` 自動呼叫即可，不需全域安裝）。
- Python 3.10+（執行 Flask 伺服器）。
- MySQL 8（或相容的 MariaDB）並可從本機連線存取。

## 安裝與啟動
### 1. 安裝前端依賴
```bash
npm install
```

### 2. 啟動 Expo 開發伺服器
```bash
npx expo start
```
> 可依需求選擇 `i`（iOS 模擬器）、`a`（Android 模擬器）或掃描 QR Code 於實機預覽。

### 3. 設定並啟動 Flask 後端
```bash
cd server
python -m venv .venv                 # 已建立可略過
source .venv/bin/activate            # Windows 請改用 .venv\\Scripts\\Activate.ps1
pip install flask mysql-connector-python
python -m order_db.db_connection     # 選擇性：若要預先建立資料庫與表
flask --app app run --host 0.0.0.0 --port 5000
```
> 後端啟動時會自動建立 `vacation` 資料庫（若不存在）以及 `employees`、`vacation` 兩張表。

> Windows 使用者可使用 `server/run_flask.ps1`：
> ```powershell
> cd .\server
> .\run_flask.ps1              # 預設啟動於 0.0.0.0:5000
> .\run_flask.ps1 -InstallDeps  # 需要時順便安裝依賴
> ```

### 4. 串接前後端
- 將 Expo 專案根目錄下的 `.env` 或環境變數 `EXPO_PUBLIC_API_URL` 設為後端可存取的網址（預設 `http://127.0.0.1:5000`）。
- 重新啟動 Expo 伺服器，`constants/config.ts` 會自動根據變數產生 API 路徑。
- 目前 `app/vacation.tsx` 的送出按鈕已直接呼叫 `POST /vacation-requests`，請確認前端可連線到後端再進行測試。

## 預設帳號與密碼
- 員工編號為 1~10，密碼為對應數字重覆四次，例如 `1 → 1111`、`2 → 2222`，10 號員工密碼固定為 `1010`。
- 成功登入後可選擇未來 30 天的休假日；若於本週六前尚未設定下週假期，系統將限制該週的日期選擇並顯示提示訊息。

## API 端點速覽（Flask）
- `GET /health`：健康檢查。
- `GET /employees`：取得員工名單。
- `GET /vacation-requests?employee_id=<id>`：查詢假單，可帶員工編號篩選；回傳的每筆資料都含 `start_time`、`end_time`。
- `POST /vacation-requests`：送出假單，JSON 需包含 `employee_id` 與 `dates` 陣列；陣列元素可為
  - 物件：`{ "date": "2024-05-10", "start_time": "09:00", "end_time": "18:00" }`
  - 或單純日期字串，後端會自動套用預設 `09:00-18:00`。
- 回傳物件 `requests` 會列出每筆成功寫入的假單（含 `start_time`、`end_time`、`submitted_at`）。

### 送出休假申請範例

```bash
curl -X POST "$EXPO_PUBLIC_API_URL/vacation-requests" \
  -H "Content-Type: application/json" \
  -d '{
        "employee_id": 1,
        "dates": [
          { "date": "2024-09-29", "start_time": "10:00", "end_time": "15:00" },
          "2024-10-02"
        ]
      }'
```

> 當元素為字串時會自動套用預設 `09:00-18:00`。

## 常用指令
- `npm run start`：啟動 Expo。
- `npm run android` / `npm run ios` / `npm run web`：以指定目標平台啟動。
- `npm run lint`：使用 Expo 預設 ESLint 規則進行靜態檢查。
- `python -m order_db.db_connection`：在 `.venv` 下執行可重建 schema，若資料庫不存在會自動建立後插入預設員工。
- `.\run_flask.ps1 -InstallDeps`：Windows 下一鍵啟動 Flask，必要時順便安裝依賴。

## 對外測試方式
- **ngrok**：本機啟動 Flask 後執行 `ngrok http 5000`，取得公開網址後把 `EXPO_PUBLIC_API_URL` 設為該 URL（HTTPS）。免費版網址每次啟動會變，建議更新 `.env` 或 `constants/config.ts`。
- **Expo Publish**：登入 Expo 帳號後執行 `npx expo publish`，即可在 Expo Go App 中透過網頁連結或 QR Code 分享最新前端程式碼。
- **Web 預覽**：執行 `npx expo export --platform web` 後可用 `npx serve dist` 預覽，記得於預覽環境設定 `EXPO_PUBLIC_API_URL`（或更新 `constants/config.ts`）指向 ngrok／後端公開網址，才能寫入休假資料。
- **Nginx 部署靜態網站**：先執行 `npx expo export --platform web` 產生 `dist/`，將其放到 Nginx 主機並在 `nginx.conf` 的 `server` block 指向該路徑，例如：
  ```
  server {
      listen 80;
      server_name localhost;
      root  C:/Users/<使用者>/Documents/learning_App/dist;  # Windows 範例
      index index.html;
      location / {
          try_files $uri $uri/ /index.html;
      }
  }
  ```
  驗證設定（`nginx -t`）並重載後，瀏覽 `http://<主機 IP 或網域>/` 即可存取 web 版；若要對外服務，請開放 80/443 埠並配置 HTTPS。
- **正式部署**：若要長期對外提供服務，建議使用 Gunicorn/Uvicorn + Nginx 或雲端平台，並加上 HTTPS、驗證與防火牆設定。

## 後續開發建議
- 將員工登入流程改為呼叫後端驗證，或整合 OAuth / AD 等實際機制。
- 引入狀態管理（例如 Zustand、Redux Toolkit）以管理登入狀態與排休紀錄。
- 補強單元測試與端對端測試，確保日期規則與 API 串接行為正確。
- 可在排休頁面新增「已申請列表」，或提供編輯與取消功能，強化申請體驗。
