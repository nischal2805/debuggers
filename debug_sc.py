import re

with open(r'd:\hackathon\backend\data\coding_problems.py', 'r', encoding='utf-8') as f:
    src = f.read()

m = re.search(r'"starter_code"', src)
print(repr(src[m.start():m.start()+400]))
