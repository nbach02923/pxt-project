FROM node:18-bullseye-slim

WORKDIR /usr/src/app

COPY . .

RUN npm install

EXPOSE 3232

CMD ["npm", "run", "serve"]