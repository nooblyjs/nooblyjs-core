/**
 * @fileoverview Azure Cache for Redis provider for NooblyJS Core caching service.
 * Leverages Redis-based Azure Cache for distributed caching with managed authentication.
 * Uses the existing CacheRedis provider under the hood with Azure-specific configuration.
 *
 * @author NooblyJS Team
 * @version 1.0.14
 * @since 1.0.15
 */

'use strict';

const CacheRedis = require('./cachingRedis');

/**
 * Azure Cache for Redis provider
 * Automatically configures connection to Azure Cache for Redis instances
 * Supports both Standard and Premium tiers with automatic tier detection
 *
 * @class CacheAzureRedis
 */
class CacheAzureRedis extends CacheRedis {
  /**
   * Initializes Azure Cache for Redis client
   * Automatically detects and configures Azure Redis endpoints
   *
   * @param {Object=} options Configuration options
   * @param {string} options.connectionString - Azure Redis connection string (e.g., myredis.redis.cache.windows.net:6379,password=XXX,ssl=True)
   * @param {string} options.hostname - Azure Redis hostname (e.g., myredis.redis.cache.windows.net)
   * @param {number} options.port - Azure Redis port (default: 6379 for non-SSL, 6380 for SSL)
   * @param {string} options.accessKey - Azure Redis access key (can be primary or secondary)
   * @param {string} options.resourceGroup - Azure resource group name
   * @param {string} options.resourceName - Azure Cache resource name
   * @param {string} options.tier - Azure tier: 'standard' or 'premium' (auto-detected)
   * @param {boolean} options.ssl - Enable SSL encryption (default: true)
   * @param {EventEmitter=} eventEmitter Optional event emitter for cache events
   */
  constructor(options, eventEmitter) {
    // Extract Azure-specific options
    const azureOptions = CacheAzureRedis.parseAzureOptions(options);

    // Call parent Redis constructor with Azure-configured options
    super(azureOptions, eventEmitter);

    // Store Azure-specific metadata
    this.azureHostname_ = azureOptions.hostname;
    this.azurePort_ = azureOptions.port;
    this.azureResourceGroup_ = azureOptions.resourceGroup;
    this.azureResourceName_ = azureOptions.resourceName;
    this.azureTier_ = azureOptions.tier;

    // Update settings description for Azure
    this.settings.description = 'Azure Cache for Redis configuration';
    this.settings.list = [
      {
        setting: 'connectionString',
        type: 'string',
        description: 'Azure Redis connection string',
        example: 'myredis.redis.cache.windows.net:6379,password=XXX,ssl=True',
        optional: true
      },
      {
        setting: 'hostname',
        type: 'string',
        description: 'Azure Redis hostname',
        example: 'myredis.redis.cache.windows.net'
      },
      {
        setting: 'port',
        type: 'number',
        description: 'Azure Redis port',
        default: 6380
      },
      {
        setting: 'accessKey',
        type: 'string',
        description: 'Azure Redis access key (primary or secondary)',
        optional: true
      },
      {
        setting: 'resourceGroup',
        type: 'string',
        description: 'Azure resource group name',
        example: 'my-resource-group'
      },
      {
        setting: 'resourceName',
        type: 'string',
        description: 'Azure Cache resource name',
        example: 'myredis'
      },
      {
        setting: 'tier',
        type: 'string',
        description: 'Azure tier (standard or premium)',
        example: 'premium',
        optional: true
      },
      {
        setting: 'ssl',
        type: 'boolean',
        description: 'Enable SSL encryption',
        default: true
      }
    ];
  }

  /**
   * Parse and validate Azure Redis options
   * Automatically detects endpoint from connection string or environment variables
   *
   * @private
   * @param {Object} options User-provided options
   * @return {Object} Processed options for Redis client
   */
  static parseAzureOptions(options = {}) {
    let hostname, port, password, tier;

    // Parse connection string if provided (format: host:port,password=XXX,ssl=True)
    if (options.connectionString) {
      const parts = options.connectionString.split(',');
      const hostPort = parts[0].split(':');
      hostname = hostPort[0];
      port = parseInt(hostPort[1]) || 6380;

      // Extract password from connection string
      parts.forEach(part => {
        const [key, value] = part.split('=');
        if (key === 'password') {
          password = value;
        }
      });
    } else {
      // Use individual options or environment variables
      hostname =
        options.hostname ||
        process.env.AZURE_REDIS_HOSTNAME ||
        'localhost';

      port =
        options.port ||
        parseInt(process.env.AZURE_REDIS_PORT) ||
        6380; // Azure defaults to 6380 for SSL

      password =
        options.accessKey ||
        process.env.AZURE_REDIS_ACCESS_KEY ||
        undefined;
    }

    // Determine tier from options or default to premium
    tier = options.tier || process.env.AZURE_REDIS_TIER || 'premium';

    // Validate tier
    if (!['standard', 'premium'].includes(tier.toLowerCase())) {
      tier = 'premium';
    }

    const resourceGroup = options.resourceGroup || process.env.AZURE_RESOURCE_GROUP || 'default';
    const resourceName = options.resourceName || process.env.AZURE_RESOURCE_NAME || 'default';

    // SSL is default for Azure (highly recommended)
    const ssl = options.ssl !== false;

    // Build Redis client options
    const redisOptions = {
      ...options,
      // Override with Azure-specific settings
      host: hostname,
      port: port,
      // Azure authentication
      password: password || undefined,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 3,
      retryDelayOnFailover: 100,
      // TLS encryption for in-transit security (required by Azure)
      tls: ssl ? {
        rejectUnauthorized: true,
        servername: hostname // Required for Azure SNI
      } : undefined,
      // Connection pooling optimized for Azure
      poolSize: options.poolSize || 10,
      keepAlive: 60000, // Keep-alive for Azure connections
      connectTimeout: 10000,
      commandTimeout: 5000,
      // Reconnection strategy for Azure failover
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      // Store for reference
      hostname,
      port,
      tier,
      resourceGroup,
      resourceName,
      providerType: 'azure-redis'
    };

    return redisOptions;
  }

