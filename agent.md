## 專案快速備忘

- **架構**：Expo Router (React Native) 前端 + Flask + MySQL 後端。核心排休頁面在 `app/vacation.tsx`，後端 API 在 `server/app.py`。
- **關鍵流程**：前端送出假單會呼叫 `POST /vacation-requests`，payload 需帶 `employee_id` 與日期陣列（元素可含 `start_time`、`end_time`）。後端會把資料寫入 `vacation_requests` 表。
- **資料庫**：`order_db/db_connection.py` 會建立 `employees`、`vacation_requests`。現行種子只插入員工資料，不會自動塞假單。需要初始 schema 時執行 `python -m order_db.db_connection`。
- **環境變數**：前端透過 `EXPO_PUBLIC_API_URL` 指定後端位址；預設 `http://127.0.0.1:5000`。後端使用 `MYSQL_*` 變數設定連線資訊。
- **常用指令**：
  - `npm install` / `npx expo start` 啟動前端。
  - `python -m venv .venv && source .venv/bin/activate`、`pip install flask mysql-connector-python`、`flask run` 啟動後端（Windows 改用對應啟動方式）。
  - `python -m order_db.db_connection` 重新套用 schema 與員工資料。
- **Lint / 測試**：`npm run lint` 使用 Expo 預設 ESLint。若無法連線 npm registry（沙箱或離線），需在可連網環境重跑以確保依賴完整。
- **提醒**：`lib/orderingApi.ts` 集中所有 API 呼叫；新增端點時同步更新 `constants/config.ts`。排休送出按鈕會在成功後清空所選日期並顯示後端回傳資訊。
