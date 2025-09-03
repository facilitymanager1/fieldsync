// Knowledge Base & Training module
// Handles CMS, search, quiz engine
import { Request, Response } from 'express';
import { KnowledgeBase } from '../models/knowledgeBase';
import { auditLogger } from '../middleware/auditLogger';

// Article interface
export interface IKnowledgeArticle {
  _id?: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  tags: string[];
  author: string;
  status: 'draft' | 'published' | 'archived';
  priority: 'low' | 'medium' | 'high';
  viewCount: number;
  likes: number;
  version: number;
  attachments?: {
    name: string;
    url: string;
    type: string;
    size: number;
  }[];
  relatedArticles?: string[];
  lastUpdated: Date;
  createdAt: Date;
  publishedAt?: Date;
  metadata?: Record<string, any>;
}

// Category interface
export interface IKnowledgeCategory {
  _id?: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  parentId?: string;
  children?: IKnowledgeCategory[];
  articleCount: number;
  isActive: boolean;
  sortOrder: number;
  permissions: string[];
}

// Search interface
export interface ISearchQuery {
  query?: string;
  category?: string;
  tags?: string[];
  status?: string;
  author?: string;
  priority?: string;
  dateFrom?: Date;
  dateTo?: Date;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Get knowledge article by ID
 */
export async function getKnowledgeArticle(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: 'Article ID is required'
      });
    }

    const article = await KnowledgeBase.findById(id)
      .populate('author', 'name email')
      .populate('relatedArticles', 'title category createdAt')
      .lean();

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }

    // Check if user has permission to view
    if (article.status === 'draft' && article.author._id.toString() !== userId) {
      // Check if user has admin permissions
      const hasAdminAccess = req.user?.role === 'admin' || req.user?.role === 'supervisor';
      if (!hasAdminAccess) {
        return res.status(403).json({
          success: false,
          error: 'Access denied'
        });
      }
    }

    // Increment view count
    await KnowledgeBase.findByIdAndUpdate(id, { 
      $inc: { viewCount: 1 } 
    });

    // Log view event
    auditLogger.info('Knowledge article viewed', {
      userId,
      action: 'VIEW_ARTICLE',
      resource: 'knowledge_article',
      resourceId: id
    });

    res.json({
      success: true,
      data: {
        article
      }
    });

  } catch (error) {
    console.error('Error getting knowledge article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve knowledge article'
    });
  }
}

/**
 * Get all knowledge articles with search and filtering
 */
export async function getKnowledgeArticles(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    
    const {
      query,
      category,
      tags,
      status = 'published',
      author,
      priority,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0,
      sortBy = 'lastUpdated',
      sortOrder = 'desc'
    }: ISearchQuery = req.query;

    // Build search filters
    const filters: any = {};

    // Only admins and supervisors can see draft articles
    if (status === 'draft' && !['admin', 'supervisor'].includes(userRole)) {
      filters.author = userId;
    } else {
      filters.status = status;
    }

    if (category) filters.category = category;
    if (author) filters.author = author;
    if (priority) filters.priority = priority;
    if (tags && tags.length > 0) {
      filters.tags = { $in: Array.isArray(tags) ? tags : [tags] };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      filters.createdAt = {};
      if (dateFrom) filters.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filters.createdAt.$lte = new Date(dateTo);
    }

    // Text search
    if (query) {
      filters.$text = { $search: query };
    }

    // Build sort options
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute search
    const [articles, totalCount] = await Promise.all([
      KnowledgeBase.find(filters)
        .populate('author', 'name email')
        .sort(sortOptions)
        .skip(Number(offset))
        .limit(Number(limit))
        .select('-content') // Exclude full content for list view
        .lean(),
      KnowledgeBase.countDocuments(filters)
    ]);

    res.json({
      success: true,
      data: {
        articles,
        pagination: {
          total: totalCount,
          limit: Number(limit),
          offset: Number(offset),
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error getting knowledge articles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve knowledge articles'
    });
  }
}

/**
 * Create new knowledge article
 */
export async function createKnowledgeArticle(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    const {
      title,
      content,
      summary,
      category,
      tags = [],
      status = 'draft',
      priority = 'medium',
      attachments = [],
      relatedArticles = []
    } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        error: 'Title, content, and category are required'
      });
    }

    // Generate summary if not provided
    const articleSummary = summary || content.substring(0, 200) + '...';

    const articleData: Partial<IKnowledgeArticle> = {
      title,
      content,
      summary: articleSummary,
      category,
      tags: Array.isArray(tags) ? tags : [tags],
      author: userId,
      status,
      priority,
      viewCount: 0,
      likes: 0,
      version: 1,
      attachments,
      relatedArticles,
      lastUpdated: new Date(),
      createdAt: new Date(),
      publishedAt: status === 'published' ? new Date() : undefined
    };

    const article = await KnowledgeBase.create(articleData);

    // Log creation event
    auditLogger.info('Knowledge article created', {
      userId,
      action: 'CREATE_ARTICLE',
      resource: 'knowledge_article',
      resourceId: article._id.toString(),
      changes: articleData
    });

    res.status(201).json({
      success: true,
      message: 'Knowledge article created successfully',
      data: {
        article: await KnowledgeBase.findById(article._id)
          .populate('author', 'name email')
          .lean()
      }
    });

  } catch (error) {
    console.error('Error creating knowledge article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create knowledge article'
    });
  }
}

