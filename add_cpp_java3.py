"""
Injects cpp+java by finding the literal pattern:
    "javascript": "...VALUE...",\n        },
and replacing with the expanded version.
Uses exact known javascript values from the original file.
"""
import sys
sys.path.insert(0, 'backend')
from data.coding_problems import CODING_PROBLEMS

STARTERS = {
    "contains_duplicate": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // parse JSON array then check duplicates\n    // your code here\n    cout<<"false"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String line=sc.nextLine();\n        // parse JSON array, your code here\n        System.out.println("false");\n    }\n}\n',
    },
    "two_sum": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string arr,tgt;\n    getline(cin,arr); getline(cin,tgt);\n    // your code here\n    cout<<"[]"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String arr=sc.nextLine();\n        int target=Integer.parseInt(sc.nextLine().trim());\n        // your code here\n        System.out.println("[]");\n    }\n}\n',
    },
    "best_time_stock": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // parse JSON array of prices\n    // your code here\n    cout<<0<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String line=sc.nextLine();\n        // your code here\n        System.out.println(0);\n    }\n}\n',
    },
    "product_except_self": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<"[]"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println("[]");\n    }\n}\n',
    },
    "max_subarray": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<0<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println(0);\n    }\n}\n',
    },
    "max_product_subarray": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<0<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println(0);\n    }\n}\n',
    },
    "find_min_rotated": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<0<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println(0);\n    }\n}\n',
    },
    "three_sum": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<"[]"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println("[]");\n    }\n}\n',
    },
    "container_most_water": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<0<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println(0);\n    }\n}\n',
    },
    "valid_palindrome": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string s; getline(cin,s);\n    // your code here\n    cout<<"false"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String s=sc.nextLine();\n        // your code here\n        System.out.println("false");\n    }\n}\n',
    },
    "valid_anagram": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string s,t; getline(cin,s); getline(cin,t);\n    // your code here\n    cout<<"false"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String s=sc.nextLine(), t=sc.nextLine();\n        // your code here\n        System.out.println("false");\n    }\n}\n',
    },
    "group_anagrams": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<"[]"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println("[]");\n    }\n}\n',
    },
    "longest_substring": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string s; getline(cin,s);\n    // your code here\n    cout<<0<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String s=sc.nextLine();\n        // your code here\n        System.out.println(0);\n    }\n}\n',
    },
    "min_window_substring": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string s,t; getline(cin,s); getline(cin,t);\n    // your code here\n    cout<<""<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String s=sc.nextLine(), t=sc.nextLine();\n        // your code here\n        System.out.println("");\n    }\n}\n',
    },
    "trapping_rain_water": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<0<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println(0);\n    }\n}\n',
    },
    "binary_search_basic": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string arr; int target;\n    getline(cin,arr); cin>>target;\n    // your code here\n    cout<<-1<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String arr=sc.nextLine();\n        int target=Integer.parseInt(sc.nextLine().trim());\n        // your code here\n        System.out.println(-1);\n    }\n}\n',
    },
    "search_rotated_array": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string arr; int target;\n    getline(cin,arr); cin>>target;\n    // your code here\n    cout<<-1<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String arr=sc.nextLine();\n        int target=Integer.parseInt(sc.nextLine().trim());\n        // your code here\n        System.out.println(-1);\n    }\n}\n',
    },
    "valid_parentheses": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string s; getline(cin,s);\n    // your code here\n    cout<<"false"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String s=sc.nextLine();\n        // your code here\n        System.out.println("false");\n    }\n}\n',
    },
    "daily_temperatures": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<"[]"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println("[]");\n    }\n}\n',
    },
    "climbing_stairs": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    int n; cin>>n;\n    // your code here\n    cout<<0<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        int n=Integer.parseInt(sc.nextLine().trim());\n        // your code here\n        System.out.println(0);\n    }\n}\n',
    },
    "house_robber": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<0<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println(0);\n    }\n}\n',
    },
    "coin_change": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string coins; int amount;\n    getline(cin,coins); cin>>amount;\n    // your code here\n    cout<<-1<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String coins=sc.nextLine();\n        int amount=Integer.parseInt(sc.nextLine().trim());\n        // your code here\n        System.out.println(-1);\n    }\n}\n',
    },
    "longest_increasing_subsequence": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<0<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println(0);\n    }\n}\n',
    },
    "number_of_islands": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<0<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println(0);\n    }\n}\n',
    },
    "clone_graph": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<"[]"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        // your code here\n        System.out.println("[]");\n    }\n}\n',
    },
    "power_of_two": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    long long n; cin>>n;\n    // your code here\n    cout<<"false"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        long n=Long.parseLong(sc.nextLine().trim());\n        // your code here\n        System.out.println("false");\n    }\n}\n',
    },
    "generate_parentheses": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    int n; cin>>n;\n    // your code here\n    cout<<"[]"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        int n=Integer.parseInt(sc.nextLine().trim());\n        // your code here\n        System.out.println("[]");\n    }\n}\n',
    },
}

