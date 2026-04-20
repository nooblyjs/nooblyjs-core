# Searching Service Usage Guide

## Overview

The Searching Service provides full-text search and indexing capabilities with support for multiple named indexes. It offers both a server-side REST API and a client-side JavaScript library for browser-based search operations.

## Key Features

- **Full-text search** with multi-index support
- **Client-side JavaScript library** for easy integration
- **Remote search** via REST API
- **Local search** implementation in browser (client-side only)
- **Search suggestions** and autocomplete support
- **Flexible document storage** with JSON support
- **Analytics tracking** for search queries

## Installation

### Server-Side (REST API)

The searching service is automatically available at `/services/searching/api` when the digital-technologies-core server is running.

### Client-Side (JavaScript Library)

Include the searching client library in your HTML:

```html
<script src="/services/searching/scripts"></script>
```

## Usage Examples

### Client-Side Search (Remote API)

Create a remote search instance to query the server-side search engine:

```javascript
// Initialize remote search service
const remoteSearch = new searchService({ provider: 'remote' });

// Search for documents
const results = await remoteSearch.search('apples');
console.log(results);

// Add a document
const key = await remoteSearch.addDocument({
  title: 'Apple Pie Recipe',
  content: 'A delicious apple pie...'
});

// Delete a document
await remoteSearch.deleteDocument(key);

// Get suggestions
const suggestions = await remoteSearch.getSuggestions('app', 10);
```

### Client-Side Search (Local/Browser-Only)

Create a local search instance for client-side search without server involvement:

```javascript
// Initialize local search service (no server needed)
const localSearch = new searchService();

// Add documents
await localSearch.addDocument({
  id: 1,
  title: 'Apple Pie',
  content: 'Delicious dessert'
});

await localSearch.addDocument({
  id: 2,
  title: 'Apple Juice',
  content: 'Fresh and healthy'
});

// Search documents
const results = await localSearch.search('apple');
console.log(results); // Returns both documents with match scores

// Get suggestions
const suggestions = await localSearch.getSuggestions('app');

// Get document count
const count = localSearch.getDocumentCount();

// Clear all documents
await localSearch.clear();
```

## API Reference

### Constructor

```javascript
new searchService(options)
```

**Options:**
- `provider` (string): 'remote' for server-side API, undefined/null for client-side
- `instance` (string): Instance name (default: 'default')
- `baseUrl` (string): Base URL for API calls (default: '/services/searching/api')
- `searchContainer` (string): Default search index name

### Methods

#### search(term, [container])

Search for documents containing the given term.

```javascript
const results = await searchService.search('apples');
```

**Parameters:**
- `term` (string): The search term
- `container` (string, optional): Search container/index name

**Returns:** Promise<Array> - Array of matching documents

#### addDocument(document, [key], [container])

Add a document to the search index.

```javascript
const key = await searchService.addDocument({
  title: 'My Document',
  content: 'Document content'
});
```

**Parameters:**
- `document` (Object): Document to add
- `key` (string, optional): Document key (auto-generated if not provided)
- `container` (string, optional): Search container/index name

**Returns:** Promise<string> - The document key

#### deleteDocument(key, [container])

Delete a document from the index.

```javascript
await searchService.deleteDocument('doc-1');
```

**Parameters:**
- `key` (string): Document key to delete
- `container` (string, optional): Search container/index name

**Returns:** Promise<boolean> - True if deleted successfully

#### getSuggestions(term, [limit])

Get search suggestions for autocomplete.

```javascript
const suggestions = await searchService.getSuggestions('app', 5);
```

**Parameters:**
- `term` (string): Partial search term
- `limit` (number, optional): Maximum suggestions (default: 10)

**Returns:** Promise<Array<string>> - Array of suggestion terms

#### clear()

Clear all documents from the index (client-side only).

```javascript
await searchService.clear();
```

**Returns:** Promise<void>

#### getDocumentCount()

Get the number of documents in the index (client-side only).

```javascript
const count = searchService.getDocumentCount();
```

**Returns:** number - Document count

## Server-Side REST API

### Endpoints

#### POST /services/searching/api/add

Add a document to the search index.

**Query Parameters:**
- `searchContainer` (optional): Index name

**Request Body:**
```json
{
  "title": "My Document",
  "content": "Document content"
}
```

**Response:** 200 OK

#### GET /services/searching/api/search/:term

Search for documents.

**Parameters:**
- `term`: Search term (required)
- `searchContainer` (query, optional): Index name

