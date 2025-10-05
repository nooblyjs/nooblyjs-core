#!/bin/bash

# Script to update all service views with centralized navigation

SERVICES=(
    "aiservice:ai"
    "authservice:authservice"
    "dataserve:dataserve"
    "filing:filing"
    "logging:logging"
    "measuring:measuring"
    "notifying:notifying"
    "queueing:queueing"
    "scheduling:scheduling"
    "searching:searching"
    "workflow:workflow"
    "working:working"
)

for service_pair in "${SERVICES[@]}"; do
    IFS=':' read -r service_dir service_name <<< "$service_pair"

    file="/workspaces/nooblyjs-core/src/${service_dir}/views/index.html"

    if [ -f "$file" ]; then
        echo "Updating $service_dir..."

        # 1. Add navigation CSS if not present
        if ! grep -q "nav-section-header" "$file"; then
            # Find the .nav-item CSS block and add the new styles before it
            sed -i '/\.nav-item {/i\
        .nav-section-header {\
            padding: 0.5rem 1rem;\
            font-size: 0.75rem;\
            font-weight: 600;\
            text-transform: uppercase;\
            color: #6c757d;\
            background-color: #f8f9fa;\
            border-bottom: 1px solid #dee2e6;\
            margin-top: 0.5rem;\
        }\
\
' "$file"
        fi

        # 2. Update .nav-item CSS to support flex and status dots
        sed -i 's/\.nav-item {$/&\n            display: flex;\n            align-items: center;\n            justify-content: space-between;\n            position: relative;/' "$file"

        # 3. Add offline class and status dot CSS if not present
        if ! grep -q "\.nav-item\.offline" "$file"; then
            sed -i '/\.nav-item\.active {/a\
\
        .nav-item.offline {\
            opacity: 0.6;\
        }\
\
        .status-dot {\
            width: 8px;\
            height: 8px;\
            border-radius: 50%;\
            display: inline-block;\
            margin-left: auto;\
        }\
\
        .status-dot.online {\
            background-color: var(--custom-success);\
        }\
\
        .status-dot.offline {\
            background-color: var(--custom-danger);\
        }' "$file"
        fi

        # 4. Replace static navigation with dynamic navigation container
        sed -i 's/<nav class="sidebar">/<nav class="sidebar" id="navigation-sidebar">/' "$file"

        # Find and remove all static nav-item links between <nav> and </nav>
        # This is a complex sed operation, so we'll use a perl one-liner instead
        perl -i -0pe 's/(<nav class="sidebar"[^>]*>)(.*?)(<\/nav>)/\1\n            <!-- Navigation will be loaded here by navigation.js -->\n        \3/gs' "$file"

        # 5. Add navigation.js script before closing body tag if not present
        if ! grep -q "navigation.js" "$file"; then
            sed -i 's|</body>|    <script src="/services/js/navigation.js"></script>\n    <script>\n        NooblyNavigation.renderNavigation('\''navigation-sidebar'\'', '\'''"$service_name"''\'');\n    </script>\n</body>|' "$file"
        fi

        echo "✓ Updated $service_dir"
    else
        echo "✗ File not found: $file"
    fi
done

echo ""
echo "All services updated with centralized navigation!"
