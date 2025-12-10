# How to Start the IT Support System

## Quick Start Guide

### 1. Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

### 2. Start MongoDB (if not running)

**Windows:**
```bash
net start MongoDB
```

**Mac/Linux:**
```bash
brew services start mongodb-community
# or
sudo systemctl start mongod
```

### 3. Start Backend Server

```bash
cd backend
npm start
# or for development with auto-reload:
npm run dev
```

The backend will start on **http://localhost:5002**

### 4. Start Frontend Development Server

**Open a NEW terminal window** and run:

```bash
cd frontend
npm start
```

The frontend will start on **http://localhost:3000** and should automatically open in your browser.

## Troubleshooting

### App Not Showing in Browser?

1. **Check if frontend server is running:**
   - Look for "Compiled successfully!" message
   - Check terminal for any errors

2. **Check browser console:**
   - Press F12 to open developer tools
   - Look for JavaScript errors in the Console tab

3. **Verify ports are available:**
   - Backend: Port 5002
   - Frontend: Port 3000
   - If ports are in use, you'll see an error

4. **Clear browser cache:**
   - Press Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac) to hard refresh

5. **Check if dependencies are installed:**
   ```bash
   cd frontend
   npm install
   ```

### Common Issues

**"Module not found" errors:**
- Run `npm install` in both frontend and backend directories

**"Cannot connect to backend" errors:**
- Make sure backend server is running on port 5002
- Check `http://localhost:5002/api/health` in browser

**"Port already in use" errors:**
- Close other applications using ports 3000 or 5002
- Or change ports in package.json scripts

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
PORT=5002
MONGODB_URI=mongodb://localhost:27017/it_support_system
JWT_SECRET=your-super-secure-jwt-secret-key-change-this-in-production
JWT_REFRESH_SECRET=your-refresh-token-secret-change-this
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

## Expected Behavior

1. Backend starts and shows: "Server running on: http://localhost:5002"
2. Frontend starts and automatically opens browser to http://localhost:3000
3. You should see the login page
4. You can register a new account or login

## Still Having Issues?

1. Check both terminal windows for error messages
2. Check browser console (F12) for JavaScript errors
3. Verify MongoDB is running (if using database features)
4. Make sure all dependencies are installed: `npm install` in both directories

