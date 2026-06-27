# ViewPhotoMiniServer — Raspberry Pi / CasaOS (arm64 and amd64).
# bookworm-slim + libheif for iPhone HEIC via sharp.

FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends libvips42 libheif1 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p /photos /thumbnails /trash /data

ENV NODE_ENV=production
ENV TZ=Europe/Rome
ENV PORT=3001
ENV PHOTOS_DIR=/photos
ENV THUMBNAILS_DIR=/thumbnails
ENV TRASH_DIR=/trash
ENV DATA_DIR=/data

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:3001/api/health',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

CMD ["npm", "start"]
