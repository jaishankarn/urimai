# Build the React app
FROM node:24-slim AS web
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Build the voice form widget (one script file, no runtime dependencies)
FROM node:24-slim AS widget
WORKDIR /widget
COPY widget/package.json widget/package-lock.json ./
RUN npm ci
COPY widget/ ./
RUN npm run build

# FastAPI serves the API, the built app, the widget and the practice portal
FROM python:3.11-slim
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/app ./app
COPY --from=web /frontend/dist ./static
COPY --from=widget /widget/dist/widget.js ./widget_dist/v1/widget.js
USER nobody
EXPOSE 3000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "3000"]
