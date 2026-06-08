import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Override oneDark background to match our theme
const theme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: '#0d1117',
    margin: 0,
    padding: '16px',
    borderRadius: 0,
    fontSize: '12px',
    lineHeight: '1.7',
    fontFamily: "'JetBrains Mono', monospace",
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'none',
    fontSize: '12px',
    fontFamily: "'JetBrains Mono', monospace",
  },
};

interface CodeBlockProps {
  code: string;
  language?: string;  // 'typescript' | 'bash' | 'rust' | 'json' | 'move'
}

export function CodeBlock({ code, language = 'typescript' }: CodeBlockProps) {
  return (
    <div style={{
      border: '1px solid #21262d',
      borderRadius: 3,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      {/* optional language badge */}
      <div style={{
        background: '#161b22',
        borderBottom: '1px solid #21262d',
        padding: '4px 12px',
        fontSize: 10,
        color: '#484f58',
        letterSpacing: '0.08em',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>{language}</span>
      </div>
      <SyntaxHighlighter
        language={language}
        style={theme}
        wrapLongLines={false}
        customStyle={{ margin: 0 }}
      >
        {code.trim()}
      </SyntaxHighlighter>
    </div>
  );
}
