Finance Tracker service

Overview
- Node.js + Express API to manage personal budgets.
- Uses MongoDB (Mongoose) and `express-session` with `connect-mongo` for session storage.

Quick start (docker-compose)

```bash
cd services/finance_tracker
docker-compose up --build
```

API highlights
- POST `/api/auth/register` {username,email,password}
- POST `/api/auth/login` {username,password}
- POST `/api/auth/logout`
- GET `/api/auth/me`
- CRUD `/api/budgets` (requires session)

Data model (budgets)
- `name`, `targetAmount`, `currentAmount`, `currency`, `category`, `recurrence`,
  `startDate`, `endDate`, `notes`, `recommendedAllocation`, `owner` (user id)
