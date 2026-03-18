# Daylog — Suivi du temps par tâche

## Projet
Application React 19 + Vite 5. Pas de backend — tout l'état est persisté en localStorage.
GitHub : https://github.com/yousmaaza/daylog

## Commandes
`npm run dev` — serveur de dev sur http://localhost:5173
`npm run build` — build de production

## Architecture
- Fichier principal : `src/App.jsx` (toute la logique + composants)
- `src/App.css` / `src/index.css` — tous les styles
- Tâches stockées sous la forme `{ [dateKey]: Task[] }` en localStorage
- Chaque tâche a un tableau `sessions: [{ id, startTime, endTime }]`

## Comportements clés
- `startTask()` : la nouvelle session démarre à `latestEnd` (dernière `endTime` de toutes les sessions du jour), ou à `now` si c'est la première tâche du jour
- Les tâches se chaînent automatiquement — aucun écart de temps entre les sessions
- `HOUR_H = 64` px par heure sur la timeline
