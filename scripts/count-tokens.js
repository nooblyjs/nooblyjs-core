#!/usr/bin/env node

/**
 * Token Counter Script
 * Counts tokens in all code and markdown files to identify refactoring candidates
 *
 * Uses a simple approximation: 1 token ≈ 4 characters (Claude's tokenizer average)
 * This is close enough for identifying large files that need refactoring.
 *
 * Output includes:
 * - Total tokens per file
 * - Files sorted by token count
 * - Refactoring recommendations
 * - Summary statistics
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CHARS_PER_TOKEN = 4; // Approximate: Claude uses ~4 chars per token
const REFACTOR_THRESHOLD = 2000; // Files over 2000 tokens are refactoring candidates
const LARGE_FILE_THRESHOLD = 5000; // Files over 5000 tokens are definitely too large

// File extensions to analyze
const CODE_EXTENSIONS = ['.js', '.json', '.md', '.txt'];

// Directories to skip
const SKIP_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.nyc_output',
  'build',
  'out'
];

/**
 * Estimate token count from text
 * @param {string} text - Text content
 * @returns {number} Estimated token count
 */
function estimateTokens(text) {
  // Remove extra whitespace for more accurate count
  const normalizedText = text.replace(/\s+/g, ' ').trim();
  return Math.ceil(normalizedText.length / CHARS_PER_TOKEN);
}

/**
 * Check if directory should be skipped
 * @param {string} dirPath - Directory path
 * @returns {boolean} True if should skip
 */
function shouldSkipDirectory(dirPath) {
  const dirName = path.basename(dirPath);
  return SKIP_DIRS.includes(dirName);
}

/**
 * Check if file should be analyzed
 * @param {string} filePath - File path
 * @returns {boolean} True if should analyze
 */
function shouldAnalyzeFile(filePath) {
  const ext = path.extname(filePath);
  return CODE_EXTENSIONS.includes(ext);
}

/**
 * Recursively find all files to analyze
 * @param {string} dirPath - Directory to search
 * @param {Array} fileList - Accumulated file list
 * @returns {Array} List of file paths
 */
