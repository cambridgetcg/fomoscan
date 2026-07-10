FROM oven/bun:1-slim
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY bin ./bin
ENV PORT=8080
EXPOSE 8080
CMD ["bun", "run", "src/server.ts"]
