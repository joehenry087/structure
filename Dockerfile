FROM node:8

EXPOSE 8080

WORKDIR /

# Copy package file here so we can install dependencies in root directory
COPY ./package*.json ./

RUN npm install --production

# Move to /app where we'll store our app bundle. 
# Not in / because in development we need to link this volume to local bundle that is updated by gulp.
# Also now we have access to the package file here as well so we can `npm start`
WORKDIR /app

COPY ./_package ./

CMD ["npm", "start"]