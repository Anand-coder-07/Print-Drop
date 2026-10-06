# PrintDrop 🖨️

A local Wi-Fi file relay and printing management system designed for campus print shops and copy centers. Students can quickly upload documents from their phones or laptops via QR code or direct link, while the shop owner manages print jobs in real-time from a dashboard.

---

## ✨ Features

- **📱 Instant Student Upload**: Scan a QR code or visit the local URL to upload files without needing WhatsApp, Bluetooth, or pen drives.
- **⚡ Dashboard polling**: The queue refreshes every five seconds (compatible with serverless hosting).
- **🔢 Pickup Codes**: Unique short pickup codes generated for each upload so students can easily identify their prints.
- **🧹 Automatic Cleanup**: Scheduled background cleanup of uploaded files after a configurable TTL to save disk space and protect student privacy.
- **🔒 Secure cloud deployment**: MongoDB Atlas stores metadata and private Google Drive stores file assets.
- **📊 Print Status Tracking**: Manage print jobs (`Pending`, `Printing`, `Completed`) with real-time status feedback.

---

## 🛠️ Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB Atlas via Mongoose
- **File Handling**: Multer memory uploads and Google Drive OAuth2
- **Security**: Helmet, bcryptjs, signed JWT httpOnly cookies

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
SESSION_SECRET=your-random-secret-key-at-least-32-characters
NODE_ENV=production
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/printdrop
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
GOOGLE_REDIRECT_URI=http://localhost
GOOGLE_REFRESH_TOKEN=your-oauth-refresh-token
GOOGLE_DRIVE_FOLDER_ID=
UPLOAD_TTL_MINUTES=30
BASE_URL=http://localhost:3000
MAX_UPLOAD_FILES=10
# MAX_FILE_SIZE_MB accepts 50-100; defaults to 80 when omitted
MAX_FILE_SIZE_MB=80
MAX_REQUEST_SIZE_MB=100
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
- **Shop-specific upload**: `http://localhost:3000/s/<shop-id>` (each shop has an isolated queue and QR code)
- **Shop Dashboard**: `http://localhost:3000/dashboard.html` (create an owner account from `/owner.html`)
- **Shop login**: use `http://localhost:3000/login.html?shop=<shop-id>` for a specific shop owner.

The first shop is created from `DEFAULT_SHOP_SLUG` and `DEFAULT_SHOP_NAME` (or `default` and
`PrintDrop`). New shop owners create their isolated shop and account from the Sign up tab on
`/owner.html`. Each shop uses `/s/<shop-id>` and has its own QR code at
`/api/shops/<shop-id>/qr.png`.
After signup, the shop QR code downloads automatically as a PNG file for printing; the success page
also provides a backup download link.

### Deploy to Vercel
1. Create a MongoDB Atlas cluster and allow Vercel's outbound access (or use `0.0.0.0/0` with a strong database user).
2. Create a Google Cloud OAuth client and obtain a Drive refresh token (steps below).
3. Import this repository into Vercel. Add every variable from `.env.example` in Project Settings
   (use a random `SESSION_SECRET` of at least 32 characters), then deploy. `vercel.json` exports
   `server.js` as the serverless handler.
4. Set `BASE_URL` to the deployed HTTPS URL so generated QR codes point to the right shop.

Uploaded files are streamed to Google Drive as private files and deleted there by Drive file ID when printed, deleted, when an account
is removed, or during opportunistic cleanup on incoming requests. For low-traffic deployments,
schedule regular traffic (or add a separately protected Vercel Cron endpoint) if strict TTL timing
is required.

### Google Drive OAuth setup
1. In [Google Cloud Console](https://console.cloud.google.com/), create/select a project,
   enable **Google Drive API**, configure the OAuth consent screen, and add your account as a
   test user while the app is in Testing.
2. Create an OAuth **Web application** client and add the exact `GOOGLE_REDIRECT_URI`
   (for local setup, `http://localhost`) as an authorized redirect URI.
3. Generate an authorization URL with scope
   `https://www.googleapis.com/auth/drive`, authorize it as the Drive account that should own
   uploads, and exchange the returned code for tokens using the same client. Store the returned
   `refresh_token` as `GOOGLE_REFRESH_TOKEN`; never expose it to the browser. Google's OAuth
   Playground can perform this exchange when configured with your client credentials.
4. Optionally create a Drive folder and put its ID in `GOOGLE_DRIVE_FOLDER_ID`. Do not change
   sharing: files are private by default and the app uses authenticated Drive links.

---

## 🛡️ Privacy & Security

- Live databases (`*.db`), environment variables (`.env`), and uploaded files (`uploads/*`) are excluded from version control via `.gitignore`.
- Always set a custom `SESSION_SECRET` and change default credentials in production.

---

## 📄 License

This project is licensed under the MIT License.
