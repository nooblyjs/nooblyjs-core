/**
 * @fileoverview Searching Service Demo
 * Example showing how to use the NooblyJS Searching Service
 * @author NooblyJS Team
 * @version 1.0.0
 */

const express = require('express');
const serviceRegistry = require('../index');

const app = express();

// Add body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Initialize the service registry
const eventEmitter = require('events');
const globalEventEmitter = new eventEmitter();

serviceRegistry.initialize(app, globalEventEmitter, {
  // Optional API key authentication
  // apiKeys: ['your-api-key-here'],
  // requireApiKey: false
});

// Example 1: Using memory search index (default)
const memorySearch = serviceRegistry.searching('memory', {
  stemming: true,
  stopWords: true,
  caseSensitive: false,
  minWordLength: 2
});

// Example 2: Using Elasticsearch (requires Elasticsearch server)
/*
const elasticSearch = serviceRegistry.searching('elasticsearch', {
  host: 'localhost:9200',
  // auth: { username: 'elastic', password: 'changeme' },
  apiVersion: '7.x'
});
*/

// Example 3: Using Algolia (requires Algolia API keys)
/*
const algoliaSearch = serviceRegistry.searching('algolia', {
  appId: process.env.ALGOLIA_APP_ID,
  apiKey: process.env.ALGOLIA_API_KEY,
  indexName: 'nooblyjs_demo'
});
*/

// Sample data for demonstration
const sampleData = {
  users: [
    { id: 'u1', name: 'John Doe', email: 'john.doe@example.com', role: 'admin', department: 'Engineering', bio: 'Senior software engineer with 10 years of experience in full-stack development.' },
    { id: 'u2', name: 'Jane Smith', email: 'jane.smith@company.com', role: 'user', department: 'Marketing', bio: 'Digital marketing specialist focused on SEO and content strategy.' },
    { id: 'u3', name: 'Bob Johnson', email: 'bob.johnson@firm.org', role: 'moderator', department: 'Sales', bio: 'Sales manager with expertise in B2B software solutions and client relations.' },
    { id: 'u4', name: 'Alice Brown', email: 'alice.brown@startup.io', role: 'user', department: 'Engineering', bio: 'Frontend developer specializing in React and modern web technologies.' },
    { id: 'u5', name: 'Charlie Wilson', email: 'charlie@consulting.com', role: 'admin', department: 'Operations', bio: 'Operations director with experience in process optimization and team management.' }
  ],
  products: [
    { id: 'p1', name: 'MacBook Pro', category: 'electronics', brand: 'Apple', price: 1999, description: 'Powerful laptop for professional developers and creatives with M2 chip and stunning display.' },
    { id: 'p2', name: 'Office Chair', category: 'furniture', brand: 'Herman Miller', price: 899, description: 'Ergonomic office chair designed for maximum comfort during long working hours.' },
    { id: 'p3', name: 'JavaScript Book', category: 'books', brand: 'OReilly', price: 49, description: 'Comprehensive guide to modern JavaScript programming techniques and best practices.' },
    { id: 'p4', name: 'iPhone 15', category: 'electronics', brand: 'Apple', price: 999, description: 'Latest smartphone with advanced camera system and powerful A17 processor.' },
    { id: 'p5', name: 'Standing Desk', category: 'furniture', brand: 'Uplift', price: 599, description: 'Height-adjustable standing desk for healthier working habits and productivity.' }
  ],
  articles: [
    { id: 'a1', title: 'Getting Started with Node.js', author: 'Tech Writer', category: 'programming', tags: ['nodejs', 'javascript', 'backend'], content: 'Node.js is a powerful runtime for building server-side applications. This comprehensive guide covers installation, basic concepts, and building your first application.' },
    { id: 'a2', title: 'Modern CSS Techniques', author: 'Design Expert', category: 'design', tags: ['css', 'frontend', 'responsive'], content: 'Explore advanced CSS techniques including Grid, Flexbox, and custom properties for building responsive and maintainable web interfaces.' },
    { id: 'a3', title: 'Database Optimization Tips', author: 'DB Admin', category: 'database', tags: ['database', 'performance', 'sql'], content: 'Learn essential database optimization strategies to improve query performance and reduce response times in your applications.' },
    { id: 'a4', title: 'React Best Practices', author: 'Frontend Dev', category: 'programming', tags: ['react', 'javascript', 'frontend'], content: 'Discover React best practices including component design, state management, performance optimization, and testing strategies.' },
    { id: 'a5', title: 'API Security Guidelines', author: 'Security Expert', category: 'security', tags: ['api', 'security', 'authentication'], content: 'Comprehensive guide to securing your APIs with authentication, authorization, rate limiting, and input validation techniques.' }
  ]
};

