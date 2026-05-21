import express from 'express';
import { spawn } from 'child_process';
import { authMiddleware } from '../middleware/auth';

const router = express.Router();

router.post('/features/:featureName/run', authMiddleware, async (req, res) => {
  try {
    const { featureName } = req.params;
    const { input } = req.body;

    if (!input) {
      return res.status(400).json({ error: 'Input is required' });
    }

    const dockerImage = `ai-feature-platform/${featureName}-adapter:latest`;
    const inputJson = JSON.stringify(input);

    const docker = spawn('docker', [
      'run',
      '--rm',
      '-i',
      dockerImage,
      'node',
      'adapter.js'
    ]);

    let stdout = '';
    let stderr = '';

    docker.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    docker.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    docker.stdin.write(inputJson);
    docker.stdin.end();

    docker.on('close', (code) => {
      if (code !== 0) {
        console.error('Docker stderr:', stderr);
        return res.status(500).json({
          error: 'Feature execution failed',
          details: stderr || stdout
        });
      }

      try {
        const output = JSON.parse(stdout);
        res.json({
          success: true,
          output
        });
      } catch (error: any) {
        res.status(500).json({
          error: 'Failed to parse output',
          details: error.message,
          stdout,
          stderr
        });
      }
    });

  } catch (error: any) {
    console.error('Feature execution error:', error);
    res.status(500).json({
      error: 'Feature execution failed',
      details: error.message
    });
  }
});

export default router;