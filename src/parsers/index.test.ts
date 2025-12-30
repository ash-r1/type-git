/**
 * Parser utilities tests
 */

import { describe, expect, it } from 'vitest';
import {
  parseGitProgress,
  parseJson,
  parseKeyValue,
  parseLfsProgress,
  parseLines,
  parsePorcelainV2,
  parseRecords,
} from './index.js';

describe('parseLines', () => {
  it('should parse newline-separated output', () => {
    const result = parseLines('line1\nline2\nline3\n');
    expect(result).toEqual(['line1', 'line2', 'line3']);
  });

  it('should trim lines by default', () => {
    const result = parseLines('  line1  \n  line2  \n');
    expect(result).toEqual(['line1', 'line2']);
  });

  it('should skip empty lines by default', () => {
    const result = parseLines('line1\n\nline2\n\n');
    expect(result).toEqual(['line1', 'line2']);
  });

  it('should keep empty lines when specified', () => {
    const result = parseLines('line1\n\nline2', { keepEmpty: true });
    expect(result).toEqual(['line1', '', 'line2']);
  });

  it('should not trim when specified', () => {
    const result = parseLines('  line1  \n', { trim: false, keepEmpty: true });
    expect(result).toEqual(['  line1  ', '']);
  });
});

describe('parseRecords', () => {
  it('should parse NUL-delimited records', () => {
    const result = parseRecords('record1\0record2\0record3\0');
    expect(result).toEqual(['record1', 'record2', 'record3']);
  });

  it('should parse custom delimiter', () => {
    const result = parseRecords('a|b|c|', '|');
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('should return empty array for empty input', () => {
    const result = parseRecords('');
    expect(result).toEqual([]);
  });
});

describe('parseJson', () => {
  it('should parse single JSON object', () => {
    const result = parseJson<{ name: string }>('{"name": "test"}');
    expect(result).toEqual({ name: 'test' });
  });

  it('should parse NDJSON', () => {
    const result = parseJson<{ id: number }>('{"id": 1}\n{"id": 2}\n{"id": 3}', { ndjson: true });
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('should handle whitespace', () => {
    const result = parseJson<number>('  42  ');
    expect(result).toBe(42);
  });
});

describe('parseKeyValue', () => {
  it('should parse key=value pairs', () => {
    const result = parseKeyValue('key1=value1\nkey2=value2');
    expect(result.get('key1')).toBe('value1');
    expect(result.get('key2')).toBe('value2');
  });

  it('should handle values with separator', () => {
    const result = parseKeyValue('key=value=with=equals');
    expect(result.get('key')).toBe('value=with=equals');
  });

  it('should support custom separator', () => {
    const result = parseKeyValue('key:value', { separator: ':' });
    expect(result.get('key')).toBe('value');
  });
});

describe('parsePorcelainV2', () => {
  it('should parse untracked files', () => {
    const result = parsePorcelainV2('? untracked.txt');
    expect(result).toEqual([{ type: 'untracked', path: 'untracked.txt' }]);
  });

  it('should parse ignored files', () => {
    const result = parsePorcelainV2('! ignored.txt');
    expect(result).toEqual([{ type: 'ignored', path: 'ignored.txt' }]);
  });

  it('should parse modified files', () => {
    const output = '1 .M N... 100644 100644 100644 abc123 def456 modified.txt';
    const result = parsePorcelainV2(output);

    expect(result[0]?.type).toBe('changed');
    expect((result[0] as { path: string }).path).toBe('modified.txt');
  });

  it('should skip header lines', () => {
    const output = '# branch.oid abc123\n# branch.head main\n? file.txt';
    const result = parsePorcelainV2(output);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ type: 'untracked', path: 'file.txt' });
  });
});

describe('parseGitProgress', () => {
  it('should parse progress with percentage', () => {
    const result = parseGitProgress('Counting objects: 100% (10/10), done.');

    expect(result).toEqual({
      phase: 'Counting objects',
      current: 10,
      total: 10,
      percent: 100,
      done: true,
    });
  });

  it('should parse progress without done', () => {
    const result = parseGitProgress('Compressing objects:  50% (4/8)');

    expect(result).toEqual({
      phase: 'Compressing objects',
      current: 4,
      total: 8,
      percent: 50,
      done: false,
    });
  });

  it('should parse simple fraction format', () => {
    const result = parseGitProgress('Receiving objects: 5/20');

    expect(result).toEqual({
      phase: 'Receiving objects',
      current: 5,
      total: 20,
      percent: 25,
      done: false,
    });
  });

  it('should return null for non-progress lines', () => {
    const result = parseGitProgress('remote: Enumerating objects');
    expect(result).toBeNull();
  });
});

describe('parseLfsProgress', () => {
  it('should parse download progress', () => {
    const result = parseLfsProgress('download abc123 500/1000 250');

    expect(result).toEqual({
      direction: 'download',
      oid: 'abc123',
      bytesSoFar: 500,
      bytesTotal: 1000,
      bytesTransferred: 250,
    });
  });

  it('should parse upload progress', () => {
    const result = parseLfsProgress('upload def456 1000/1000 1000');

    expect(result).toEqual({
      direction: 'upload',
      oid: 'def456',
      bytesSoFar: 1000,
      bytesTotal: 1000,
      bytesTransferred: 1000,
    });
  });

  it('should return null for invalid format', () => {
    const result = parseLfsProgress('invalid line');
    expect(result).toBeNull();
  });

  it('should return null for invalid direction', () => {
    const result = parseLfsProgress('invalid abc123 100/100 100');
    expect(result).toBeNull();
  });
});
