const numberFormatter = new Intl.NumberFormat();
let analyticsData = [];
let currentSort = { column: 'lastPrompt', direction: 'desc' };
let selectedProvider = 'claude';
let isProcessing = false;

function formatNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return '0';
    }
    return numberFormatter.format(value);
}

function formatDate(value) {
    if (!value) {
        return '—';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleString();
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function showAlert(message, type = 'success') {
    const alertElement = document.getElementById(type + 'Alert');
    const messageElement = document.getElementById(type + 'Message');
    if (!alertElement || !messageElement) return;
    messageElement.textContent = message;
    alertElement.classList.add('show');
    setTimeout(() => alertElement.classList.remove('show'), 5000);
}

function showResponse(containerId, contentId, data) {
    const container = document.getElementById(containerId);
    const content = document.getElementById(contentId);
    if (!container || !content) return;
    content.textContent = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
    container.style.display = 'block';
}

function setLoading(isLoading) {
    isProcessing = Boolean(isLoading);
    const submitBtn = document.getElementById('submitBtn');
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (submitBtn) submitBtn.disabled = isProcessing;
    if (loadingIndicator) loadingIndicator.classList.toggle('d-none', !isProcessing);
}

async function makeRequest(url, method = 'GET', body = null) {
    const options = {
        method,
        headers: { 'Content-Type': 'application/json' }
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);
    const contentType = response.headers.get('content-type') || '';
    const payload = contentType.includes('application/json') ? await response.json() : await response.text();

    if (!response.ok) {
        throw new Error(typeof payload === 'string' && payload ? payload : `Request failed with status ${response.status}`);
    }

    return payload;
}

function toggleAdvanced() {
    const content = document.getElementById('advancedContent');
    if (content) {
        content.classList.toggle('show');
    }
}

function handleProviderSelection() {
    document.querySelectorAll('.provider-option').forEach((option) => {
        option.addEventListener('click', () => {
            document.querySelectorAll('.provider-option').forEach((opt) => opt.classList.remove('selected'));
            option.classList.add('selected');
            const input = option.querySelector('input[type="radio"]');
            if (input) input.checked = true;
            selectedProvider = option.dataset.provider;
            checkProviderStatus(selectedProvider);
        });
    });
}

function handleExamplePrompts() {
    document.querySelectorAll('.example-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const textarea = document.getElementById('promptText');
            if (textarea) {
                textarea.value = btn.dataset.prompt;
            }
        });
    });
}

async function checkProviderStatus(provider) {
    try {
        const result = await makeRequest('/services/ai/api/health');
        const indicator = document.querySelector(`[data-provider="${provider}"] .status-indicator`);
        if (indicator) {
            indicator.className = 'status-indicator ' + (result.healthy ? 'status-online' : 'status-offline');
        }
    } catch (error) {
        const indicator = document.querySelector(`[data-provider="${provider}"] .status-indicator`);
        if (indicator) {
            indicator.className = 'status-indicator status-offline';
        }
    }
}

function renderOverview(overview) {
    const {
        totalPrompts = 0,
        totalCalls = 0,
        totalPromptTokens = 0,
        totalCompletionTokens = 0,
        lastPromptAt = null
    } = overview || {};

    const totalPromptsEl = document.getElementById('totalPrompts');
    const totalCallsEl = document.getElementById('totalCalls');
    const totalPromptTokensEl = document.getElementById('totalPromptTokens');
    const totalCompletionTokensEl = document.getElementById('totalCompletionTokens');
    const lastPromptEl = document.getElementById('lastPrompt');

    if (totalPromptsEl) totalPromptsEl.textContent = formatNumber(totalPrompts);
    if (totalCallsEl) totalCallsEl.textContent = formatNumber(totalCalls);
    if (totalPromptTokensEl) totalPromptTokensEl.textContent = formatNumber(totalPromptTokens);
    if (totalCompletionTokensEl) totalCompletionTokensEl.textContent = formatNumber(totalCompletionTokens);
    if (lastPromptEl) lastPromptEl.textContent = formatDate(lastPromptAt);
}

