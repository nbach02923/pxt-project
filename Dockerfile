FROM node:18-bullseye-slim

WORKDIR /usr/src/app

COPY pxt /usr/src/app/pxt
COPY pxt-common-packages /usr/src/app/pxt-common-packages
COPY pxt-arcade /usr/src/app/pxt-arcade

WORKDIR /usr/src/app/pxt
RUN npm install && npm run build

WORKDIR /usr/src/app/pxt-common-packages
RUN npm install && npm link ../pxt

WORKDIR /usr/src/app/pxt-arcade
RUN npm install && npm link ../pxt && npm link ../pxt-common-packages

WORKDIR /usr/src/app/

EXPOSE 3232

CMD ["pxt", "serve", "--rebundle"]