// Index sample data on startup
async function indexSampleData() {
  try {
    console.log('📚 Indexing sample data...');

    // Add users to search index
    for (const user of sampleData.users) {
      await memorySearch.add(`users_${user.id}`, {
        id: user.id,
        type: 'user',
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department,
        bio: user.bio,
        searchableText: `${user.name} ${user.email} ${user.role} ${user.department} ${user.bio}`
      });
    }

    // Add products to search index
    for (const product of sampleData.products) {
      await memorySearch.add(`products_${product.id}`, {
        id: product.id,
        type: 'product',
        name: product.name,
        category: product.category,
        brand: product.brand,
        price: product.price,
        description: product.description,
        searchableText: `${product.name} ${product.category} ${product.brand} ${product.description}`
      });
    }

    // Add articles to search index
    for (const article of sampleData.articles) {
      await memorySearch.add(`articles_${article.id}`, {
        id: article.id,
        type: 'article',
        title: article.title,
        author: article.author,
        category: article.category,
        tags: article.tags.join(' '),
        content: article.content,
        searchableText: `${article.title} ${article.author} ${article.category} ${article.tags.join(' ')} ${article.content}`
      });
    }

    console.log('[x] Sample data indexed successfully');
  } catch (error) {
    console.error('[ ] Error indexing sample data:', error);
  }
}

