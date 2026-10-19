FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client python3 ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g pnpm@11.25.0 @openai/codex@0.163.0 @anthropic-ai/claude-code@2.1.302
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV CLINIC_CONTAINER=1 CLINIC_DATA_DIR=/home/node/.sdd-clinic HOME=/home/node
RUN mkdir -p /home/node/.sdd-clinic /home/node/.codex /home/node/.claude && chown -R node:node /home/node
USER node
EXPOSE 4310
CMD ["node", "dist/server/cli.js", "start", "--no-open"]
