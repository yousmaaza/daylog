# Daylog — Task Time Tracker

A minimalist daily task tracker with a visual timeline. Track time spent on tasks throughout your day.

## Features

- Add tasks and track time with start/pause/done controls
- Visual timeline showing sessions across the day
- Tasks chain automatically — each new session starts where the last one ended
- Weekly calendar navigation
- Daily overview with total tracked time and task status

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

### Build for Production

```bash
npm run build
npm run preview
```

## Tech Stack

- React 19
- Vite 5
- LocalStorage for persistence (no backend needed)
