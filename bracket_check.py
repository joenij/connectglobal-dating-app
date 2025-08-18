import os
import glob

def check_file_brackets(filepath):
    """Check bracket pairing in a single file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Count brackets
        round_open = content.count('(')
        round_close = content.count(')')
        square_open = content.count('[')
        square_close = content.count(']')
        curly_open = content.count('{')
        curly_close = content.count('}')
        backticks = content.count('`')
        
        issues = []
        if round_open != round_close:
            issues.append(f'Round brackets: {round_open} open vs {round_close} close')
        if square_open != square_close:
            issues.append(f'Square brackets: {square_open} open vs {square_close} close')
        if curly_open != curly_close:
            issues.append(f'Curly brackets: {curly_open} open vs {curly_close} close')
        if backticks % 2 != 0:
            issues.append(f'Backticks: {backticks} total (uneven number)')
            
        return {
            'file': filepath,
            'issues': issues,
            'counts': {
                'round': f'{round_open}/{round_close}',
                'square': f'{square_open}/{square_close}',
                'curly': f'{curly_open}/{curly_close}',
                'backticks': backticks
            }
        }
        
    except Exception as e:
        return {
            'file': filepath,
            'issues': [f'ERROR reading file: {str(e)}'],
            'counts': None
        }

def main():
    # Collect all files to check
    file_patterns = [
        'backend/src/**/*.js',
        'src/**/*.ts', 
        'src/**/*.tsx'
    ]
    
    all_files = []
    for pattern in file_patterns:
        all_files.extend(glob.glob(pattern, recursive=True))
    
    print(f"=== BRACKET PAIRING CHECK ({len(all_files)} files) ===\n")
    
    problem_files = []
    ok_files = []
    
    for filepath in sorted(all_files):
        result = check_file_brackets(filepath)
        
        if result['issues']:
            problem_files.append(result)
            print(f"[PROBLEM] {filepath}")
            for issue in result['issues']:
                print(f"   - {issue}")
            if result['counts']:
                print(f"   Counts: () {result['counts']['round']}, [] {result['counts']['square']}, {{}} {result['counts']['curly']}, `` {result['counts']['backticks']}")
            print()
        else:
            ok_files.append(result)
            print(f"[OK] {filepath}")
    
    print(f"\n=== SUMMARY ===")
    print(f"Total files checked: {len(all_files)}")
    print(f"Files with problems: {len(problem_files)}")
    print(f"Files OK: {len(ok_files)}")
    
    if problem_files:
        print(f"\n[CRITICAL] {len(problem_files)} files have bracket pairing issues!")
        for result in problem_files:
            print(f"  - {result['file']}: {len(result['issues'])} issues")
    else:
        print(f"\n[SUCCESS] All files have correct bracket pairing!")

if __name__ == "__main__":
    main()