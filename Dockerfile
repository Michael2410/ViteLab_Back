# ============================================
# ViteLab-Back - Dockerfile
# Node.js + Express + TypeScript
# ============================================

# Stage 1: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar todas las dependencias (incluyendo devDependencies para compilar)
RUN npm ci

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# ============================================
# Stage 2: Production Dependencies
# ============================================
FROM node:20-alpine AS deps

WORKDIR /app

COPY package*.json ./

# Instalar solo dependencias de producción
RUN npm ci --omit=dev && npm cache clean --force

# ============================================
# Stage 3: Production
# ============================================
FROM node:20-alpine AS production

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copiar node_modules de producción desde deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copiar el build compilado desde el builder
COPY --from=builder /app/dist ./dist

# Copiar package.json (necesario para algunos módulos)
COPY package*.json ./

# Crear carpetas para uploads
RUN mkdir -p uploads/firmas uploads/logos whatsapp_auth && \
    chown -R nodejs:nodejs /app

# Cambiar al usuario no-root
USER nodejs

# Variables de entorno
ENV NODE_ENV=production
ENV PORT=3000

# Exponer puerto
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Comando para ejecutar
CMD ["node", "dist/server.js"]
