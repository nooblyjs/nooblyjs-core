/**
 * @fileoverview Data Service Demo
 * Example showing how to use the NooblyJS Data Service
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

// Example 1: Using memory datastore (default)
const memoryDatastore = serviceRegistry.dataService('memory', {
  // Optional configuration
});

// Example 2: Using file-based datastore
const fileDatastore = serviceRegistry.dataService('file', {
  dataPath: './data'
});

// Example 3: Using MongoDB datastore (requires MongoDB connection)
/*
const mongoDatastore = serviceRegistry.dataService('mongodb', {
  connectionString: 'mongodb://localhost:27017/nooblyjs'
});
*/

// Sample data setup
async function setupSampleData() {
  try {
    // Create containers first
    await memoryDatastore.createContainer('users');
    await memoryDatastore.createContainer('products');

    // Users container
    const users = [
      { name: 'John Doe', email: 'john@example.com', role: 'admin', active: true },
      { name: 'Jane Smith', email: 'jane@example.com', role: 'user', active: true },
      { name: 'Bob Johnson', email: 'bob@example.com', role: 'user', active: false },
      { name: 'Alice Brown', email: 'alice@example.com', role: 'moderator', active: true }
    ];

    for (const user of users) {
      await memoryDatastore.add('users', user);
    }

    // Products container
    const products = [
      { name: 'Laptop', category: 'electronics', price: 999.99, inStock: true },
      { name: 'Chair', category: 'furniture', price: 149.99, inStock: true },
      { name: 'Book', category: 'books', price: 19.99, inStock: false },
      { name: 'Phone', category: 'electronics', price: 699.99, inStock: true }
    ];

    for (const product of products) {
      await memoryDatastore.add('products', product);
    }

    console.log('Sample data loaded successfully');
  } catch (error) {
    console.error('Error loading sample data:', error);
  }
}

// Custom routes using data service
app.get('/users', async (req, res) => {
  try {
    const { role, active } = req.query;
    let users = await memoryDatastore.find('users', '');

    // Apply filters
    if (role) {
      users = users.filter(user => user.role === role);
    }

    if (active !== undefined) {
      const isActive = active === 'true';
      users = users.filter(user => user.active === isActive);
    }

    res.json({
      users: users,
      count: users.length,
      filters: { role, active }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/users', async (req, res) => {
  try {
    const userData = req.body;

    // Validate required fields
    if (!userData.name || !userData.email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Set defaults
    userData.role = userData.role || 'user';
    userData.active = userData.active !== false;
    userData.createdAt = new Date().toISOString();

    const result = await memoryDatastore.add('users', userData);

    res.status(201).json({
      success: true,
      id: result,
      user: userData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await memoryDatastore.getByUuid('users', id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const existingUser = await memoryDatastore.getByUuid('users', id);
    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updatedUser = { ...existingUser, ...updates, updatedAt: new Date().toISOString() };
    await memoryDatastore.remove('users', id);
    const newId = await memoryDatastore.add('users', updatedUser);

    res.json({
      success: true,
      id: newId,
      user: updatedUser
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await memoryDatastore.remove('users', id);

    res.json({
      success: true,
      message: `User ${id} deleted`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Advanced search examples
app.get('/search/users', async (req, res) => {
  try {
    const { email, name } = req.query;

    if (email) {
      // Search by exact email
      const results = await memoryDatastore.jsonFindByPath('users', 'email', email);
      return res.json({ results, searchType: 'email' });
    }

    if (name) {
      // Search by name containing text (using predicate)
      const results = await memoryDatastore.jsonFind('users', `obj.name.toLowerCase().includes('${name.toLowerCase()}')`);
      return res.json({ results, searchType: 'name_contains' });
    }

    res.status(400).json({ error: 'Provide email or name parameter' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/search/advanced', async (req, res) => {
  try {
    const { container, criteria } = req.body;

    if (!container || !criteria) {
      return res.status(400).json({ error: 'Container and criteria are required' });
    }

    const results = await memoryDatastore.jsonFindByCriteria(container, criteria);

    res.json({
      results,
      count: results.length,
      container,
      criteria
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Products examples
app.get('/products/in-stock', async (req, res) => {
  try {
    const results = await memoryDatastore.jsonFindByPath('products', 'inStock', 'true');

    res.json({
      products: results,
      count: results.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/products/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const results = await memoryDatastore.jsonFindByPath('products', 'category', category);

    res.json({
      products: results,
      count: results.length,
      category
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk operations
app.post('/bulk/users', async (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users)) {
      return res.status(400).json({ error: 'Users must be an array' });
    }

    const results = [];
    for (const user of users) {
      try {
        const result = await memoryDatastore.add('users', {
          ...user,
          createdAt: new Date().toISOString()
        });
        results.push({ success: true, id: result, user });
      } catch (error) {
        results.push({ success: false, error: error.message, user });
      }
    }

    res.json({ results });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Event listeners
globalEventEmitter.on('api-dataservice-put', (data) => {
  console.log(`Data stored in container '${data.container}' with ID: ${data.id}`);
});

globalEventEmitter.on('api-dataservice-get', (data) => {
  console.log(`Data retrieved from container '${data.container}' with ID: ${data.id}`);
});

globalEventEmitter.on('api-dataservice-delete', (data) => {
  console.log(`Data deleted from container '${data.container}' with ID: ${data.id}`);
});

globalEventEmitter.on('api-dataservice-search', (data) => {
  console.log(`Search performed on container '${data.container}': ${data.results.length} results`);
});

// Start server and load sample data
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`\n🗃️ Data Service Demo running on port ${PORT}\n`);
  console.log('Available endpoints:');
  console.log('- Data Service Interface: http://localhost:3000/services/dataservice/');
  console.log('- Swagger API Docs: http://localhost:3000/services/dataservice/swagger');
  console.log('- Service Status: http://localhost:3000/services/dataservice/api/status');
  console.log('- List Users: GET http://localhost:3000/users');
  console.log('- Create User: POST http://localhost:3000/users');
  console.log('- Get User: GET http://localhost:3000/users/{id}');
  console.log('- Update User: PUT http://localhost:3000/users/{id}');
  console.log('- Delete User: DELETE http://localhost:3000/users/{id}');
  console.log('- Search Users: GET http://localhost:3000/search/users?email=john@example.com');
  console.log('- Advanced Search: POST http://localhost:3000/search/advanced');
  console.log('- In-Stock Products: GET http://localhost:3000/products/in-stock');
  console.log('- Products by Category: GET http://localhost:3000/products/category/electronics');
  console.log('- Bulk Create Users: POST http://localhost:3000/bulk/users');
  console.log('\nExample user creation:');
  console.log('{ "name": "New User", "email": "new@example.com", "role": "user", "active": true }');
  console.log('\nExample advanced search:');
  console.log('{ "container": "users", "criteria": { "role": "admin", "active": true } }');

  // Load sample data
  await setupSampleData();
});