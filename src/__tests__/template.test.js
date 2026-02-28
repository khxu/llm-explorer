import { describe, it, expect } from 'vitest';
import { interpolate, extractPlaceholders } from '../utils/template.js';

describe('interpolate', () => {
  it('replaces simple placeholders', () => {
    expect(interpolate('Hello {{name}}!', { name: 'World' })).toBe('Hello World!');
  });

  it('replaces multiple placeholders', () => {
    const result = interpolate('{{greeting}} {{name}}, you are {{age}}.', {
      greeting: 'Hi',
      name: 'Alice',
      age: '30',
    });
    expect(result).toBe('Hi Alice, you are 30.');
  });

  it('handles whitespace inside braces', () => {
    expect(interpolate('Hello {{ name }}!', { name: 'World' })).toBe('Hello World!');
    expect(interpolate('Hello {{  name  }}!', { name: 'World' })).toBe('Hello World!');
  });

  it('leaves unmatched placeholders intact', () => {
    expect(interpolate('Hello {{name}} and {{missing}}!', { name: 'World' })).toBe(
      'Hello World and {{missing}}!'
    );
  });

  it('handles empty template', () => {
    expect(interpolate('', { name: 'World' })).toBe('');
  });

  it('handles template with no placeholders', () => {
    expect(interpolate('No placeholders here', { name: 'World' })).toBe('No placeholders here');
  });

  it('handles empty data object', () => {
    expect(interpolate('Hello {{name}}!', {})).toBe('Hello {{name}}!');
  });

  it('returns null/undefined for null/undefined template', () => {
    expect(interpolate(null, { name: 'World' })).toBeNull();
    expect(interpolate(undefined, { name: 'World' })).toBeUndefined();
  });

  it('replaces duplicate placeholders', () => {
    expect(interpolate('{{x}} and {{x}}', { x: 'val' })).toBe('val and val');
  });

  it('handles empty string values', () => {
    expect(interpolate('Hello {{name}}!', { name: '' })).toBe('Hello !');
  });
});

describe('extractPlaceholders', () => {
  it('extracts simple placeholders', () => {
    expect(extractPlaceholders('Hello {{name}}')).toEqual(['name']);
  });

  it('extracts multiple unique placeholders', () => {
    expect(extractPlaceholders('{{a}} and {{b}} and {{c}}')).toEqual(['a', 'b', 'c']);
  });

  it('deduplicates placeholders', () => {
    expect(extractPlaceholders('{{x}} and {{x}} and {{y}}')).toEqual(['x', 'y']);
  });

  it('handles whitespace in placeholders', () => {
    expect(extractPlaceholders('{{ name }} and {{  age  }}')).toEqual(['name', 'age']);
  });

  it('returns empty array for no placeholders', () => {
    expect(extractPlaceholders('No placeholders')).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(extractPlaceholders('')).toEqual([]);
  });
});