/**
 * Update knowledge article
 */
export async function updateKnowledgeArticle(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;
    const updateData = req.body;

    const article = await KnowledgeBase.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }

    // Check permissions
    const canEdit = article.author.toString() === userId || 
                   ['admin', 'supervisor'].includes(userRole);

    if (!canEdit) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Increment version if content changed
    if (updateData.content && updateData.content !== article.content) {
      updateData.version = article.version + 1;
    }

    updateData.lastUpdated = new Date();

    // If publishing for the first time
    if (updateData.status === 'published' && article.status !== 'published') {
      updateData.publishedAt = new Date();
    }

    const updatedArticle = await KnowledgeBase.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('author', 'name email');

    // Log update event
    auditLogger.info('Knowledge article updated', {
      userId,
      action: 'UPDATE_ARTICLE',
      resource: 'knowledge_article',
      resourceId: id,
      changes: updateData
    });

    res.json({
      success: true,
      message: 'Knowledge article updated successfully',
      data: {
        article: updatedArticle
      }
    });

  } catch (error) {
    console.error('Error updating knowledge article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update knowledge article'
    });
  }
}

/**
 * Delete knowledge article
 */
export async function deleteKnowledgeArticle(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    const article = await KnowledgeBase.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }

    // Check permissions
    const canDelete = article.author.toString() === userId || 
                     ['admin', 'supervisor'].includes(userRole);

    if (!canDelete) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }

    // Soft delete by archiving
    await KnowledgeBase.findByIdAndUpdate(id, {
      status: 'archived',
      lastUpdated: new Date()
    });

    // Log deletion event
    auditLogger.info('Knowledge article archived', {
      userId,
      action: 'ARCHIVE_ARTICLE',
      resource: 'knowledge_article',
      resourceId: id
    });

    res.json({
      success: true,
      message: 'Knowledge article archived successfully'
    });

  } catch (error) {
    console.error('Error archiving knowledge article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to archive knowledge article'
    });
  }
}

/**
 * Like/unlike knowledge article
 */
export async function likeKnowledgeArticle(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { action = 'like' } = req.body; // 'like' or 'unlike'
    const userId = req.user?.id;

    const article = await KnowledgeBase.findById(id);

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }

    // Update like count
    const increment = action === 'like' ? 1 : -1;
    const updatedArticle = await KnowledgeBase.findByIdAndUpdate(
      id,
      { $inc: { likes: increment } },
      { new: true }
    );

    // Log like event
    auditLogger.info('Knowledge article liked', {
      userId,
      action: action.toUpperCase() + '_ARTICLE',
      resource: 'knowledge_article',
      resourceId: id
    });

    res.json({
      success: true,
      message: `Article ${action}d successfully`,
      data: {
        likes: updatedArticle.likes
      }
    });

  } catch (error) {
    console.error('Error liking knowledge article:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update article likes'
    });
  }
}

