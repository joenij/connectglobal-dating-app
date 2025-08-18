import os
import glob
import re

def check_file_detailed(filepath):
    """Check file for bracket pairing and common issues"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
        
        # Basic bracket counts
        round_open = content.count('(')
        round_close = content.count(')')
        square_open = content.count('[')
        square_close = content.count(']')
        curly_open = content.count('{')
        curly_close = content.count('}')
        backticks = content.count('`')
        
        issues = []
        patterns = []
        
        # Check basic pairing
        if round_open != round_close:
            issues.append(f'Round brackets mismatch: {round_open} open vs {round_close} close')
        if square_open != square_close:
            issues.append(f'Square brackets mismatch: {square_open} open vs {square_close} close')
        if curly_open != curly_close:
            issues.append(f'Curly brackets mismatch: {curly_open} open vs {curly_close} close')
        if backticks % 2 != 0:
            issues.append(f'Template literals mismatch: {backticks} backticks (should be even)')
        
        # Check for potential problematic patterns
        for line_num, line in enumerate(lines, 1):
            # Multiple consecutive brackets (often indicates minified or complex code - not necessarily bad)
            if re.search(r'[)\]}]{4,}', line):
                patterns.append(f'Line {line_num}: Many consecutive closing brackets (possibly normal in complex structures)')
            
            # Unmatched quotes that might affect bracket parsing
            single_quotes = line.count("'") - line.count("\\'")
            double_quotes = line.count('"') - line.count('\\"')
            if single_quotes % 2 != 0:
                patterns.append(f'Line {line_num}: Unmatched single quotes')
            if double_quotes % 2 != 0:
                patterns.append(f'Line {line_num}: Unmatched double quotes')
        
        return {
            'filepath': filepath,
            'critical_issues': issues,
            'info_patterns': patterns,
            'bracket_counts': {
                'round': f'{round_open}/{round_close}',
                'square': f'{square_open}/{square_close}',
                'curly': f'{curly_open}/{curly_close}',
                'backticks': backticks
            }
        }
        
    except Exception as e:
        return {
            'filepath': filepath,
            'critical_issues': [f'FILE ERROR: {str(e)}'],
            'info_patterns': [],
            'bracket_counts': None
        }

def main():
    file_patterns = [
        'backend/src/**/*.js',
        'src/**/*.ts',
        'src/**/*.tsx'
    ]
    
    all_files = []
    for pattern in file_patterns:
        all_files.extend(glob.glob(pattern, recursive=True))
    
    print("=== FINAL BRACKET PAIRING REPORT ===")
    print(f"Checking {len(all_files)} files for bracket issues...\n")
    
    critical_files = []
    info_files = []
    clean_files = []
    
    for filepath in sorted(all_files):
        result = check_file_detailed(filepath)
        
        if result['critical_issues']:
            critical_files.append(result)
        elif result['info_patterns']:
            info_files.append(result)
        else:
            clean_files.append(result)
    
    # Report critical issues
    if critical_files:
        print("[CRITICAL ISSUES - MUST BE FIXED]")
        for result in critical_files:
            print(f"[CRITICAL] {result['filepath']}")
            for issue in result['critical_issues']:
                print(f"   - {issue}")
            if result['bracket_counts']:
                bc = result['bracket_counts']
                print(f"   Counts: () {bc['round']}, [] {bc['square']}, {{}} {bc['curly']}, `` {bc['backticks']}")
            print()
    
    # Report informational patterns (not necessarily errors)
    if info_files and len(info_files) <= 10:  # Only show if not too many
        print("[INFORMATIONAL - Complex patterns detected]")
        for result in info_files:
            print(f"[INFO] {result['filepath']}")
            for pattern in result['info_patterns'][:3]:  # Show first 3 patterns
                print(f"   - {pattern}")
            if len(result['info_patterns']) > 3:
                print(f"   - ... and {len(result['info_patterns']) - 3} more patterns")
            print()
    
    # Summary
    print("=== FINAL SUMMARY ===")
    print(f"Total files checked: {len(all_files)}")
    print(f"Files with CRITICAL bracket issues: {len(critical_files)}")
    print(f"Files with informational patterns: {len(info_files)}")
    print(f"Files with clean bracket structure: {len(clean_files)}")
    
    if critical_files:
        print(f"\n[QUALITY CHECK FAILED]")
        print(f"   {len(critical_files)} files have critical bracket pairing issues!")
        print("   These MUST be fixed before deployment!")
        return False
    else:
        print(f"\n[QUALITY CHECK PASSED]")
        print("   All files have correct bracket pairing!")
        print("   Ready for deployment from bracket perspective!")
        return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)