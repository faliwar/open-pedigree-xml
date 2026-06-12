FROM docker.io/library/node:14

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install && npm cache clean --force

COPY . .

# Roda o build usando o script que acabamos de consertar no package.json
RUN npm run build

# Instala o servidor leve
RUN npm install -g serve@14

EXPOSE 9000

# Executa o servidor leve consumindo quase 0 de RAM
CMD ["serve", "-s", "dist", "-l", "9000"]