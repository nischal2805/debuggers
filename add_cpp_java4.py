"""
Final approach: find each starter_code block, find its },  closer,
insert cpp+java entries just before the closing brace.
"""
import sys, re
sys.path.insert(0, 'backend')
from data.coding_problems import CODING_PROBLEMS

STARTERS = {
    "contains_duplicate": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<"false"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String line=sc.nextLine();\n        // your code here\n        System.out.println("false");\n    }\n}\n',
    },
    "two_sum": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string arr,tgt;\n    getline(cin,arr); getline(cin,tgt);\n    // your code here\n    cout<<"[]"<<endl;\n}\n',
        "java": 'import java.util.*;\npublic class Solution {\n    public static void main(String[] args) throws Exception {\n        Scanner sc=new Scanner(System.in);\n        String arr=sc.nextLine();\n        int target=Integer.parseInt(sc.nextLine().trim());\n        // your code here\n        System.out.println("[]");\n    }\n}\n',
    },
    "best_time_stock": {
        "cpp": '#include<bits/stdc++.h>\nusing namespace std;\nint main(){\n    string line; getline(cin,line);\n    // your code here\n    cout<<0<<endl;\n}\n',
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

ok = 0
for pid, extras in STARTERS.items():
    if pid not in CODING_PROBLEMS:
        continue

    id_pos = src.find(f'"id": "{pid}"')
    if id_pos == -1:
        print(f"SKIP {pid}: id not found")
        continue

    sc_pos = src.find('"starter_code":', id_pos)
    next_section = src.find('"public_tests"', sc_pos)
    if next_section == -1:
        print(f"SKIP {pid}: no public_tests")
        continue

    block = src[sc_pos:next_section]
    if '"cpp":' in block:
        print(f"SKIP {pid}: already done")
        continue

    # Find the },  just before "public_tests"
    # Walk backwards from next_section to find the }
    p = next_section - 1
    while src[p] in ' \t\n\r,':
        p -= 1
    # p should be at }
    if src[p] != '}':
        print(f"SKIP {pid}: expected }} got {src[p]!r} at {p}")
        continue

    # Insert before this }
    cpp_r = repr(extras["cpp"])
    java_r = repr(extras["java"])
    addition = f'            "cpp": {cpp_r},\n            "java": {java_r},\n        '
    src = src[:p] + addition + src[p:]
    ok += 1
    print(f"OK {pid}")

with open(FPATH,'w',encoding='utf-8') as f:
    f.write(src)

print(f"\nInjected: {ok}")

import importlib.util
spec = importlib.util.spec_from_file_location("cpx", FPATH)
mod = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(mod)
    sample = mod.CODING_PROBLEMS['contains_duplicate']['starter_code']
    print("Syntax OK. Keys:", list(sample.keys()))
    print("cpp snippet:", sample['cpp'][:50])
except SyntaxError as e:
    print(f"SYNTAX ERROR line {e.lineno}: {e.msg}")
    # Show context
    lines = open(FPATH).readlines()
    for i in range(max(0,e.lineno-3), min(len(lines),e.lineno+2)):
        print(f"{i+1}: {lines[i]}", end='')
