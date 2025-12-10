# 🚀 Start Backend Server

## The Issue
Your frontend is working perfectly! ✅ But the backend server isn't running, which is why you see:
- "System Maintenance: Server is temporarily unavailable"
- Response: 2345ms (timeout trying to connect)

## Solution: Start the Backend

### Step 1: Open a NEW Terminal Window
Keep your frontend terminal running, open a **NEW** terminal window.

### Step 2: Navigate to Backend Directory
```bash
cd C:\Users\KADZ-TECH\Documents\dev\it-support-system\backend
```

### Step 3: Install Dependencies (if not done)
```bash
npm install
```

### Step 4: Start the Backend Server
```bash
npm start
```

### Step 5: What You Should See
```
🚀 Bugema University IT Support System
📡 Server running on: http://localhost:5002
✅ Health check: http://localhost:5002/api/health
🔐 Auth routes: http://localhost:5002/api/auth
💾 Database: Connected ✅ (or Memory Mode 🔄)
```

### Step 6: Verify It's Working
1. Open browser: http://localhost:5002/api/health
2. You should see JSON response: `{"status":"OK",...}`
3. Go back to your frontend (http://localhost:3000)
4. The error message should disappear! ✅

## Quick Check Commands

**Check if backend is running:**
```bash
netstat -ano | findstr ":5002"
```

**Test backend health:**
Open browser: http://localhost:5002/api/health

## Troubleshooting

**Port 5002 already in use?**
- Close other applications using port 5002
- Or change PORT in backend/.env file

**MongoDB connection errors?**
- The server will still work in "Memory Mode"
- To use MongoDB: Start MongoDB service first

**Still seeing errors?**
- Make sure backend terminal shows "Server running on: http://localhost:5002"
- Check browser console (F12) for specific errors
- Verify both servers are running:
  - Frontend: http://localhost:3000 ✅
  - Backend: http://localhost:5002 ✅

