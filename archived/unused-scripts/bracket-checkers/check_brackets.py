#!/usr/bin/env python3
import os
import re

def count_brackets(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # Count different bracket types
        round_open = content.count('(')
        round_close = content.count(')')
        square_open = content.count('[')
        square_close = content.count(']')
        curly_open = content.count('{')
        curly_close = content.count('}')
        backticks = content.count('`')
        
        issues = []
        
        if round_open != round_close:
            issues.append(f'ROUND BRACKETS: {round_open} open, {round_close} close')
        if square_open != square_close:
            issues.append(f'SQUARE BRACKETS: {square_open} open, {square_close} close')
        if curly_open != curly_close:
            issues.append(f'CURLY BRACKETS: {curly_open} open, {curly_close} close')
        if backticks % 2 != 0:
            issues.append(f'BACKTICKS: {backticks} (odd number)')
            
        return issues
        
    except Exception as e:
        return [f'ERROR reading file: {str(e)}']

def find_bracket_position_issues(file_path):
    """Find line numbers where bracket issues might occur"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        bracket_issues = []
        round_stack = []
        square_stack = []
        curly_stack = []
        
        for line_num, line in enumerate(lines, 1):
            for char_pos, char in enumerate(line):
                if char == '(':
                    round_stack.append((line_num, char_pos))
                elif char == ')':
                    if round_stack:
                        round_stack.pop()
                    else:
                        bracket_issues.append(f'Line {line_num}, pos {char_pos}: Unmatched closing )')
                        
                elif char == '[':
                    square_stack.append((line_num, char_pos))
                elif char == ']':
                    if square_stack:
                        square_stack.pop()
                    else:
                        bracket_issues.append(f'Line {line_num}, pos {char_pos}: Unmatched closing ]')
                        
                elif char == '{':
                    curly_stack.append((line_num, char_pos))
                elif char == '}':
                    if curly_stack:
                        curly_stack.pop()
                    else:
                        bracket_issues.append(f'Line {line_num}, pos {char_pos}: Unmatched closing }}')
        
        # Check for unclosed brackets
        for line_num, char_pos in round_stack:
            bracket_issues.append(f'Line {line_num}, pos {char_pos}: Unclosed opening (')
        for line_num, char_pos in square_stack:
            bracket_issues.append(f'Line {line_num}, pos {char_pos}: Unclosed opening [')
        for line_num, char_pos in curly_stack:
            bracket_issues.append(f'Line {line_num}, pos {char_pos}: Unclosed opening {{')
            
        return bracket_issues
        
    except Exception as e:
        return [f'ERROR: {str(e)}']

# Check all JavaScript, TypeScript files
target_files = []
extensions = ['.js', '.ts', '.tsx']

for root, dirs, files in os.walk('.'):
    for file in files:
        if any(file.endswith(ext) for ext in extensions):
            target_files.append(os.path.join(root, file))

print('=== UMFASSENDE KLAMMER-PAIRING ÜBERPRÜFUNG ===\n')
print(f'Überprüfe {len(target_files)} Dateien...\n')

problems_found = False
detailed_issues = {}

for file_path in target_files:
    basic_issues = count_brackets(file_path)
    position_issues = find_bracket_position_issues(file_path)
    
    if basic_issues or position_issues:
        problems_found = True
        detailed_issues[file_path] = {
            'basic': basic_issues,
            'positions': position_issues
        }
        print(f'❌ PROBLEME in: {file_path}')
        for issue in basic_issues:
            print(f'   - {issue}')
        for issue in position_issues[:5]:  # Show first 5 position issues
            print(f'   - {issue}')
        if len(position_issues) > 5:
            print(f'   - ... und {len(position_issues) - 5} weitere Positionsfehler')
        print()
    else:
        print(f'✅ OK: {file_path}')

print('\n=== ZUSAMMENFASSUNG ===')
if not problems_found:
    print('🎉 Alle Dateien haben korrektes Klammer-Pairing!')
else:
    print(f'⚠️  KRITISCHE PROBLEME in {len(detailed_issues)} Dateien gefunden!')
    print('\nDetaillierte Probleme:')
    for file_path, issues in detailed_issues.items():
        print(f'\n📁 {file_path}:')
        if issues['basic']:
            print('  Zählung:')
            for issue in issues['basic']:
                print(f'    - {issue}')
        if issues['positions']:
            print('  Positionen:')
            for issue in issues['positions']:
                print(f'    - {issue}')