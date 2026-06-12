FROM docker.io/library/node:18

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --production=false && npm cache clean --force

COPY . .

RUN npm run build -- --display-error-details

# Copy static files into dist/ so serve can find them
RUN cp index.html dist/ && cp -r public dist/

RUN npm install -g serve@14

EXPOSE 9000

CMD ["serve", "-s", "dist", "-l", "9000"]