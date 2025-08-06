const express = require('express');
const cors = require('cors');
const Docker = require('dockerode');
const simpleGit = require('simple-git');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

const app = express();
const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const PORT = process.env.PORT || 3001;
const REPOS_DIR = path.join(__dirname, '..', 'repos');

// Middleware
app.use(cors());
app.use(express.json());

// In-memory store for active sessions
const activeSessions = new Map();

// Ensure repos directory exists
if (!fsSync.existsSync(REPOS_DIR)) {
  fsSync.mkdirSync(REPOS_DIR, { recursive: true });
}

// Helper function to find an available port
async function findAvailablePort(startPort = 8080) {
  const net = require('net');
  
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(startPort, (err) => {
      if (err) {
        server.listen(0, (err) => {
          if (err) {
            reject(err);
          } else {
            const port = server.address().port;
            server.close(() => resolve(port));
          }
        });
      } else {
        const port = server.address().port;
        server.close(() => resolve(port));
      }
    });
  });
}

// API Routes

// GET /api/dev-server - List active sessions
app.get('/api/dev-server', async (req, res) => {
  try {
    const sessions = Array.from(activeSessions.values()).map(session => ({
      sessionId: session.sessionId,
      repoUrl: session.repoUrl,
      port: session.port,
      status: session.status,
      containerId: session.containerId
    }));
    
    res.json({ sessions });
  } catch (error) {
    console.error('Error listing sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// POST /api/dev-server - Create new dev server session
app.post('/api/dev-server', async (req, res) => {
  try {
    const { repoUrl } = req.body;
    
    if (!repoUrl) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }

    const sessionId = uuidv4();
    const sessionDir = path.join(REPOS_DIR, sessionId);
    const port = await findAvailablePort(8080);

    // Update session status
    activeSessions.set(sessionId, {
      sessionId,
      repoUrl,
      port,
      status: 'cloning',
      containerId: null,
      sessionDir
    });

    // Clone repository
    console.log(`Cloning repository ${repoUrl} to ${sessionDir}`);
    const git = simpleGit();
    await git.clone(repoUrl, sessionDir);

    // Update session status
    activeSessions.get(sessionId).status = 'starting';

    // Create and start Docker container
    console.log(`Creating OpenVSCode container for session ${sessionId} on port ${port}`);
    
    const container = await docker.createContainer({
      Image: 'gitpod/openvscode-server:latest',
      name: `openvscode-${sessionId}`,
      HostConfig: {
        PortBindings: {
          '3000/tcp': [{ HostPort: port.toString() }]
        },
        Binds: [
          `${sessionDir}:/home/workspace:rw`
        ],
        AutoRemove: true
      },
      Env: [
        'OPENVSCODE_SERVER_ROOT=/home/workspace',
        'OPENVSCODE_DISABLE_WELCOME_PAGE=true'
      ],
      WorkingDir: '/home/workspace'
    });

    await container.start();
    
    // Update session with container info
    const session = activeSessions.get(sessionId);
    session.containerId = container.id;
    session.status = 'running';

    console.log(`OpenVSCode server started for session ${sessionId} on port ${port}`);

    res.json({
      sessionId,
      repoUrl,
      port,
      status: 'running',
      url: `http://localhost:${port}`
    });

  } catch (error) {
    console.error('Error creating dev server:', error);
    
    // Clean up on error
    if (req.body.repoUrl) {
      const sessionId = Array.from(activeSessions.keys()).find(id => 
        activeSessions.get(id)?.repoUrl === req.body.repoUrl && 
        activeSessions.get(id)?.status !== 'running'
      );
      
      if (sessionId) {
        activeSessions.delete(sessionId);
        const sessionDir = path.join(REPOS_DIR, sessionId);
        try {
          await fs.rmdir(sessionDir, { recursive: true });
        } catch (cleanupError) {
          console.error('Error cleaning up session directory:', cleanupError);
        }
      }
    }
    
    res.status(500).json({ error: 'Failed to create dev server: ' + error.message });
  }
});

// DELETE /api/dev-server/:sessionId - Stop dev server and cleanup
app.delete('/api/dev-server/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Stop and remove container
    if (session.containerId) {
      try {
        const container = docker.getContainer(session.containerId);
        await container.stop();
        console.log(`Stopped container ${session.containerId} for session ${sessionId}`);
      } catch (error) {
        console.error('Error stopping container:', error);
      }
    }

    // Remove session directory
    try {
      await fs.rmdir(session.sessionDir, { recursive: true });
      console.log(`Removed session directory ${session.sessionDir}`);
    } catch (error) {
      console.error('Error removing session directory:', error);
    }

    // Remove from active sessions
    activeSessions.delete(sessionId);

    res.json({ message: 'Dev server stopped and cleaned up successfully' });

  } catch (error) {
    console.error('Error stopping dev server:', error);
    res.status(500).json({ error: 'Failed to stop dev server: ' + error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`OpenVSCode Dev Server Orchestrator backend running on port ${PORT}`);
  console.log(`Repos directory: ${REPOS_DIR}`);
});