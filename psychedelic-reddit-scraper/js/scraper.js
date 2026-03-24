/**
 * PullPush API client for fetching Reddit data.
 * No authentication required — runs entirely client-side.
 */
const PULLPUSH_BASE = 'https://api.pullpush.io/reddit';

class RedditScraper {
    constructor() {
        this.abortController = null;
        this.results = [];
        this.seenIds = new Set();
    }

    /**
     * Run a full search across terms × subreddits × content types.
     * Yields progress updates via the onProgress callback.
     */
    async search({ terms, subreddits, contentType, maxResults, sortType, afterDate, beforeDate, onProgress, onResult }) {
        this.abortController = new AbortController();
        this.results = [];
        this.seenIds = new Set();

        const queries = [];
        for (const term of terms) {
            for (const sub of subreddits) {
                if (contentType === 'both' || contentType === 'submissions') {
                    queries.push({ term, subreddit: sub, type: 'submission' });
                }
                if (contentType === 'both' || contentType === 'comments') {
                    queries.push({ term, subreddit: sub, type: 'comment' });
                }
            }
        }

        let completed = 0;
        for (const query of queries) {
            if (this.abortController.signal.aborted) break;

            onProgress({
                phase: 'fetching',
                completed,
                total: queries.length,
                detail: `Searching r/${query.subreddit} for "${query.term}" (${query.type}s)...`
            });

            try {
                const items = await this._fetchAll(query, maxResults, sortType, afterDate, beforeDate);
                let newCount = 0;
                for (const item of items) {
                    if (!this.seenIds.has(item.id)) {
                        this.seenIds.add(item.id);
                        this.results.push(item);
                        newCount++;
                        onResult(item);
                    }
                }
                onProgress({
                    phase: 'fetched',
                    completed: completed + 1,
                    total: queries.length,
                    detail: `r/${query.subreddit} "${query.term}" ${query.type}s: ${items.length} found, ${newCount} new`,
                    success: true
                });
            } catch (err) {
                if (err.name === 'AbortError') break;
                onProgress({
                    phase: 'error',
                    completed: completed + 1,
                    total: queries.length,
                    detail: `Error on r/${query.subreddit} "${query.term}": ${err.message}`,
                    error: true
                });
            }

            completed++;

            // Rate limiting: wait between requests
            if (completed < queries.length && !this.abortController.signal.aborted) {
                await this._sleep(1500);
            }
        }

        onProgress({
            phase: 'done',
            completed: queries.length,
            total: queries.length,
            detail: `Done. ${this.results.length} unique results found.`
        });

        return this.results;
    }

    stop() {
        if (this.abortController) {
            this.abortController.abort();
        }
    }

    /**
     * Fetch all pages for a single query (term + subreddit + type).
     */
    async _fetchAll(query, maxResults, sortType, afterDate, beforeDate) {
        const allItems = [];
        const pageSize = 100;
        let after = afterDate ? Math.floor(new Date(afterDate).getTime() / 1000) : null;
        const before = beforeDate ? Math.floor(new Date(beforeDate).getTime() / 1000) : null;

        while (allItems.length < maxResults) {
            if (this.abortController.signal.aborted) break;

            const endpoint = query.type === 'submission'
                ? `${PULLPUSH_BASE}/search/submission/`
                : `${PULLPUSH_BASE}/search/comment/`;

            const params = new URLSearchParams({
                q: query.term,
                subreddit: query.subreddit,
                size: String(Math.min(pageSize, maxResults - allItems.length)),
                sort: 'desc',
                sort_type: sortType
            });

            if (after) params.set('after', String(after));
            if (before) params.set('before', String(before));

            const response = await fetch(`${endpoint}?${params}`, {
                signal: this.abortController.signal
            });

            if (response.status === 429) {
                // Rate limited — wait and retry
                await this._sleep(10000);
                continue;
            }

            if (!response.ok) {
                throw new Error(`API returned ${response.status}`);
            }

            const data = await response.json();
            const items = data.data || [];

            if (items.length === 0) break;

            for (const raw of items) {
                allItems.push(this._normalize(raw, query));
            }

            // For pagination: get the oldest item's timestamp and search before it
            if (items.length < pageSize) break;
            const oldest = items[items.length - 1];
            const oldestTs = oldest.created_utc;
            // Use 'before' param for next page (we sort desc)
            params.set('before', String(oldestTs));
            // Remove 'after' for pagination to work
            if (after && oldestTs <= after) break;

            await this._sleep(1000);
        }

        return allItems;
    }

