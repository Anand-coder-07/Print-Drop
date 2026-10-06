# PrintDrop

PrintDrop is a simple file-upload system for local print shops.

Students scan a shop's QR code, upload their documents, and receive a pickup
code. The shop owner sees the order in a dashboard, downloads or previews the
files, and marks the order as completed.

## What the project does

- Public landing page at `/`
- Shop owner signup and login
- Separate upload link for every shop
- QR code for each shop's upload link
- Uploads for PDF, JPG, and PNG files
- Upload limit between 50 MB and 100 MB per file
- Chunked uploads for larger files
- Private Google Drive storage
- MongoDB storage for shops, users, orders, and file information
- Owner dashboard with order status and file actions
- Automatic cleanup of old files
- Password confirmation before deleting an owner account
- Sitemap, robots file, favicon, and search metadata

## How the flow works

1. A shop owner creates an account.
2. PrintDrop creates a shop slug and a shop-specific upload URL.
3. The owner shares the QR code or upload URL with students.
4. A student selects files and sends them without creating an account.
5. The browser sends large files in small chunks through the server.
6. The server uploads those chunks to a private Google Drive file.
7. PrintDrop saves the order and file details in MongoDB.
8. The owner sees the order in the dashboard and prints the files.
9. The owner marks the order complete or deletes it.
10. Old files are removed after the configured time limit.

## Tech stack

- **Node.js and Express** - web server and API routes
- **MongoDB and Mongoose** - database and data models
- **Google Drive API** - private file storage
- **Multer** - handling upload data
- **JWT in an HTTP-only cookie** - owner authentication
- **bcryptjs** - password hashing
- **Helmet** - basic security headers
- **QRCode** - shop QR code generation
- **HTML, CSS, and JavaScript** - frontend pages
- **Vercel** - supported deployment platform

## Project structure

```text
server.js              Express app and public routes
db.js                  MongoDB connection and models
routes/                Authentication, upload, shop, and dashboard APIs
middleware/auth.js     JWT authentication middleware
utils/googleDrive.js   Google Drive upload and file operations
utils/cleanup.js       Cleanup of expired uploads
public/                HTML pages, styles, scripts, logo, and manifest
.env.example           Environment variable template
vercel.json            Vercel serverless configuration
```

## Run locally

### Requirements

- Node.js 18 or newer
- npm
- MongoDB database
- Google Drive OAuth credentials

### Install

```bash
git clone https://github.com/Anand-coder-07/Print-Drop.git
cd Print-Drop
npm install
```

Create a local environment file:

```bash
copy .env.example .env
```

On macOS or Linux, use:

```bash
cp .env.example .env
```

Add the required values to `.env`, then start the app:

```bash
npm run dev
```

For a normal start without the file watcher:

```bash
npm start
```

The app will be available at `http://localhost:3000`.

## Important environment variables

```env
PORT=3000
NODE_ENV=development
SESSION_SECRET=use-a-long-random-secret
MONGODB_URI=your-mongodb-connection-string

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost
GOOGLE_REFRESH_TOKEN=your-google-refresh-token
GOOGLE_DRIVE_FOLDER_ID=

BASE_URL=http://localhost:3000
UPLOAD_TTL_MINUTES=30
MAX_UPLOAD_FILES=10
MAX_FILE_SIZE_MB=80
MAX_REQUEST_SIZE_MB=100
```

`MAX_FILE_SIZE_MB` is kept between 50 MB and 100 MB by the server. The default
is 80 MB. Never commit `.env`, OAuth secrets, refresh tokens, or database files.

## Main URLs

| URL | Purpose |
| --- | --- |
| `/` | Public landing page |
| `/owner.html` | Shop owner signup and login |
| `/login.html` | Shop owner login |
| `/dashboard.html` | Owner dashboard after login |
| `/s/<shop-slug>` | Student upload page for one shop |
| `/api/shops/<shop-slug>/qr.png` | QR code for a shop |
| `/robots.txt` | Search crawler rules |
| `/sitemap.xml` | Public sitemap |

The sitemap contains the public landing page only. Login, dashboard, owner
pages, and shop upload pages are marked `noindex` because they are not useful
search results and may contain private information.

## Google Drive setup

1. Create or select a project in Google Cloud Console.
2. Enable the Google Drive API.
3. Configure the OAuth consent screen.
4. Add your Google account as a test user while the app is in testing mode.
5. Create an OAuth web application client.
6. Add the exact value of `GOOGLE_REDIRECT_URI` as an authorized redirect URI.
7. Generate a refresh token with Drive access.
8. Put the client details and refresh token in `.env`.
9. Optionally create a Drive folder and set `GOOGLE_DRIVE_FOLDER_ID`.

Uploaded files remain private in Drive. The app streams them through
authenticated dashboard endpoints instead of making them public.

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Add the environment variables from `.env.example` in Vercel project settings.
4. Set `NODE_ENV=production`.
5. Set `BASE_URL` to the exact HTTPS URL of the deployed app.
6. Deploy and test the landing page, owner login, upload page, and dashboard.

The `vercel.json` file tells Vercel to run `server.js` as the serverless
application entry point.

## Google Search Console

After deployment:

1. Open `/robots.txt` and `/sitemap.xml` on the production domain.
2. Add the domain to Google Search Console.
3. Complete Google's DNS or HTML verification.
4. Submit the following sitemap:

```text
https://your-domain.com/sitemap.xml
```

The public logo is available at `/brand.svg` and is used for the favicon and
social preview metadata. Search engines may take some time to index the site.

## Security notes

- Use a strong, random `SESSION_SECRET` in production.
- Keep MongoDB, Google OAuth, and refresh-token values private.
- Do not make the Google Drive folder public.
- Use HTTPS in production.
- Review upload limits before changing them.
- The `.gitignore` file excludes environment files, local databases, uploads,
  logs, and generated QR files.

## License

This project is licensed under the MIT License.
