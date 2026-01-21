# Mahjong Online Game

## Overview
Mahjong Online is a web-based application that allows users to play Mahjong games online. The application consists of a server-side component that manages the game logic and a client-side component that provides the user interface.

## Project Structure
```
mahjong-online
├── server               # Server-side application
│   ├── database         # Database management
│   │   └── Database.js  # DatabaseManager class
│   ├── index.js         # Entry point for the server
│   └── package.json     # Server dependencies and scripts
├── client               # Client-side application
│   ├── src              # Source files for the client
│   │   └── index.html   # Main HTML file
│   └── package.json     # Client dependencies and scripts
├── data                 # Directory for data storage
│   └── .gitkeep         # Keeps the data directory in version control
├── docker               # Docker configuration
│   ├── nginx            # Nginx configuration
│   │   └── nginx.conf   # Nginx server configuration
│   └── node             # Node.js Docker setup
│       └── Dockerfile   # Dockerfile for Node.js server
├── docker-compose.yml    # Docker Compose configuration
├── Dockerfile           # Main Dockerfile for the application
├── .dockerignore        # Files to ignore in Docker builds
├── .env.example         # Example environment variables
└── README.md            # Project documentation
```

## Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- Docker and Docker Compose

### Installation
1. Clone the repository:
   ```
   git clone https://github.com/yourusername/mahjong-online.git
   cd mahjong-online
   ```

2. Install server dependencies:
   ```
   cd server
   npm install
   ```

3. Install client dependencies:
   ```
   cd ../client
   npm install
   ```

### Running the Application
You can run the application using Docker Compose. From the root of the project, execute:
```
docker-compose up
```

This command will build the Docker images and start the services defined in `docker-compose.yml`.

### Accessing the Application
Once the application is running, you can access the client interface by navigating to `http://localhost:3000` in your web browser.

### Database
The application uses an SQLite database to manage user data and game records. The database is initialized automatically when the server starts.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.