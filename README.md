# OpenVSCode Dev Server Orchestrator

A monorepo project that provides a web-based interface for managing OpenVSCode development servers. Users can submit GitHub repository URLs through a React frontend, which then spins up isolated OpenVSCode Server containers with the specified repositories mounted as workspaces.

## Features

- **Web Interface**: React frontend for managing development servers
- **Repository Cloning**: Automatically clones GitHub repositories
- **Container Management**: Spins up OpenVSCode Server containers for each repository
- **Session Management**: Track and manage multiple active development sessions
- **Easy Cleanup**: Stop containers and remove repository folders with one click

## Architecture

```
/
├── backend/          # Node.js/Express API server
├── frontend/         # React web application
├── repos/            # Directory for cloned repositories (mounted into containers)
├── docker-compose.yml # Production Docker Compose configuration
└── docker-compose.dev.yml # Development Docker Compose configuration
```

### Backend (Node.js/Express)

The backend provides REST API endpoints:

- `POST /api/dev-server`: Create a new development server
  - Accepts a repository URL
  - Clones the repository to a unique session folder
  - Spins up an OpenVSCode Server container
  - Mounts the repository as `/home/workspace`

- `GET /api/dev-server`: List all active sessions
  - Returns session ID, port, repository URL, and status

- `DELETE /api/dev-server/:sessionId`: Stop and cleanup a development server
  - Stops the Docker container
  - Removes the repository folder

### Frontend (React)

The frontend provides:

- **Session Table**: Lists all active sessions with "Open" and "Stop" controls
- **New Server Form**: Submit repository URLs to create new development servers
- **Auto-refresh**: Automatically updates the session list every 5 seconds

## Prerequisites

- Docker and Docker Compose
- Node.js 18+ (for local development)
- Git (for repository cloning)

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Clone this repository**:
   ```bash
   git clone <repository-url>
   cd dev-server-orchestrator
   ```

2. **Start the services**:
   ```bash
   docker-compose up -d
   ```

3. **Access the application**:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:3001

### Option 2: Development Mode

For development with hot reloading:

```bash
docker-compose -f docker-compose.dev.yml up
```

### Option 3: Local Development

1. **Start the backend**:
   ```bash
   cd backend
   npm install
   npm run dev
   ```

2. **Start the frontend** (in a new terminal):
   ```bash
   cd frontend
   npm install
   npm start
   ```

## Usage

1. **Access the web interface** at http://localhost:3000

2. **Create a new development server**:
   - Enter a GitHub repository URL (e.g., `https://github.com/user/repo.git`)
   - Click "Create Dev Server"
   - Wait for the status to change to "running"

3. **Open the development environment**:
   - Click the "Open" button next to a running session
   - This will open OpenVSCode Server in a new tab with your repository

4. **Stop a development server**:
   - Click the "Stop" button next to any session
   - This will stop the container and clean up the repository folder

## API Documentation

### Create Development Server

```http
POST /api/dev-server
Content-Type: application/json

{
  "repoUrl": "https://github.com/user/repo.git"
}
```

**Response:**
```json
{
  "sessionId": "abc123-def456-...",
  "repoUrl": "https://github.com/user/repo.git",
  "port": 8080,
  "status": "running",
  "url": "http://localhost:8080"
}
```

### List Active Sessions

```http
GET /api/dev-server
```

**Response:**
```json
{
  "sessions": [
    {
      "sessionId": "abc123-def456-...",
      "repoUrl": "https://github.com/user/repo.git",
      "port": 8080,
      "status": "running"
    }
  ]
}
```

### Stop Development Server

```http
DELETE /api/dev-server/:sessionId
```

**Response:**
```json
{
  "message": "Dev server stopped and cleaned up successfully"
}
```

## Configuration

### Environment Variables

**Backend:**
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: Environment mode (development/production)

**Frontend:**
- `REACT_APP_API_URL`: Backend API URL (default: http://localhost:3001)

### Docker Configuration

The application uses the following Docker images:
- **OpenVSCode Server**: `gitpod/openvscode-server:latest`
- **Backend**: Node.js 18 Alpine
- **Frontend**: Nginx Alpine (production) / Node.js 18 Alpine (development)

## File Structure

```
dev-server-orchestrator/
├── backend/
│   ├── index.js              # Main Express server
│   ├── package.json          # Backend dependencies
│   ├── Dockerfile            # Production Dockerfile
│   └── Dockerfile.dev        # Development Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # Main React component
│   │   ├── App.css           # Styling
│   │   └── ...               # Other React files
│   ├── public/               # Static assets
│   ├── package.json          # Frontend dependencies
│   ├── Dockerfile            # Production Dockerfile
│   ├── Dockerfile.dev        # Development Dockerfile
│   └── nginx.conf            # Nginx configuration
├── repos/                    # Cloned repositories directory
├── docker-compose.yml        # Production Docker Compose
├── docker-compose.dev.yml    # Development Docker Compose
├── .gitignore               # Git ignore rules
└── README.md                # This file
```

## Security Considerations

⚠️ **Important**: This is a prototype application and should NOT be used in production without additional security measures:

- **No Authentication**: Anyone with access can create/stop development servers
- **Docker Socket Access**: The backend has access to the Docker socket
- **Resource Limits**: No limits on container resources or number of sessions
- **Network Security**: All containers run on the same Docker network
- **Repository Access**: Any public Git repository can be cloned

## Troubleshooting

### Common Issues

1. **Docker Socket Permission Denied**:
   - Ensure Docker daemon is running
   - On Linux, add your user to the `docker` group: `sudo usermod -aG docker $USER`

2. **Port Already in Use**:
   - Check if ports 3000 or 3001 are already in use
   - Modify the ports in `docker-compose.yml` if needed

3. **OpenVSCode Container Fails to Start**:
   - Ensure Docker has enough resources (memory/CPU)
   - Check Docker logs: `docker logs <container-name>`

4. **Repository Clone Fails**:
   - Verify the repository URL is correct and accessible
   - Check if the repository is public (private repos require authentication)

### Logs

View application logs:
```bash
# All services
docker-compose logs -f

# Backend only
docker-compose logs -f backend

# Frontend only
docker-compose logs -f frontend
```

## Development

### Adding Features

1. **Backend**: Modify `backend/index.js` for new API endpoints
2. **Frontend**: Add components in `frontend/src/`
3. **Styling**: Update `frontend/src/App.css`

### Testing

Currently, this is a prototype without comprehensive tests. For production use, add:
- Unit tests for backend API endpoints
- Integration tests for Docker container management
- Frontend component tests
- End-to-end tests

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is provided as-is for demonstration and prototyping purposes.