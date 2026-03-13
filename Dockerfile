# Dockerfile — Railway-ready CRM App
FROM node:20-alpine

# Railway inject PORT อัตโนมัติ ต้องรับค่าให้ได้
ENV PORT=3000

WORKDIR /app

# copy package files ก่อน → cache npm install layer
COPY package*.json ./

# ติดตั้ง production dependencies เท่านั้น
RUN npm install --omit=dev

# copy source code ทั้งหมด (node_modules ถูก exclude ใน .dockerignore)
COPY . .

# Railway จะ override PORT เอง — EXPOSE เป็นแค่ documentation
EXPOSE 3000

# ใช้ npm start → เรียก "node server.js" ตาม package.json
CMD ["npm", "start"]
