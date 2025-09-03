// CI/CD & Operations module
// Handles pipeline, monitoring, smoke tests
import { Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { auditLogger } from '../middleware/auditLogger';

const execAsync = promisify(exec);

// Pipeline interfaces
export interface IPipelineConfig {
  _id?: string;
  name: string;
  repository: string;
  branch: string;
  environment: 'development' | 'staging' | 'production';
  triggers: string[];
  steps: IPipelineStep[];
  notifications: {
    onSuccess: string[];
    onFailure: string[];
  };
  secrets: Record<string, string>;
  timeout: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPipelineStep {
  name: string;
  type: 'build' | 'test' | 'deploy' | 'security' | 'custom';
  command: string;
  workingDirectory?: string;
  environment?: Record<string, string>;
  continueOnError: boolean;
  timeout: number;
  retryCount: number;
}

export interface IPipelineRun {
  _id?: string;
  pipelineId: string;
  runNumber: number;
  status: 'pending' | 'running' | 'success' | 'failed' | 'cancelled';
  triggeredBy: string;
  triggeredAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  steps: IPipelineStepResult[];
  logs: string[];
  artifacts: string[];
  environment: Record<string, string>;
  commit: {
    hash: string;
    message: string;
    author: string;
  };
}

export interface IPipelineStepResult {
  stepName: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  output?: string;
  error?: string;
  exitCode?: number;
}

// Default pipeline configurations
const DEFAULT_PIPELINES: Record<string, IPipelineConfig> = {
  'fieldsync-backend': {
    name: 'FieldSync Backend CI/CD',
    repository: 'fieldsync',
    branch: 'main',
    environment: 'production',
    triggers: ['push', 'pull_request'],
    steps: [
      {
        name: 'Install Dependencies',
        type: 'build',
        command: 'cd backend && npm ci',
        continueOnError: false,
        timeout: 300000,
        retryCount: 2
      },
      {
        name: 'TypeScript Build',
        type: 'build', 
        command: 'cd backend && npm run build:prod',
        continueOnError: false,
        timeout: 180000,
        retryCount: 1
      },
      {
        name: 'Run Tests',
        type: 'test',
        command: 'cd backend && npm test',
        continueOnError: false,
        timeout: 300000,
        retryCount: 1
      },
      {
        name: 'Security Scan',
        type: 'security',
        command: 'cd backend && npm audit --audit-level moderate',
        continueOnError: true,
        timeout: 120000,
        retryCount: 1
      },
      {
        name: 'Build Docker Image',
        type: 'build',
        command: 'docker build -t fieldsync-backend:latest -f backend/Dockerfile .',
        continueOnError: false,
        timeout: 600000,
        retryCount: 1
      },
      {
        name: 'Deploy to Production',
        type: 'deploy',
        command: 'kubectl apply -f k8s/production/',
        continueOnError: false,
        timeout: 300000,
        retryCount: 1
      }
    ],
    notifications: {
      onSuccess: ['admin@fieldsync.com'],
      onFailure: ['devops@fieldsync.com', 'admin@fieldsync.com']
    },
    secrets: {},
    timeout: 1800000, // 30 minutes
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  },
  'fieldsync-frontend': {
    name: 'FieldSync Frontend CI/CD',
    repository: 'fieldsync',
    branch: 'main',
    environment: 'production',
    triggers: ['push', 'pull_request'],
    steps: [
      {
        name: 'Install Dependencies',
        type: 'build',
        command: 'npm ci',
        continueOnError: false,
        timeout: 300000,
        retryCount: 2
      },
      {
        name: 'TypeScript Check',
        type: 'build',
        command: 'npx tsc --noEmit',
        continueOnError: false,
        timeout: 120000,
        retryCount: 1
      },
      {
        name: 'Run Tests',
        type: 'test',
        command: 'npm run test:web',
        continueOnError: false,
        timeout: 300000,
        retryCount: 1
      },
      {
        name: 'Build Production',
        type: 'build',
        command: 'npm run build',
        continueOnError: false,
        timeout: 600000,
        retryCount: 1
      },
      {
        name: 'Security Scan',
        type: 'security',
        command: 'npm audit --audit-level moderate',
        continueOnError: true,
        timeout: 120000,
        retryCount: 1
      }
    ],
    notifications: {
      onSuccess: ['admin@fieldsync.com'],
      onFailure: ['frontend@fieldsync.com', 'admin@fieldsync.com']
    },
    secrets: {},
    timeout: 1200000, // 20 minutes
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date()
  }
};

/**
 * Run CI/CD pipeline
 */
export async function runCICDPipeline(req: Request, res: Response) {
  try {
    const { pipelineId, branch, triggeredBy, commitHash, commitMessage } = req.body;
    const userId = req.user?.id;

    if (!pipelineId) {
      return res.status(400).json({
        success: false,
        error: 'Pipeline ID is required'
      });
    }

    // Get pipeline configuration
    const pipelineConfig = DEFAULT_PIPELINES[pipelineId];
    if (!pipelineConfig) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline configuration not found'
      });
    }

    // Create pipeline run
    const runNumber = await getNextRunNumber(pipelineId);
    const pipelineRun: IPipelineRun = {
      pipelineId,
      runNumber,
      status: 'pending',
      triggeredBy: triggeredBy || userId || 'system',
      triggeredAt: new Date(),
      steps: pipelineConfig.steps.map(step => ({
        stepName: step.name,
        status: 'pending'
      })),
      logs: [],
      artifacts: [],
      environment: process.env as Record<string, string>,
      commit: {
        hash: commitHash || 'unknown',
        message: commitMessage || 'Manual trigger',
        author: triggeredBy || userId || 'system'
      }
    };

    // Start pipeline execution in background
    executePipeline(pipelineConfig, pipelineRun);

    // Log pipeline start
    auditLogger.info('CI/CD pipeline started', {
      userId,
      action: 'START_PIPELINE',
      resource: 'cicd_pipeline',
      resourceId: pipelineId,
      metadata: { runNumber, branch, commitHash }
    });

    res.status(201).json({
      success: true,
      message: 'Pipeline started successfully',
      data: {
        pipelineRun: {
          pipelineId,
          runNumber,
          status: pipelineRun.status,
          triggeredAt: pipelineRun.triggeredAt
        }
      }
    });

  } catch (error) {
    console.error('Error starting CI/CD pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start CI/CD pipeline'
    });
  }
}

