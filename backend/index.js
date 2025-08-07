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
// GET /api/dev-server/:sessionId/logs - Get logs for a dev server container
app.get('/api/dev-server/:sessionId/logs', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    if (!session || !session.containerId) {
      return res.status(404).json({ error: 'Session or container not found' });
    }
    const container = docker.getContainer(session.containerId);
    // Fetch logs (stdout + stderr, tail last 200 lines)
    const logsBuffer = await container.logs({
      stdout: true,
      stderr: true,
      tail: 200,
      timestamps: false
    });
    // logsBuffer can be a Buffer or string
    const logs = Buffer.isBuffer(logsBuffer) ? logsBuffer.toString('utf8') : String(logsBuffer);
    res.json({ logs });
  } catch (error) {
    console.error('Error fetching container logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs: ' + error.message });
  }
});

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
    const port = await findAvailablePort(8080);

    // Update session status
    activeSessions.set(sessionId, {
      sessionId,
      repoUrl,
      port,
      status: 'starting',
      containerId: null
    });

    // Create and start Docker container that clones the repo itself
    const openVSCodeImage = 'gitpod/openvscode-server:1.86.2';
    console.log(`Creating OpenVSCode container for session ${sessionId} on port ${port} using image ${openVSCodeImage}`);

    const containerConfig = {
      Image: openVSCodeImage,
      name: `openvscode-${sessionId}`,
      HostConfig: {
        PortBindings: {
          '3000/tcp': [{ HostPort: port.toString() }]
        }
        // AutoRemove removed for debugging
      },
      Env: [
        `REPO_URL=${repoUrl}`,
        'OPENVSCODE_SERVER_ROOT=/home/workspace',
        'OPENVSCODE_DISABLE_WELCOME_PAGE=true'
      ],
      WorkingDir: '/home/workspace',
      Entrypoint: ['/bin/sh', '-c', 'git clone "$REPO_URL" /home/workspace && /openvscode-server/bin/openvscode-server --host 0.0.0.0 --port 3000']
    };

    console.log('Container config:', JSON.stringify(containerConfig, null, 2));
    const container = await docker.createContainer(containerConfig);
    await container.start();

    // Wait a moment, then check container status and logs
    setTimeout(async () => {
      try {
        const inspect = await container.inspect();
        if (inspect.State.Status !== 'running') {
          // Container exited, fetch logs
          const logsBuffer = await container.logs({ stdout: true, stderr: true, tail: 100, timestamps: false });
          const logStr = Buffer.isBuffer(logsBuffer) ? logsBuffer.toString('utf8') : String(logsBuffer);
          console.error(`Container for session ${sessionId} exited. Logs:\n${logStr}`);
        } else {
          // Try to validate the server is actually responding
          const http = require('http');
          const maxAttempts = 10;
          let attempts = 0;
          const checkUrl = `http://localhost:${port}`;
          const check = () => {
            http.get(checkUrl, res => {
              if (res.statusCode === 200) {
                console.log(`OpenVSCode server for session ${sessionId} is responding on port ${port}`);
              } else {
                retry();
              }
            }).on('error', retry);
          };
          const retry = () => {
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(check, 1000);
            } else {
              console.error(`OpenVSCode server for session ${sessionId} did not respond on port ${port} after ${maxAttempts} attempts.`);
            }
          };
          check();
        }
      } catch (err) {
        console.error('Error inspecting/logging container:', err);
      }
    }, 2000);

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