# Use an official Node runtime as the base image
FROM node:18.16.0

# Set the working directory in the container to /app
WORKDIR /app

# Copy package.json and yarn.lock to the working directory
COPY package*.json yarn.lock ./

# Install any needed packages specified in package.json
RUN yarn install

# Copy the current directory contents into the container at /app
COPY . .

# Make port 3000 available to the world outside this container (or whichever port your app uses)
EXPOSE 3000
ENV PORT=3000

# Define the command to run your app using CMD which defines your runtime
CMD ["yarn", "run", "start"]