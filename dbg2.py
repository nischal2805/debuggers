import re
with open(r'd:\hackathon\backend\data\coding_problems.py','r',encoding='utf-8') as f:
    src = f.read()

# Find first starter_code block
sc = src.find('"starter_code"')
chunk = src[sc:sc+600]
print(repr(chunk))
