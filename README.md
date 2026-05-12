# Cinema

A modern, feature-rich desktop media center built with React, TypeScript, Electron, and Tailwind CSS. Cinema lets you browse, organize, and play your local and online movies and TV series, with smart recommendations, beautiful UI, and deep integration with VLC for playback.

## Features

- **Unified Media Library:** Organize and browse both local and online movies and TV series in one place.
- **Smart Recommendations:** Personalized suggestions based on your watch history and genre preferences.
- **Trailer & Preview Playback:** Watch trailers inline or pop them out, with robust error handling and Electron integration.
- **VLC Integration:** Uses VLC for reliable, high-quality playback of all major video formats.
- **Offline Support:** Browse and play your local library even when offline.

## Getting started

### 1. Clone the repository

```bash
git clone https://github.com/Benjaminax/cinema.git
cd cinema
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables (if applicable)

If you use TMDB or other APIs, copy `.env.example` to `.env` and fill in real values.

```bash
cp .env.example .env
```

If you are on Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Required variables in `.env`:

```env
TMDB_API_KEY=your-tmdb-api-key
```

### 4. Run the application

```bash
npm run dev
```

### 5. Build for production

```bash
npm run build
```

## API endpoints (if applicable)

- `GET /api/tmdb/movie/:id` -> Fetch movie details from TMDB
- `GET /api/tmdb/series/:id` -> Fetch series details from TMDB

**Request body example:**

```json
{
  "id": 12345
}
```

## Dependencies

- **React:** UI library for building interactive interfaces
- **TypeScript:** Type-safe JavaScript for scalable development
- **Electron:** Desktop app shell for cross-platform support
- **Vite:** Fast build tool and dev server
- **Tailwind CSS:** Utility-first CSS framework for rapid UI development
- **VLC:** External player for robust media playback

## Project structure

```
cinema/
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── contexts/
│   ├── utils/
│   ├── App.tsx
│   └── main.tsx
├── public/
├── electron/
├── dist-electron/
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── README.md
```


## Screenshots

<p align="center">
  <img src="./src/screenshots/Screenshot%202026-05-12%20201419.png" alt="Home" width="600" />
  <br/>
  <img src="./src/screenshots/Screenshot%202026-05-12%20201428.png" alt="Details Modal" width="600" />
  <br/>
  <img src="./src/screenshots/Screenshot%202026-05-12%20201439.png" alt="Player" width="600" />
  <br/>
  <img src="./src/screenshots/Screenshot%202026-05-12%20201500.png" alt="Library" width="600" />
</p>

## Socials

If you have any questions, you can reach me here:

- **Instagram:** [@_.benjamin.a._](https://www.instagram.com/_.benjamin.a._/)
- **GitHub:** [Benjaminax](https://github.com/Benjaminax/)
- **Email:** kojoben29@gmail.com

In God we trust