/**
 * Get pipeline status
 */
export async function getPipelineStatus(req: Request, res: Response) {
  try {
    const { pipelineId, runNumber } = req.params;

    // In a real implementation, this would fetch from database
    // For now, return mock status based on pipeline configuration
    const pipelineConfig = DEFAULT_PIPELINES[pipelineId];
    if (!pipelineConfig) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline not found'
      });
    }

    const mockRun: IPipelineRun = {
      pipelineId,
      runNumber: parseInt(runNumber),
      status: 'success',
      triggeredBy: 'system',
      triggeredAt: new Date(Date.now() - 300000), // 5 minutes ago
      startedAt: new Date(Date.now() - 280000),
      completedAt: new Date(Date.now() - 60000), // 1 minute ago
      duration: 240000, // 4 minutes
      steps: pipelineConfig.steps.map((step, index) => ({
        stepName: step.name,
        status: 'success',
        startedAt: new Date(Date.now() - 280000 + (index * 40000)),
        completedAt: new Date(Date.now() - 240000 + (index * 40000)),
        duration: 35000,
        exitCode: 0
      })),
      logs: [
        'Pipeline started',
        'Installing dependencies...',
        'Building application...',
        'Running tests...',
        'All tests passed',
        'Pipeline completed successfully'
      ],
      artifacts: ['build.tar.gz', 'test-results.xml'],
      environment: {},
      commit: {
        hash: 'abc123',
        message: 'Update CI/CD pipeline',
        author: 'developer'
      }
    };

    res.json({
      success: true,
      data: { pipelineRun: mockRun }
    });

  } catch (error) {
    console.error('Error getting pipeline status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pipeline status'
    });
  }
}

/**
 * Get all pipelines
 */
