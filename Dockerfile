FROM node:lts

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

RUN mkdir -p uploads
RUN mkdir -p uploads/codes
RUN mkdir -p uploads/tmp

CMD ["node", "server.js"]