**Response:**
```json
[
  {
    "_key": "doc-uuid",
    "title": "My Document",
    "content": "Document content"
  }
]
```

#### DELETE /services/searching/api/delete/:key

Delete a document.

**Parameters:**
- `key`: Document key (required)
- `searchContainer` (query, optional): Index name

**Response:** 200 OK

#### GET /services/searching/api/indexes

List all available indexes.

**Response:**
```json
{
  "indexes": [
    { "name": "documents", "count": 10 },
    { "name": "articles", "count": 25 }
  ]
}
```

#### GET /services/searching/api/status

Check service status.

**Response:** 200 OK with status message

#### GET /services/searching/api/analytics

Get search analytics.

**Response:**
```json
{
  "operations": {
    "adds": 100,
    "reads": 500,
    "deletes": 10,
    "searches": 200
  },
  "searchTerms": [
    {
      "term": "apple",
      "callCount": 50,
      "totalResults": 120,
      "lastCalled": "2025-12-14T10:30:00Z"
    }
  ]
}
```

## Web UI

The Searching Service includes an interactive web UI at `/services/searching`.

### Dashboard Tab

- View search analytics
- Monitor search operations (adds, reads, deletes, searches)
- Top search terms and statistics

### UI Tab

- **Search interface** for end-users
- **Search box** with autocomplete suggestions
- **Index selector** dropdown to choose which index to search
- **Results display** showing matching documents
- **Event-based** integration for applications

### Data Operations Tab

- Create and manage search indexes
- Add/update documents
- Delete documents
- Perform searches
- View index statistics
- Interactive API testing with Swagger UI

### Settings Tab

- **Configure search service parameters**
- **Dynamic form generation** based on available settings
- **Save/Reload functionality** for settings persistence
- **Type-aware form fields** (text, number, date, select, etc.)
- Display descriptions and helper text for each setting
- Real-time validation and error handling

## Integration with Applications

### Listening for Search Events

The UI tab dispatches custom events that applications can listen to:

```javascript
// Listen for search results
window.addEventListener('searchUIResults', function(event) {
  const { results, searchTerm } = event.detail;
  console.log(`Search for "${searchTerm}" returned ${results.length} results`);
  // Update your application with the results
});

// Listen for result selection
window.addEventListener('searchUIResultSelected', function(event) {
  const { index } = event.detail;
  console.log(`User selected result at index ${index}`);
  // Load the selected result detail
});
```

### Using the Search Component in Your Application

```html
<!-- Include the library -->
<script src="/services/searching/scripts"></script>

<!-- Access the UI tab -->
<iframe src="/services/searching" width="100%" height="600"></iframe>

<!-- Or embed the search component -->
<div id="search-container"></div>
<script>
  // Initialize search functionality
  const search = new searchService({ provider: 'remote' });

  // Listen for results
  window.addEventListener('searchUIResults', function(event) {
    // Handle results in your app
  });
</script>
```

## Configuration

The Searching Service can be configured via options when creating an instance:

```javascript
const search = new searchService({
  provider: 'remote',           // 'remote' or null
  instance: 'default',          // Instance name
  baseUrl: '/services/searching/api',  // API base URL
  searchContainer: 'documents'  // Default index
});
```

## Advanced Usage

### Multi-Index Search

Use different indexes to organize search documents:

```javascript
// Search in specific index
const results = await search.search('apple', 'fruits');

// Add document to specific index
const key = await search.addDocument(
  { name: 'Apple', type: 'Fruit' },
  'apple-1',
  'fruits'
);

// Delete from specific index
await search.deleteDocument('apple-1', 'fruits');
```

### Analytics and Monitoring

Track search performance and user behavior:

```javascript
// Fetch analytics
const response = await fetch('/services/searching/api/analytics');
const analytics = await response.json();

console.log('Total searches:', analytics.operations.searches);
console.log('Top search terms:', analytics.searchTerms);
```

## Performance Considerations

- **Client-side search** is fastest for small datasets (< 10K documents)
- **Remote search** is recommended for large datasets
- **Search suggestions** use debouncing (300ms default) to reduce API calls
- **Local indexing** uses Map for O(1) document lookups

## Error Handling

```javascript
try {
  const results = await search.search('term');
} catch (error) {
  console.error('Search error:', error);
  // Handle error appropriately
}
```

## See Also

- [Digital Technologies Core Documentation](./digital-technologies-core-usage.md)
- REST API Documentation (available in Data Operations tab under API Documentation)