FPATH = r'd:\hackathon\backend\data\coding_problems.py'

with open(FPATH,'r',encoding='utf-8') as f:
    src = f.read()

# For each problem, find the exact javascript value from the live dict, then
# locate that value in the source file and append cpp/java entries after it.
# The javascript value in the source is a Python string literal (double-quoted),
# with internal quotes escaped as \' or \".

ok = 0
for pid, extras in STARTERS.items():
    if pid not in CODING_PROBLEMS:
        print(f"SKIP {pid}: not in CODING_PROBLEMS")
        continue

    # Get the exact javascript starter code from the live dict
    js_val = CODING_PROBLEMS[pid]["starter_code"].get("javascript","")
    if not js_val:
        print(f"SKIP {pid}: no javascript value")
        continue

    # The source has this value as a repr'd string inside the file.
    # Find '"javascript": ' then get the full string literal that follows.
    # We'll find the problem block first.
    id_pos = src.find(f'"id": "{pid}"')
    if id_pos == -1:
        print(f"SKIP {pid}: id not found in src")
        continue

    # Find starter_code dict closing pattern after sc_start:
    # Pattern: last entry in starter_code ends with ",\n        },"
    sc_pos = src.find('"starter_code":', id_pos)

    # Find the closing },  of the starter_code dict
    # Look for: \",\n        },\n        "public_tests"  (the next key after starter_code)
    # This means the last quoted string ends just before \n        },
    next_section = src.find('"public_tests"', sc_pos)
    if next_section == -1:
        print(f"SKIP {pid}: public_tests not found")
        continue

    # The starter_code block is between sc_pos and next_section
    block = src[sc_pos:next_section]

    # Check not already done
    if '"cpp":' in block:
        print(f"SKIP {pid}: already has cpp")
        continue

    # Find the closing },  just before public_tests
    # It looks like: "\n\",\n        },\n        "public_tests"
    # We need position of the },\n that's just before "public_tests"
    close_pos = next_section - 1
    # Walk back past whitespace and newline
    while close_pos > sc_pos and src[close_pos] in ' \t\n\r':
        close_pos -= 1
    # Now should be at }
    if src[close_pos] != '}':
        print(f"SKIP {pid}: expected }} at pos {close_pos}, got {src[close_pos]!r}")
        continue
    # And before that should be a comma
    cm_pos = close_pos - 1
    while cm_pos > sc_pos and src[cm_pos] in ' \t\n\r':
        cm_pos -= 1
    # Insert cpp/java BEFORE the closing }
    cpp_r = repr(extras["cpp"])
    java_r = repr(extras["java"])
    indent = '            '  # 12 spaces
    insertion = f',\n{indent}"cpp": {cpp_r},\n{indent}"java": {java_r}\n        '
    # Find the last quote before the closing }
    # The structure inside is  "javascript": "VALUE",\n        }
    # We insert after the last comma (or after the last string value)
    # Locate the last quote+comma before the }
    # Simple: find the last occurrence of '",\n' or '"\n' just before close_pos
    last_quote = src.rfind('"', sc_pos, close_pos)
    if last_quote == -1:
        print(f"SKIP {pid}: no quote found")
        continue

    # Insert after the last quote
    insert_at = last_quote + 1
    # Check if there's already a comma
    rest = src[insert_at:close_pos].strip()
    if rest == ',':
        insert_at = src.index(',', insert_at) + 1

    addition = f',\n{indent}"cpp": {cpp_r},\n{indent}"java": {java_r}'
    src = src[:insert_at] + addition + src[insert_at:]
    ok += 1
    print(f"OK {pid}")

with open(FPATH,'w',encoding='utf-8') as f:
    f.write(src)

print(f"\nInjected {ok} problems.")

# Syntax check
import importlib.util
spec = importlib.util.spec_from_file_location("cp2", FPATH)
mod = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(mod)
    sample = mod.CODING_PROBLEMS['contains_duplicate']['starter_code']
    print("Syntax OK. Keys:", list(sample.keys()))
except SyntaxError as e:
    print(f"SYNTAX ERROR line {e.lineno}: {e.msg}")
