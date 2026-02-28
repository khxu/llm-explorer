import { useRef, useMemo } from 'react';
import { FormControl, Textarea, Token, Text } from '@primer/react';
import { extractPlaceholders } from '../utils/template.js';

export default function PromptEditor({ value, onChange, columns = [], label }) {
  const textareaRef = useRef(null);

  const invalidPlaceholders = useMemo(() => {
    const used = extractPlaceholders(value || '');
    return used.filter(p => !columns.includes(p));
  }, [value, columns]);

  const insertColumn = (col) => {
    const tag = `{{${col}}}`;
    const el = textareaRef.current;
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart;
      const end = el.selectionEnd;
      const next = value.slice(0, start) + tag + value.slice(end);
      onChange(next);
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start + tag.length;
        el.focus();
      });
    } else {
      onChange((value || '') + tag);
    }
  };

  return (
    <FormControl>
      <FormControl.Label>{label}</FormControl.Label>
      <Textarea
        ref={textareaRef}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        block
        placeholder={`Enter ${label?.toLowerCase() || 'prompt'} template, e.g. {{column_name}}`}
      />
      {columns.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
          <Text fontSize={1} color="fg.muted" style={{ marginRight: '4px', alignSelf: 'center' }}>
            Insert column:
          </Text>
          {columns.map((col) => (
            <Token
              key={col}
              text={col}
              onClick={() => insertColumn(col)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </div>
      )}
      {invalidPlaceholders.length > 0 && (
        <FormControl.Validation variant="warning">
          Unknown placeholders: {invalidPlaceholders.join(', ')}
        </FormControl.Validation>
      )}
    </FormControl>
  );
}
