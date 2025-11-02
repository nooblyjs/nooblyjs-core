        // JSON validation
        function validateJSON(elementId) {
            const element = document.getElementById(elementId);
            const validation = document.getElementById(elementId.replace('Message', 'Validation'));
            const value = element.value.trim();
            
            if (!value) {
                element.classList.remove('json-valid', 'json-invalid');
                validation.style.display = 'none';
                return true;
            }
            
            try {
                JSON.parse(value);
                element.classList.remove('json-invalid');
                element.classList.add('json-valid');
                validation.textContent = '✓ Valid JSON';
                validation.className = 'validation-message validation-success';
                validation.style.display = 'block';
                return true;
            } catch (e) {
                element.classList.remove('json-valid');
                element.classList.add('json-invalid');
                validation.textContent = '✗ Invalid JSON: ' + e.message;
                validation.className = 'validation-message validation-error';
                validation.style.display = 'block';
                return false;
            }
        }

        // Real-time validation
        document.getElementById('logMessage').addEventListener('input', () => validateJSON('logMessage'));

        // Format JSON
        function formatJSON(elementId) {
            const element = document.getElementById(elementId);
            try {
                const parsed = JSON.parse(element.value);
                element.value = JSON.stringify(parsed, null, 2);
                validateJSON(elementId);
            } catch (e) {
                showAlert('Invalid JSON cannot be formatted', 'error');
            }
        }

        // Load example
        function loadExample(elementId) {
            const examples = {
                logMessage: {
                    "message": "User logged in successfully",
                    "details": {
                        "userId": "12345",
                        "ip": "192.168.1.1"
                    }
                }
            };
            
            if (examples[elementId]) {
                document.getElementById(elementId).value = JSON.stringify(examples[elementId], null, 2);
                validateJSON(elementId);
            }
        }

        // Instance selection state
        let selectedInstance = 'default';

        // Instance management functions
        async function loadAvailableInstances() {
            try {
                const response = await fetch('/services/logging/api/instances');
                if (!response.ok) {
                    console.error('Failed to fetch instances');
                    return;
                }
                const data = await response.json();
                if (data.instances && Array.isArray(data.instances)) {
                    updateInstanceSelector(data.instances);
                }
            } catch (error) {
                console.error('Error loading instances:', error);
            }
        }

        function updateInstanceSelector(instances) {
            const selector = document.getElementById('instanceSelector');
            const currentValue = selector.value;

            // Clear existing options
            selector.innerHTML = '';

            // Add instances as options
            instances.forEach(instance => {
                const option = document.createElement('option');
                option.value = instance.name;
                option.textContent = `${instance.name}${instance.name === 'default' ? ' (default)' : ''}`;
                selector.appendChild(option);
            });

            // Restore previously selected instance if it still exists
            if (instances.some(i => i.name === currentValue)) {
                selector.value = currentValue;
            } else {
                selector.value = 'default';
                selectedInstance = 'default';
            }
        }

        function buildInstanceUrl(basePath) {
            if (selectedInstance === 'default') {
                return basePath;
            }
            // Insert instance name after /api/ in the path
            return basePath.replace('/services/logging/api/', `/services/logging/api/${selectedInstance}/`);
        }

        // Utility functions
        function showAlert(message, type = 'success') {
            const alertElement = document.getElementById(type + 'Alert');
            const messageElement = document.getElementById(type + 'Message');
            messageElement.textContent = message;
            alertElement.classList.add('show');
            setTimeout(() => alertElement.classList.remove('show'), 5000);
        }

        function showResponse(containerId, contentId, data) {
            const container = document.getElementById(containerId);
            const content = document.getElementById(contentId);
            content.textContent = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
            container.style.display = 'block';
        }

        function setLoading(formId, isLoading) {
            const form = document.getElementById(formId);
            if (isLoading) {
                form.classList.add('loading');
            } else {
                form.classList.remove('loading');
            }
        }

        // API functions
        async function makeRequest(url, method = 'GET', body = null) {
            // Make URL instance-aware
            const instanceAwareUrl = buildInstanceUrl(url);

            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(instanceAwareUrl, options);
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        }

        // Form handlers
        document.getElementById('logForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const logginglevel = document.getElementById('logging-level-select').value
            const message = document.getElementById('logMessage').value;
            
            if (!validateJSON('logMessage')) {
                showAlert('Please enter a valid JSON log message', 'error');
                return;
            }
            
            try {
                setLoading('logForm', true);
                const parsedMessage = JSON.parse(message);
                // Add level to the message object
                parsedMessage.level = logginglevel;
                const result = await makeRequest(`/services/logging/api/log`, 'POST', parsedMessage);
                showResponse('logResponse', 'logResponseContent', result);
                showAlert(`Log entry submitted successfully`);
            } catch (error) {
                showAlert('Error submitting log entry: ' + error.message, 'error');
                showResponse('logResponse', 'logResponseContent', 'Error: ' + error.message);
            } finally {
                setLoading('logForm', false);
            }
        });

        async function checkStatus() {
            try {
                const result = await makeRequest('/services/logging/api/status');
                showResponse('statusResponse', 'statusResponseContent', result);
                showAlert('Status checked successfully');
            } catch (error) {
                showAlert('Error checking status: ' + error.message, 'error');
                showResponse('statusResponse', 'statusResponseContent', 'Error: ' + error.message);
            }
        }

        // Dashboard functionality
        let currentLogs = [];
        let logStatsChart = null;
        let logTimelineChart = null;

        // Fetch statistics from analytics API
        async function fetchStats() {
            try {
                const statsUrl = buildInstanceUrl('/services/logging/api/stats');
                const response = await fetch(statsUrl);
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error fetching stats:', error);
                return null;
            }
        }

        // Update statistics display
        function updateStatsDisplay(stats) {
            if (!stats) return;

            // Update total count
            document.getElementById('statTotalCount').textContent = stats.total;

            // Update INFO stats
            document.getElementById('statInfoCount').textContent = stats.counts.INFO;
            document.getElementById('statInfoPercent').textContent = stats.percentages.INFO + '%';
            document.getElementById('statInfoBar').style.width = stats.percentages.INFO + '%';

            // Update WARN stats
            document.getElementById('statWarnCount').textContent = stats.counts.WARN;
            document.getElementById('statWarnPercent').textContent = stats.percentages.WARN + '%';
            document.getElementById('statWarnBar').style.width = stats.percentages.WARN + '%';

            // Update ERROR stats
            document.getElementById('statErrorCount').textContent = stats.counts.ERROR;
            document.getElementById('statErrorPercent').textContent = stats.percentages.ERROR + '%';
            document.getElementById('statErrorBar').style.width = stats.percentages.ERROR + '%';

            // Update LOG stats
            document.getElementById('statLogCount').textContent = stats.counts.LOG;
            document.getElementById('statLogPercent').textContent = stats.percentages.LOG + '%';
            document.getElementById('statLogBar').style.width = stats.percentages.LOG + '%';
        }

        // Fetch timeline from analytics API
        async function fetchTimeline() {
            try {
                const timelineUrl = buildInstanceUrl('/services/logging/api/timeline');
                const response = await fetch(timelineUrl);
                const data = await response.json();
                return data;
            } catch (error) {
                console.error('Error fetching timeline:', error);
                return null;
            }
        }

        // Initialize or update pie chart
        function updateChart(stats) {
            if (!stats) return;

            const ctx = document.getElementById('logStatsChart');
            if (!ctx) return;

            // Destroy existing chart if it exists
            if (logStatsChart) {
                logStatsChart.destroy();
            }

            // Create new chart
            logStatsChart = new Chart(ctx, {
                type: 'pie',
                data: {
                    labels: ['INFO', 'WARN', 'ERROR', 'LOG'],
                    datasets: [{
                        label: 'Log Levels',
                        data: [
                            stats.counts.INFO,
                            stats.counts.WARN,
                            stats.counts.ERROR,
                            stats.counts.LOG
                        ],
                        backgroundColor: [
                            'rgba(13, 110, 253, 0.8)',   // Bootstrap primary (blue)
                            'rgba(255, 193, 7, 0.8)',    // Bootstrap warning (yellow)
                            'rgba(220, 53, 69, 0.8)',    // Bootstrap danger (red)
                            'rgba(108, 117, 125, 0.8)'   // Bootstrap secondary (gray)
                        ],
                        borderColor: [
                            'rgba(13, 110, 253, 1)',
                            'rgba(255, 193, 7, 1)',
                            'rgba(220, 53, 69, 1)',
                            'rgba(108, 117, 125, 1)'
                        ],
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                padding: 15,
                                font: {
                                    size: 12,
                                    weight: '500'
                                }
                            }
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    const label = context.label || '';
                                    const value = context.parsed || 0;
                                    const percentage = stats.percentages[label] || 0;
                                    return `${label}: ${value} (${percentage}%)`;
                                }
                            }
                        }
                    }
                }
            });
        }

        // Initialize or update timeline chart
        function updateTimelineChart(timeline) {
            if (!timeline) return;

            const ctx = document.getElementById('logTimelineChart');
            if (!ctx) return;

            // Destroy existing chart if it exists
            if (logTimelineChart) {
                logTimelineChart.destroy();
            }

            // Create new timeline chart
            logTimelineChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: timeline.labels,
                    datasets: [
                        {
                            label: 'INFO',
                            data: timeline.datasets.INFO,
                            borderColor: 'rgba(13, 110, 253, 1)',
                            backgroundColor: 'rgba(13, 110, 253, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        },
                        {
                            label: 'WARN',
                            data: timeline.datasets.WARN,
                            borderColor: 'rgba(255, 193, 7, 1)',
                            backgroundColor: 'rgba(255, 193, 7, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        },
                        {
                            label: 'ERROR',
                            data: timeline.datasets.ERROR,
                            borderColor: 'rgba(220, 53, 69, 1)',
                            backgroundColor: 'rgba(220, 53, 69, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        },
                        {
                            label: 'LOG',
                            data: timeline.datasets.LOG,
                            borderColor: 'rgba(108, 117, 125, 1)',
                            backgroundColor: 'rgba(108, 117, 125, 0.1)',
                            borderWidth: 2,
                            tension: 0.4,
                            fill: true,
                            pointRadius: 3,
                            pointHoverRadius: 5
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    plugins: {
                        legend: {
                            position: 'top',
                            labels: {
                                padding: 15,
                                font: {
                                    size: 12,
                                    weight: '500'
                                },
                                usePointStyle: true,
                                pointStyle: 'circle'
                            }
                        },
                        tooltip: {
                            callbacks: {
                                title: function(context) {
                                    return 'Time: ' + context[0].label;
                                },
                                label: function(context) {
                                    const label = context.dataset.label || '';
                                    const value = context.parsed.y || 0;
                                    return `${label}: ${value} log${value !== 1 ? 's' : ''}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Time (per minute)',
                                font: {
                                    size: 12,
                                    weight: '600'
                                }
                            },
                            grid: {
                                display: false
                            }
                        },
                        y: {
                            display: true,
                            title: {
                                display: true,
                                text: 'Number of Logs',
                                font: {
                                    size: 12,
                                    weight: '600'
                                }
                            },
                            beginAtZero: true,
                            ticks: {
                                stepSize: 1
                            },
                            grid: {
                                color: 'rgba(0, 0, 0, 0.05)'
                            }
                        }
                    }
                }
            });
        }

        // Fetch logs from analytics API
        async function fetchLogs(level = '') {
            try {
                const url = level
                    ? `/services/logging/api/logs?level=${level}`
                    : '/services/logging/api/logs';

                const response = await fetch(url);
                const data = await response.json();

                return data;
            } catch (error) {
                console.error('Error fetching logs:', error);
                showAlert('Error fetching logs: ' + error.message, 'error');
                return { logs: [], count: 0 };
            }
        }

        // Render logs table
        function renderLogsTable(logs) {
            const tbody = document.getElementById('logsTableBody');
            const countElement = document.getElementById('logCount');

            if (!logs || logs.length === 0) {
                tbody.innerHTML = `
                    <tr>
                        <td colspan="3" class="text-center text-muted py-4">
                            <i class="bi bi-info-circle fs-4"></i>
                            <p class="mb-0 mt-2">No logs found</p>
                        </td>
                    </tr>
                `;
                countElement.textContent = '0';
                return;
            }

            // Build table rows
            const rows = logs.map(log => {
                // Determine badge color based on level
                let badgeClass = 'bg-secondary';
                if (log.level === 'INFO') badgeClass = 'bg-primary';
                else if (log.level === 'WARN') badgeClass = 'bg-warning text-dark';
                else if (log.level === 'ERROR') badgeClass = 'bg-danger';

                // Format timestamp
                const date = new Date(log.timestamp);
                const formattedDate = date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });

                return `
                    <tr>
                        <td>
                            <span class="badge ${badgeClass}">${log.level}</span>
                        </td>
                        <td>
                            <div class="text-truncate" style="max-width: 600px;" title="${escapeHtml(log.message)}">
                                ${escapeHtml(log.message)}
                            </div>
                        </td>
                        <td>
                            <small class="text-muted">${formattedDate}</small>
                        </td>
                    </tr>
                `;
            }).join('');

            tbody.innerHTML = rows;
            countElement.textContent = logs.length;
        }

        // Escape HTML to prevent XSS
        function escapeHtml(text) {
            const map = {
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#039;'
            };
            return text.replace(/[&<>"']/g, m => map[m]);
        }

        // Refresh dashboard with current filter
        async function refreshDashboard() {
            const levelFilter = document.getElementById('logLevelFilter').value;
            const tbody = document.getElementById('logsTableBody');

            // Show loading state
            tbody.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-muted py-4">
                        <div class="spinner-border spinner-border-sm me-2" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        Loading logs...
                    </td>
                </tr>
            `;

            // Fetch stats, timeline, and logs in parallel
            const [stats, timeline, logsData] = await Promise.all([
                fetchStats(),
                fetchTimeline(),
                fetchLogs(levelFilter)
            ]);

            // Update statistics and pie chart
            if (stats) {
                updateStatsDisplay(stats);
                updateChart(stats);
            }

            // Update timeline chart
            if (timeline) {
                updateTimelineChart(timeline);
            }

            // Update logs table
            currentLogs = logsData.logs || [];
            renderLogsTable(currentLogs);
        }

        // Handle log level filter change
        document.getElementById('logLevelFilter')?.addEventListener('change', refreshDashboard);

        // Load dashboard on tab activation
        document.getElementById('dashboard-tab')?.addEventListener('shown.bs.tab', function (e) {
            refreshDashboard();
        });

        // Initial dashboard load
        if (document.getElementById('dashboard').classList.contains('show')) {
            refreshDashboard();
        }

        // Swagger UI setup
        const spec = {
            openapi: '3.0.0',
            info: {
                title: 'Logging API',
                description: 'REST API for logging operations',
                version: '1.0.0'
            },
            servers: [
                { url: '/services/logging/api', description: 'Logging API' }
            ],
            paths: {
                '/log': {
                    post: {
                        summary: 'Submit a log entry',
                        description: 'Submits a new log entry to the logging service',
                        requestBody: {
                            required: true,
                            content: {
                                'application/json': {
                                    schema: { type: 'object' },
                                    example: { "level": "info", "message": "User logged in" }
                                }
                            }
                        },
                        responses: {
                            '200': {
                                description: 'Log entry submitted successfully',
                                content: {
                                    'text/plain': { schema: { type: 'string', example: 'OK' } }
                                }
                            },
                            '500': {
                                description: 'Server error',
                                content: {
                                    'text/plain': { schema: { type: 'string' } }
                                }
                            }
                        }
                    }
                },
                '/status': {
                    get: {
                        summary: 'Service status',
                        description: 'Check if the logging service is running',
                        responses: {
                            '200': {
                                description: 'Service is running',
                                content: {
                                    'application/json': {
                                        schema: { type: 'string', example: 'logging api running' }
                                    }
                                }
                            }
                        }
                    }
                },
                '/settings': {
                    get: {
                        summary: 'Service settings',
                        description: 'Check the logging service settings',
                        responses: {
                            '200': {
                                description: 'Service settings',
                                content: {
                                    'application/json': {
                                        schema: { type: 'string', example: '{}' }
                                    }
                                }
                            }
                        }
                    },
                    post: {
                        summary: 'Submit settings',
                        description: 'Submits the settings for the provider',
                        requestBody: {
                            required: true,
                            content: {
                                'application/json': {
                                    schema: { type: 'object' },
                                    example: { "minLogLevel": "info"}
                                }
                            }
                        },
                        responses: {
                            '200': {
                                description: 'Settings submitted successfully',
                                content: {
                                    'text/plain': { schema: { type: 'string', example: 'OK' } }
                                }
                            },
                            '500': {
                                description: 'Server error',
                                content: {
                                    'text/plain': { schema: { type: 'string' } }
                                }
                            }
                        }
                    }
                },
                '/logs': {
                    get: {
                        summary: 'Get log analytics',
                        description: 'Retrieves the last 1000 logs from analytics in descending order (newest to oldest). Optional query parameter to filter by log level.',
                        parameters: [
                            {
                                name: 'level',
                                in: 'query',
                                description: 'Filter logs by level (INFO, WARN, ERROR, LOG)',
                                required: false,
                                schema: {
                                    type: 'string',
                                    enum: ['INFO', 'WARN', 'ERROR', 'LOG']
                                }
                            }
                        ],
                        responses: {
                            '200': {
                                description: 'Logs retrieved successfully',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                count: {
                                                    type: 'number',
                                                    example: 10
                                                },
                                                level: {
                                                    type: 'string',
                                                    example: 'ALL'
                                                },
                                                logs: {
                                                    type: 'array',
                                                    items: {
                                                        type: 'object',
                                                        properties: {
                                                            level: {
                                                                type: 'string',
                                                                example: 'INFO'
                                                            },
                                                            message: {
                                                                type: 'string',
                                                                example: '2025-10-10T13:23:19.980Z - INFO - hostname - Application started'
                                                            },
                                                            timestamp: {
                                                                type: 'string',
                                                                example: '2025-10-10T13:23:19.980Z'
                                                            },
                                                            capturedAt: {
                                                                type: 'number',
                                                                example: 1728568999980
                                                            }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            },
                            '500': {
                                description: 'Server error',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                error: { type: 'string' },
                                                message: { type: 'string' }
                                            }
                                        }
                                    }
                                }
                            },
                            '503': {
                                description: 'Analytics module not available',
                                content: {
                                    'application/json': {
                                        schema: {
                                            type: 'object',
                                            properties: {
                                                error: { type: 'string' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        };

        // Settings functionality
        let currentSettings = {};

        // Fetch settings from API
        async function loadSettings() {
            try {
                const response = await fetch('/services/logging/api/settings');
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
                const response = await fetch('/services/logging/api/settings', {
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

        // Instance selector handlers
        document.getElementById('instanceSelector')?.addEventListener('change', function (e) {
            selectedInstance = this.value;
            // Reload stats and timeline when instance changes
            loadStats();
            loadTimeline();
        });

        document.getElementById('refreshInstanceBtn')?.addEventListener('click', function (e) {
            e.preventDefault();
            loadAvailableInstances();
        });

        // Initialize Swagger UI
        window.onload = function() {
            checkStatus();
            loadAvailableInstances();
            try {
            checkStatus();
                const ui = SwaggerUIBundle({
                    spec: spec,
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [
                        SwaggerUIBundle.presets.apis,
                        SwaggerUIBundle.presets.standalone
                    ],
                    plugins: [
                        SwaggerUIBundle.plugins.DownloadUrl
                    ],
                    layout: "BaseLayout",
                    tryItOutEnabled: true,
                    requestInterceptor: (request) => {
                        // Add any headers or modify request if needed
                        return request;
                    },
                    responseInterceptor: (response) => {
                        // Handle response if needed
                        return response;
                    },
                    onComplete: () => {
                        console.log('Swagger UI loaded successfully');
                    },
                    onFailure: (error) => {
                        console.error('Swagger UI failed to load:', error);
                    }
                });

                window.ui = ui;
            } catch (error) {
                console.error('Error initializing Swagger UI:', error);
                document.getElementById('swagger-ui').innerHTML = '<p style="color: red;">Error loading API documentation. Please refresh the page.</p>';
            }
        };