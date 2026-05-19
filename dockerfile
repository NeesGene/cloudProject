# Step 1: Use a specific version for stability (3.19 is current/stable)
FROM node:20-alpine

# Step 2: Set the working directory
WORKDIR /app

# Step 3: Copy ONLY the package files first
# This is the "secret sauce." If these files don't change, 
# Docker skips the 'npm install' step in future builds.
COPY package*.json ./

# Step 4: Install dependencies
RUN npm install

# Step 5: Copy the rest of your application code
COPY . .

# Step 6: Document the port
EXPOSE 80

# Step 7: Start the app
CMD ["npm", "start"]