# Scripts Directory

Utility scripts for the nooblyjs-core project.

## Available Scripts

### `count-tokens.js` - Token Analysis Tool

Analyzes all code and markdown files in the project to identify files that are too large for effective AI analysis.

**Usage:**
```bash
npm run analyze-tokens
# or
node scripts/count-tokens.js
```

**What it does:**
- Scans all `.js`, `.json`, and `.md` files in the project
- Estimates token count for each file (1 token ≈ 4 characters)
- Identifies files that need refactoring (>2000 tokens)
- Generates detailed recommendations
- Creates `token-analysis-report.json` with full analysis

**Output:**
- Summary statistics (total tokens, files, lines)
- Top 20 largest files
- Refactoring recommendations by priority
- Breakdown by file type
- Specific recommendations by category

**Thresholds:**
- **<2,000 tokens:** ✅ Good size for AI analysis
- **2,000-5,000 tokens:** ⚠️ Consider refactoring
- **>5,000 tokens:** 🚨 Critical - split immediately

**Generated Files:**
- `token-analysis-report.json` - Full analysis data
- See `docs/refactoring-plan.md` for detailed refactoring plan

## Adding New Scripts

When adding new scripts to this directory:

1. Make the script executable:
   ```bash
   chmod +x scripts/your-script.js
   ```

2. Add shebang line at top:
   ```javascript
   #!/usr/bin/env node
   ```

3. Add script to `package.json`:
   ```json
   "scripts": {
     "your-script": "node ./scripts/your-script.js"
   }
   ```

4. Document the script in this README

## Related Documentation

- [`docs/refactoring-plan.md`](../docs/refactoring-plan.md) - Detailed refactoring recommendations
- [`token-analysis-report.json`](../token-analysis-report.json) - Full analysis output (generated)
