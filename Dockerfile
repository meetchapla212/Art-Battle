FROM node:8.11.1-alpine as builder

WORKDIR /app
COPY . /app

RUN apk add --update g++ make python && npm i && npm run build