import express from 'express';
import apiDocumentationService from '../services/apiDocumentationService';
import apiVersioningService from '../services/apiVersioningService';
import auth from '../middleware/auth';

const router = express.Router();

/**
 * @route GET /api/docs
 * @desc Get interactive API documentation
 * @access Public
 */
router.get('/', (req, res) => {
  try {
    const { version, theme = 'light' } = req.query;
    const targetVersion = version as string || apiVersioningService.getSupportedVersions()[0];

    const html = apiDocumentationService.generateInteractiveDocumentation(
      targetVersion,
      theme as 'light' | 'dark'
    );

    res.set('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate documentation'
    });
  }
});

/**
 * @route GET /api/docs/spec
 * @desc Get OpenAPI specification
 * @access Public
 */
router.get('/spec', async (req, res) => {
  try {
    const { version, format = 'json' } = req.query;
    const targetVersion = version as string || apiVersioningService.getSupportedVersions()[0];

    const documentation = await apiDocumentationService.getDocumentation(
      targetVersion,
      format as 'json' | 'yaml' | 'html'
    );

    switch (format) {
      case 'yaml':
        res.set('Content-Type', 'application/x-yaml');
        res.send(documentation);
        break;
      case 'html':
        res.set('Content-Type', 'text/html');
        res.send(documentation);
        break;
      case 'json':
      default:
        res.json(documentation);
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get API specification',
      details: error.message
    });
  }
});

/**
 * @route GET /api/docs/versions
 * @desc Get all supported API versions
 * @access Public
 */
router.get('/versions', (req, res) => {
  try {
    const versions = apiVersioningService.getSupportedVersions();
    const versionDetails = versions.map(version => ({
      version,
      ...apiVersioningService.getVersionInfo(version)
    }));

    res.json({
      success: true,
      data: {
        versions: versionDetails,
        defaultVersion: versions[0]
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get version information'
    });
  }
});

/**
 * @route GET /api/docs/versions/:version
 * @desc Get specific version information
 * @access Public
 */
router.get('/versions/:version', (req, res) => {
  try {
    const { version } = req.params;
    const versionInfo = apiVersioningService.getVersionInfo(version);

    if (!versionInfo) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    res.json({
      success: true,
      data: versionInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get version information'
    });
  }
});

/**
 * @route GET /api/docs/changelog
 * @desc Get changelog between versions
 * @access Public
 */
router.get('/changelog', (req, res) => {
  try {
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        success: false,
        error: 'Both "from" and "to" version parameters are required'
      });
    }

    const changelog = apiDocumentationService.generateChangelog(
      from as string,
      to as string
    );

    res.json({
      success: true,
      data: changelog
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate changelog',
      details: error.message
    });
  }
});

/**
 * @route GET /api/docs/examples/:endpoint
 * @desc Get code examples for specific endpoint
 * @access Public
 */
router.get('/examples/*', (req, res) => {
  try {
    const endpoint = '/' + req.params[0];
    const { method = 'GET', version, languages } = req.query;
    
    const targetVersion = version as string || apiVersioningService.getSupportedVersions()[0];
    const targetLanguages = languages ? 
      (languages as string).split(',') : 
      ['curl', 'javascript', 'python', 'java'];

    const codeSamples = apiDocumentationService.generateCodeSamples(
      method as string,
      endpoint,
      targetVersion,
      targetLanguages
    );

    const examples = apiDocumentationService.generateExamples(
      endpoint,
      method as string,
      targetVersion
    );

    res.json({
      success: true,
      data: {
        endpoint,
        method,
        version: targetVersion,
        codeSamples,
        examples
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to generate examples',
      details: error.message
    });
  }
});

/**
 * @route POST /api/docs/export
 * @desc Export API documentation
 * @access Admin only
 */
router.post('/export', auth(['admin']), async (req, res) => {
  try {
    const {
      version,
      format = 'json',
      outputPath = './exports'
    } = req.body;

    const targetVersion = version || apiVersioningService.getSupportedVersions()[0];

    if (!['json', 'yaml', 'html'].includes(format)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid format. Must be json, yaml, or html'
      });
    }

    const filePath = await apiDocumentationService.exportDocumentation(
      targetVersion,
      format,
      outputPath
    );

    req.log.info('API documentation exported', {
      version: targetVersion,
      format,
      path: filePath,
      exportedBy: (req as any).user?.id
    });

    res.json({
      success: true,
      data: {
        version: targetVersion,
        format,
        filePath,
        downloadUrl: `/api/docs/download/${encodeURIComponent(filePath)}`
      }
    });
  } catch (error) {
    req.log.error('Failed to export documentation', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export documentation'
    });
  }
});

/**
 * @route GET /api/docs/download/:filename
 * @desc Download exported documentation
 * @access Admin only
 */
router.get('/download/*', auth(['admin']), (req, res) => {
  try {
    const filePath = decodeURIComponent(req.params[0]);
    
    // Security check - ensure file is in exports directory
    if (!filePath.includes('/exports/') && !filePath.includes('\\exports\\')) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    res.download(filePath, (err) => {
      if (err) {
        req.log.error('Failed to download file', err);
        res.status(500).json({
          success: false,
          error: 'Failed to download file'
        });
      }
    });
  } catch (error) {
    req.log.error('Failed to serve download', error);
    res.status(500).json({
      success: false,
      error: 'Failed to serve download'
    });
  }
});

