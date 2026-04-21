FROM node:20-alpine AS claude-install
RUN npm install -g @anthropic-ai/claude-code

FROM alpine:3.20
RUN apk add --no-cache \
    tini \
    bash \
    git \
    python3 \
    py3-pip \
    nodejs \
    npm \
    openssh-client \
    ttyd

COPY --from=claude-install /usr/local/lib/node_modules/@anthropic-ai/claude-code /opt/claude-code
RUN ln -s /opt/claude-code/bin/claude /usr/local/bin/claude

WORKDIR /users_datas

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["ttyd", "-p", "7681", "-W", "bash"]
