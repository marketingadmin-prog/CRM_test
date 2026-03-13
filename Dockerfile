# Dockerfile — สร้าง Docker image สำหรับ CRM App
# Multi-stage: ใช้ Node.js Alpine เพื่อให้ image เล็ก

FROM node:20-alpine

# ตั้ง working directory ภายใน container
WORKDIR /app

# copy package files ก่อน เพื่อ cache npm install layer
COPY package*.json ./

# ติดตั้ง dependencies (production only)
RUN npm install --omit=dev

# copy source code ทั้งหมด
COPY . .

# expose port (ตรงกับ process.env.PORT)
EXPOSE 3000

# รัน server
CMD ["node", "server.js"]