/**
 * @route GET /api/docs/statistics
 * @desc Get API usage statistics
 * @access Admin, Supervisor
 */
router.get('/statistics', auth(['admin', 'supervisor']), (req, res) => {
  try {
    const statistics = apiDocumentationService.generateUsageStatistics();

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    req.log.error('Failed to get API statistics', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve API statistics'
    });
  }
});

/**
 * @route GET /api/docs/health
 * @desc Get documentation service health
 * @access Admin only
 */
router.get('/health', auth(['admin']), (req, res) => {
  try {
    const supportedVersions = apiVersioningService.getSupportedVersions();
    const activeVersions = supportedVersions.filter(version => {
      const info = apiVersioningService.getVersionInfo(version);
      return info?.status === 'active';
    });

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      versions: {
        total: supportedVersions.length,
        active: activeVersions.length,
        deprecated: supportedVersions.length - activeVersions.length
      },
      documentation: {
        cacheSize: 'N/A', // Would get actual cache size
        lastGenerated: new Date().toISOString()
      }
    };

    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    req.log.error('Failed to get documentation health', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve documentation health'
    });
  }
});

/**
 * @route POST /api/docs/versions
 * @desc Add or update API version
 * @access Admin only
 */
router.post('/versions', auth(['admin']), (req, res) => {
  try {
    const versionData = req.body;

    if (!versionData.version || !versionData.releaseDate) {
      return res.status(400).json({
        success: false,
        error: 'Version and releaseDate are required'
      });
    }

    apiVersioningService.addVersion(versionData);

    req.log.info('API version added/updated', {
      version: versionData.version,
      updatedBy: (req as any).user?.id
    });

    res.json({
      success: true,
      message: 'Version added/updated successfully'
    });
  } catch (error) {
    req.log.error('Failed to add/update version', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add/update version'
    });
  }
});

/**
 * @route POST /api/docs/versions/:version/deprecate
 * @desc Deprecate API version
 * @access Admin only
 */
router.post('/versions/:version/deprecate', auth(['admin']), (req, res) => {
  try {
    const { version } = req.params;
    const { sunsetDate } = req.body;

    const success = apiVersioningService.deprecateVersion(version, sunsetDate);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Version not found'
      });
    }

    req.log.info('API version deprecated', {
      version,
      sunsetDate,
      deprecatedBy: (req as any).user?.id
    });

    res.json({
      success: true,
      message: 'Version deprecated successfully'
    });
  } catch (error) {
    req.log.error('Failed to deprecate version', error);
    res.status(500).json({
      success: false,
      error: 'Failed to deprecate version'
    });
  }
});

/**
 * @route GET /api/docs/search
 * @desc Search API documentation
 * @access Public
 */
router.get('/search', async (req, res) => {
  try {
    const { q, version, type } = req.query;

    if (!q) {
      return res.status(400).json({
        success: false,
        error: 'Search query (q) parameter is required'
      });
    }

    const targetVersion = version as string || apiVersioningService.getSupportedVersions()[0];
    const searchQuery = q as string;
    const searchType = type as string || 'all'; // all, endpoints, schemas, examples

    // This would implement full-text search across documentation
    // For now, return a simple placeholder response
    const searchResults = {
      query: searchQuery,
      version: targetVersion,
      type: searchType,
      results: [
        {
          type: 'endpoint',
          path: '/auth/login',
          method: 'POST',
          description: 'User authentication endpoint',
          relevance: 0.9
        },
        {
          type: 'schema',
          name: 'User',
          description: 'User object schema',
          relevance: 0.7
        }
      ],
      total: 2
    };

    res.json({
      success: true,
      data: searchResults
    });
  } catch (error) {
    req.log.error('Failed to search documentation', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search documentation'
    });
  }
});

/**
 * @route GET /api/docs/postman
 * @desc Generate Postman collection
 * @access Public
 */
router.get('/postman', async (req, res) => {
  try {
    const { version } = req.query;
    const targetVersion = version as string || apiVersioningService.getSupportedVersions()[0];

    const spec = await apiDocumentationService.getDocumentation(targetVersion);
    
    // Convert OpenAPI spec to Postman collection format
    const postmanCollection = this.convertToPostmanCollection(spec);

    res.json({
      success: true,
      data: postmanCollection
    });
  } catch (error) {
    req.log.error('Failed to generate Postman collection', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate Postman collection'
    });
  }
});

/**
 * Helper method to convert OpenAPI to Postman collection
 */
function convertToPostmanCollection(spec: any): any {
  return {
    info: {
      name: spec.info.title,
      description: spec.info.description,
      version: spec.info.version,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: Object.entries(spec.paths).map(([path, pathObj]: [string, any]) =>
      Object.entries(pathObj).map(([method, operation]: [string, any]) => ({
        name: operation.summary || `${method.toUpperCase()} ${path}`,
        request: {
          method: method.toUpperCase(),
          header: [
            {
              key: 'Content-Type',
              value: 'application/json'
            },
            {
              key: 'API-Version',
              value: spec.info.version
            }
          ],
          url: {
            raw: `{{baseUrl}}${path}`,
            host: ['{{baseUrl}}'],
            path: path.split('/').filter(Boolean)
          },
          description: operation.description
        },
        response: []
      }))
    ).flat(),
    variable: [
      {
        key: 'baseUrl',
        value: process.env.API_BASE_URL || 'http://localhost:3000/api'
      }
    ]
  };
}

export default router;