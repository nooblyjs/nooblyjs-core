/**
 * @fileoverview Token-based Search Service with Inverted Index
 * Provides full-text search with tokenization, relevance scoring, disk persistence,
 * suggestions, and memory safety guards — extracted from digital-technologies-knowledge.
 *
 * @author Digital Technologies Team
 * @version 1.0.0
 * @since 1.0.16
 */

'use strict';

const fs = require('node:fs').promises;
const path = require('node:path');
const analytics = require('../modules/analytics');

// Stop words for filtering noise
const STOP_WORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those'
]);

/**
 * A token-based search service with inverted index, disk persistence, and relevance scoring.
 * Provides O(1) per-token lookup and memory-efficient content indexing.
 * @class
 */
class SearchTokenService {
    /**
     * Initializes the token-based search service.
     * @param {Object=} options Configuration options.
     * @param {string=} options.indexDir Directory for disk persistence (if null, no persistence).
     * @param {number=} options.maxTokensPerDocument Default: 500.
     * @param {number=} options.maxTotalTokens Default: 500000.
     * @param {number=} options.minTokenLength Default: 3.
     * @param {number=} options.diskTTLHours Default: 24.
     * @param {EventEmitter=} eventEmitter Optional event emitter.
     * @param {Object=} dependencies Injected service dependencies.
     */
    constructor(options = {}, eventEmitter, dependencies = {}) {
        this.logger = dependencies.logging || null;
        this.eventEmitter_ = eventEmitter;

        // Per-container storage: containerName → { tokens, documents, metadata }
        this.containers = new Map();

        // Create default container
        this.createContainer_('default');

        // Configuration
        this.maxTokensPerDocument = options.maxTokensPerDocument || 500;
        this.maxTotalTokens = options.maxTotalTokens || 500000;
        this.minTokenLength = options.minTokenLength || 3;
        this.diskTTLHours = options.diskTTLHours || 24;
        this.stopWords = STOP_WORDS;
        this.indexDir = options.indexDir || null;

        this.isIndexing = false;
        this.lastIndexTime = null;

        // Settings for consistency with SearchService
        this.settings = {
            description: 'Token-based search with inverted index',
            list: []
        };
    }

    /**
     * Creates a new named container if it doesn't exist.
     * @private
     */
    createContainer_(containerName) {
        if (!this.containers.has(containerName)) {
            this.containers.set(containerName, {
                tokens: new Map(),      // token → Set<docId>
                documents: new Map(),   // docId → { metadata, excerpt, isIndexed }
            });
        }
    }

    /**
     * Gets or creates a container.
     * @private
     */
    getContainer_(containerName) {
        const resolved = containerName || 'default';
        this.createContainer_(resolved);
        return this.containers.get(resolved);
    }

    // ─── Disk Persistence ────────────────────────────────────────────

    /**
     * Ensure the index directory exists.
     * @private
     */
    async _ensureIndexDir() {
        if (!this.indexDir) return;
        try {
            await fs.mkdir(this.indexDir, { recursive: true });
        } catch (error) {
            this.logger?.warn(`Could not create index directory: ${error.message}`);
        }
    }

    /**
     * Save a container's index to disk.
     * @private
     */
    async _saveContainerToDisk(containerName, container) {
        if (!this.indexDir) return;

        await this._ensureIndexDir();

        try {
            const containerDir = path.join(this.indexDir, containerName);
            await fs.mkdir(containerDir, { recursive: true });

            // Save documents metadata
            const docsObj = {};
            for (const [docId, docInfo] of container.documents) {
                docsObj[docId] = { ...docInfo };
            }
            await fs.writeFile(
                path.join(containerDir, 'documents.json'),
                JSON.stringify(docsObj, null, 0),
                'utf8'
            );

            // Save token index
            const tokensObj = {};
            for (const [token, docIds] of container.tokens) {
                tokensObj[token] = Array.from(docIds);
            }
            await fs.writeFile(
                path.join(containerDir, 'tokens.json'),
                JSON.stringify(tokensObj, null, 0),
                'utf8'
            );

            // Save metadata
            await fs.writeFile(
                path.join(containerDir, 'meta.json'),
                JSON.stringify({
                    lastIndexTime: this.lastIndexTime,
                    totalDocuments: container.documents.size,
                    totalTokens: container.tokens.size,
                    version: '1.0.0'
                }, null, 2),
                'utf8'
            );

            this.logger?.info(`[SearchTokenService] Saved ${containerName} to disk: ${container.documents.size} docs, ${container.tokens.size} tokens`);
        } catch (error) {
            this.logger?.error(`[SearchTokenService] Failed to save ${containerName} to disk: ${error.message}`);
        }
    }

