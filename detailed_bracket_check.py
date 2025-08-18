import os
import glob
import re

def analyze_bracket_structure(filepath):
    """Detailed bracket structure analysis"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        bracket_stack = []
        issues = []
        line_issues = []
        
        for line_num, line in enumerate(lines, 1):
            for char_pos, char in enumerate(line):
                if char in '([{':
                    bracket_stack.append({
                        'char': char,
                        'line': line_num,
                        'pos': char_pos,
                        'context': line.strip()[:50] + '...' if len(line.strip()) > 50 else line.strip()
                    })
                elif char in ')]}':
                    # Find matching opening bracket
                    expected = {')', ']', '}'}[{')': 0, ']': 1, '}': 2}[char]]
                    expected_open = '([{'[{')': 0, ']': 1, '}': 2}[char]]
                    
                    if not bracket_stack:
                        line_issues.append({
                            'line': line_num,
                            'pos': char_pos,
                            'issue': f'Unmatched closing {char}',
                            'context': line.strip()
                        })
                    else:
                        last_open = bracket_stack[-1]
                        if last_open['char'] == expected_open:
                            bracket_stack.pop()  # Correct match
                        else:
                            line_issues.append({
                                'line': line_num,
                                'pos': char_pos,
                                'issue': f'Mismatched brackets: expected closing for {last_open["char"]} from line {last_open["line"]}, got {char}',
                                'context': line.strip()
                            })
                            bracket_stack.pop()  # Remove mismatched bracket
        
        # Check for unclosed brackets
        for unclosed in bracket_stack:
            line_issues.append({
                'line': unclosed['line'],
                'pos': unclosed['pos'],
                'issue': f'Unclosed {unclosed["char"]}',
                'context': unclosed['context']
            })
        
        # Check template literals (backticks)
        content = ''.join(lines)
        backtick_count = content.count('`')
        if backtick_count % 2 != 0:
            line_issues.append({
                'line': 'multiple',
                'pos': 'various',
                'issue': f'Unmatched template literals (backticks): {backtick_count} total',
                'context': 'Check template string literals'
            })
        
        return {
            'file': filepath,
            'issues': line_issues,
            'total_brackets': {
                'round': (content.count('('), content.count(')')),
                'square': (content.count('['), content.count(']')),
                'curly': (content.count('{'), content.count('}')),
                'backticks': backtick_count
            }
        }
        
    except Exception as e:
        return {
            'file': filepath,
            'issues': [{'line': 'N/A', 'pos': 'N/A', 'issue': f'ERROR: {str(e)}', 'context': 'File read error'}],
            'total_brackets': None
        }

def find_common_patterns(filepath):
    """Find common problematic patterns"""
    patterns = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
        
        # Check for common issues
        for line_num, line in enumerate(lines, 1):
            # Multiple consecutive opening brackets without context
            if re.search(r'[(\[{]{3,}', line):
                patterns.append(f'Line {line_num}: Multiple consecutive opening brackets')
            
            # Multiple consecutive closing brackets
            if re.search(r'[)\]}]{3,}', line):
                patterns.append(f'Line {line_num}: Multiple consecutive closing brackets')
            
            # Suspicious bracket patterns
            if re.search(r'\)\s*\[\s*\{', line):
                patterns.append(f'Line {line_num}: Complex bracket sequence )[{{')
            
            # Template literal with nested brackets
            if '`' in line and ('{' in line or '[' in line or '(' in line):
                if line.count('`') == 1:  # Incomplete template literal on this line
                    patterns.append(f'Line {line_num}: Possible incomplete template literal')
        
        return patterns
        
    except Exception as e:
        return [f'ERROR analyzing patterns: {str(e)}']

def main():
    # File patterns to check
    file_patterns = [
        'backend/src/**/*.js',
        'src/**/*.ts',
        'src/**/*.tsx'
    ]
    
    all_files = []
    for pattern in file_patterns:
        all_files.extend(glob.glob(pattern, recursive=True))
    
    print("=== DETAILED BRACKET STRUCTURE ANALYSIS ===\n")
    print(f"Analyzing {len(all_files)} files for bracket issues...\n")
    
    files_with_issues = []
    total_issues = 0
    
    for filepath in sorted(all_files):
        result = analyze_bracket_structure(filepath)
        patterns = find_common_patterns(filepath)
        
        has_issues = bool(result['issues'] or patterns)
        
        if has_issues:
            files_with_issues.append((filepath, result, patterns))
            total_issues += len(result['issues']) + len(patterns)
            
            print(f"[ISSUES] {filepath}")
            
            if result['total_brackets']:
                tb = result['total_brackets']
                print(f"  Bracket counts: () {tb['round'][0]}/{tb['round'][1]}, [] {tb['square'][0]}/{tb['square'][1]}, {{}} {tb['curly'][0]}/{tb['curly'][1]}, `` {tb['backticks']}")
            
            for issue in result['issues']:
                print(f"  - Line {issue['line']}, pos {issue['pos']}: {issue['issue']}")
                if issue['context'] and issue['context'] != 'File read error':
                    print(f"    Context: {issue['context']}")
            
            for pattern in patterns:
                print(f"  - Pattern: {pattern}")
            
            print()
        else:
            print(f"[OK] {filepath}")
    
    print(f"\n=== FINAL REPORT ===")
    print(f"Total files analyzed: {len(all_files)}")
    print(f"Files with issues: {len(files_with_issues)}")
    print(f"Total issues found: {total_issues}")
    
    if files_with_issues:
        print(f"\n[CRITICAL] Found bracket issues in {len(files_with_issues)} files!")
        print("\nSUMMARY OF PROBLEMATIC FILES:")
        for filepath, result, patterns in files_with_issues:
            issue_count = len(result['issues']) + len(patterns)
            print(f"  - {filepath}: {issue_count} issues")
    else:
        print(f"\n[SUCCESS] All files passed detailed bracket analysis!")
        print("\nAll bracket structures are correctly paired and nested.")

if __name__ == "__main__":
    main()