    /**
     * Normalize a raw PullPush API item into our standard format.
     */
    _normalize(raw, query) {
        const isComment = query.type === 'comment';
        const text = isComment ? (raw.body || '') : (raw.selftext || '');
        const title = raw.title || '';
        const author = raw.author || '[deleted]';
        const createdUtc = raw.created_utc;
        const date = createdUtc ? new Date(createdUtc * 1000) : null;

        const permalink = raw.permalink
            ? `https://www.reddit.com${raw.permalink}`
            : (raw.url || '');

        const threadUrl = isComment
            ? `https://www.reddit.com${raw.permalink || ''}`.split('?')[0]
            : permalink;

        return {
            id: raw.id,
            type: isComment ? 'comment' : 'post',
            subreddit: raw.subreddit || query.subreddit,
            title: isComment ? (raw.link_title || '') : title,
            author,
            text: text.replace(/\[deleted\]|\[removed\]/g, '').trim(),
            score: raw.score || 0,
            numComments: raw.num_comments || 0,
            date,
            dateStr: date ? date.toISOString().split('T')[0] : '',
            url: threadUrl,
            searchTerm: query.term
        };
    }

    _sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}


/**
 * localStorage cache for search results.
 * Stores results keyed by a hash of the search params so repeat searches
 * load instantly. Uses a ~40MB soft cap to avoid blowing up the browser.
 */
class ResultsCache {
    constructor() {
        this.STORAGE_KEY = 'prs_cache';       // psychedelic reddit scraper
        this.INDEX_KEY = 'prs_cache_index';
    }

    /** Build a deterministic cache key from search params. */
    _key({ terms, subreddits, contentType }) {
        const parts = [
            terms.slice().sort().join('|').toLowerCase(),
            subreddits.slice().sort().join('|').toLowerCase(),
            contentType
        ];
        return parts.join('::');
    }

    /** Get the index of all cached searches. */
    _getIndex() {
        try {
            return JSON.parse(localStorage.getItem(this.INDEX_KEY)) || {};
        } catch { return {}; }
    }

    _saveIndex(index) {
        localStorage.setItem(this.INDEX_KEY, JSON.stringify(index));
    }

    /** Check if we have cached results for these params. */
    has(params) {
        const index = this._getIndex();
        return !!index[this._key(params)];
    }

    /** Get cached results. Returns null if not found. */
    get(params) {
        const key = this._key(params);
        const index = this._getIndex();
        if (!index[key]) return null;
        try {
            const raw = localStorage.getItem(`${this.STORAGE_KEY}:${key}`);
            if (!raw) return null;
            const items = JSON.parse(raw);
            // Restore Date objects
            for (const item of items) {
                item.date = item.date ? new Date(item.date) : null;
            }
            return { items, meta: index[key] };
        } catch {
            return null;
        }
    }

    /** Save results to cache. */
    save(params, items) {
        const key = this._key(params);
        try {
            localStorage.setItem(`${this.STORAGE_KEY}:${key}`, JSON.stringify(items));
            const index = this._getIndex();
            index[key] = {
                terms: params.terms,
                subreddits: params.subreddits,
                contentType: params.contentType,
                count: items.length,
                cachedAt: new Date().toISOString()
            };
            this._saveIndex(index);
        } catch (e) {
            // localStorage full — evict oldest entry and retry once
            if (e.name === 'QuotaExceededError') {
                this._evictOldest();
                try {
                    localStorage.setItem(`${this.STORAGE_KEY}:${key}`, JSON.stringify(items));
                    const index = this._getIndex();
                    index[key] = {
                        terms: params.terms,
                        subreddits: params.subreddits,
                        contentType: params.contentType,
                        count: items.length,
                        cachedAt: new Date().toISOString()
                    };
                    this._saveIndex(index);
                } catch { /* give up silently */ }
            }
        }
    }

    /** Remove the oldest cached search. */
    _evictOldest() {
        const index = this._getIndex();
        let oldestKey = null, oldestDate = null;
        for (const [k, v] of Object.entries(index)) {
            if (!oldestDate || v.cachedAt < oldestDate) {
                oldestDate = v.cachedAt;
                oldestKey = k;
            }
        }
        if (oldestKey) {
            localStorage.removeItem(`${this.STORAGE_KEY}:${oldestKey}`);
            delete index[oldestKey];
            this._saveIndex(index);
        }
    }

    /** Get list of all cached searches for the UI. */
    list() {
        const index = this._getIndex();
        return Object.entries(index).map(([key, meta]) => ({ key, ...meta }));
    }

    /** Clear a specific cached search. */
    remove(params) {
        const key = this._key(params);
        const index = this._getIndex();
        localStorage.removeItem(`${this.STORAGE_KEY}:${key}`);
        delete index[key];
        this._saveIndex(index);
    }

    /** Clear all cached data. */
    clearAll() {
        const index = this._getIndex();
        for (const key of Object.keys(index)) {
            localStorage.removeItem(`${this.STORAGE_KEY}:${key}`);
        }
        localStorage.removeItem(this.INDEX_KEY);
    }
}