function renderTopPrompts(prompts) {
    const list = document.getElementById('topPromptsList');
    if (!list) return;

    list.innerHTML = '';

    if (!prompts || prompts.length === 0) {
        list.innerHTML = '<div class="list-group-item text-muted">No prompt activity recorded yet.</div>';
        return;
    }

    prompts.forEach((prompt, index) => {
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';

        const details = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'fw-semibold prompt-snippet';
        title.title = prompt.prompt;
        title.textContent = `${index + 1}. ${prompt.prompt}`;

        const meta = document.createElement('div');
        meta.className = 'text-muted small';
        meta.textContent = `User: ${prompt.username || 'anonymous'} • Calls: ${formatNumber(prompt.calls)} • Tokens (in/out): ${formatNumber(prompt.promptTokens || 0)} / ${formatNumber(prompt.completionTokens || 0)}`;

        details.appendChild(title);
        details.appendChild(meta);

        const badge = document.createElement('span');
        badge.className = 'badge bg-primary rounded-pill';
        badge.textContent = formatNumber(prompt.calls);

        item.appendChild(details);
        item.appendChild(badge);
        list.appendChild(item);
    });
}

function renderPromptsTable(prompts) {
    const tableBody = document.getElementById('promptsTableBody');
    const rowCount = document.getElementById('promptsRowCount');
    if (!tableBody) return;

    if (!prompts || prompts.length === 0) {
        tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-muted py-4">
                            <i class="bi bi-info-circle fs-4"></i>
                            <p class="mb-0 mt-2">No prompt activity recorded yet.</p>
                        </td>
                    </tr>`;
        if (rowCount) rowCount.textContent = '0';
        return;
    }

    tableBody.innerHTML = prompts.map((prompt) => `
                <tr>
                    <td class="prompt-snippet" title="${escapeHtml(prompt.prompt)}">${escapeHtml(prompt.prompt)}</td>
                    <td>${escapeHtml(prompt.username || 'anonymous')}</td>
                    <td>${formatNumber(prompt.promptTokens || 0)}</td>
                    <td>${formatNumber(prompt.completionTokens || 0)}</td>
                    <td>${formatDate(prompt.lastPrompt)}</td>
                </tr>
            `).join('');

    if (rowCount) {
        rowCount.textContent = String(prompts.length);
    }
}

function sortTable(column) {
    if (!analyticsData || analyticsData.length === 0) {
        renderPromptsTable([]);
        return;
    }

    if (currentSort.column === column) {
        currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
        currentSort.column = column;
        currentSort.direction = column === 'lastPrompt' ? 'desc' : 'desc';
    }

    document.querySelectorAll('.sortable span').forEach((span) => {
        span.parentElement.classList.remove('sort-asc', 'sort-desc');
    });

    const sortElement = document.getElementById(`sort-${column}`);
    if (sortElement) {
        sortElement.parentElement.classList.add(currentSort.direction === 'asc' ? 'sort-asc' : 'sort-desc');
    }

    analyticsData.sort((a, b) => {
        let aVal;
        let bVal;

        switch (column) {
            case 'prompt':
                aVal = (a.prompt || '').toLowerCase();
                bVal = (b.prompt || '').toLowerCase();
                return currentSort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            case 'username':
                aVal = (a.username || '').toLowerCase();
                bVal = (b.username || '').toLowerCase();
                return currentSort.direction === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
            case 'lastPrompt':
                aVal = a.lastPrompt ? new Date(a.lastPrompt).getTime() : 0;
                bVal = b.lastPrompt ? new Date(b.lastPrompt).getTime() : 0;
                return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            case 'promptTokens':
            case 'completionTokens':
                aVal = a[column] || 0;
                bVal = b[column] || 0;
                return currentSort.direction === 'asc' ? aVal - bVal : bVal - aVal;
            default:
                return 0;
        }
    });

    renderPromptsTable(analyticsData);
}

function toggleAnalyticsLoading(isLoading) {
    const spinner = document.getElementById('analyticsSpinner');
    const button = document.getElementById('analyticsRefreshButton');
    if (spinner) spinner.classList.toggle('d-none', !isLoading);
    if (button) button.disabled = Boolean(isLoading);
}

function setAnalyticsPlaceholders() {
    const list = document.getElementById('topPromptsList');
    const tableBody = document.getElementById('promptsTableBody');
    const rowCount = document.getElementById('promptsRowCount');

    if (list) {
        list.innerHTML = `
                    <div class="list-group-item text-center text-muted py-3">
                        <div class="spinner-border spinner-border-sm me-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        Loading analytics...
                    </div>`;
    }

    if (tableBody) {
        tableBody.innerHTML = `
                    <tr>
                        <td colspan="5" class="text-center text-muted py-4">
                            <div class="spinner-border spinner-border-sm me-2" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                            Loading analytics...
                        </td>
                    </tr>`;
    }

    if (rowCount) {
        rowCount.textContent = '0';
    }
}

async function loadAnalytics() {
    toggleAnalyticsLoading(true);
    setAnalyticsPlaceholders();

    try {
        const response = await makeRequest('/services/ai/api/analytics');
        renderOverview(response.overview || {});
        renderTopPrompts(response.topPrompts || []);
        analyticsData = response.topRecent || [];

        const analyticsContainer = document.getElementById('analyticsData');
        const analyticsContent = document.getElementById('analyticsContent');
        const analyticsCount = document.getElementById('analyticsCount');

        if (analyticsContainer && analyticsContent) {
            analyticsContainer.style.display = 'block';
            analyticsContent.textContent = JSON.stringify(response, null, 2);
        }

        if (analyticsCount) {
            const totalCalls = response?.overview?.totalCalls || 0;
            analyticsCount.textContent = `${formatNumber(totalCalls)} calls recorded`;
        }

        currentSort.column = '';
        currentSort.direction = 'desc';
        sortTable('lastPrompt');
    } catch (error) {
        console.error('Error loading analytics:', error);
        showAlert('Error loading analytics: ' + error.message, 'error');
    } finally {
        toggleAnalyticsLoading(false);
    }
}

function calculateCost(usage, provider) {
    const rates = {
        claude: { input: 0.000003, output: 0.000015 },
        chatgpt: { input: 0.0000005, output: 0.0000015 },
        ollama: { input: 0, output: 0 }
    };
    const rate = rates[provider] || rates.ollama;
    const promptCost = (usage.promptTokens || 0) * rate.input;
    const completionCost = (usage.completionTokens || 0) * rate.output;
    return promptCost + completionCost;
}

async function handlePromptSubmit(event) {
    event.preventDefault();
    if (isProcessing) return;

    const prompt = document.getElementById('promptText')?.value.trim();
    const username = document.getElementById('promptUsername')?.value.trim();
    const maxTokensValue = parseInt(document.getElementById('maxTokens')?.value || '0', 10);
    const temperatureValue = parseFloat(document.getElementById('temperature')?.value || '0.7');
    const model = document.getElementById('modelName')?.value.trim();

    if (!prompt) {
        showAlert('Please enter a prompt', 'error');
        return;
    }

    const maxTokens = Number.isFinite(maxTokensValue) && maxTokensValue > 0 ? maxTokensValue : undefined;
    const temperature = Number.isFinite(temperatureValue) ? temperatureValue : 0.7;

    try {
        setLoading(true);
        const requestBody = {
            prompt,
            username,
            options: {
                maxTokens,
                temperature,
                provider: selectedProvider,
                model: model || undefined,
                username
            }
        };

        const result = await makeRequest('/services/ai/api/prompt', 'POST', requestBody);

        const responseContainer = document.getElementById('responseContainer');
        const aiResponse = document.getElementById('aiResponse');
        if (responseContainer && aiResponse) {
            responseContainer.style.display = 'block';
            aiResponse.textContent = result.content || JSON.stringify(result, null, 2);
        }

        if (result.usage) {
            document.getElementById('usageInfo').style.display = 'block';
            document.getElementById('promptTokens').textContent = formatNumber(result.usage.promptTokens || 0);
            document.getElementById('responseTokens').textContent = formatNumber(result.usage.completionTokens || 0);
            document.getElementById('totalTokens').textContent = formatNumber(result.usage.totalTokens || 0);
            document.getElementById('estimatedCost').textContent =
                '$' + calculateCost(result.usage, result.provider || selectedProvider).toFixed(6);
        }

        showAlert(`Response received from ${result.provider || selectedProvider}`);
        loadAnalytics();
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
        console.error('Prompt error:', error);
    } finally {
        setLoading(false);
    }
}

function clearPrompt() {
    const textarea = document.getElementById('promptText');
    if (textarea) textarea.value = '';
    const responseContainer = document.getElementById('responseContainer');
    if (responseContainer) responseContainer.style.display = 'none';
}

async function checkStatus() {
    try {
        const result = await makeRequest('/services/ai/api/status');
        showResponse('statusResponse', 'statusResponseContent', result);
        showAlert('Status checked successfully');
    } catch (error) {
        showAlert('Error checking status: ' + error.message, 'error');
        showResponse('statusResponse', 'statusResponseContent', 'Error: ' + error.message);
    }
}

async function checkModels() {
    try {
        const result = await makeRequest('/services/ai/api/models');
        showResponse('statusResponse', 'statusResponseContent', result);
        showAlert('Models retrieved successfully');
    } catch (error) {
        showAlert('Error retrieving models: ' + error.message, 'error');
        showResponse('statusResponse', 'statusResponseContent', 'Error: ' + error.message);
    }
}

async function checkHealth() {
    try {
        const result = await makeRequest('/services/ai/api/health');
        showResponse('statusResponse', 'statusResponseContent', result);
        showAlert('Health check completed');
    } catch (error) {
        showAlert('Error during health check: ' + error.message, 'error');
        showResponse('statusResponse', 'statusResponseContent', 'Error: ' + error.message);
    }
}

async function checkServiceStatus() {
    try {
        const result = await makeRequest('/services/ai/api/status');
        const submitBtn = document.getElementById('submitBtn');
        const promptTextarea = document.getElementById('promptText');

        if (result.enabled === false || !result.hasApiKey) {
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'API Key Required';
                submitBtn.className = 'btn btn-secondary';
            }
            if (promptTextarea) {
                promptTextarea.placeholder = 'AI service disabled - API key required';
            }
        } else {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Send Prompt';
                submitBtn.className = 'btn btn-primary';
            }
            if (promptTextarea) {
                promptTextarea.placeholder = 'Enter your prompt here...';
            }
        }
    } catch (error) {
        console.error('Error checking service status:', error);
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Service Unavailable';
            submitBtn.className = 'btn btn-secondary';
        }
    }
}

// Settings functionality
let currentSettings = {};

// Fetch settings from API
async function loadSettings() {
    try {
        const response = await fetch('/services/ai/api/settings');
        const data = await response.json();
        currentSettings = data;
        renderSettingsForm(data);
    } catch (error) {
        showAlert('Error loading settings: ' + error.message, 'error');
        console.error('Error loading settings:', error);
    }
}

// Render settings form based on settings structure
function renderSettingsForm(data) {
    const formFieldsContainer = document.getElementById('settingsFormFields');
    const infoContainer = document.getElementById('settingsInfo');

    // Clear existing form fields
    formFieldsContainer.innerHTML = '';

    // Display description if available
    if (data.desciption) {
        infoContainer.textContent = data.desciption;
        infoContainer.style.display = 'block';
    }

    // Render form fields from settings list
    if (data.list && Array.isArray(data.list)) {
        data.list.forEach((setting) => {
            const formGroup = createFormField(setting, data);
            formFieldsContainer.appendChild(formGroup);
        });
    }
}

// Create form field based on setting type
function createFormField(setting, settingsData) {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    // Create label
    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = 'setting_' + setting.setting;
    label.textContent = setting.setting;
    formGroup.appendChild(label);

    // Get current value from settings
    const currentValue = settingsData[setting.setting] || '';

    // Create input based on type
    let input;
    switch (setting.type) {
        case 'string':
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-input';
            input.id = 'setting_' + setting.setting;
            input.name = setting.setting;
            input.value = currentValue;
            if (setting.values && setting.values.length > 0) {
                input.placeholder = setting.values[0];
            }
            break;

        case 'integer':
            input = document.createElement('input');
            input.type = 'number';
            input.className = 'form-input';
            input.id = 'setting_' + setting.setting;
            input.name = setting.setting;
            input.value = currentValue;
            input.step = '1';
            break;

        case 'number':
            input = document.createElement('input');
            input.type = 'number';
            input.className = 'form-input';
            input.id = 'setting_' + setting.setting;
            input.name = setting.setting;
            input.value = currentValue;
            input.step = 'any';
            break;

        case 'date':
            input = document.createElement('input');
            input.type = 'date';
            input.className = 'form-input';
            input.id = 'setting_' + setting.setting;
            input.name = setting.setting;
            input.value = currentValue;
            break;

        case 'list':
        case 'options':
            input = document.createElement('select');
            input.className = 'form-select';
            input.id = 'setting_' + setting.setting;
            input.name = setting.setting;

            // Add options
            if (setting.values && Array.isArray(setting.values)) {
                setting.values.forEach((value) => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = value;
                    if (value === currentValue) {
                        option.selected = true;
                    }
                    input.appendChild(option);
                });
            }
            break;

        default:
            input = document.createElement('input');
            input.type = 'text';
            input.className = 'form-input';
            input.id = 'setting_' + setting.setting;
            input.name = setting.setting;
            input.value = currentValue;
    }

    formGroup.appendChild(input);

    // Add description helper text if available
    if (setting.desciption) {
        const helperText = document.createElement('div');
        helperText.className = 'helper-text';
        helperText.textContent = setting.desciption;
        formGroup.appendChild(helperText);
    }

    return formGroup;
}

// Handle settings form submission
document.getElementById('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    try {
        // Collect form data
        const formData = new FormData(document.getElementById('settingsForm'));
        const payload = {};

        // Build payload from form fields
        for (let [key, value] of formData.entries()) {
            payload[key] = value;
        }

        // Send to API
        const response = await fetch('/services/ai/api/settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const responseText = await response.text();

        // Show response
        showResponse('settingsSaveResponse', 'settingsSaveResponseContent', responseText);

        if (response.ok) {
            showAlert('Settings saved successfully', 'success');
            // Reload settings to reflect changes
            setTimeout(() => loadSettings(), 1000);
        } else {
            showAlert('Error saving settings: ' + responseText, 'error');
        }
    } catch (error) {
        showAlert('Error saving settings: ' + error.message, 'error');
        showResponse('settingsSaveResponse', 'settingsSaveResponseContent', 'Error: ' + error.message);
    }
});

// Load settings when settings tab is shown
document.getElementById('settings-tab')?.addEventListener('shown.bs.tab', function (e) {
    loadSettings();
});

function initializeSwagger() {
    const spec = {
        openapi: '3.0.0',
        info: {
            title: 'AI Service API',
            description: 'REST API for AI service operations with multiple provider support',
            version: '1.0.0'
        },
        servers: [{ url: '/services/ai/api', description: 'AI Service API' }]
    };

    try {
        SwaggerUIBundle({
            spec,
            dom_id: '#swagger-ui',
            deepLinking: true,
            presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.presets.standalone],
            plugins: [SwaggerUIBundle.plugins.DownloadUrl],
            layout: 'BaseLayout',
            tryItOutEnabled: true
        });
    } catch (error) {
        console.error('Error initializing Swagger UI:', error);
        const swaggerContainer = document.getElementById('swagger-ui');
        if (swaggerContainer) {
            swaggerContainer.innerHTML = '<p class="text-danger">Error loading API documentation. Please refresh the page.</p>';
        }
    }
}

function initializeEventHandlers() {
    const promptForm = document.getElementById('promptForm');
    if (promptForm) {
        promptForm.addEventListener('submit', handlePromptSubmit);
    }

    const clearButton = document.getElementById('clearPromptButton');
    if (clearButton) {
        clearButton.addEventListener('click', clearPrompt);
    }

    const advancedToggle = document.getElementById('advancedToggle');
    if (advancedToggle) {
        advancedToggle.addEventListener('click', toggleAdvanced);
    }

    const temperatureInput = document.getElementById('temperature');
    if (temperatureInput) {
        temperatureInput.addEventListener('input', (event) => {
            const valueEl = document.getElementById('temperatureValue');
            if (valueEl) valueEl.textContent = event.target.value;
        });
    }

    const refreshButton = document.getElementById('analyticsRefreshButton');
    if (refreshButton) {
        refreshButton.addEventListener('click', () => loadAnalytics());
    }

    document.getElementById('dashboard-tab')?.addEventListener('shown.bs.tab', () => loadAnalytics());
    document.getElementById('data-tab')?.addEventListener('shown.bs.tab', () => checkServiceStatus());
}

document.addEventListener('DOMContentLoaded', () => {
    handleProviderSelection();
    handleExamplePrompts();
    initializeEventHandlers();
    initializeSwagger();
    checkServiceStatus();
    ['claude', 'chatgpt', 'ollama'].forEach(checkProviderStatus);
    loadAnalytics();
    setInterval(loadAnalytics, 30000);
});