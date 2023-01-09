FROM node:alpine


ENV APPNAME yoythtestserver
ADD . /usr/src/app

WORKDIR /usr/src/app

RUN npm install

ENV NODE_ENV production
EXPOSE $PORT
ENTRYPOINT ["npm", "start"]