function findFiles(dirPath, fileList = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (!shouldSkipDirectory(filePath)) {
        findFiles(filePath, fileList);
      }
    } else if (shouldAnalyzeFile(filePath)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

/**
 * Analyze a single file
 * @param {string} filePath - File to analyze
 * @returns {Object} Analysis results
 */
function analyzeFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').length;
    const chars = content.length;
    const tokens = estimateTokens(content);
    const ext = path.extname(filePath);

    return {
      path: filePath,
      relativePath: path.relative(process.cwd(), filePath),
      extension: ext,
      lines,
      chars,
      tokens,
      needsRefactor: tokens > REFACTOR_THRESHOLD,
      severity: tokens > LARGE_FILE_THRESHOLD ? 'CRITICAL' :
                tokens > REFACTOR_THRESHOLD ? 'HIGH' :
                tokens > 1000 ? 'MEDIUM' : 'LOW'
    };
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Generate refactoring recommendations
 * @param {Object} fileData - File analysis data
 * @returns {string} Recommendation text
 */
function generateRecommendation(fileData) {
  const { relativePath, tokens, lines, extension } = fileData;

  if (extension === '.md') {
    if (tokens > 5000) {
      return `📄 SPLIT: ${relativePath} (${tokens} tokens, ${lines} lines)
   → Split into multiple smaller documents
   → Create a table of contents with links
   → Consider separating sections into individual files`;
    } else if (tokens > 2000) {
      return `📄 CONSIDER: ${relativePath} (${tokens} tokens, ${lines} lines)
   → Add more section headers for better navigation
   → Consider splitting if it continues to grow`;
    }
  }

  if (extension === '.js') {
    if (tokens > 5000) {
      return `🔧 REFACTOR: ${relativePath} (${tokens} tokens, ${lines} lines)
   → Extract utility functions into separate modules
   → Split large classes into smaller components
   → Consider using composition over inheritance
   → Move provider logic to separate files`;
    } else if (tokens > 2000) {
      return `🔧 REVIEW: ${relativePath} (${tokens} tokens, ${lines} lines)
   → Look for opportunities to extract functions
   → Consider splitting if adding more features`;
    }
  }

  if (extension === '.json') {
    if (tokens > 2000) {
      return `📊 LARGE DATA: ${relativePath} (${tokens} tokens, ${lines} lines)
   → Consider splitting into multiple JSON files
   → Use external data files if this is configuration`;
    }
  }

  return null;
}

/**
 * Main function
 */
function main() {
  console.log('🔍 Token Counter - Analyzing codebase...\n');

  const startTime = Date.now();
  const projectRoot = process.cwd();

  // Find all files
  console.log('Finding files...');
  const files = findFiles(projectRoot);
  console.log(`Found ${files.length} files to analyze\n`);

  // Analyze all files
  console.log('Analyzing files...');
  const results = files
    .map(analyzeFile)
    .filter(result => result !== null);

  // Sort by token count (descending)
  results.sort((a, b) => b.tokens - a.tokens);

  // Calculate statistics
  const totalTokens = results.reduce((sum, r) => sum + r.tokens, 0);
  const totalLines = results.reduce((sum, r) => sum + r.lines, 0);
  const totalChars = results.reduce((sum, r) => sum + r.chars, 0);
  const avgTokens = Math.round(totalTokens / results.length);

  const refactorCandidates = results.filter(r => r.needsRefactor);
  const criticalFiles = results.filter(r => r.severity === 'CRITICAL');
  const highPriorityFiles = results.filter(r => r.severity === 'HIGH');

  // Group by extension
  const byExtension = {};
  results.forEach(r => {
    if (!byExtension[r.extension]) {
      byExtension[r.extension] = {
        count: 0,
        tokens: 0,
        lines: 0
      };
    }
    byExtension[r.extension].count++;
    byExtension[r.extension].tokens += r.tokens;
    byExtension[r.extension].lines += r.lines;
  });

  // Print summary statistics
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY STATISTICS');
  console.log('='.repeat(80));
  console.log(`Total files analyzed: ${results.length}`);
  console.log(`Total lines of code: ${totalLines.toLocaleString()}`);
  console.log(`Total characters: ${totalChars.toLocaleString()}`);
  console.log(`Total tokens (estimated): ${totalTokens.toLocaleString()}`);
  console.log(`Average tokens per file: ${avgTokens.toLocaleString()}`);
  console.log(`\nFiles needing refactoring: ${refactorCandidates.length}`);
  console.log(`  - Critical (>5000 tokens): ${criticalFiles.length}`);
  console.log(`  - High (>2000 tokens): ${highPriorityFiles.length}`);

  // Print breakdown by extension
  console.log('\n' + '='.repeat(80));
  console.log('📁 BREAKDOWN BY FILE TYPE');
  console.log('='.repeat(80));
  Object.entries(byExtension)
    .sort((a, b) => b[1].tokens - a[1].tokens)
    .forEach(([ext, data]) => {
      console.log(`${ext.padEnd(10)} ${data.count.toString().padStart(4)} files  ` +
                  `${data.tokens.toLocaleString().padStart(8)} tokens  ` +
                  `${data.lines.toLocaleString().padStart(7)} lines`);
    });

  // Print top 20 largest files
  console.log('\n' + '='.repeat(80));
  console.log('📈 TOP 20 LARGEST FILES (by token count)');
  console.log('='.repeat(80));
  results.slice(0, 20).forEach((file, index) => {
    const rank = (index + 1).toString().padStart(2);
    const tokens = file.tokens.toLocaleString().padStart(6);
    const lines = file.lines.toString().padStart(5);
    const severity = file.severity.padEnd(8);
    console.log(`${rank}. [${severity}] ${tokens} tokens, ${lines} lines - ${file.relativePath}`);
  });

  // Print refactoring recommendations
  if (refactorCandidates.length > 0) {
    console.log('\n' + '='.repeat(80));
    console.log('🔧 REFACTORING RECOMMENDATIONS');
    console.log('='.repeat(80));
    console.log(`Found ${refactorCandidates.length} files that should be refactored:\n`);

    // Critical files first
    if (criticalFiles.length > 0) {
      console.log('🚨 CRITICAL PRIORITY (>5000 tokens) - REFACTOR IMMEDIATELY:\n');
      criticalFiles.forEach(file => {
        const recommendation = generateRecommendation(file);
        if (recommendation) {
          console.log(recommendation + '\n');
        }
      });
    }

    // High priority files
    if (highPriorityFiles.length > 0) {
      console.log('\n⚠️  HIGH PRIORITY (2000-5000 tokens) - PLAN REFACTORING:\n');
      highPriorityFiles.forEach(file => {
        const recommendation = generateRecommendation(file);
        if (recommendation) {
          console.log(recommendation + '\n');
        }
      });
    }
  }

  // Print specific recommendations by category
  console.log('\n' + '='.repeat(80));
  console.log('💡 SPECIFIC RECOMMENDATIONS BY CATEGORY');
  console.log('='.repeat(80));

  // Documentation files
  const largeDocs = results.filter(r => r.extension === '.md' && r.tokens > 2000);
  if (largeDocs.length > 0) {
    console.log('\n📚 DOCUMENTATION FILES:\n');
    largeDocs.forEach(doc => {
      console.log(`   ${doc.relativePath} (${doc.tokens} tokens)`);
    });
    console.log('\n   Recommendations:');
    console.log('   1. Split large docs into multiple focused documents');
    console.log('   2. Create index/navigation documents');
    console.log('   3. Use relative links between documents');
    console.log('   4. Consider AI consumption patterns (2000-4000 token chunks optimal)');
  }

  // Code files
  const largeCode = results.filter(r => r.extension === '.js' && r.tokens > 2000);
  if (largeCode.length > 0) {
    console.log('\n💻 CODE FILES:\n');
    largeCode.forEach(code => {
      console.log(`   ${code.relativePath} (${code.tokens} tokens, ${code.lines} lines)`);
    });
    console.log('\n   Recommendations:');
    console.log('   1. Extract provider implementations to separate files');
    console.log('   2. Split utility functions into modules');
    console.log('   3. Use factory patterns for complex initialization');
    console.log('   4. Consider service-specific subdirectories');
    console.log('   5. Maximum ~500 lines per file for maintainability');
  }

  // Configuration files
  const largeConfig = results.filter(r => r.extension === '.json' && r.tokens > 1000);
  if (largeConfig.length > 0) {
    console.log('\n⚙️  CONFIGURATION FILES:\n');
    largeConfig.forEach(config => {
      console.log(`   ${config.relativePath} (${config.tokens} tokens)`);
    });
    console.log('\n   Recommendations:');
    console.log('   1. Split large package.json if it has many dependencies');
    console.log('   2. Move test data to separate files');
    console.log('   3. Use environment-specific config files');
  }

  // Overall recommendations
  console.log('\n' + '='.repeat(80));
  console.log('🎯 OVERALL RECOMMENDATIONS');
  console.log('='.repeat(80));
  console.log(`
1. TARGET METRICS:
   - Code files: Keep under 500 lines (~2000 tokens)
   - Documentation: Keep under 1000 lines (~4000 tokens)
   - Configuration: Keep under 500 lines

2. REFACTORING PRIORITY:
   - First: Files with >5000 tokens (${criticalFiles.length} files)
   - Second: Files with 2000-5000 tokens (${highPriorityFiles.length} files)
   - Third: Growing files approaching 2000 tokens

3. BENEFITS OF REFACTORING:
   - Better AI code understanding and suggestions
   - Easier code navigation and maintenance
   - Reduced cognitive load for developers
   - Faster file loading and parsing
   - Better test coverage granularity

4. REFACTORING STRATEGIES:
   - Documentation: Split by major sections/topics
   - Code: Extract providers, utilities, and helpers
   - Tests: One test file per module
   - Configuration: Split by environment or feature
  `);

  const duration = Date.now() - startTime;
  console.log('='.repeat(80));
  console.log(`✅ Analysis complete in ${duration}ms\n`);

  // Write detailed report to file
  const reportPath = path.join(projectRoot, 'token-analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: {
      totalFiles: results.length,
      totalLines,
      totalChars,
      totalTokens,
      avgTokens,
      refactorCandidates: refactorCandidates.length,
      criticalFiles: criticalFiles.length,
      highPriorityFiles: highPriorityFiles.length
    },
    byExtension,
    files: results,
    refactoringCandidates: refactorCandidates.map(f => ({
      path: f.relativePath,
      tokens: f.tokens,
      lines: f.lines,
      severity: f.severity,
      recommendation: generateRecommendation(f)
    }))
  }, null, 2));

  console.log(`📄 Detailed report written to: ${reportPath}\n`);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { estimateTokens, analyzeFile, findFiles };