    /**
     * Load a container's index from disk.
     * @private
     */
    async _loadContainerFromDisk(containerName, container) {
        if (!this.indexDir) return false;

        try {
            const containerDir = path.join(this.indexDir, containerName);
            const metaPath = path.join(containerDir, 'meta.json');

            // Check if exists and not expired
            const meta = JSON.parse(await fs.readFile(metaPath, 'utf8'));

            if (meta.version !== '1.0.0') {
                this.logger?.info(`[SearchTokenService] ${containerName} version mismatch, will rebuild`);
                return false;
            }

            // Check TTL
            if (meta.lastIndexTime) {
                const age = Date.now() - new Date(meta.lastIndexTime).getTime();
                const maxAge = this.diskTTLHours * 60 * 60 * 1000;
                if (age > maxAge) {
                    this.logger?.info(`[SearchTokenService] ${containerName} is ${Math.round(age / 3600000)}h old, will rebuild`);
                    return false;
                }
            }

            // Load documents
            const docsJson = JSON.parse(await fs.readFile(path.join(containerDir, 'documents.json'), 'utf8'));
            container.documents.clear();
            const documentCount = Object.keys(docsJson).length;
            for (const [docId, info] of Object.entries(docsJson)) {
                container.documents.set(docId, info);
            }

            // Load tokens
            const tokensJson = JSON.parse(await fs.readFile(path.join(containerDir, 'tokens.json'), 'utf8'));
            container.tokens.clear();
            for (const [token, docIds] of Object.entries(tokensJson)) {
                container.tokens.set(token, new Set(docIds));
            }

            // Track analytics for loaded documents
            if (documentCount > 0) {
                for (let i = 0; i < documentCount; i++) {
                    analytics.trackAdd(containerName);
                }
            }

            this.lastIndexTime = meta.lastIndexTime ? new Date(meta.lastIndexTime) : null;
            this.logger?.info(`[SearchTokenService] Loaded ${containerName} from disk: ${container.documents.size} docs, ${container.tokens.size} tokens`);
            return true;
        } catch (error) {
            this.logger?.debug(`[SearchTokenService] No valid ${containerName} on disk: ${error.message}`);
            return false;
        }
    }

    /**
     * Save all containers to disk (public API).
     * @param {string=} containerName Optional specific container; if not provided, saves all.
     */
    async saveToDisk(containerName = null) {
        if (!this.indexDir) return;

        if (containerName) {
            const container = this.containers.get(containerName);
            if (container) {
                await this._saveContainerToDisk(containerName, container);
            }
        } else {
            for (const [name, container] of this.containers) {
                await this._saveContainerToDisk(name, container);
            }
        }
    }

    /**
     * Load all containers from disk (public API).
     * @param {string=} containerName Optional specific container.
     * @returns {Promise<boolean>} True if at least one container was loaded.
     */
    async loadFromDisk(containerName = null) {
        if (!this.indexDir) return false;

        if (containerName) {
            const container = this.containers.get(containerName);
            if (!container) return false;
            return await this._loadContainerFromDisk(containerName, container);
        } else {
            let anyLoaded = false;
            for (const [name, container] of this.containers) {
                const loaded = await this._loadContainerFromDisk(name, container);
                if (loaded) anyLoaded = true;
            }
            return anyLoaded;
        }
    }

    // ─── Tokenization ───────────────────────────────────────────────

    /**
     * Tokenize text: lowercase, strip non-word chars, min length, deduplicate, filter stop words.
     */
    tokenize(text) {
        if (!text) return [];

        const tokens = text
            .toLowerCase()
            .replace(/[^\w\s-]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length >= this.minTokenLength)
            .filter(token => !this.stopWords.has(token));

        return [...new Set(tokens)]; // Deduplicate
    }

    // ─── Public: Backward-compatible SearchService API ──────────────

    /**
     * Add a JSON object (backward-compatible with SearchService).
     * Tokenizes the stringified JSON and indexes it.
     */
    async add(key, jsonObject, containerName = 'default') {
        if (!key || typeof key !== 'string' || key.trim() === '') {
            throw new Error('Invalid key: must be a non-empty string');
        }
        if (!jsonObject || typeof jsonObject !== 'object' || Array.isArray(jsonObject)) {
            throw new Error('Invalid jsonObject: must be a non-null object');
        }

        const content = JSON.stringify(jsonObject);
        const metadata = { object: jsonObject, isIndexed: false };

        return this.indexDocument(key, content, metadata, containerName);
    }

    /**
     * Remove a document.
     */
    async remove(key, containerName = 'default') {
        if (!key || typeof key !== 'string' || key.trim() === '') {
            throw new Error('Invalid key: must be a non-empty string');
        }

        return this.removeDocument(key, containerName);
    }

