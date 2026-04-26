"""
Injects cpp + java starter_code into every problem in coding_problems.py.
Strategy: find each  "javascript": "..."  value, append cpp/java right after.
"""
import re

CPP = {
    "contains_duplicate": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // parse JSON array then check duplicates\\n    // your code here\\n    cout<<"false"<<endl;\\n}\\n',
    "two_sum": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string arrLine,tgtLine;\\n    getline(cin,arrLine); getline(cin,tgtLine);\\n    // your code here\\n    cout<<"[]"<<endl;\\n}\\n',
    "best_time_stock": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<0<<endl;\\n}\\n',
    "product_except_self": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<"[]"<<endl;\\n}\\n',
    "max_subarray": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<0<<endl;\\n}\\n',
    "max_product_subarray": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<0<<endl;\\n}\\n',
    "find_min_rotated": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<0<<endl;\\n}\\n',
    "three_sum": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<"[]"<<endl;\\n}\\n',
    "container_most_water": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<0<<endl;\\n}\\n',
    "valid_palindrome": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string s; getline(cin,s);\\n    // your code here\\n    cout<<"false"<<endl;\\n}\\n',
    "valid_anagram": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string s,t; getline(cin,s); getline(cin,t);\\n    // your code here\\n    cout<<"false"<<endl;\\n}\\n',
    "group_anagrams": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<"[]"<<endl;\\n}\\n',
    "longest_substring": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string s; getline(cin,s);\\n    // your code here\\n    cout<<0<<endl;\\n}\\n',
    "min_window_substring": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string s,t; getline(cin,s); getline(cin,t);\\n    // your code here\\n    cout<<""<<endl;\\n}\\n',
    "trapping_rain_water": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<0<<endl;\\n}\\n',
    "binary_search_basic": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string arrLine; int target;\\n    getline(cin,arrLine); cin>>target;\\n    // your code here\\n    cout<<-1<<endl;\\n}\\n',
    "search_rotated_array": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string arrLine; int target;\\n    getline(cin,arrLine); cin>>target;\\n    // your code here\\n    cout<<-1<<endl;\\n}\\n',
    "valid_parentheses": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string s; getline(cin,s);\\n    // your code here\\n    cout<<"false"<<endl;\\n}\\n',
    "daily_temperatures": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<"[]"<<endl;\\n}\\n',
    "climbing_stairs": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    int n; cin>>n;\\n    // your code here\\n    cout<<0<<endl;\\n}\\n',
    "house_robber": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<0<<endl;\\n}\\n',
    "coin_change": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string coinsLine; int amount;\\n    getline(cin,coinsLine); cin>>amount;\\n    // your code here\\n    cout<<-1<<endl;\\n}\\n',
    "longest_increasing_subsequence": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<0<<endl;\\n}\\n',
    "number_of_islands": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<0<<endl;\\n}\\n',
    "clone_graph": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    string line; getline(cin,line);\\n    // your code here\\n    cout<<"[]"<<endl;\\n}\\n',
    "power_of_two": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    long long n; cin>>n;\\n    // your code here\\n    cout<<"false"<<endl;\\n}\\n',
    "generate_parentheses": '#include<bits/stdc++.h>\\nusing namespace std;\\nint main(){\\n    int n; cin>>n;\\n    // your code here\\n    cout<<"[]"<<endl;\\n}\\n',
}

