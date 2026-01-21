FROM node:14

# Set the working directory
WORKDIR /usr/src/app

# Copy package.json and package-lock.json
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application files
COPY server/ .

# Expose the port the app runs on
EXPOSE 3000

# Command to run the application
CMD ["node", "index.js"]