export async function getPipelines(req: Request, res: Response) {
  try {
    const pipelines = Object.entries(DEFAULT_PIPELINES).map(([id, config]) => ({
      id,
      ...config,
      lastRun: {
        runNumber: 42,
        status: 'success',
        completedAt: new Date(Date.now() - 3600000), // 1 hour ago
        duration: 240000
      }
    }));

    res.json({
      success: true,
      data: {
        pipelines,
        count: pipelines.length
      }
    });

  } catch (error) {
    console.error('Error getting pipelines:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pipelines'
    });
  }
}

/**
 * Create or update pipeline configuration
 */
export async function createPipeline(req: Request, res: Response) {
  try {
    const pipelineConfig: Partial<IPipelineConfig> = req.body;
    const userId = req.user?.id;

    if (!pipelineConfig.name || !pipelineConfig.repository) {
      return res.status(400).json({
        success: false,
        error: 'Pipeline name and repository are required'
      });
    }

    const newPipeline: IPipelineConfig = {
      ...pipelineConfig as IPipelineConfig,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: pipelineConfig.isActive !== false
    };

    // In a real implementation, save to database
    const pipelineId = `${pipelineConfig.name?.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`;

    // Log pipeline creation
    auditLogger.info('CI/CD pipeline created', {
      userId,
      action: 'CREATE_PIPELINE',
      resource: 'cicd_pipeline',
      resourceId: pipelineId,
      changes: newPipeline
    });

    res.status(201).json({
      success: true,
      message: 'Pipeline created successfully',
      data: {
        pipeline: { id: pipelineId, ...newPipeline }
      }
    });

  } catch (error) {
    console.error('Error creating pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create pipeline'
    });
  }
}

/**
 * Cancel running pipeline
 */
export async function cancelPipeline(req: Request, res: Response) {
  try {
    const { pipelineId, runNumber } = req.params;
    const userId = req.user?.id;

    // In a real implementation, this would stop the running process
    console.log(`Cancelling pipeline ${pipelineId} run ${runNumber}`);

    // Log pipeline cancellation
    auditLogger.info('CI/CD pipeline cancelled', {
      userId,
      action: 'CANCEL_PIPELINE',
      resource: 'cicd_pipeline',
      resourceId: pipelineId,
      metadata: { runNumber }
    });

    res.json({
      success: true,
      message: 'Pipeline cancelled successfully'
    });

  } catch (error) {
    console.error('Error cancelling pipeline:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to cancel pipeline'
    });
  }
}

/**
 * Get pipeline logs
 */
export async function getPipelineLogs(req: Request, res: Response) {
  try {
    const { pipelineId, runNumber } = req.params;
    const { stepName, tail = 100 } = req.query;

    // Mock logs for demonstration
    const mockLogs = [
      '2025-08-20T10:00:00Z [INFO] Pipeline started',
      '2025-08-20T10:00:01Z [INFO] Installing dependencies...',
      '2025-08-20T10:01:30Z [INFO] npm WARN deprecated package@1.0.0',
      '2025-08-20T10:02:45Z [INFO] Dependencies installed successfully',
      '2025-08-20T10:02:46Z [INFO] Starting TypeScript build...',
      '2025-08-20T10:04:12Z [INFO] Build completed successfully',
      '2025-08-20T10:04:13Z [INFO] Running tests...',
      '2025-08-20T10:06:30Z [INFO] All tests passed (24 tests, 0 failures)',
      '2025-08-20T10:06:31Z [INFO] Pipeline completed successfully'
    ];

    const filteredLogs = stepName 
      ? mockLogs.filter(log => log.includes(stepName as string))
      : mockLogs;

    const tailedLogs = filteredLogs.slice(-Number(tail));

    res.json({
      success: true,
      data: {
        logs: tailedLogs,
        totalLines: filteredLogs.length,
        hasMore: filteredLogs.length > Number(tail)
      }
    });

  } catch (error) {
    console.error('Error getting pipeline logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get pipeline logs'
    });
  }
}

/**
 * Run smoke tests
 */
