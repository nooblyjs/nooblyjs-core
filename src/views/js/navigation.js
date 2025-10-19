/**
 * Centralized Navigation System for Noobly JS Services
 * Dynamically generates navigation with online/offline status
 */

const NooblyNavigation = {
    services: [
        { name: 'ai', icon: 'bi-robot', title: 'AI Service', path: 'ai' },
        { name: 'authservice', icon: 'bi-lock-fill', title: 'Authentication', path: 'authservice' },
        { name: 'logging', icon: 'bi-journal-text', title: 'Logging', path: 'logging' },
        { name: 'caching', icon: 'bi-server', title: 'Caching', path: 'caching' },
        { name: 'queueing', icon: 'bi-list-task', title: 'Queues', path: 'queueing' },
        { name: 'filing', icon: 'bi-folder-fill', title: 'File Management', path: 'filing' },
        { name: 'working', icon: 'bi-gear-fill', title: 'Worker Tasks', path: 'working' },
        { name: 'measuring', icon: 'bi-graph-up', title: 'Measuring', path: 'measuring' },
        { name: 'dataservice', icon: 'bi-database', title: 'Data Service', path: 'dataservice' },
        { name: 'notifying', icon: 'bi-bell-fill', title: 'Notifications', path: 'notifying' },
        { name: 'scheduling', icon: 'bi-alarm-fill', title: 'Scheduling', path: 'scheduling' },
        { name: 'searching', icon: 'bi-search', title: 'Searching', path: 'searching' },
        { name: 'workflow', icon: 'bi-diagram-3-fill', title: 'Workflows', path: 'workflow' }
    ],

    serviceStatus: {},

    /**
     * Check status of all services
     */
    async checkAllStatuses() {
        const statusPromises = this.services.map(async (service) => {
            try {
                const response = await fetch(`/services/${service.path}/api/status`);
                this.serviceStatus[service.name] = response.ok;
                return { name: service.name, online: response.ok };
            } catch (error) {
                this.serviceStatus[service.name] = false;
                return { name: service.name, online: false };
            }
        });

        await Promise.all(statusPromises);
        return this.serviceStatus;
    },

    /**
     * Get online services
     */
    getOnlineServices() {
        return this.services.filter(service => this.serviceStatus[service.name] === true);
    },

    /**
     * Get offline services
     */
    getOfflineServices() {
        return this.services.filter(service => this.serviceStatus[service.name] === false);
    },

    /**
     * Render navigation sidebar
     * @param {string} containerId - ID of the container element
     * @param {string} activeService - Name of the currently active service ('home' for dashboard)
     */
    async renderNavigation(containerId, activeService = 'home') {
        const container = document.getElementById(containerId);
        if (!container) return;

        // Check all service statuses first
        await this.checkAllStatuses();

        const onlineServices = this.getOnlineServices();
        const offlineServices = this.getOfflineServices();

        // Build navigation HTML
        let navHTML = `
            <div class="logo">
                <h1>Noobly JS</h1>
                <div class="subtitle">Service Registry</div>
            </div>
            <a href="/" class="nav-item ${activeService === 'home' ? 'active' : ''}">Home</a>
        `;

        // Online Services Section
        if (onlineServices.length > 0) {
            navHTML += `<div class="nav-section-header">Online Services</div>`;
            onlineServices.forEach(service => {
                const isActive = activeService === service.name ? 'active' : '';
                navHTML += `
                    <a href="/services/${service.path}/" class="nav-item ${isActive}">
                        ${service.title}
                        <span class="status-dot online"></span>
                    </a>
                `;
            });
        }

        // Offline Services Section
        if (offlineServices.length > 0) {
            navHTML += `
                <div class="nav-section-header" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center;" onclick="NooblyNavigation.toggleOfflineNav()">
                    <span>Offline Services</span>
                    <span id="offline-toggle-icon">▼</span>
                </div>
                <div id="offline-nav-services" style="display: none;">
            `;
            offlineServices.forEach(service => {
                const isActive = activeService === service.name ? 'active' : '';
                navHTML += `
                    <a href="/services/${service.path}/" class="nav-item ${isActive} offline">
                        ${service.title}
                        <span class="status-dot offline"></span>
                    </a>
                `;
            });
            navHTML += `</div>`;
        }

        // Logout section
        navHTML += `
            <div class="logout-section">
                <div class="user-info">
                    <small>Logged in as:</small>
                    <strong id="username-display">Loading...</strong>
                </div>
                <button id="logout-btn" class="btn btn-danger">
                    Logout
                </button>
            </div>
        `;

        container.innerHTML = navHTML;

        // Initialize auth display
        this.initializeAuth();
    },

    /**
     * Toggle offline services section in navigation
     */
    toggleOfflineNav() {
        const offlineSection = document.getElementById('offline-nav-services');
        const toggleIcon = document.getElementById('offline-toggle-icon');

        if (offlineSection && toggleIcon) {
            if (offlineSection.style.display === 'none') {
                offlineSection.style.display = 'block';
                toggleIcon.textContent = '▲';
            } else {
                offlineSection.style.display = 'none';
                toggleIcon.textContent = '▼';
            }
        }
    },

    /**
     * Initialize authentication display and logout
     */
    initializeAuth() {
        const currentUser = localStorage.getItem('currentUser');
        const usernameDisplay = document.getElementById('username-display');

        if (currentUser && usernameDisplay) {
            try {
                const user = JSON.parse(currentUser);
                usernameDisplay.textContent = user.username || 'Unknown';
            } catch (e) {
                usernameDisplay.textContent = 'Unknown';
            }
        }

        // Logout functionality
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                const token = localStorage.getItem('authToken');
                if (token) {
                    try {
                        await fetch('/services/authservice/api/logout', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ token })
                        });
                    } catch (error) {
                        console.error('Logout error:', error);
                    }
                }

                localStorage.removeItem('authToken');
                localStorage.removeItem('currentUser');
                window.location.href = '/services/authservice/views/login.html';
            });
        }
    }
};

// Make it globally available
window.NooblyNavigation = NooblyNavigation;
