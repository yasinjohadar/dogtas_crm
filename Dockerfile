# ---------- Stage 1: build React frontend ----------
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY dogtas-crm/package*.json ./
RUN npm ci
COPY dogtas-crm/ ./
RUN npm run build

# ---------- Stage 2: backend + built frontend ----------
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY salescrm_backend/package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY salescrm_backend/*.js ./
# Fresh frontend build replaces the old public folder
COPY --from=frontend /frontend/dist ./public

USER node
ENV PORT=3000
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "app.js"]
