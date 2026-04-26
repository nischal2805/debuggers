"""
Canonical topic → problem mapping.
Problems sourced from NeetCode 150, Striver A2Z, LeetCode Top 150, Striver SDE Sheet.
Each problem has difficulty 1-5, the core pattern, and a suggested answer type.
"""

PROBLEM_CATALOG: dict[str, list[dict]] = {
    "arrays": [
        {"lc": "1",   "name": "Two Sum",                          "pattern": "hashing",        "difficulty": 1, "answer_type": "code"},
        {"lc": "121", "name": "Best Time to Buy and Sell Stock",  "pattern": "sliding_window", "difficulty": 1, "answer_type": "code"},
        {"lc": "217", "name": "Contains Duplicate",               "pattern": "hashing",        "difficulty": 1, "answer_type": "code"},
        {"lc": "238", "name": "Product of Array Except Self",     "pattern": "prefix_product",  "difficulty": 2, "answer_type": "code"},
        {"lc": "53",  "name": "Maximum Subarray",                 "pattern": "kadane",         "difficulty": 2, "answer_type": "code"},
        {"lc": "152", "name": "Maximum Product Subarray",         "pattern": "dp",             "difficulty": 3, "answer_type": "code"},
    ],
    "strings": [
        {"lc": "125", "name": "Valid Palindrome",                 "pattern": "two_pointers",   "difficulty": 1, "answer_type": "code"},
        {"lc": "242", "name": "Valid Anagram",                    "pattern": "hashing",        "difficulty": 1, "answer_type": "code"},
        {"lc": "49",  "name": "Group Anagrams",                   "pattern": "hashing",        "difficulty": 2, "answer_type": "code"},
        {"lc": "5",   "name": "Longest Palindromic Substring",    "pattern": "expand_center",  "difficulty": 3, "answer_type": "code"},
    ],
    "two_pointers": [
        {"lc": "167", "name": "Two Sum II",                       "pattern": "two_pointers",   "difficulty": 1, "answer_type": "code"},
        {"lc": "15",  "name": "3Sum",                             "pattern": "two_pointers",   "difficulty": 2, "answer_type": "code"},
        {"lc": "11",  "name": "Container With Most Water",        "pattern": "two_pointers",   "difficulty": 2, "answer_type": "code"},
        {"lc": "42",  "name": "Trapping Rain Water",              "pattern": "two_pointers",   "difficulty": 3, "answer_type": "code"},
    ],
    "sliding_window": [
        {"lc": "3",   "name": "Longest Substring Without Repeating Characters", "pattern": "sliding_window", "difficulty": 2, "answer_type": "code"},
        {"lc": "424", "name": "Longest Repeating Character Replacement",        "pattern": "sliding_window", "difficulty": 2, "answer_type": "code"},
        {"lc": "567", "name": "Permutation in String",                          "pattern": "sliding_window", "difficulty": 2, "answer_type": "code"},
        {"lc": "76",  "name": "Minimum Window Substring",                       "pattern": "sliding_window", "difficulty": 4, "answer_type": "code"},
    ],
    "binary_search": [
        {"lc": "704", "name": "Binary Search",                    "pattern": "binary_search",  "difficulty": 1, "answer_type": "code"},
        {"lc": "74",  "name": "Search a 2D Matrix",               "pattern": "binary_search",  "difficulty": 2, "answer_type": "code"},
        {"lc": "33",  "name": "Search in Rotated Sorted Array",   "pattern": "binary_search",  "difficulty": 2, "answer_type": "code"},
        {"lc": "875", "name": "Koko Eating Bananas",              "pattern": "binary_search",  "difficulty": 2, "answer_type": "code"},
        {"lc": "4",   "name": "Median of Two Sorted Arrays",      "pattern": "binary_search",  "difficulty": 5, "answer_type": "code"},
    ],
    "stack": [
        {"lc": "20",  "name": "Valid Parentheses",                "pattern": "stack",          "difficulty": 1, "answer_type": "code"},
        {"lc": "155", "name": "Min Stack",                        "pattern": "stack",          "difficulty": 2, "answer_type": "code"},
        {"lc": "150", "name": "Evaluate Reverse Polish Notation", "pattern": "stack",          "difficulty": 2, "answer_type": "code"},
    ],
    "monotonic_stack": [
        {"lc": "739", "name": "Daily Temperatures",               "pattern": "monotonic_stack","difficulty": 2, "answer_type": "code"},
        {"lc": "853", "name": "Car Fleet",                        "pattern": "monotonic_stack","difficulty": 3, "answer_type": "code"},
        {"lc": "84",  "name": "Largest Rectangle in Histogram",   "pattern": "monotonic_stack","difficulty": 4, "answer_type": "code"},
    ],
    "linked_list": [
        {"lc": "206", "name": "Reverse Linked List",              "pattern": "iteration",      "difficulty": 1, "answer_type": "code"},
        {"lc": "21",  "name": "Merge Two Sorted Lists",           "pattern": "two_pointers",   "difficulty": 1, "answer_type": "code"},
        {"lc": "143", "name": "Reorder List",                     "pattern": "fast_slow",      "difficulty": 3, "answer_type": "code"},
        {"lc": "19",  "name": "Remove Nth Node From End",         "pattern": "two_pointers",   "difficulty": 2, "answer_type": "code"},
    ],
    "fast_slow_pointers": [
        {"lc": "141", "name": "Linked List Cycle",                "pattern": "fast_slow",      "difficulty": 1, "answer_type": "code"},
        {"lc": "142", "name": "Linked List Cycle II",             "pattern": "fast_slow",      "difficulty": 2, "answer_type": "code"},
        {"lc": "287", "name": "Find the Duplicate Number",        "pattern": "fast_slow",      "difficulty": 3, "answer_type": "code"},
    ],
    "binary_tree": [
        {"lc": "226", "name": "Invert Binary Tree",               "pattern": "dfs",            "difficulty": 1, "answer_type": "code"},
        {"lc": "104", "name": "Maximum Depth of Binary Tree",     "pattern": "dfs",            "difficulty": 1, "answer_type": "code"},
        {"lc": "100", "name": "Same Tree",                        "pattern": "dfs",            "difficulty": 1, "answer_type": "code"},
        {"lc": "543", "name": "Diameter of Binary Tree",          "pattern": "dfs",            "difficulty": 2, "answer_type": "code"},
        {"lc": "124", "name": "Binary Tree Maximum Path Sum",     "pattern": "dfs",            "difficulty": 4, "answer_type": "code"},
    ],
    "tree_traversal": [
        {"lc": "102", "name": "Binary Tree Level Order Traversal","pattern": "bfs",            "difficulty": 2, "answer_type": "code"},
        {"lc": "199", "name": "Binary Tree Right Side View",      "pattern": "bfs",            "difficulty": 2, "answer_type": "code"},
        {"lc": "105", "name": "Construct Tree from Preorder+Inorder","pattern": "dfs",         "difficulty": 3, "answer_type": "code"},
    ],
    "bst": [
        {"lc": "700", "name": "Search in a BST",                  "pattern": "bst",            "difficulty": 1, "answer_type": "code"},
        {"lc": "98",  "name": "Validate Binary Search Tree",      "pattern": "bst",            "difficulty": 2, "answer_type": "code"},
        {"lc": "230", "name": "Kth Smallest in BST",              "pattern": "inorder",        "difficulty": 2, "answer_type": "code"},
    ],
    "heap": [
        {"lc": "703", "name": "Kth Largest Element in Stream",    "pattern": "heap",           "difficulty": 2, "answer_type": "code"},
        {"lc": "215", "name": "Kth Largest Element in Array",     "pattern": "heap",           "difficulty": 2, "answer_type": "code"},
        {"lc": "295", "name": "Find Median from Data Stream",     "pattern": "two_heaps",      "difficulty": 4, "answer_type": "code"},
    ],
    "graph_basics": [
        {"lc": "200", "name": "Number of Islands",                "pattern": "dfs_bfs",        "difficulty": 2, "answer_type": "code"},
        {"lc": "133", "name": "Clone Graph",                      "pattern": "bfs",            "difficulty": 2, "answer_type": "code"},
        {"lc": "417", "name": "Pacific Atlantic Water Flow",      "pattern": "dfs",            "difficulty": 3, "answer_type": "code"},
    ],
    "bfs": [
        {"lc": "127", "name": "Word Ladder",                      "pattern": "bfs",            "difficulty": 4, "answer_type": "code"},
        {"lc": "542", "name": "01 Matrix",                        "pattern": "bfs",            "difficulty": 2, "answer_type": "code"},
        {"lc": "994", "name": "Rotting Oranges",                  "pattern": "bfs",            "difficulty": 2, "answer_type": "code"},
    ],
    "dfs": [
        {"lc": "130", "name": "Surrounded Regions",               "pattern": "dfs",            "difficulty": 2, "answer_type": "code"},
        {"lc": "399", "name": "Evaluate Division",                "pattern": "dfs",            "difficulty": 3, "answer_type": "code"},
    ],
    "topological_sort": [
        {"lc": "207", "name": "Course Schedule",                  "pattern": "topo_sort",      "difficulty": 2, "answer_type": "code"},
        {"lc": "210", "name": "Course Schedule II",               "pattern": "topo_sort",      "difficulty": 2, "answer_type": "code"},
    ],
    "union_find": [
        {"lc": "684", "name": "Redundant Connection",             "pattern": "union_find",     "difficulty": 2, "answer_type": "code"},
        {"lc": "323", "name": "Number of Connected Components",   "pattern": "union_find",     "difficulty": 2, "answer_type": "code"},
        {"lc": "1584","name": "Min Cost to Connect All Points",   "pattern": "kruskal",        "difficulty": 3, "answer_type": "code"},
    ],
    "shortest_path_dijkstra": [
        {"lc": "743", "name": "Network Delay Time",               "pattern": "dijkstra",       "difficulty": 3, "answer_type": "code"},
        {"lc": "778", "name": "Swim in Rising Water",             "pattern": "dijkstra",       "difficulty": 4, "answer_type": "code"},
    ],
    "dp_intro": [
        {"lc": "70",  "name": "Climbing Stairs",                  "pattern": "dp_1d",          "difficulty": 1, "answer_type": "code"},
        {"lc": "746", "name": "Min Cost Climbing Stairs",         "pattern": "dp_1d",          "difficulty": 1, "answer_type": "code"},
        {"lc": "198", "name": "House Robber",                     "pattern": "dp_1d",          "difficulty": 2, "answer_type": "code"},
    ],
    "dp_1d": [
        {"lc": "322", "name": "Coin Change",                      "pattern": "dp_1d",          "difficulty": 2, "answer_type": "code"},
        {"lc": "300", "name": "Longest Increasing Subsequence",   "pattern": "dp_1d",          "difficulty": 3, "answer_type": "code"},
        {"lc": "139", "name": "Word Break",                       "pattern": "dp_1d",          "difficulty": 3, "answer_type": "code"},
    ],
    "dp_2d": [
        {"lc": "62",  "name": "Unique Paths",                     "pattern": "dp_2d",          "difficulty": 2, "answer_type": "code"},
        {"lc": "1143","name": "Longest Common Subsequence",       "pattern": "dp_2d",          "difficulty": 3, "answer_type": "code"},
        {"lc": "72",  "name": "Edit Distance",                    "pattern": "dp_2d",          "difficulty": 4, "answer_type": "code"},
    ],
    "dp_knapsack": [
        {"lc": "416", "name": "Partition Equal Subset Sum",       "pattern": "0_1_knapsack",   "difficulty": 3, "answer_type": "code"},
        {"lc": "494", "name": "Target Sum",                       "pattern": "0_1_knapsack",   "difficulty": 3, "answer_type": "code"},
    ],
    "trie": [
        {"lc": "208", "name": "Implement Trie",                   "pattern": "trie",           "difficulty": 2, "answer_type": "code"},
        {"lc": "211", "name": "Design Add and Search Words",      "pattern": "trie",           "difficulty": 3, "answer_type": "code"},
        {"lc": "212", "name": "Word Search II",                   "pattern": "trie_backtrack", "difficulty": 4, "answer_type": "code"},
    ],
    "backtracking": [
        {"lc": "78",  "name": "Subsets",                          "pattern": "backtracking",   "difficulty": 2, "answer_type": "code"},
        {"lc": "39",  "name": "Combination Sum",                  "pattern": "backtracking",   "difficulty": 2, "answer_type": "code"},
        {"lc": "46",  "name": "Permutations",                     "pattern": "backtracking",   "difficulty": 2, "answer_type": "code"},
        {"lc": "51",  "name": "N-Queens",                         "pattern": "backtracking",   "difficulty": 4, "answer_type": "code"},
    ],
    "greedy": [
        {"lc": "455", "name": "Assign Cookies",                   "pattern": "greedy",         "difficulty": 1, "answer_type": "code"},
        {"lc": "55",  "name": "Jump Game",                        "pattern": "greedy",         "difficulty": 2, "answer_type": "code"},
        {"lc": "45",  "name": "Jump Game II",                     "pattern": "greedy",         "difficulty": 2, "answer_type": "code"},
    ],
    "intervals": [
        {"lc": "57",  "name": "Insert Interval",                  "pattern": "intervals",      "difficulty": 2, "answer_type": "code"},
        {"lc": "56",  "name": "Merge Intervals",                  "pattern": "intervals",      "difficulty": 2, "answer_type": "code"},
        {"lc": "435", "name": "Non-overlapping Intervals",        "pattern": "greedy",         "difficulty": 2, "answer_type": "code"},
    ],
    "bit_manipulation": [
        {"lc": "136", "name": "Single Number",                    "pattern": "xor",            "difficulty": 1, "answer_type": "code"},
        {"lc": "191", "name": "Number of 1 Bits",                 "pattern": "bit_ops",        "difficulty": 1, "answer_type": "code"},
        {"lc": "338", "name": "Counting Bits",                    "pattern": "dp_bits",        "difficulty": 2, "answer_type": "code"},
    ],
    "hashing": [
        {"lc": "128", "name": "Longest Consecutive Sequence",     "pattern": "hashing",        "difficulty": 2, "answer_type": "code"},
        {"lc": "380", "name": "Insert Delete GetRandom O(1)",     "pattern": "hashing",        "difficulty": 2, "answer_type": "code"},
    ],
    "prefix_sum": [
        {"lc": "303", "name": "Range Sum Query",                  "pattern": "prefix_sum",     "difficulty": 1, "answer_type": "code"},
        {"lc": "560", "name": "Subarray Sum Equals K",            "pattern": "prefix_sum",     "difficulty": 2, "answer_type": "code"},
    ],
    "lowest_common_ancestor": [
        {"lc": "235", "name": "LCA of BST",                       "pattern": "lca",            "difficulty": 2, "answer_type": "code"},
        {"lc": "236", "name": "LCA of Binary Tree",               "pattern": "lca",            "difficulty": 2, "answer_type": "code"},
    ],
    "recursion": [
        {"lc": "509", "name": "Fibonacci Number",                 "pattern": "recursion",      "difficulty": 1, "answer_type": "code"},
        {"lc": "206", "name": "Reverse Linked List (recursive)",  "pattern": "recursion",      "difficulty": 1, "answer_type": "code"},
        {"lc": "344", "name": "Reverse String",                   "pattern": "recursion",      "difficulty": 1, "answer_type": "code"},
    ],
    "sorting": [
        {"lc": "912", "name": "Sort an Array",                    "pattern": "sorting",        "difficulty": 2, "answer_type": "code"},
        {"lc": "75",  "name": "Sort Colors",                      "pattern": "three_pointers", "difficulty": 2, "answer_type": "code"},
        {"lc": "179", "name": "Largest Number",                   "pattern": "custom_sort",    "difficulty": 2, "answer_type": "code"},
    ],
}


def get_problems_for_topic(topic: str, mastery: float, count: int = 3) -> list[dict]:
    """Return problems calibrated to current mastery level."""
    catalog = PROBLEM_CATALOG.get(topic, [])
    if not catalog:
        return []
    target_difficulty = max(1, min(5, int(mastery * 4) + 1))
    sorted_problems = sorted(catalog, key=lambda p: abs(p["difficulty"] - target_difficulty))
    return sorted_problems[:count]


def format_problem_for_prompt(problem: dict) -> str:
    return f"LC {problem['lc']} — {problem['name']} [Pattern: {problem['pattern']}]"
