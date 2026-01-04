/**
 * Performance caching utilities for high-traffic scenarios
 * Implements request deduplication, smart caching, and batching
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

interface PendingRequest<T> {
  promise: Promise<T>;
  timestamp: number;
}

/**
 * Generic cache with TTL and request deduplication
 */
export class PerformanceCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  private pending = new Map<string, PendingRequest<T>>();
  private maxSize: number;
  private defaultTtlMs: number;
  
  constructor(options: {
    maxSize?: number;
    defaultTtlMs?: number;
  } = {}) {
    this.maxSize = options.maxSize || 500;
    this.defaultTtlMs = options.defaultTtlMs || 60 * 1000; // 1 minute default
    
    // Periodic cleanup
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanup(), 5 * 60 * 1000); // Every 5 minutes
    }
  }
  
  /**
   * Get cached value or fetch with deduplication
   */
  async getOrFetch(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs?: number
  ): Promise<T> {
    // Check cache first
    const cached = this.get(key);
    if (cached !== null) {
      return cached;
    }
    
    // Check if request is already pending
    const pending = this.pending.get(key);
    if (pending) {
      console.log(`[PerformanceCache] Deduplicating request for: ${key}`);
      return pending.promise;
    }
    
    // Create new request
    const promise = fetcher().then(
      (data) => {
        this.set(key, data, ttlMs);
        this.pending.delete(key);
        return data;
      },
      (error) => {
        this.pending.delete(key);
        throw error;
      }
    );
    
    this.pending.set(key, { promise, timestamp: Date.now() });
    return promise;
  }
  
  /**
   * Get cached value if valid
   */
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }
  
  /**
   * Set cache value
   */
  set(key: string, data: T, ttlMs?: number): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }
    
    const now = Date.now();
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (ttlMs || this.defaultTtlMs)
    });
  }
  
  /**
   * Invalidate cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
    this.pending.delete(key);
  }
  
  /**
   * Invalidate entries matching a pattern
   */
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
    for (const key of this.pending.keys()) {
      if (regex.test(key)) {
        this.pending.delete(key);
      }
    }
  }
  
  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.pending.clear();
  }
  
  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    pending: number;
    maxSize: number;
  } {
    return {
      size: this.cache.size,
      pending: this.pending.size,
      maxSize: this.maxSize
    };
  }
  
  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    // Cleanup stale pending requests (older than 30 seconds)
    for (const [key, pending] of this.pending.entries()) {
      if (now - pending.timestamp > 30000) {
        this.pending.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[PerformanceCache] Cleaned ${cleaned} expired entries`);
    }
  }
  
  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldest: string | null = null;
    let oldestTime = Infinity;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldest = key;
        oldestTime = entry.timestamp;
      }
    }
    
    if (oldest) {
      this.cache.delete(oldest);
    }
  }
}

/**
 * Request batcher for combining multiple requests
 */
export class RequestBatcher<TItem, TResult> {
  private batch: TItem[] = [];
  private batchPromise: Promise<Map<TItem, TResult>> | null = null;
  private resolvers: Array<{
    item: TItem;
    resolve: (result: TResult | undefined) => void;
    reject: (error: Error) => void;
  }> = [];
  private timeout: number | null = null;
  private batchFn: (items: TItem[]) => Promise<Map<TItem, TResult>>;
  private maxBatchSize: number;
  private batchDelayMs: number;
  
  constructor(
    batchFn: (items: TItem[]) => Promise<Map<TItem, TResult>>,
    options: {
      maxBatchSize?: number;
      batchDelayMs?: number;
    } = {}
  ) {
    this.batchFn = batchFn;
    this.maxBatchSize = options.maxBatchSize || 50;
    this.batchDelayMs = options.batchDelayMs || 50;
  }
  
  /**
   * Add item to batch and get result
   */
  async add(item: TItem): Promise<TResult | undefined> {
    return new Promise((resolve, reject) => {
      this.batch.push(item);
      this.resolvers.push({ item, resolve, reject });
      
      // Execute immediately if batch is full
      if (this.batch.length >= this.maxBatchSize) {
        this.executeBatch();
      } else if (!this.timeout) {
        // Schedule batch execution
        this.timeout = window.setTimeout(() => {
          this.executeBatch();
        }, this.batchDelayMs);
      }
    });
  }
  
  /**
   * Execute the current batch
   */
  private async executeBatch(): Promise<void> {
    if (this.timeout) {
      window.clearTimeout(this.timeout);
      this.timeout = null;
    }
    
    if (this.batch.length === 0) return;
    
    const currentBatch = [...this.batch];
    const currentResolvers = [...this.resolvers];
    this.batch = [];
    this.resolvers = [];
    
    try {
      console.log(`[RequestBatcher] Executing batch of ${currentBatch.length} items`);
      const results = await this.batchFn(currentBatch);
      
      for (const resolver of currentResolvers) {
        resolver.resolve(results.get(resolver.item));
      }
    } catch (error) {
      for (const resolver of currentResolvers) {
        resolver.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
}

// Global caches for common use cases
export const stockPriceCache = new PerformanceCache<{
  price: number;
  change: number;
  changePercent: number;
}>({
  maxSize: 500,
  defaultTtlMs: 60 * 1000 // 1 minute
});

export const newsCache = new PerformanceCache<unknown[]>({
  maxSize: 100,
  defaultTtlMs: 5 * 60 * 1000 // 5 minutes
});

export const userDataCache = new PerformanceCache<unknown>({
  maxSize: 200,
  defaultTtlMs: 2 * 60 * 1000 // 2 minutes
});
