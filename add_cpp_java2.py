"""
Safely adds cpp + java starter_code to every problem by:
1. Importing the module to get the actual dict
2. Writing a clean replacement for each starter_code block using repr()
   with escaped strings that won't break Python syntax

Run from hackathon root:  python add_cpp_java2.py
"""
import sys, re
sys.path.insert(0, 'backend')

from data.coding_problems import CODING_PROBLEMS

# cpp starter code - uses single-quoted Python strings, inner " escaped as \"
# Java uses single-quoted Python strings too; internal double-quotes escaped
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
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // parse JSON array of prices, your code here\n    cout<<0<<endl;\n}\n',
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

# Inject into the live dict and write a new file from scratch
for pid, extras in STARTERS.items():
    if pid in CODING_PROBLEMS:
        CODING_PROBLEMS[pid]["starter_code"]["cpp"] = extras["cpp"]
        CODING_PROBLEMS[pid]["starter_code"]["java"] = extras["java"]

# Now regenerate the file using a template approach
# Read original file, replace each starter_code block with the expanded version
with open(r'd:\hackathon\backend\data\coding_problems.py', 'r', encoding='utf-8') as f:
    src = f.read()

for pid, extras in STARTERS.items():
    cpp_s = extras["cpp"]
    java_s = extras["java"]
    # Build the addition: two new entries to append after "javascript": "..."
    # We find the exact javascript value for this problem and append after
    # Strategy: find  "javascript": JSVAL\n        },  and replace with
    #           "javascript": JSVAL,\n            "cpp": CPPVAL,\n            "java": JAVAVAL\n        },

    # Locate problem in source by its id string
    id_marker = f'"id": "{pid}"'
    id_pos = src.find(id_marker)
    if id_pos == -1:
        id_marker2 = f'"id": "{pid}",'
        id_pos = src.find(id_marker2)
    if id_pos == -1:
        print(f"SKIP {pid}: id not found")
        continue

    # Find starter_code after id
    sc_start = src.find('"starter_code":', id_pos)
    if sc_start == -1:
        print(f"SKIP {pid}: starter_code not found")
        continue

    # Find next problem boundary
    next_id = src.find('"id":', id_pos + len(id_marker))

    # Find the closing brace of starter_code block (first }, at right indentation)
    # It looks like:  \n        },\n        "public_tests"
    # Search in the range sc_start..next_id
    search_range = src[sc_start: next_id if next_id > 0 else sc_start + 3000]

    # Already has cpp?
    if '"cpp":' in search_range:
        print(f"SKIP {pid}: already has cpp")
        continue

    # Find the closing of starter_code: pattern is  \",\n        },
    # The last string inside starter_code ends with  \n"  then optionally , then newline+spaces+}
    close_pattern = re.compile(r'("javascript":\s*"(?:[^"\\]|\\.)*")\s*\n(\s*)\}', re.DOTALL)
    m = close_pattern.search(search_range)
    if not m:
        print(f"SKIP {pid}: close pattern not found")
        continue

    indent = m.group(2)  # whitespace before the closing }
    # Build addition safely using repr to get proper escaping
    cpp_repr = repr(cpp_s)   # 'string with proper escaping'
    java_repr = repr(java_s)
    addition = f',\n{indent}    "cpp": {cpp_repr},\n{indent}    "java": {java_repr}'

    # Position in full src
    abs_match_start = sc_start + m.start(1) + len(m.group(1))
    src = src[:abs_match_start] + addition + src[abs_match_start:]
    print(f"OK {pid}")

with open(r'd:\hackathon\backend\data\coding_problems.py', 'w', encoding='utf-8') as f:
    f.write(src)

print(f"\ncpp entries: {src.count(chr(34)+'cpp'+chr(34)+':')}, java entries: {src.count(chr(34)+'java'+chr(34)+':')}")

# Verify it parses
import importlib, importlib.util
spec = importlib.util.spec_from_file_location("cp", r'd:\hackathon\backend\data\coding_problems.py')
mod = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(mod)
    sample = mod.CODING_PROBLEMS['contains_duplicate']['starter_code']
    print("Syntax OK. Keys:", list(sample.keys()))
except SyntaxError as e:
    print(f"SYNTAX ERROR: {e}")
