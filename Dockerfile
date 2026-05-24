FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./

RUN npm ci

COPY . .

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_WS_URL
ARG NEXT_PUBLIC_WEB_ORIGIN

ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_WEB_ORIGIN=$NEXT_PUBLIC_WEB_ORIGIN

RUN npm run build

FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

EXPOSE 8080

ENV PORT=8080
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
