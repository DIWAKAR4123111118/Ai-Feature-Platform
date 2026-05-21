import { ESLint } from 'eslint';

export interface LintInput {
  code: string;
  filePath?: string;
  options?: {
    fix?: boolean;
  };
}

export interface LintOutput {
  issues: Array<{
    ruleId: string | null;
    message: string;
    severity: 'error' | 'warning';
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
  }>;
  fixedCode?: string;
  errorCount: number;
  warningCount: number;
}

export async function runESLint(input: LintInput): Promise<LintOutput> {
  const eslint = new ESLint({
    fix: input.options?.fix || false,
    useEslintrc: false,
    overrideConfig: {
      extends: ['eslint:recommended'],
      env: {
        es2021: true,
        node: true,
        browser: true
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    }
  });

  const filePath = input.filePath || 'input.js';
  
  const results = await eslint.lintText(input.code, { filePath });
  
  const issues = results[0].messages.map(msg => ({
    ruleId: msg.ruleId,
    message: msg.message,
    severity: (msg.severity === 2 ? 'error' : 'warning') as 'error' | 'warning',
    line: msg.line,
    column: msg.column,
    endLine: msg.endLine,
    endColumn: msg.endColumn
  }));

  return {
    issues,
    fixedCode: results[0].output,
    errorCount: results[0].errorCount,
    warningCount: results[0].warningCount
  };
}

// CLI entry point
async function main() {
  try {
    let inputData = '';
    
    // Read from stdin if no command line args
    if (process.argv[2]) {
      inputData = process.argv[2];
    } else {
      // Read from stdin
      const chunks: Buffer[] = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      inputData = Buffer.concat(chunks).toString('utf-8');
    }
    
    const input = JSON.parse(inputData);
    const output = await runESLint(input);
    console.log(JSON.stringify(output));
    process.exit(0);
  } catch (error: any) {
    console.error(JSON.stringify({ error: error.message }));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}