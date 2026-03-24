/**
 * Main application logic — wires up UI to the scraper and cache.
 */
(function () {
    const scraper = new RedditScraper();
    const cache = new ResultsCache();
    let allResults = [];

    // ── DOM refs ──
    const presetsGrid = document.getElementById('presets-grid');
    const termsInput = document.getElementById('search-terms');
    const subredditsInput = document.getElementById('subreddits');
    const contentTypeSelect = document.getElementById('content-type');
    const maxResultsSelect = document.getElementById('max-results');
    const sortTypeSelect = document.getElementById('sort-type');
    const dateAfterInput = document.getElementById('date-after');
    const dateBeforeInput = document.getElementById('date-before');
    const runBtn = document.getElementById('run-search');
    const stopBtn = document.getElementById('stop-search');
    const clearBtn = document.getElementById('clear-results');
    const progressSection = document.getElementById('progress-section');
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const progressLog = document.getElementById('progress-log');
    const resultsSection = document.getElementById('results-section');
    const resultCount = document.getElementById('result-count');
    const resultsBody = document.getElementById('results-body');
    const filterInput = document.getElementById('filter-text');
    const dedupToggle = document.getElementById('dedup-toggle');
    const exportCsvBtn = document.getElementById('export-csv');
    const exportCodingBtn = document.getElementById('export-csv-coding');

    // ── Render presets ──
    function renderPresets() {
        presetsGrid.innerHTML = '';
        PRESETS.forEach(preset => {
            const card = document.createElement('div');
            card.className = 'preset-card';
            card.dataset.id = preset.id;

            const cacheParams = { terms: preset.terms, subreddits: preset.subreddits, contentType: 'both' };
            const cached = cache.has(cacheParams);
            const cachedData = cached ? cache.get(cacheParams) : null;

            const tags = [
                ...preset.subreddits.map(s => `r/${s}`),
                ...preset.terms
            ].map(t => `<span>${escapeHtml(t)}</span>`).join('');

            const cachedBadge = cached
                ? `<span class="cached-badge">${cachedData ? cachedData.meta.count + ' cached' : 'cached'}</span>`
                : '';

            card.innerHTML = `
                <div class="preset-title">${escapeHtml(preset.title)} ${cachedBadge}</div>
                <div class="preset-detail">${tags}</div>
            `;

            card.addEventListener('click', () => {
                document.querySelectorAll('.preset-card').forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                termsInput.value = preset.terms.join(', ');
                subredditsInput.value = preset.subreddits.join(', ');
            });

            presetsGrid.appendChild(card);
        });
    }

    renderPresets();

    // ── Run search ──
    runBtn.addEventListener('click', async () => {
        const terms = parseCSV(termsInput.value);
        const subreddits = parseCSV(subredditsInput.value);

        if (terms.length === 0 || subreddits.length === 0) {
            alert('Please enter at least one search term and one subreddit.');
            return;
        }

        const contentType = contentTypeSelect.value;
        const cacheParams = { terms, subreddits, contentType };

        // Check cache first
        const cached = cache.get(cacheParams);
        if (cached) {
            const useCached = confirm(
                `Found ${cached.meta.count} cached results from ${new Date(cached.meta.cachedAt).toLocaleDateString()}.\n\n` +
                `Click OK to load cached results, or Cancel to re-fetch from Reddit.`
            );
            if (useCached) {
                loadCachedResults(cached.items);
                return;
            }
        }

        // UI state
        runBtn.disabled = true;
        stopBtn.disabled = false;
        progressSection.style.display = '';
        progressLog.innerHTML = '';
        progressBar.style.width = '0%';

        allResults = [];
        resultsBody.innerHTML = '';
        resultsSection.style.display = '';
        resultCount.textContent = '0';

        try {
            const results = await scraper.search({
                terms,
                subreddits,
                contentType,
                maxResults: parseInt(maxResultsSelect.value),
                sortType: sortTypeSelect.value,
                afterDate: dateAfterInput.value || null,
                beforeDate: dateBeforeInput.value || null,
                onProgress: handleProgress,
                onResult: handleResult
            });

            // Save to cache
            if (results.length > 0) {
                cache.save(cacheParams, results);
                renderPresets(); // update cached badges
                log(`Saved ${results.length} results to cache.`, 'log-success');
            }
        } catch (err) {
            log(`Fatal error: ${err.message}`, 'log-error');
        }

        runBtn.disabled = false;
        stopBtn.disabled = true;
    });

    function loadCachedResults(items) {
        allResults = items;
        resultsBody.innerHTML = '';
        resultsSection.style.display = '';
        progressSection.style.display = '';
        progressLog.innerHTML = '';
        progressBar.style.width = '100%';
        progressText.textContent = `Loaded ${items.length} results from cache.`;
        log(`Loaded ${items.length} cached results.`, 'log-success');

        items.forEach((item, i) => appendRow(item, i + 1));
        resultCount.textContent = items.length;
    }

    stopBtn.addEventListener('click', () => {
        scraper.stop();
        stopBtn.disabled = true;
        log('Search stopped by user.', 'log-warn');
    });

    clearBtn.addEventListener('click', () => {
        allResults = [];
        resultsBody.innerHTML = '';
        resultsSection.style.display = 'none';
        progressSection.style.display = 'none';
        resultCount.textContent = '0';
    });

    // ── Progress handler ──
    function handleProgress(p) {
        const pct = p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0;
        progressBar.style.width = pct + '%';
        progressText.textContent = p.detail;

        const cls = p.error ? 'log-error' : p.success ? 'log-success' : (p.phase === 'done' ? 'log-success' : '');
        log(p.detail, cls);
    }

    function log(msg, cls) {
        const el = document.createElement('div');
        el.className = 'log-entry' + (cls ? ` ${cls}` : '');
        el.textContent = msg;
        progressLog.appendChild(el);
        progressLog.scrollTop = progressLog.scrollHeight;
    }

    // ── Result handler ──
    function handleResult(item) {
        allResults.push(item);
        resultCount.textContent = allResults.length;
        appendRow(item, allResults.length);
    }

    function appendRow(item, idx) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${idx}</td>
            <td><span class="type-badge ${item.type}">${item.type}</span></td>
            <td>r/${escapeHtml(item.subreddit)}</td>
            <td>${escapeHtml(item.title || '—')}</td>
            <td>${escapeHtml(item.author)}</td>
            <td>${item.dateStr}</td>
            <td>${item.score}</td>
            <td class="cell-text">${escapeHtml(truncate(item.text, 300))}</td>
            <td><a href="${escapeHtml(item.url)}" target="_blank" rel="noopener">Link</a></td>
        `;
        resultsBody.appendChild(tr);
    }

    // ── Filtering ──
    filterInput.addEventListener('input', () => renderFilteredTable());
    dedupToggle.addEventListener('change', () => renderFilteredTable());

    function renderFilteredTable() {
        const query = filterInput.value.toLowerCase();
        let filtered = allResults;

        if (query) {
            filtered = filtered.filter(r =>
                r.text.toLowerCase().includes(query) ||
                r.title.toLowerCase().includes(query) ||
                r.author.toLowerCase().includes(query) ||
                r.subreddit.toLowerCase().includes(query)
            );
        }

        if (dedupToggle.checked) {
            const seen = new Set();
            filtered = filtered.filter(r => {
                if (seen.has(r.id)) return false;
                seen.add(r.id);
                return true;
            });
        }

        resultsBody.innerHTML = '';
        filtered.forEach((item, i) => appendRow(item, i + 1));
        resultCount.textContent = filtered.length;
    }

    // ── CSV Export ──
    exportCsvBtn.addEventListener('click', () => exportCSV(false));
    exportCodingBtn.addEventListener('click', () => exportCSV(true));

    function exportCSV(includeCodingColumns) {
        if (allResults.length === 0) {
            alert('No results to export.');
            return;
        }

        const baseHeaders = [
            'Post Text',
            'Thread number',
            'Thread Name',
            'Thread URL',
            'Username',
            'Type',
            'Subreddit',
            'Date',
            'Score',
            'Search Term'
        ];

        const headers = includeCodingColumns
            ? [...baseHeaders, ...CODING_COLUMNS]
            : baseHeaders;

        const rows = allResults.map((r, i) => {
            const base = [
                r.text,
                i + 1,
                r.title,
                r.url,
                r.author,
                r.type,
                r.subreddit,
                r.dateStr,
                r.score,
                r.searchTerm
            ];
            if (includeCodingColumns) {
                return [...base, ...CODING_COLUMNS.map(() => '')];
            }
            return base;
        });

        const csvContent = [headers, ...rows]
            .map(row => row.map(cell => csvCell(String(cell ?? ''))).join(','))
            .join('\n');

        // Build filename from search config
        const terms = parseCSV(termsInput.value).join('_') || 'search';
        const subs = parseCSV(subredditsInput.value).join('_') || 'reddit';
        const suffix = includeCodingColumns ? '_coding' : '';
        const filename = `reddit_${sanitizeFilename(terms)}_${sanitizeFilename(subs)}${suffix}.csv`;

        downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
    }

    // ── Utilities ──
    function parseCSV(str) {
        return str.split(',').map(s => s.trim()).filter(Boolean);
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function truncate(str, len) {
        return str.length > len ? str.slice(0, len) + '...' : str;
    }

    function csvCell(str) {
        if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
            return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
    }

    function sanitizeFilename(str) {
        return str.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 30);
    }

    function downloadFile(content, filename, mimeType) {
        const BOM = '\uFEFF'; // UTF-8 BOM for Excel compatibility
        const blob = new Blob([BOM + content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
})();
