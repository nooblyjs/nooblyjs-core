# NooblyJS Core Caching Client Library

A powerful, lightweight JavaScript library for client-side access to the NooblyJS Core caching service. Use this library to cache data directly from your web applications.

## Quick Start

### 1. Include the Library

Add a single script tag to your HTML:

```html
<script src="/services/caching/scriptlibrary"></script>
```

### 2. Initialize and Use

```javascript
// Create a cache instance
const cache = new nooblyjsCaching({ instanceName: 'default' });

// Store data
await cache.put('user:123', { name: 'John', age: 30 });

// Retrieve data
const user = await cache.get('user:123');
console.log(user); // { name: 'John', age: 30 }

// Delete data
await cache.delete('user:123');
```

## Features

- **Simple API** - Intuitive methods for cache operations
- **Promise-based** - Full async/await support
- **Batch Operations** - Store, retrieve, and delete multiple items at once
- **Multi-instance Support** - Work with different cache instances
- **Debug Mode** - Optional logging for troubleshooting
- **Error Handling** - Comprehensive error messages
- **Timeouts** - Configurable request timeouts
- **Zero Dependencies** - Works in all modern browsers

## Installation

The library is automatically served by the NooblyJS Core caching service. No npm installation required!

## Usage

### Basic Operations

#### Store Data
```javascript
const cache = new nooblyjsCaching();

// Store a simple value
cache.put('greeting', 'Hello World')
  .then(() => console.log('Stored!'))
  .catch(err => console.error('Error:', err));

// Store an object
cache.put('user:123', {
  id: 123,
  name: 'John Doe',
  email: 'john@example.com',
  role: 'admin'
})
  .then(() => console.log('User stored!'))
  .catch(err => console.error('Error:', err));
```

#### Retrieve Data
```javascript
cache.get('user:123')
  .then(user => {
    console.log('User:', user);
    console.log('Name:', user.name);
  })
  .catch(err => console.error('Error:', err));
```

#### Delete Data
```javascript
cache.delete('user:123')
  .then(() => console.log('User deleted!'))
  .catch(err => console.error('Error:', err));
```

#### Check if Key Exists
```javascript
cache.exists('user:123')
  .then(exists => {
    if (exists) {
      console.log('User found in cache');
    } else {
      console.log('User not in cache');
    }
  });
```

### Advanced Usage

#### Batch Operations

Store multiple values at once:
```javascript
const users = {
  'user:100': { name: 'Alice', role: 'admin' },
  'user:101': { name: 'Bob', role: 'user' },
  'user:102': { name: 'Charlie', role: 'user' }
};

cache.putBatch(users)
  .then(results => {
    console.log('All users stored!');
    results.forEach(r => {
      console.log(`${r.key}: ${r.success ? 'OK' : 'FAILED'}`);
    });
  });
```

Retrieve multiple values at once:
```javascript
cache.getBatch(['user:100', 'user:101', 'user:102'])
  .then(users => {
    console.log('Retrieved users:', users);
    // { 'user:100': {...}, 'user:101': {...}, 'user:102': {...} }
  });
```

Delete multiple values at once:
```javascript
cache.clear(['user:100', 'user:101', 'user:102'])
  .then(results => console.log('All users cleared!'));
```

#### Multi-instance Support

Work with different cache instances:
```javascript
// Default instance
const defaultCache = new nooblyjsCaching({ instanceName: 'default' });

// Custom instance
const sessionCache = new nooblyjsCaching({ instanceName: 'sessions' });

// Store in different caches
await defaultCache.put('config', { theme: 'dark' });
await sessionCache.put('user:123:session', { token: 'xyz' });
```

#### Debug Mode

Enable logging for troubleshooting:
```javascript
const cache = new nooblyjsCaching({
  instanceName: 'default',
  debug: true  // Enable debug logging
});

// Now all operations will log to the console
cache.put('test', 'value');
// Logs: [nooblyjsCaching:default] Storing key: test
// Logs: [nooblyjsCaching:default] Successfully stored key: test
```

#### Custom Configuration

```javascript
const cache = new nooblyjsCaching({
  instanceName: 'my-cache',        // Cache instance name
  baseUrl: 'http://localhost:3001', // Server URL
  debug: true,                      // Enable debug logging
  timeout: 10000                    // Request timeout (ms)
});
```