// Basic search endpoint
app.get('/search', async (req, res) => {
  try {
    const { q, index, limit = 10, offset = 0 } = req.query;

    if (!q) {
      return res.status(400).json({
        error: 'Query parameter "q" is required',
        example: '/search?q=javascript&index=articles&limit=5'
      });
    }

    const searchOptions = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      fuzzy: true,
      boost: {
        title: 2,
        name: 2,
        tags: 1.5
      }
    };

    let results;
    if (index) {
      // Search in specific index
      results = await memorySearch.search(index, q, searchOptions);
    } else {
      // Search across all indices
      const userResults = await memorySearch.search('users', q, { ...searchOptions, limit: 5 });
      const productResults = await memorySearch.search('products', q, { ...searchOptions, limit: 5 });
      const articleResults = await memorySearch.search('articles', q, { ...searchOptions, limit: 5 });

      results = [
        ...userResults.map(r => ({ ...r, type: 'user' })),
        ...productResults.map(r => ({ ...r, type: 'product' })),
        ...articleResults.map(r => ({ ...r, type: 'article' }))
      ].sort((a, b) => b.score - a.score).slice(0, parseInt(limit));
    }

    res.json({
      query: q,
      index: index || 'all',
      results: results,
      count: results.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Advanced search with filters
app.post('/search/advanced', async (req, res) => {
  try {
    const {
      query,
      indices = ['users', 'products', 'articles'],
      filters = {},
      sort = 'relevance',
      limit = 20,
      offset = 0
    } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const searchOptions = {
      limit: parseInt(limit),
      offset: parseInt(offset),
      fuzzy: true,
      filters: filters
    };

    // Apply sorting
    if (sort === 'date') {
      searchOptions.sort = 'createdAt';
    } else if (sort === 'price') {
      searchOptions.sort = 'price';
    }

    const allResults = [];

    for (const indexName of indices) {
      try {
        const results = await memorySearch.search(indexName, query, searchOptions);
        allResults.push(...results.map(r => ({
          ...r,
          type: indexName.slice(0, -1) // Remove 's' from index name
        })));
      } catch (error) {
        console.error(`Error searching in ${indexName}:`, error);
      }
    }

    // Sort results by relevance score
    allResults.sort((a, b) => b.score - a.score);

    // Apply pagination
    const paginatedResults = allResults.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      query: query,
      indices: indices,
      filters: filters,
      results: paginatedResults,
      totalCount: allResults.length,
      count: paginatedResults.length,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: allResults.length > parseInt(offset) + parseInt(limit)
      }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Autocomplete/suggestions endpoint
app.get('/search/suggest', async (req, res) => {
  try {
    const { q, index = 'all', limit = 5 } = req.query;

    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Query must be at least 2 characters' });
    }

    const suggestions = await memorySearch.suggest(index === 'all' ? null : index, q, {
      limit: parseInt(limit)
    });

    res.json({
      query: q,
      suggestions: suggestions,
      count: suggestions.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search analytics endpoint
app.get('/search/analytics', async (req, res) => {
  try {
    const analytics = await memorySearch.getAnalytics();

    res.json({
      analytics: analytics,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Index management endpoints

// Add/update document in index
app.post('/index/:indexName/:id', async (req, res) => {
  try {
    const { indexName, id } = req.params;
    const document = req.body;

    await memorySearch.add(`${indexName}_${id}`, { id, type: indexName, ...document });

    res.json({
      success: true,
      message: `Document ${id} indexed in ${indexName}`,
      document: { id, ...document }
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove document from index
app.delete('/index/:indexName/:id', async (req, res) => {
  try {
    const { indexName, id } = req.params;

    await memorySearch.remove(indexName, id);

    res.json({
      success: true,
      message: `Document ${id} removed from ${indexName}`
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get index statistics
app.get('/index/:indexName/stats', async (req, res) => {
  try {
    const { indexName } = req.params;
    const stats = await memorySearch.getIndexStats(indexName);

    res.json({
      index: indexName,
      stats: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all indices
app.get('/indices', async (req, res) => {
  try {
    const indices = await memorySearch.listIndices();

    res.json({
      indices: indices,
      count: indices.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search within specific categories
app.get('/search/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { q, limit = 10 } = req.query;

    if (!q) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    // Map category to index
    const indexMap = {
      people: 'users',
      users: 'users',
      products: 'products',
      items: 'products',
      articles: 'articles',
      content: 'articles',
      blog: 'articles'
    };

    const indexName = indexMap[category];
    if (!indexName) {
      return res.status(400).json({
        error: `Unknown category: ${category}`,
        availableCategories: Object.keys(indexMap)
      });
    }

    const results = await memorySearch.search(indexName, q, {
      limit: parseInt(limit),
      fuzzy: true
    });

    res.json({
      category: category,
      query: q,
      results: results.map(r => ({ ...r, category })),
      count: results.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Faceted search (search with filters and facets)
app.post('/search/faceted', async (req, res) => {
  try {
    const { query, facets = [], filters = {}, limit = 20 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Perform searches across different indices
    const results = {
      users: [],
      products: [],
      articles: []
    };

    const facetCounts = {};

    // Search users
    const userResults = await memorySearch.search('users', query, {
      limit: parseInt(limit),
      filters: filters.users || {}
    });
    results.users = userResults;

    // Calculate facets for users (departments, roles)
    if (facets.includes('department')) {
      facetCounts.department = {};
      sampleData.users.forEach(user => {
        facetCounts.department[user.department] = (facetCounts.department[user.department] || 0) + 1;
      });
    }

    // Search products
    const productResults = await memorySearch.search('products', query, {
      limit: parseInt(limit),
      filters: filters.products || {}
    });
    results.products = productResults;

    // Calculate facets for products (categories, brands)
    if (facets.includes('category')) {
      facetCounts.category = {};
      sampleData.products.forEach(product => {
        facetCounts.category[product.category] = (facetCounts.category[product.category] || 0) + 1;
      });
    }
    if (facets.includes('brand')) {
      facetCounts.brand = {};
      sampleData.products.forEach(product => {
        facetCounts.brand[product.brand] = (facetCounts.brand[product.brand] || 0) + 1;
      });
    }

    // Search articles
    const articleResults = await memorySearch.search('articles', query, {
      limit: parseInt(limit),
      filters: filters.articles || {}
    });
    results.articles = articleResults;

    res.json({
      query: query,
      results: results,
      facets: facetCounts,
      totalResults: userResults.length + productResults.length + articleResults.length,
      filters: filters
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Similar items/recommendations
app.get('/search/similar/:indexName/:id', async (req, res) => {
  try {
    const { indexName, id } = req.params;
    const { limit = 5 } = req.query;

    const similar = await memorySearch.findSimilar(indexName, id, {
      limit: parseInt(limit)
    });

    res.json({
      index: indexName,
      sourceId: id,
      similar: similar,
      count: similar.length
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event listeners
globalEventEmitter.on('search:query', (data) => {
  console.log(`🔍 Search query: "${data.query}" in ${data.index || 'all indices'} (${data.results} results)`);
});

globalEventEmitter.on('search:indexed', (data) => {
  console.log(`📚 Document indexed: ${data.id} in ${data.index}`);
});

globalEventEmitter.on('search:removed', (data) => {
  console.log(`🗑️ Document removed: ${data.id} from ${data.index}`);
});

// Start server and index sample data
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🔍 Searching Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Searching Interface: http://localhost:3000/services/searching/');
  console.log('- Swagger API Docs: http://localhost:3000/services/searching/swagger');
  console.log('- Service Status: http://localhost:3000/services/searching/api/status');
  console.log('- Basic Search: GET http://localhost:3000/search?q=javascript&limit=5');
  console.log('- Advanced Search: POST http://localhost:3000/search/advanced');
  console.log('- Autocomplete: GET http://localhost:3000/search/suggest?q=java&limit=5');
  console.log('- Category Search: GET http://localhost:3000/search/people?q=john');
  console.log('- Faceted Search: POST http://localhost:3000/search/faceted');
  console.log('- Similar Items: GET http://localhost:3000/search/similar/products/p1');
  console.log('- Index Document: POST http://localhost:3000/index/{indexName}/{id}');
  console.log('- Remove Document: DELETE http://localhost:3000/index/{indexName}/{id}');
  console.log('- Index Stats: GET http://localhost:3000/index/{indexName}/stats');
  console.log('- List Indices: GET http://localhost:3000/indices');
  console.log('- Search Analytics: GET http://localhost:3000/search/analytics');
  console.log('\nExample advanced search:');
  console.log('{ "query": "javascript", "indices": ["articles"], "filters": {"category": "programming"}, "limit": 10 }');
  console.log('\nExample faceted search:');
  console.log('{ "query": "apple", "facets": ["category", "brand"], "filters": {"products": {"category": "electronics"}} }');
  console.log('\nAvailable indices: users, products, articles');
  console.log('Available categories: people/users, products/items, articles/content/blog');

  // Index sample data
  await indexSampleData();
});