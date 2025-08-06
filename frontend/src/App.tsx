import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

interface DevSession {
  sessionId: string;
  repoUrl: string;
  port: number;
  status: string;
  containerId?: string;
}

interface ApiResponse {
  sessions: DevSession[];
}

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

function App() {
  const [sessions, setSessions] = useState<DevSession[]>([]);
  const [repoUrl, setRepoUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch sessions from API
  const fetchSessions = async () => {
    try {
      const response = await axios.get<ApiResponse>(`${API_BASE_URL}/api/dev-server`);
      setSessions(response.data.sessions);
      setError(null);
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Failed to fetch sessions');
    }
  };

  // Auto-refresh sessions every 5 seconds
  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, []);

  // Create new dev server
  const handleCreateServer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/dev-server`, {
        repoUrl: repoUrl.trim()
      });
      
      console.log('Created dev server:', response.data);
      setRepoUrl('');
      fetchSessions(); // Refresh the list
    } catch (err: any) {
      console.error('Error creating dev server:', err);
      setError(err.response?.data?.error || 'Failed to create dev server');
    } finally {
      setLoading(false);
    }
  };

  // Stop dev server
  const handleStopServer = async (sessionId: string) => {
    try {
      await axios.delete(`${API_BASE_URL}/api/dev-server/${sessionId}`);
      fetchSessions(); // Refresh the list
    } catch (err: any) {
      console.error('Error stopping dev server:', err);
      setError(err.response?.data?.error || 'Failed to stop dev server');
    }
  };

  // Open dev server in new tab
  const handleOpenServer = (port: number) => {
    window.open(`http://localhost:${port}`, '_blank');
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>OpenVSCode Dev Server Orchestrator</h1>
      </header>
      
      <main className="App-main">
        {/* Create New Server Form */}
        <section className="create-server-section">
          <h2>Create New Dev Server</h2>
          <form onSubmit={handleCreateServer} className="create-server-form">
            <div className="form-group">
              <label htmlFor="repoUrl">Repository URL:</label>
              <input
                type="url"
                id="repoUrl"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/user/repo.git"
                required
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading || !repoUrl.trim()}>
              {loading ? 'Creating...' : 'Create Dev Server'}
            </button>
          </form>
        </section>

        {/* Error Display */}
        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {/* Active Sessions Table */}
        <section className="sessions-section">
          <h2>Active Dev Servers</h2>
          {sessions.length === 0 ? (
            <p className="no-sessions">No active dev servers</p>
          ) : (
            <div className="sessions-table">
              <table>
                <thead>
                  <tr>
                    <th>Session ID</th>
                    <th>Repository</th>
                    <th>Status</th>
                    <th>Port</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.sessionId}>
                      <td className="session-id">{session.sessionId.substring(0, 8)}...</td>
                      <td className="repo-url" title={session.repoUrl}>
                        {session.repoUrl.split('/').pop()?.replace('.git', '') || session.repoUrl}
                      </td>
                      <td className={`status status-${session.status}`}>
                        {session.status}
                      </td>
                      <td>{session.port}</td>
                      <td className="actions">
                        {session.status === 'running' && (
                          <button
                            onClick={() => handleOpenServer(session.port)}
                            className="open-button"
                          >
                            Open
                          </button>
                        )}
                        <button
                          onClick={() => handleStopServer(session.sessionId)}
                          className="stop-button"
                        >
                          Stop
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