JAVA = {
    "contains_duplicate": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        String line=sc.nextLine();\\n        // parse JSON array, your code here\\n        System.out.println("false");\\n    }\\n}\\n',
    "two_sum": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        String arr=sc.nextLine(); int target=Integer.parseInt(sc.nextLine().trim());\\n        // your code here\\n        System.out.println("[]");\\n    }\\n}\\n',
    "best_time_stock": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        String line=sc.nextLine();\\n        // your code here\\n        System.out.println(0);\\n    }\\n}\\n',
    "product_except_self": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println("[]");\\n    }\\n}\\n',
    "max_subarray": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println(0);\\n    }\\n}\\n',
    "max_product_subarray": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println(0);\\n    }\\n}\\n',
    "find_min_rotated": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println(0);\\n    }\\n}\\n',
    "three_sum": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println("[]");\\n    }\\n}\\n',
    "container_most_water": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println(0);\\n    }\\n}\\n',
    "valid_palindrome": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        String s=sc.nextLine();\\n        // your code here\\n        System.out.println("false");\\n    }\\n}\\n',
    "valid_anagram": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        String s=sc.nextLine(),t=sc.nextLine();\\n        // your code here\\n        System.out.println("false");\\n    }\\n}\\n',
    "group_anagrams": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println("[]");\\n    }\\n}\\n',
    "longest_substring": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        String s=sc.nextLine();\\n        // your code here\\n        System.out.println(0);\\n    }\\n}\\n',
    "min_window_substring": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        String s=sc.nextLine(),t=sc.nextLine();\\n        // your code here\\n        System.out.println("");\\n    }\\n}\\n',
    "trapping_rain_water": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println(0);\\n    }\\n}\\n',
    "binary_search_basic": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        String arr=sc.nextLine(); int target=Integer.parseInt(sc.nextLine().trim());\\n        // your code here\\n        System.out.println(-1);\\n    }\\n}\\n',
    "search_rotated_array": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        String arr=sc.nextLine(); int target=Integer.parseInt(sc.nextLine().trim());\\n        // your code here\\n        System.out.println(-1);\\n    }\\n}\\n',
    "valid_parentheses": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        String s=sc.nextLine();\\n        // your code here\\n        System.out.println("false");\\n    }\\n}\\n',
    "daily_temperatures": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println("[]");\\n    }\\n}\\n',
    "climbing_stairs": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        int n=Integer.parseInt(sc.nextLine().trim());\\n        // your code here\\n        System.out.println(0);\\n    }\\n}\\n',
    "house_robber": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println(0);\\n    }\\n}\\n',
    "coin_change": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        String coins=sc.nextLine(); int amount=Integer.parseInt(sc.nextLine().trim());\\n        // your code here\\n        System.out.println(-1);\\n    }\\n}\\n',
    "longest_increasing_subsequence": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println(0);\\n    }\\n}\\n',
    "number_of_islands": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println(0);\\n    }\\n}\\n',
    "clone_graph": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        // your code here\\n        System.out.println("[]");\\n    }\\n}\\n',
    "power_of_two": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        long n=Long.parseLong(sc.nextLine().trim());\\n        // your code here\\n        System.out.println("false");\\n    }\\n}\\n',
    "generate_parentheses": 'import java.util.*;\\npublic class Solution {\\n    public static void main(String[] args) throws Exception {\\n        Scanner sc=new Scanner(System.in);\\n        int n=Integer.parseInt(sc.nextLine().trim());\\n        // your code here\\n        System.out.println("[]");\\n    }\\n}\\n',
}

with open(r'd:\hackathon\backend\data\coding_problems.py', 'r', encoding='utf-8') as f:
    src = f.read()

added = 0
# Find each problem block by its "id" key, then find its starter_code's javascript entry
# and append cpp/java right after the closing quote of the javascript value.
# Pattern: find  "javascript": "...(escaped string)..."  inside starter_code blocks.
# We look for the pattern and insert before the closing } of starter_code.

# Approach: find "javascript": "VALUE",\n        }, then insert before the }
# The javascript value ends with \n" then optional comma and newline then spaces then }

problem_ids = re.findall(r'"id":\s*"([^"]+)"', src)
print("Problems found:", problem_ids)

for pid in problem_ids:
    if pid not in CPP:
        print(f"  SKIP {pid} (no template)")
        continue
    # Already injected?
    if f'"cpp":' in src[src.find(f'"id": "{pid}"'):src.find(f'"id": "{pid}"')+2000]:
        print(f"  SKIP {pid} (already has cpp)")
        continue

    cpp_val = CPP[pid]
    java_val = JAVA.get(pid, 'import java.util.*;\\npublic class Solution { public static void main(String[] a){} }\\n')

    # Find the javascript entry for this specific problem
    # Locate the problem block start
    id_pos = src.find(f'"id": "{pid}"')
    if id_pos == -1:
        id_pos = src.find(f'"id": "{pid}",')
    if id_pos == -1:
        print(f"  SKIP {pid} (id not found)")
        continue

    # Find starter_code block after this id
    sc_pos = src.find('"starter_code":', id_pos)
    if sc_pos == -1:
        print(f"  SKIP {pid} (no starter_code)")
        continue

    # Find closing brace of starter_code (first }, at indentation level)
    # The javascript value is a string literal ending with \n"
    # Look for:  "javascript": "...value...",\n        },
    js_pat = re.compile(r'"javascript":\s*"((?:[^"\\]|\\.)*)"\s*,?\s*\n(\s*)\}', re.DOTALL)
    m = js_pat.search(src, sc_pos)
    if not m:
        print(f"  SKIP {pid} (js pattern not found)")
        continue

    # Check this match is in the right problem (before the next problem)
    next_id_pos = src.find('"id":', id_pos + 10)
    if next_id_pos != -1 and m.start() > next_id_pos:
        print(f"  SKIP {pid} (match beyond problem boundary)")
        continue

    indent = m.group(2)
    insertion = f',\n{indent}    "cpp": "{cpp_val}",\n{indent}    "java": "{java_val}"\n{indent}'
    # Insert before the closing }
    close_brace_pos = m.end() - 1  # position of }
    src = src[:m.start(1) + len(m.group(1)) + 1] + insertion + src[m.start(1) + len(m.group(1)) + 1:]
    # Recalculate closing brace removal of trailing comma issue:
    # Actually, re-do: insert after the closing quote of javascript value
    # Reset and redo properly
    print(f"  DONE {pid}")
    added += 1

# Write back
with open(r'd:\hackathon\backend\data\coding_problems.py', 'w', encoding='utf-8') as f:
    f.write(src)

print(f"\nInjected cpp/java into {added} problems.")
cpp_total = src.count('"cpp":')
java_total = src.count('"java":')
print(f"cpp entries in file: {cpp_total}, java entries: {java_total}")
