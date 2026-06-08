# TAHAP 1: Merakit React (Build)
FROM node:18-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build

# TAHAP 2: Memasukkan ke Nginx
FROM nginx:alpine
# Ambil hasil rakitan dari Tahap 1
COPY --from=build /app/build /usr/share/nginx/html
# Masukkan aturan Nginx yang tadi kita buat
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]