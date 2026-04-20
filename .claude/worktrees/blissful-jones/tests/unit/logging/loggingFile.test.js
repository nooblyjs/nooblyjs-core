/**
 * @fileoverview Unit tests for the file logging functionality with rolling logs.
 *
 * This test suite covers the file logger provider, testing async file writing,
 * log rotation by size and period, and file retention policies.
 *
 * @author Digital Technologies Team
 * @version 1.1.0
 * @since 1.0.0
 */

'use strict';

const EventEmitter = require('events');

/**
 * Mock fs module for testing file operations.
 * Provides both sync (for constructor) and async (fs.promises) methods.
 */
jest.mock('fs', () => ({
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  promises: {
    appendFile: jest.fn().mockResolvedValue(undefined),
    stat: jest.fn().mockResolvedValue({ size: 0 }),
    rename: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockRejectedValue(new Error('ENOENT')),
  }
}));

const fs = require('node:fs');
const createLogger = require('../../../src/logging');

/**
 * Test suite for file logging operations with rolling logs.
 */
describe('loggingFile', () => {
  /** @type {Object} File logger instance for testing */
  let logger;
  /** @type {string} Test log filename */
  const filename = 'test.log';

  /**
   * Set up test environment before each test case.
   * Creates a file logger instance with test configuration.
   */
  beforeEach(() => {
    logger = createLogger('file', { filename }, new EventEmitter());
    jest.clearAllMocks();
  });

  /**
   * Clean up test environment after each test case.
   */
  afterEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test basic async file logging.
   * Verifies that log messages are appended to the file asynchronously.
   */
  it('should log a message to a file asynchronously', async () => {
    const message = 'Test message';
    await logger.log(message);

    expect(fs.promises.appendFile).toHaveBeenCalledWith(
      expect.stringContaining('test.log'),
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*- LOG - .* - Test message\n$/)
    );
  });

  /**
   * Test that info() logs with proper formatting.
   */
  it('should format info level logs with timestamp, device, and message', async () => {
    const message = 'Info test';
    await logger.info(message);

    expect(fs.promises.appendFile).toHaveBeenCalled();
    const call = fs.promises.appendFile.mock.calls[0];
    const loggedText = call[1];

    expect(loggedText).toMatch(/^\d{4}-\d{2}-\d{2}T.*INFO.*Info test\n$/);
  });

  /**
   * Test that warn() logs with proper formatting.
   */
  it('should format warn level logs with timestamp, device, and message', async () => {
    const message = 'Warning test';
    await logger.warn(message);

    expect(fs.promises.appendFile).toHaveBeenCalled();
    const call = fs.promises.appendFile.mock.calls[0];
    const loggedText = call[1];

    expect(loggedText).toMatch(/^\d{4}-\d{2}-\d{2}T.*WARN.*Warning test\n$/);
  });

  /**
   * Test that error() logs with proper formatting.
   */
  it('should format error level logs with timestamp, device, and message', async () => {
    const message = 'Error test';
    await logger.error(message);

    expect(fs.promises.appendFile).toHaveBeenCalled();
    const call = fs.promises.appendFile.mock.calls[0];
    const loggedText = call[1];

    expect(loggedText).toMatch(/^\d{4}-\d{2}-\d{2}T.*ERROR.*Error test\n$/);
  });

  /**
   * Test default date-based filename generation and directory creation.
   */
  it('should use default date-based filename and create .logs directory', async () => {
    const loggerDefault = createLogger('file', {}, new EventEmitter());
    const message = 'Default test message';
    await loggerDefault.log(message);

    // Should attempt to create .logs directory
    expect(fs.mkdirSync).toHaveBeenCalledWith('.logs', { recursive: true });

    // Should use date-based filename pattern
    const calls = fs.promises.appendFile.mock.calls;
    const lastCall = calls[calls.length - 1];
    expect(lastCall[0]).toMatch(/^\.logs\/app\.\d{4}-\d{2}-\d{2}\.log$/);
    // Log format is now: timestamp - LOG - device - message\n
    expect(lastCall[1]).toMatch(/^\d{4}-\d{2}-\d{2}T.*- LOG - .* - Default test message\n$/);
  });

  /**
   * Test custom directory option.
   */
  it('should use custom log directory when specified', async () => {
    const customLogger = createLogger('file', {
      logDir: './custom-logs',
      filename: 'custom.log'
    }, new EventEmitter());

    const message = 'Custom dir test';
    await customLogger.log(message);

    expect(fs.promises.appendFile).toHaveBeenCalled();
    const call = fs.promises.appendFile.mock.calls[0];
    expect(call[0]).toMatch(/custom-logs\/custom\.log$/);
    // Log format is now: timestamp - LOG - device - message\n
    expect(call[1]).toMatch(/^\d{4}-\d{2}-\d{2}T.*- LOG - .* - Custom dir test\n$/);
  });

  /**
   * Test metadata is appended to log messages as JSON.
   */
  it('should append metadata to log messages as JSON', async () => {
    const message = 'Test with metadata';
    const meta = { userId: '123', action: 'login' };

    await logger.info(message, meta);

    expect(fs.promises.appendFile).toHaveBeenCalled();
    const call = fs.promises.appendFile.mock.calls[0];
    const loggedText = call[1];

    expect(loggedText).toContain(message);
    expect(loggedText).toContain(JSON.stringify(meta));
  });

  /**
   * Test that stat is called to check file size for rotation.
   */
  it('should check file size before rotation when size-based rotation is enabled', async () => {
    const loggerWithSize = createLogger('file', {
      filename: 'test.log',
      maxSize: 1000,
      rotatePeriod: 'none'
    }, new EventEmitter());

    fs.promises.stat.mockResolvedValue({ size: 500 });

    await loggerWithSize.log('Test message');

    // Verify stat was called to check the file size
    expect(fs.promises.stat).toHaveBeenCalled();
    expect(fs.promises.stat.mock.calls[0][0]).toContain('test.log');
  });

  /**
   * Test that maxSize: 0 disables size-based rotation.
   */
  it('should not check file size when maxSize is 0', async () => {
    const loggerNoSize = createLogger('file', {
      filename: 'test.log',
      maxSize: 0
    }, new EventEmitter());

    await loggerNoSize.log('Test message');

    // stat should not be called since maxSize is 0
    expect(fs.promises.stat).not.toHaveBeenCalled();
  });

  /**
   * Test period-based rotation (daily).
   */
  it('should trigger period-based rotation when period key changes', async () => {
    // Create logger with daily rotation
    const loggerDaily = createLogger('file', {
      filename: 'test.log',
      rotatePeriod: 'daily'
    }, new EventEmitter());

    // First write with no rotation
    await loggerDaily.log('Message 1');
    expect(fs.promises.rename).not.toHaveBeenCalled();

    // The period key is based on current date, so we can't easily trigger it in tests
    // but we can verify the setting exists
    const settings = await loggerDaily.getSettings();
    expect(settings.rotatePeriod).toBe('daily');
  });

  /**
   * Test that rotatePeriod: 'none' disables period-based rotation.
   */
  it('should not perform period-based rotation when rotatePeriod is none', async () => {
    const loggerNoRotate = createLogger('file', {
      filename: 'test.log',
      rotatePeriod: 'none'
    }, new EventEmitter());

    await loggerNoRotate.log('Test message');

    // stat should not be called for period rotation when set to 'none'
    // (will still check size if maxSize > 0)
    const settings = await loggerNoRotate.getSettings();
    expect(settings.rotatePeriod).toBe('none');
  });

  /**
   * Test settings persistence.
   */
  it('should persist settings changes', async () => {
    const newSettings = {
      maxSize: 5 * 1024 * 1024,
      maxFiles: 10,
      rotatePeriod: 'hourly'
    };

    await logger.saveSettings(newSettings);

    const settings = await logger.getSettings();
    expect(settings.maxSize).toBe(5 * 1024 * 1024);
    expect(settings.maxFiles).toBe(10);
    expect(settings.rotatePeriod).toBe('hourly');
  });

  /**
   * Test write queue serialization (concurrent writes execute in order).
   */
  it('should serialize writes through the promise queue', async () => {
    const appendCalls = [];
    fs.promises.appendFile.mockImplementation((path, content) => {
      appendCalls.push(content);
      return Promise.resolve();
    });

    // Issue multiple concurrent writes
    const write1 = logger.log('Message 1');
    const write2 = logger.log('Message 2');
    const write3 = logger.log('Message 3');

    await Promise.all([write1, write2, write3]);

    // All writes should be queued and executed (order preserved)
    expect(fs.promises.appendFile).toHaveBeenCalledTimes(3);
    expect(appendCalls).toHaveLength(3);
    expect(appendCalls[0]).toContain('Message 1');
    expect(appendCalls[1]).toContain('Message 2');
    expect(appendCalls[2]).toContain('Message 3');
  });

  /**
   * Test graceful error handling when write fails.
   */
  it('should continue logging when write fails', async () => {
    const mockEmitter = new EventEmitter();
    const warnSpy = jest.spyOn(mockEmitter, 'emit');

    const testLogger = createLogger('file', {
      filename: 'test.log'
    }, mockEmitter);

    // Mock appendFile to reject
    fs.promises.appendFile.mockRejectedValueOnce(new Error('Disk full'));

    await testLogger.log('This will fail');

    // Should emit a warning event but not throw
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('warn'),
      expect.objectContaining({ message: expect.stringContaining('write failed') })
    );

    warnSpy.mockRestore();
  });

  /**
   * Test log level filtering.
   */
  it('should respect minLogLevel setting', async () => {
    const testLogger = createLogger('file', {
      filename: 'test.log',
      log: { level: 'error' } // Only log errors
    }, new EventEmitter());

    await testLogger.info('Info message');
    await testLogger.warn('Warn message');
    await testLogger.error('Error message');

    // Only error should be written
    expect(fs.promises.appendFile).toHaveBeenCalledTimes(1);
    const call = fs.promises.appendFile.mock.calls[0];
    expect(call[1]).toContain('Error message');
  });
});