    /**
     * Search for a query (backward-compatible, returns scored results with original objects).
     */
    async search(query, containerName = 'default') {
        if (!query || typeof query !== 'string' || query.trim() === '') {
            throw new Error('Invalid query: must be a non-empty string');
        }

        const results = [];
        const container = this.getContainer_(containerName);

        const queryTokens = this.tokenize(query.trim());
        const scores = new Map(); // docId → score

        for (const token of queryTokens) {
            if (container.tokens.has(token)) {
                const docIds = container.tokens.get(token);
                for (const docId of docIds) {
                    const currentScore = scores.get(docId) || 0;
                    scores.set(docId, currentScore + this.calculateTokenScore_(token, docId, container));
                }
            }
        }

        // Build results array
        for (const [docId, score] of scores.entries()) {
            const docInfo = container.documents.get(docId);
            if (!docInfo) continue;

            results.push({
                key: docId,
                obj: docInfo.object || {},
                score: score,
                metadata: docInfo
            });
        }

        results.sort((a, b) => b.score - a.score);

        // Track search analytics
        const resolvedContainer = containerName || 'default';
        analytics.trackSearch(query, results.length, resolvedContainer);

        if (this.eventEmitter_) {
            this.eventEmitter_.emit('search:search', {
                searchTerm: query,
                searchContainer: resolvedContainer,
                results: results.length
            });
        }

        return results;
    }

    /**
     * Get statistics.
     */
    getStats(containerName = null) {
        if (containerName) {
            const container = this.getContainer_(containerName);
            return {
                searchContainer: containerName,
                totalDocuments: container.documents.size,
                indexedDocuments: Array.from(container.documents.values()).filter(d => d.isIndexed).length,
                totalTokens: container.tokens.size,
                lastIndexTime: this.lastIndexTime
            };
        }

        // Aggregated stats
        let totalDocs = 0, totalIndexedDocs = 0, totalTokens = 0;
        for (const container of this.containers.values()) {
            totalDocs += container.documents.size;
            totalIndexedDocs += Array.from(container.documents.values()).filter(d => d.isIndexed).length;
            totalTokens += container.tokens.size;
        }

        return {
            totalContainers: this.containers.size,
            totalDocuments: totalDocs,
            indexedDocuments: totalIndexedDocs,
            totalTokens: totalTokens,
            lastIndexTime: this.lastIndexTime
        };
    }

    /**
     * Clear all documents from a container.
     */
    clearIndex(containerName = 'default') {
        const container = this.getContainer_(containerName);
        const previousSize = container.documents.size;
        container.documents.clear();
        container.tokens.clear();

        if (this.eventEmitter_) {
            this.eventEmitter_.emit('search:index:cleared', {
                searchContainer: containerName,
                previousSize
            });
        }

        return true;
    }

    /**
     * Delete an entire container.
     */
    deleteIndex(containerName = 'default') {
        if (containerName === 'default') {
            throw new Error('Cannot delete the default container');
        }

        if (!this.containers.has(containerName)) {
            return false;
        }

        const deleted = this.containers.delete(containerName);
        if (deleted && this.eventEmitter_) {
            this.eventEmitter_.emit('search:index:deleted', {
                searchContainer: containerName,
                remainingContainers: this.containers.size
            });
        }

        return deleted;
    }

    /**
     * List all container names.
     */
    listIndexes() {
        return Array.from(this.containers.keys());
    }

    /**
     * Get stats for a specific container (format compatible with SearchService).
     */
    getIndexStats(containerName = 'default') {
        const container = this.getContainer_(containerName);
        return {
            searchContainer: containerName,
            size: container.documents.size,
            keys: Array.from(container.documents.keys()),
            tokenCount: container.tokens.size
        };
    }

    // ─── Public: New token-specific API ──────────────────────────────

    /**
     * Index a document with text content and metadata.
     * Content is tokenized; raw content is NOT stored in memory.
     */
    async indexDocument(id, content, metadata = {}, containerName = 'default') {
        const container = this.getContainer_(containerName);

        // Remove from index if already exists
        this.removeDocument(id, containerName);

        // Tokenize and index content
        const contentTokens = this.tokenize(content);
        const limitedTokens = contentTokens.slice(0, this.maxTokensPerDocument);

        // Check total token cap
        if (container.tokens.size >= this.maxTotalTokens) {
            this.logger?.warn(`[SearchTokenService] Token cap (${this.maxTotalTokens}) reached for ${containerName}`);
        } else {
            for (const token of limitedTokens) {
                this.addTokenToIndex_(token, id, container);
            }
        }

        // Store document metadata (not raw content)
        const docInfo = {
            ...metadata,
            isIndexed: true,
            excerpt: this.generateExcerpt_(content)
        };
        container.documents.set(id, docInfo);

        // Track add analytics (unless called from add() which already tracked)
        const resolvedContainer = containerName || 'default';
        analytics.trackAdd(resolvedContainer);

        if (this.eventEmitter_) {
            this.eventEmitter_.emit('search:add', {
                key: id,
                searchContainer: resolvedContainer,
                tokenCount: limitedTokens.length
            });
        }

        return true;
    }

