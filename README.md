# PrintDrop 🖨️

A local Wi-Fi file relay and printing management system designed for campus print shops and copy centers. Students can quickly upload documents from their phones or laptops via QR code or direct link, while the shop owner manages print jobs in real-time from a dashboard.

---

## ✨ Features

- **📱 Instant Student Upload**: Scan a QR code or visit the local URL to upload files without needing WhatsApp, Bluetooth, or pen drives.
- **⚡ Real-Time Dashboard**: Live queue updates using Socket.IO as soon as new files are submitted.
- **🔢 Pickup Codes**: Unique short pickup codes generated for each upload so students can easily identify their prints.
- **🧹 Automatic Cleanup**: Scheduled background cleanup of uploaded files after a configurable TTL to save disk space and protect student privacy.
- **🔒 Secure & Local**: Runs entirely on your local network. No external third-party cloud required.
- **📊 Print Status Tracking**: Manage print jobs (`Pending`, `Printing`, `Completed`) with real-time status feedback.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Realtime**: Socket.IO
- **Database**: SQLite via `sql.js` (portable, serverless)
- **File Handling**: Multer
- **Security**: Helmet, bcryptjs, express-session

---

## 🚀 Quick Start

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16 or newer)
- npm

### 2. Installation
```bash
git clone https://github.com/Anand-coder-07/mini-project.git
cd mini-project
npm install
```

### 3. Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure your environment variables in `.env`:
```env
PORT=3000
SESSION_SECRET=your-random-secret-key
UPLOAD_TTL_MINUTES=30
BASE_URL=http://localhost:3000
```

### 4. Running the Server
```bash
# Production mode
npm start

# Development mode (with file watcher)
npm run dev
```

Visit the application:
- **Student Upload**: `http://localhost:3000/`
- **Shop Dashboard**: `http://localhost:3000/dashboard.html` (Default login: `admin` / `printshop123`)

---

## 🛡️ Privacy & Security

- Live databases (`*.db`), environment variables (`.env`), and uploaded files (`uploads/*`) are excluded from version control via `.gitignore`.
- Always set a custom `SESSION_SECRET` and change default credentials in production.

---

## 📄 License

This project is licensed under the MIT License.