/**
 * Search knowledge base with full-text search
 */
export async function searchKnowledgeBase(req: Request, res: Response) {
  try {
    const { q: query, limit = 20, offset = 0 } = req.query;
    const userId = req.user?.id;
    const userRole = req.user?.role;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Search query is required'
      });
    }

    // Build search filters
    const filters: any = {
      $text: { $search: query as string },
      status: 'published'
    };

    // Allow draft viewing for authors and admins
    if (['admin', 'supervisor'].includes(userRole)) {
      delete filters.status;
    }

    const [articles, totalCount] = await Promise.all([
      KnowledgeBase.find(filters, { score: { $meta: 'textScore' } })
        .populate('author', 'name email')
        .sort({ score: { $meta: 'textScore' } })
        .skip(Number(offset))
        .limit(Number(limit))
        .select('-content')
        .lean(),
      KnowledgeBase.countDocuments(filters)
    ]);

    // Log search event
    auditLogger.info('Knowledge base searched', {
      userId,
      action: 'SEARCH_KNOWLEDGE_BASE',
      resource: 'knowledge_base',
      metadata: { query, resultCount: articles.length }
    });

    res.json({
      success: true,
      data: {
        articles,
        query: query as string,
        pagination: {
          total: totalCount,
          limit: Number(limit),
          offset: Number(offset),
          pages: Math.ceil(totalCount / Number(limit))
        }
      }
    });

  } catch (error) {
    console.error('Error searching knowledge base:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search knowledge base'
    });
  }
}

/**
 * Get knowledge base statistics
 */
export async function getKnowledgeBaseStats(req: Request, res: Response) {
  try {
    const [
      totalArticles,
      publishedArticles,
      draftArticles,
      archivedArticles,
      totalViews,
      totalLikes,
      categoriesStats
    ] = await Promise.all([
      KnowledgeBase.countDocuments(),
      KnowledgeBase.countDocuments({ status: 'published' }),
      KnowledgeBase.countDocuments({ status: 'draft' }),
      KnowledgeBase.countDocuments({ status: 'archived' }),
      KnowledgeBase.aggregate([
        { $group: { _id: null, total: { $sum: '$viewCount' } } }
      ]),
      KnowledgeBase.aggregate([
        { $group: { _id: null, total: { $sum: '$likes' } } }
      ]),
      KnowledgeBase.aggregate([
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
      ])
    ]);

    const stats = {
      articles: {
        total: totalArticles,
        published: publishedArticles,
        draft: draftArticles,
        archived: archivedArticles
      },
      engagement: {
        totalViews: totalViews[0]?.total || 0,
        totalLikes: totalLikes[0]?.total || 0
      },
      categories: categoriesStats.map(cat => ({
        category: cat._id,
        count: cat.count
      }))
    };

    res.json({
      success: true,
      data: { stats }
    });

  } catch (error) {
    console.error('Error getting knowledge base stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve knowledge base statistics'
    });
  }
}

/**
 * Get popular articles
 */
export async function getPopularArticles(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const popularArticles = await KnowledgeBase.find({ status: 'published' })
      .populate('author', 'name email')
      .sort({ viewCount: -1, likes: -1 })
      .limit(limit)
      .select('-content')
      .lean();

    res.json({
      success: true,
      data: {
        articles: popularArticles
      }
    });

  } catch (error) {
    console.error('Error getting popular articles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve popular articles'
    });
  }
}

/**
 * Get recent articles
 */
export async function getRecentArticles(req: Request, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const userRole = req.user?.role;

    const filters: any = { status: 'published' };

    // Admins and supervisors can see all recent articles including drafts
    if (['admin', 'supervisor'].includes(userRole)) {
      delete filters.status;
    }

    const recentArticles = await KnowledgeBase.find(filters)
      .populate('author', 'name email')
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('-content')
      .lean();

    res.json({
      success: true,
      data: {
        articles: recentArticles
      }
    });

  } catch (error) {
    console.error('Error getting recent articles:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve recent articles'
    });
  }
}

// Export interfaces and functions
export {
  IKnowledgeArticle,
  IKnowledgeCategory,
  ISearchQuery
};