    /**
     * Remove a document from the index.
     */
    removeDocument(id, containerName = 'default') {
        const container = this.getContainer_(containerName);
        const docInfo = container.documents.get(id);

        if (!docInfo) {
            return false;
        }

        // Remove this doc from all token entries
        for (const [token, docIds] of container.tokens) {
            docIds.delete(id);
            if (docIds.size === 0) {
                container.tokens.delete(token);
            }
        }

        container.documents.delete(id);

        // Track delete analytics
        const resolvedContainer = containerName || 'default';
        analytics.trackDelete(resolvedContainer);

        if (this.eventEmitter_) {
            this.eventEmitter_.emit('search:remove', {
                key: id,
                searchContainer: resolvedContainer
            });
        }

        return true;
    }

    /**
     * Get autocomplete suggestions.
     * Returns document names + token prefix matches.
     */
    suggest(query, options = {}) {
        if (!query || query.length < 2) {
            return [];
        }

        const maxSuggestions = options.maxSuggestions || 10;
        const containerName = options.containerName || 'default';
        const container = this.getContainer_(containerName);
        const queryLower = query.toLowerCase();

        const documentSuggestions = [];
        const tokenSuggestions = [];

        // Document name suggestions
        for (const [, docInfo] of container.documents) {
            const docName = docInfo.name || docInfo.title || '';
            const nameMatches = docName.toLowerCase().includes(queryLower);

            if (nameMatches) {
                documentSuggestions.push({
                    title: docName,
                    type: 'document',
                    relevance: docName.toLowerCase().startsWith(queryLower) ? 2 : 1
                });
            }

            if (documentSuggestions.length >= maxSuggestions) break;
        }

        // Token prefix suggestions
        if (documentSuggestions.length < maxSuggestions) {
            for (const token of container.tokens.keys()) {
                if (token.startsWith(queryLower) && token !== queryLower) {
                    tokenSuggestions.push(token);
                    if (tokenSuggestions.length >= (maxSuggestions - documentSuggestions.length)) break;
                }
            }
        }

        documentSuggestions.sort((a, b) => b.relevance - a.relevance);

        return [
            ...documentSuggestions,
            ...tokenSuggestions
        ].slice(0, maxSuggestions);
    }

    // ─── Internal Helpers ────────────────────────────────────────────

    /**
     * Add a token to the index.
     * @private
     */
    addTokenToIndex_(token, docId, container) {
        if (!container.tokens.has(token)) {
            container.tokens.set(token, new Set());
        }
        container.tokens.get(token).add(docId);
    }

    /**
     * Calculate relevance score for a token in a document.
     * @private
     */
    calculateTokenScore_(token, docId, container) {
        let score = 1;

        const docInfo = container.documents.get(docId);
        if (docInfo) {
            // Bonus if token appears in document name/title
            const docName = (docInfo.name || docInfo.title || '').toLowerCase();
            if (docName.includes(token)) {
                score += 5;
            }

            // Type-specific bonuses
            if (docInfo.type === 'markdown') score += 2;
            if (docInfo.type === 'text') score += 1;
        }

        // Frequency penalty: common tokens are less valuable
        const tokenFrequency = container.tokens.get(token)?.size || 1;
        if (tokenFrequency > 10) {
            score *= 0.7;
        }

        return score;
    }

    /**
     * Generate excerpt from content.
     * @private
     */
    generateExcerpt_(content, maxLength = 200) {
        if (!content) return '';

        const cleanContent = content
            .replace(/#{1,6}\s/g, '')
            .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
            .replace(/`([^`]+)`/g, '$1')
            .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
            .replace(/\n\s*\n/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        if (cleanContent.length <= maxLength) {
            return cleanContent;
        }

        return cleanContent.substring(0, maxLength).replace(/\s+\w*$/, '') + '...';
    }

    // ─── Settings (compatibility with SearchService) ──────────────────

    /**
     * Get settings.
     */
    async getSettings() {
        return this.settings;
    }

    /**
     * Save settings.
     */
    async saveSettings(settings) {
        // Placeholder for settings management
    }
}

module.exports = SearchTokenService;