### Service Information

Check service status:
```javascript
cache.status()
  .then(status => console.log('Status:', status))
  .catch(err => console.error('Service unavailable:', err));
```

List available instances:
```javascript
cache.listInstances()
  .then(instances => {
    console.log('Available instances:');
    instances.forEach(inst => {
      console.log(`- ${inst.name} (${inst.provider})`);
    });
  });
```

## API Reference

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `instanceName` | string | `'default'` | Cache instance name |
| `baseUrl` | string | `window.location.origin` | Server base URL |
| `debug` | boolean | `false` | Enable debug logging |
| `timeout` | number | `5000` | Request timeout in milliseconds |

### Methods

#### `put(key, value)`
Store a value in the cache.
- **Parameters:**
  - `key` (string): The cache key
  - `value` (any): The value to store (must be JSON-serializable)
- **Returns:** Promise<void>

#### `get(key)`
Retrieve a value from the cache.
- **Parameters:**
  - `key` (string): The cache key
- **Returns:** Promise<any>

#### `delete(key)`
Delete a value from the cache.
- **Parameters:**
  - `key` (string): The cache key
- **Returns:** Promise<void>

#### `exists(key)`
Check if a key exists in the cache.
- **Parameters:**
  - `key` (string): The cache key
- **Returns:** Promise<boolean>

#### `putBatch(items)`
Store multiple values at once.
- **Parameters:**
  - `items` (object): Object with key-value pairs
- **Returns:** Promise<Array>

#### `getBatch(keys)`
Retrieve multiple values at once.
- **Parameters:**
  - `keys` (array): Array of cache keys
- **Returns:** Promise<object>

#### `clear(keys)`
Delete multiple values at once.
- **Parameters:**
  - `keys` (array): Array of cache keys
- **Returns:** Promise<Array>

#### `status()`
Check the cache service status.
- **Returns:** Promise<string>

#### `listInstances()`
Get a list of available cache instances.
- **Returns:** Promise<Array>

## Key Naming Conventions

Use hierarchical keys for better organization:

```javascript
// User data
cache.put('user:123:profile', {...});
cache.put('user:123:settings', {...});
cache.put('user:123:preferences', {...});

// Configuration
cache.put('config:app:theme', 'dark');
cache.put('config:app:language', 'en');

// Session data
cache.put('session:abc123:token', 'xyz');
cache.put('session:abc123:user', 'john');

// Analytics
cache.put('analytics:daily:2024-01-15', {...});
```

## Error Handling

Always handle errors appropriately:

```javascript
cache.get('user:123')
  .then(data => {
    // Success
    console.log('Data:', data);
  })
  .catch(error => {
    // Handle error
    if (error.message.includes('Request timeout')) {
      console.error('Request took too long');
    } else if (error.message.includes('HTTP 404')) {
      console.error('Key not found');
    } else {
      console.error('Unexpected error:', error);
    }
  });
```

## Testing

Visit the interactive test page:
```
http://localhost:3001/services/caching/scriptlibrary/test
```

The test page provides:
- Configuration panel for testing different instances
- Interactive tools for all cache operations
- Batch operation demos
- Service status monitoring
- Console output for debugging

## Browser Support

The library works in all modern browsers that support:
- ES6 (ECMAScript 2015)
- Fetch API
- Promises
- async/await

Tested on:
- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

## Performance Tips

1. **Use hierarchical keys** - Organize data with meaningful key names
2. **Batch operations** - Use putBatch/getBatch for multiple items
3. **Check existence first** - Use exists() before get() if needed
4. **Set appropriate timeouts** - Adjust timeout for your network
5. **Enable debug mode** - Only during development

## Limitations

- Values must be JSON-serializable
- Key size and value size limits depend on the backend provider
- Cache is not persistent by default (depends on provider configuration)

## Support

For issues or questions:
1. Check the test page: `/services/caching/scriptlibrary/test`
2. Enable debug mode to see detailed logs
3. Check the console for error messages
4. Review the examples in this README

## License

Part of the NooblyJS Core framework. See main repository for license information.

## Version

- **Library Version:** 1.0.0
- **Framework:** NooblyJS Core v1.0.15+
- **Last Updated:** 2024