export async function runSmokeTests(req: Request, res: Response) {
  try {
    const { environment = 'production' } = req.body;
    const userId = req.user?.id;

    const smokeTests = [
      {
        name: 'Health Check',
        url: '/health',
        expected: 'OK'
      },
      {
        name: 'Authentication',
        url: '/api/auth/methods',
        expected: 'success'
      },
      {
        name: 'Database Connection',
        url: '/api/monitoring/health',
        expected: 'connected'
      },
      {
        name: 'Redis Connection',
        url: '/api/monitoring/performance',
        expected: 'operational'
      }
    ];

    const results = await Promise.all(
      smokeTests.map(async (test) => {
        try {
          // Mock test execution
          return {
            test: test.name,
            status: 'passed',
            duration: Math.floor(Math.random() * 1000) + 100,
            message: 'Test passed successfully'
          };
        } catch (error) {
          return {
            test: test.name,
            status: 'failed',
            duration: 0,
            message: error.message
          };
        }
      })
    );

    const passed = results.filter(r => r.status === 'passed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    // Log smoke test execution
    auditLogger.info('Smoke tests executed', {
      userId,
      action: 'RUN_SMOKE_TESTS',
      resource: 'cicd_smoke_tests',
      metadata: { environment, passed, failed, total: results.length }
    });

    res.json({
      success: true,
      data: {
        summary: {
          total: results.length,
          passed,
          failed,
          environment
        },
        results
      }
    });

  } catch (error) {
    console.error('Error running smoke tests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run smoke tests'
    });
  }
}

// Utility functions

async function getNextRunNumber(pipelineId: string): Promise<number> {
  // In a real implementation, this would query the database
  // For now, return a random number
  return Math.floor(Math.random() * 1000) + 1;
}

async function executePipeline(config: IPipelineConfig, run: IPipelineRun) {
  try {
    run.status = 'running';
    run.startedAt = new Date();

    for (let i = 0; i < config.steps.length; i++) {
      const step = config.steps[i];
      const stepResult = run.steps[i];

      stepResult.status = 'running';
      stepResult.startedAt = new Date();

      try {
        // Execute step command
        const result = await executeStep(step);
        
        stepResult.status = 'success';
        stepResult.completedAt = new Date();
        stepResult.duration = stepResult.completedAt.getTime() - stepResult.startedAt!.getTime();
        stepResult.output = result.output;
        stepResult.exitCode = 0;

        run.logs.push(`Step "${step.name}" completed successfully`);

      } catch (error) {
        stepResult.status = 'failed';
        stepResult.completedAt = new Date();
        stepResult.duration = stepResult.completedAt.getTime() - stepResult.startedAt!.getTime();
        stepResult.error = error.message;
        stepResult.exitCode = 1;

        run.logs.push(`Step "${step.name}" failed: ${error.message}`);

        if (!step.continueOnError) {
          run.status = 'failed';
          break;
        }
      }
    }

    if (run.status !== 'failed') {
      run.status = 'success';
    }

    run.completedAt = new Date();
    run.duration = run.completedAt.getTime() - run.startedAt!.getTime();

    console.log(`Pipeline ${config.name} completed with status: ${run.status}`);

  } catch (error) {
    run.status = 'failed';
    run.completedAt = new Date();
    run.logs.push(`Pipeline failed: ${error.message}`);
    console.error('Pipeline execution failed:', error);
  }
}

async function executeStep(step: IPipelineStep): Promise<{ output: string }> {
  // Mock step execution for demonstration
  // In a real implementation, this would execute the actual command
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (Math.random() > 0.1) { // 90% success rate
        resolve({ output: `${step.command} executed successfully` });
      } else {
        reject(new Error(`Command failed: ${step.command}`));
      }
    }, Math.random() * 5000 + 1000); // 1-6 seconds
  });
}

// Export all functions
export {
  getPipelineStatus,
  getPipelines,
  createPipeline,
  cancelPipeline,
  getPipelineLogs,
  runSmokeTests,
  IPipelineConfig,
  IPipelineRun,
  IPipelineStep,
  IPipelineStepResult
};