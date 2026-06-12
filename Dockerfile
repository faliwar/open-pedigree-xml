FROM docker.io/library/node:14

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --production=false && npm cache clean --force

COPY . .

RUN npm run build -- --display-error-details

RUN npm install -g serve@14

EXPOSE 9000

CMD ["serve", "-s", "dist", "-l", "9000"]