  /**
   * Detect Azure Cache tier and update configuration
   * Call this after connection to optimize for Standard or Premium mode
   *
   * @return {!Promise<{tier: string, size: string, region: string, endpoints: Array}>}
   */
  async detectCacheTier() {
    try {
      await this.ensureConnection_();

      // Get Redis info to detect configuration
      const info = await this.client_.info('server');
      const memoryInfo = await this.client_.info('memory');

      // Parse memory to estimate tier
      const maxMemory = this.parseRedisInfo_(memoryInfo, 'maxmemory');
      const usedMemory = this.parseRedisInfo_(memoryInfo, 'used_memory_human');

      // Estimate tier based on max memory
      let estimatedTier = 'standard'; // Default
      if (maxMemory > 53687091200) { // > 50GB
        estimatedTier = 'premium';
      }

      const tierInfo = {
        tier: this.azureTier_,
        estimatedTier: estimatedTier,
        maxMemory: maxMemory,
        usedMemory: usedMemory,
        hostname: this.azureHostname_,
        resourceGroup: this.azureResourceGroup_,
        resourceName: this.azureResourceName_
      };

      if (this.eventEmitter_) {
        this.eventEmitter_.emit('azure-redis:tier-detected', tierInfo);
      }

      return tierInfo;
    } catch (error) {
      console.warn('Could not detect Azure Cache tier:', error.message);
      return {
        tier: this.azureTier_,
        hostname: this.azureHostname_,
        resourceGroup: this.azureResourceGroup_,
        resourceName: this.azureResourceName_,
        error: error.message
      };
    }
  }

  /**
   * Parse Redis INFO response to extract key values
   * @private
   * @param {string} info Redis INFO response
   * @param {string} key Key to extract
   * @return {string|number} The value
   */
  parseRedisInfo_(info, key) {
    const lines = info.split('\r\n');
    for (const line of lines) {
      if (line.startsWith(key + ':')) {
        const value = line.split(':')[1];
        // Try to parse as number
        const num = parseInt(value);
        return isNaN(num) ? value : num;
      }
    }
    return null;
  }

  /**
   * Get Azure Cache for Redis connection information
   * Extends parent method with Azure-specific metadata
   *
   * @return {Object} Connection info with Azure metadata
   */
  getConnectionInfo() {
    const parentInfo = super.getConnectionInfo();
    return {
      ...parentInfo,
      hostname: this.azureHostname_,
      port: this.azurePort_,
      resourceGroup: this.azureResourceGroup_,
      resourceName: this.azureResourceName_,
      tier: this.azureTier_,
      provider: 'azure-redis',
      ssl: this.client_.options.tls ? true : false
    };
  }

  /**
   * Get Azure Cache for Redis-specific analytics
   * Extends parent analytics with Azure metrics
   *
   * @return {Object} Analytics with Azure-specific metrics
   */
  async getAnalytics() {
    try {
      const parentAnalytics = super.getAnalytics();

      // Get additional Azure metrics from Redis INFO
      await this.ensureConnection_();
      const info = await this.client_.info('stats');
      const memoryInfo = await this.client_.info('memory');

      const stats = {};
      const infoToProcess = info + '\r\n' + memoryInfo;

      infoToProcess.split('\r\n').forEach((line) => {
        const [key, value] = line.split(':');
        if (key && value) {
          stats[key] = value;
        }
      });

      return {
        ...parentAnalytics,
        cacheHits: parseInt(stats.keyspace_hits) || 0,
        cacheMisses: parseInt(stats.keyspace_misses) || 0,
        evictions: parseInt(stats.evicted_keys) || 0,
        usedMemory: stats.used_memory_human || 'N/A',
        maxMemory: stats.maxmemory_human || 'N/A',
        connectedClients: parseInt(stats.connected_clients) || 0,
        hostname: this.azureHostname_,
        resourceGroup: this.azureResourceGroup_,
        resourceName: this.azureResourceName_,
        tier: this.azureTier_,
        provider: 'azure-redis'
      };
    } catch (error) {
      console.warn('Could not get Azure analytics:', error.message);
      return super.getAnalytics();
    }
  }

  /**
   * Get Azure Cache for Redis-specific settings
   * Includes information about the Azure Cache resource
   *
   * @return {Object} Settings with Azure configuration
   */
  async getSettings() {
    const settings = await super.getSettings();

    return {
      ...settings,
      azure: {
        hostname: this.azureHostname_,
        port: this.azurePort_,
        resourceGroup: this.azureResourceGroup_,
        resourceName: this.azureResourceName_,
        tier: this.azureTier_,
        provider: 'azure-redis',
        ssl: this.client_.options.tls ? true : false,
        connectionInfo: this.getConnectionInfo()
      }
    };
  }

  /**
   * Ensure Redis connection is established
   * @private
   * @return {!Promise<void>}
   */
  async ensureConnection_() {
    if (!this.client_.status || this.client_.status === 'close') {
      await this.client_.connect();
    }
  }
}

module.exports = CacheAzureRedis;
