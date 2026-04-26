"""
Coding sandbox problem catalog — NeetCode 150 / Striver A2Z aligned.

All problems use plain stdin/stdout so they run on any local Python/Node runner.
Two test tiers: public (shown during Run) and hidden (revealed on Submit).
"""

CODING_PROBLEMS: dict[str, dict] = {

    # ════════════════════════════════════════════════════════════════════
    # ARRAYS
    # ════════════════════════════════════════════════════════════════════

    "contains_duplicate": {
        "id": "contains_duplicate", "lc": "217", "title": "Contains Duplicate",
        "topic": "arrays", "pattern": "hashing", "difficulty": "easy",
        "statement": "Given an integer array `nums`, return `true` if any value appears at least twice, and `false` if every element is distinct.",
        "constraints": ["1 <= nums.length <= 10^5", "-10^9 <= nums[i] <= 10^9"],
        "examples": [
            {"input": "nums = [1,2,3,1]", "output": "true"},
            {"input": "nums = [1,2,3,4]", "output": "false"},
        ],
        "hints": [
            "A set stores only unique values. If adding an element fails (already in set), it's a duplicate.",
            "O(n) time: iterate once, check membership in a set.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(n)"},
        "starter_code": {
            "python": "import sys, json\ndef contains_duplicate(nums):\n    # your code here\n    return False\n\nnums = json.loads(sys.stdin.read())\nprint('true' if contains_duplicate(nums) else 'false')\n",
            "javascript": "const nums = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction containsDuplicate(nums) {\n    // your code here\n    return false;\n}\nconsole.log(containsDuplicate(nums) ? 'true' : 'false');\n",
        },
        "public_tests": [
            {"input": "[1,2,3,1]", "expected": "true"},
            {"input": "[1,2,3,4]", "expected": "false"},
        ],
        "hidden_tests": [
            {"input": "[1,1,1,3,3,4,3,2,4,2]", "expected": "true"},
            {"input": "[]", "expected": "false"},
            {"input": "[1]", "expected": "false"},
            {"input": "[0,0]", "expected": "true"},
        ],
    },

    "two_sum": {
        "id": "two_sum", "lc": "1", "title": "Two Sum",
        "topic": "arrays", "pattern": "hashing", "difficulty": "easy",
        "statement": (
            "Given an array of integers `nums` and an integer `target`, "
            "return the indices of the two numbers that add up to `target`. "
            "Each input has exactly one solution. You may not use the same element twice."
        ),
        "constraints": ["2 <= nums.length <= 10^4", "-10^9 <= nums[i] <= 10^9", "Only one valid answer exists."],
        "examples": [
            {"input": "nums = [2,7,11,15], target = 9", "output": "[0,1]", "explanation": "nums[0] + nums[1] = 9"},
            {"input": "nums = [3,2,4], target = 6", "output": "[1,2]"},
        ],
        "hints": [
            "Brute force is O(n^2) — check every pair. Can you do it in one pass?",
            "A hash map stores value → index. At each element, check if (target - nums[i]) is already in the map.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(n)"},
        "starter_code": {
            "python": "import sys, json\ndef two_sum(nums, target):\n    # your code here\n    return []\n\ndata = sys.stdin.read().split('\\n')\nnums = json.loads(data[0])\ntarget = int(data[1])\nprint(json.dumps(two_sum(nums, target)))\n",
            "javascript": "const data = require('fs').readFileSync(0,'utf8').split('\\n');\nconst nums = JSON.parse(data[0]), target = Number(data[1]);\nfunction twoSum(nums, target) {\n    // your code here\n    return [];\n}\nconsole.log(JSON.stringify(twoSum(nums, target)));\n",
        },
        "public_tests": [
            {"input": "[2,7,11,15]\n9", "expected": "[0,1]"},
            {"input": "[3,2,4]\n6", "expected": "[1,2]"},
        ],
        "hidden_tests": [
            {"input": "[3,3]\n6", "expected": "[0,1]"},
            {"input": "[1,5,3,7,9,2]\n11", "expected": "[1,3]"},
            {"input": "[-1,-2,-3,-4,-5]\n-8", "expected": "[2,4]"},
        ],
    },

    "best_time_stock": {
        "id": "best_time_stock", "lc": "121", "title": "Best Time to Buy and Sell Stock",
        "topic": "arrays", "pattern": "sliding_window", "difficulty": "easy",
        "statement": (
            "You are given an array `prices` where `prices[i]` is the price of a stock on day `i`. "
            "You want to maximize profit by choosing a single day to buy and a later day to sell. "
            "Return the maximum profit. If no profit is possible, return 0."
        ),
        "constraints": ["1 <= prices.length <= 10^5", "0 <= prices[i] <= 10^4"],
        "examples": [
            {"input": "prices = [7,1,5,3,6,4]", "output": "5", "explanation": "Buy day 2 (price=1), sell day 5 (price=6)"},
            {"input": "prices = [7,6,4,3,1]", "output": "0"},
        ],
        "hints": [
            "Track the minimum price seen so far. At each day, compute potential profit = current - min_so_far.",
            "One pass, O(1) space: maintain min_price and max_profit.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": "import sys, json\ndef max_profit(prices):\n    # your code here\n    return 0\n\nprices = json.loads(sys.stdin.read())\nprint(max_profit(prices))\n",
            "javascript": "const prices = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction maxProfit(prices) {\n    // your code here\n    return 0;\n}\nconsole.log(maxProfit(prices));\n",
        },
        "public_tests": [
            {"input": "[7,1,5,3,6,4]", "expected": "5"},
            {"input": "[7,6,4,3,1]", "expected": "0"},
        ],
        "hidden_tests": [
            {"input": "[1,2]", "expected": "1"},
            {"input": "[2,4,1]", "expected": "2"},
            {"input": "[3,3,3,3]", "expected": "0"},
            {"input": "[1]", "expected": "0"},
        ],
    },

    "product_except_self": {
        "id": "product_except_self", "lc": "238", "title": "Product of Array Except Self",
        "topic": "arrays", "pattern": "prefix_sum", "difficulty": "medium",
        "statement": (
            "Given an integer array `nums`, return an array `answer` such that `answer[i]` "
            "is equal to the product of all elements except `nums[i]`. "
            "You must do this in O(n) time without using division."
        ),
        "constraints": ["2 <= nums.length <= 10^5", "-30 <= nums[i] <= 30"],
        "examples": [
            {"input": "nums = [1,2,3,4]", "output": "[24,12,8,6]"},
            {"input": "nums = [-1,1,0,-3,3]", "output": "[0,0,9,0,0]"},
        ],
        "hints": [
            "Think prefix products and suffix products separately.",
            "answer[i] = (product of all elements left of i) * (product of all elements right of i).",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1) extra"},
        "starter_code": {
            "python": "import sys, json\ndef product_except_self(nums):\n    # your code here\n    return []\n\nnums = json.loads(sys.stdin.read())\nprint(json.dumps(product_except_self(nums)))\n",
            "javascript": "const nums = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction productExceptSelf(nums) {\n    // your code here\n    return [];\n}\nconsole.log(JSON.stringify(productExceptSelf(nums)));\n",
        },
        "public_tests": [
            {"input": "[1,2,3,4]", "expected": "[24,12,8,6]"},
            {"input": "[-1,1,0,-3,3]", "expected": "[0,0,9,0,0]"},
        ],
        "hidden_tests": [
            {"input": "[0,0]", "expected": "[0,0]"},
            {"input": "[1,1]", "expected": "[1,1]"},
            {"input": "[-1,-2,-3,-4]", "expected": "[-24,-12,-8,-6]"},
        ],
    },

    "max_subarray": {
        "id": "max_subarray", "lc": "53", "title": "Maximum Subarray",
        "topic": "arrays", "pattern": "kadane", "difficulty": "medium",
        "statement": "Find the contiguous subarray with the largest sum and return its sum.",
        "constraints": ["1 <= nums.length <= 10^5", "-10^4 <= nums[i] <= 10^4"],
        "examples": [
            {"input": "nums = [-2,1,-3,4,-1,2,1,-5,4]", "output": "6", "explanation": "[4,-1,2,1] has the largest sum"},
            {"input": "nums = [1]", "output": "1"},
        ],
        "hints": [
            "Kadane's algorithm: at each index, either extend the current subarray or start fresh.",
            "cur = max(nums[i], cur + nums[i]). Track max of all cur values.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": "import sys, json\ndef max_subarray(nums):\n    # your code here\n    return 0\n\nnums = json.loads(sys.stdin.read())\nprint(max_subarray(nums))\n",
            "javascript": "const nums = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction maxSubArray(nums) {\n    // your code here\n    return 0;\n}\nconsole.log(maxSubArray(nums));\n",
        },
        "public_tests": [
            {"input": "[-2,1,-3,4,-1,2,1,-5,4]", "expected": "6"},
            {"input": "[1]", "expected": "1"},
        ],
        "hidden_tests": [
            {"input": "[5,4,-1,7,8]", "expected": "23"},
            {"input": "[-1,-2,-3,-4]", "expected": "-1"},
            {"input": "[2,-1,2,3,4,-5]", "expected": "10"},
        ],
    },

    "max_product_subarray": {
        "id": "max_product_subarray", "lc": "152", "title": "Maximum Product Subarray",
        "topic": "arrays", "pattern": "dp_1d", "difficulty": "medium",
        "statement": (
            "Given an integer array `nums`, find a subarray that has the largest product, and return the product."
        ),
        "constraints": ["1 <= nums.length <= 2*10^4", "-10 <= nums[i] <= 10"],
        "examples": [
            {"input": "nums = [2,3,-2,4]", "output": "6", "explanation": "[2,3] has the largest product"},
            {"input": "nums = [-2,0,-1]", "output": "0"},
        ],
        "hints": [
            "A negative * negative = positive. Track both max and min product ending at each index.",
            "At each step: cur_max = max(nums[i], prev_max*nums[i], prev_min*nums[i]).",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": "import sys, json\ndef max_product(nums):\n    # your code here\n    return 0\n\nnums = json.loads(sys.stdin.read())\nprint(max_product(nums))\n",
            "javascript": "const nums = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction maxProduct(nums) {\n    // your code here\n    return 0;\n}\nconsole.log(maxProduct(nums));\n",
        },
        "public_tests": [
            {"input": "[2,3,-2,4]", "expected": "6"},
            {"input": "[-2,0,-1]", "expected": "0"},
        ],
        "hidden_tests": [
            {"input": "[-2]", "expected": "-2"},
            {"input": "[-2,3,-4]", "expected": "24"},
            {"input": "[0,2]", "expected": "2"},
        ],
    },

    "find_min_rotated": {
        "id": "find_min_rotated", "lc": "153", "title": "Find Minimum in Rotated Sorted Array",
        "topic": "arrays", "pattern": "binary_search", "difficulty": "medium",
        "statement": (
            "Suppose an array of length n sorted in ascending order is rotated between 1 and n times. "
            "Given the sorted rotated array `nums` of unique elements, return the minimum element."
        ),
        "constraints": ["1 <= nums.length <= 5000", "-5000 <= nums[i] <= 5000", "All integers unique"],
        "examples": [
            {"input": "nums = [3,4,5,1,2]", "output": "1"},
            {"input": "nums = [4,5,6,7,0,1,2]", "output": "0"},
            {"input": "nums = [11,13,15,17]", "output": "11"},
        ],
        "hints": [
            "Use binary search. The minimum is at the inflection point where nums[mid] > nums[right].",
            "If nums[mid] > nums[right], the min is in the right half. Otherwise it's in the left.",
        ],
        "expected_complexity": {"time": "O(log n)", "space": "O(1)"},
        "starter_code": {
            "python": "import sys, json\ndef find_min(nums):\n    # your code here\n    return 0\n\nnums = json.loads(sys.stdin.read())\nprint(find_min(nums))\n",
            "javascript": "const nums = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction findMin(nums) {\n    // your code here\n    return 0;\n}\nconsole.log(findMin(nums));\n",
        },
        "public_tests": [
            {"input": "[3,4,5,1,2]", "expected": "1"},
            {"input": "[4,5,6,7,0,1,2]", "expected": "0"},
        ],
        "hidden_tests": [
            {"input": "[11,13,15,17]", "expected": "11"},
            {"input": "[1]", "expected": "1"},
            {"input": "[2,1]", "expected": "1"},
        ],
    },

    "three_sum": {
        "id": "three_sum", "lc": "15", "title": "3Sum",
        "topic": "arrays", "pattern": "two_pointers", "difficulty": "medium",
        "statement": (
            "Given an integer array `nums`, return all the triplets [nums[i], nums[j], nums[k]] "
            "such that i != j, i != k, j != k, and nums[i] + nums[j] + nums[k] == 0. "
            "The solution set must not contain duplicate triplets."
        ),
        "constraints": ["3 <= nums.length <= 3000", "-10^5 <= nums[i] <= 10^5"],
        "examples": [
            {"input": "nums = [-1,0,1,2,-1,-4]", "output": "[[-1,-1,2],[-1,0,1]]"},
            {"input": "nums = [0,1,1]", "output": "[]"},
            {"input": "nums = [0,0,0]", "output": "[[0,0,0]]"},
        ],
        "hints": [
            "Sort first. Fix one element, then use two pointers on the rest.",
            "Skip duplicates for the fixed element and both pointers to avoid duplicate triplets.",
        ],
        "expected_complexity": {"time": "O(n^2)", "space": "O(1) extra"},
        "starter_code": {
            "python": "import sys, json\ndef three_sum(nums):\n    # your code here\n    return []\n\nnums = json.loads(sys.stdin.read())\nresult = three_sum(nums)\nprint(json.dumps(sorted([sorted(t) for t in result])))\n",
            "javascript": "const nums = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction threeSum(nums) {\n    // your code here\n    return [];\n}\nconst result = threeSum(nums).map(t => t.sort((a,b)=>a-b)).sort((a,b)=>a[0]-b[0]||a[1]-b[1]);\nconsole.log(JSON.stringify(result));\n",
        },
        "public_tests": [
            {"input": "[-1,0,1,2,-1,-4]", "expected": "[[-1,-1,2],[-1,0,1]]"},
            {"input": "[0,0,0]", "expected": "[[0,0,0]]"},
        ],
        "hidden_tests": [
            {"input": "[0,1,1]", "expected": "[]"},
            {"input": "[-2,0,1,1,2]", "expected": "[[-2,0,2],[-2,1,1]]"},
            {"input": "[-4,-2,-2,-2,0,1,2,2,2,3,3,4,4,6,6]", "expected": "[[-4,-2,6],[-4,0,4],[-4,1,3],[-4,2,2],[-2,-2,4],[-2,0,2]]"},
        ],
    },

    "container_most_water": {
        "id": "container_most_water", "lc": "11", "title": "Container With Most Water",
        "topic": "arrays", "pattern": "two_pointers", "difficulty": "medium",
        "statement": (
            "You are given an integer array `height` of length n. There are n vertical lines. "
            "Find two lines that together with the x-axis form a container that contains the most water. "
            "Return the maximum amount of water a container can store."
        ),
        "constraints": ["2 <= height.length <= 10^5", "0 <= height[i] <= 10^4"],
        "examples": [
            {"input": "height = [1,8,6,2,5,4,8,3,7]", "output": "49"},
            {"input": "height = [1,1]", "output": "1"},
        ],
        "hints": [
            "Two pointers: start from both ends. Move the shorter line inward.",
            "Area = min(height[l], height[r]) * (r - l). Move whichever pointer has smaller height.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": "import sys, json\ndef max_area(height):\n    # your code here\n    return 0\n\nheight = json.loads(sys.stdin.read())\nprint(max_area(height))\n",
            "javascript": "const height = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction maxArea(height) {\n    // your code here\n    return 0;\n}\nconsole.log(maxArea(height));\n",
        },
        "public_tests": [
            {"input": "[1,8,6,2,5,4,8,3,7]", "expected": "49"},
            {"input": "[1,1]", "expected": "1"},
        ],
        "hidden_tests": [
            {"input": "[4,3,2,1,4]", "expected": "16"},
            {"input": "[1,2,1]", "expected": "2"},
            {"input": "[2,3,4,5,18,17,6]", "expected": "17"},
        ],
    },

    # ════════════════════════════════════════════════════════════════════
    # STRINGS
    # ════════════════════════════════════════════════════════════════════

    "valid_palindrome": {
        "id": "valid_palindrome", "lc": "125", "title": "Valid Palindrome",
        "topic": "strings", "pattern": "two_pointers", "difficulty": "easy",
        "statement": "Given a string `s`, return `true` if it is a palindrome considering only alphanumeric characters and ignoring case.",
        "constraints": ["1 <= s.length <= 2*10^5", "s consists only of printable ASCII characters."],
        "examples": [
            {"input": "s = 'A man, a plan, a canal: Panama'", "output": "true"},
            {"input": "s = 'race a car'", "output": "false"},
        ],
        "hints": [
            "Two pointers from both ends. Skip non-alphanumeric characters. Compare case-insensitively.",
            "Use isalnum() and lower() in Python.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": "import sys\ndef is_palindrome(s):\n    # your code here\n    return False\n\ns = sys.stdin.read().rstrip('\\n')\nprint('true' if is_palindrome(s) else 'false')\n",
            "javascript": "const s = require('fs').readFileSync(0,'utf8').replace(/\\n$/,'');\nfunction isPalindrome(s) {\n    // your code here\n    return false;\n}\nconsole.log(isPalindrome(s) ? 'true' : 'false');\n",
        },
        "public_tests": [
            {"input": "A man, a plan, a canal: Panama", "expected": "true"},
            {"input": "race a car", "expected": "false"},
        ],
        "hidden_tests": [
            {"input": " ", "expected": "true"},
            {"input": "0P", "expected": "false"},
            {"input": "Madam", "expected": "true"},
            {"input": "Was it a car or a cat I saw", "expected": "true"},
        ],
    },

    "valid_anagram": {
        "id": "valid_anagram", "lc": "242", "title": "Valid Anagram",
        "topic": "strings", "pattern": "hashing", "difficulty": "easy",
        "statement": "Given two strings `s` and `t`, return `true` if `t` is an anagram of `s`, and `false` otherwise.",
        "constraints": ["1 <= s.length, t.length <= 5*10^4", "s and t consist of lowercase English letters."],
        "examples": [
            {"input": "s = 'anagram', t = 'nagaram'", "output": "true"},
            {"input": "s = 'rat', t = 'car'", "output": "false"},
        ],
        "hints": [
            "Character frequency counts. Counter(s) == Counter(t) in Python.",
            "Or sort both strings and compare — but that is O(n log n).",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": "import sys\ndef is_anagram(s, t):\n    # your code here\n    return False\n\nlines = sys.stdin.read().split('\\n')\nprint('true' if is_anagram(lines[0], lines[1]) else 'false')\n",
            "javascript": "const lines = require('fs').readFileSync(0,'utf8').split('\\n');\nfunction isAnagram(s, t) {\n    // your code here\n    return false;\n}\nconsole.log(isAnagram(lines[0], lines[1]) ? 'true' : 'false');\n",
        },
        "public_tests": [
            {"input": "anagram\nnagaram", "expected": "true"},
            {"input": "rat\ncar", "expected": "false"},
        ],
        "hidden_tests": [
            {"input": "a\na", "expected": "true"},
            {"input": "ab\nba", "expected": "true"},
            {"input": "ab\nbc", "expected": "false"},
            {"input": "aacc\nccac", "expected": "false"},
        ],
    },

    "group_anagrams": {
        "id": "group_anagrams", "lc": "49", "title": "Group Anagrams",
        "topic": "strings", "pattern": "hashing", "difficulty": "medium",
        "statement": (
            "Given an array of strings `strs`, group the anagrams together. "
            "You can return the answer in any order."
        ),
        "constraints": ["1 <= strs.length <= 10^4", "0 <= strs[i].length <= 100", "strs[i] consists of lowercase English letters."],
        "examples": [
            {"input": 'strs = ["eat","tea","tan","ate","nat","bat"]', "output": '[["bat"],["nat","tan"],["ate","eat","tea"]]'},
            {"input": 'strs = [""]', "output": '[[""]]'},
        ],
        "hints": [
            "Anagrams have the same sorted characters. Use sorted(word) as the hash key.",
            "Group all words with the same sorted key into the same bucket.",
        ],
        "expected_complexity": {"time": "O(n * k log k) where k is max word length", "space": "O(n*k)"},
        "starter_code": {
            "python": "import sys, json\ndef group_anagrams(strs):\n    # your code here\n    return []\n\nstrs = json.loads(sys.stdin.read())\nresult = group_anagrams(strs)\nprint(json.dumps(sorted([sorted(g) for g in result])))\n",
            "javascript": "const strs = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction groupAnagrams(strs) {\n    // your code here\n    return [];\n}\nconst result = groupAnagrams(strs).map(g=>g.sort()).sort((a,b)=>a[0]>b[0]?1:-1);\nconsole.log(JSON.stringify(result));\n",
        },
        "public_tests": [
            {"input": '["eat","tea","tan","ate","nat","bat"]', "expected": '[["bat"],["nat","tan"],["ate","eat","tea"]]'},
            {"input": '[""]', "expected": '[[""]]'},
        ],
        "hidden_tests": [
            {"input": '["a"]', "expected": '[["a"]]'},
            {"input": '["abc","bca","cab","xyz","zyx"]', "expected": '[["abc","bca","cab"],["xyz","zyx"]]'},
        ],
    },

    # ════════════════════════════════════════════════════════════════════
    # SLIDING WINDOW
    # ════════════════════════════════════════════════════════════════════

    "longest_substring": {
        "id": "longest_substring", "lc": "3", "title": "Longest Substring Without Repeating Characters",
        "topic": "sliding_window", "pattern": "sliding_window", "difficulty": "medium",
        "statement": "Given a string `s`, find the length of the longest substring without repeating characters.",
        "constraints": ["0 <= s.length <= 5*10^4"],
        "examples": [
            {"input": "s = 'abcabcbb'", "output": "3", "explanation": "The answer is 'abc'"},
            {"input": "s = 'bbbbb'", "output": "1"},
        ],
        "hints": [
            "Sliding window: two pointers left and right. Expand right, shrink left when a duplicate is found.",
            "Use a hash set (or dict of char → last index) to track what's in the current window.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(min(n, charset))"},
        "starter_code": {
            "python": "import sys\ndef length_of_longest_substring(s):\n    # your code here\n    return 0\n\ns = sys.stdin.read().rstrip('\\n')\nprint(length_of_longest_substring(s))\n",
            "javascript": "const s = require('fs').readFileSync(0,'utf8').replace(/\\n$/,'');\nfunction lengthOfLongestSubstring(s) {\n    // your code here\n    return 0;\n}\nconsole.log(lengthOfLongestSubstring(s));\n",
        },
        "public_tests": [
            {"input": "abcabcbb", "expected": "3"},
            {"input": "bbbbb", "expected": "1"},
        ],
        "hidden_tests": [
            {"input": "pwwkew", "expected": "3"},
            {"input": "", "expected": "0"},
            {"input": "au", "expected": "2"},
            {"input": " ", "expected": "1"},
        ],
    },

    "min_window_substring": {
        "id": "min_window_substring", "lc": "76", "title": "Minimum Window Substring",
        "topic": "sliding_window", "pattern": "sliding_window", "difficulty": "hard",
        "statement": (
            "Given two strings `s` and `t`, return the minimum window substring of `s` "
            "such that every character in `t` (including duplicates) is included in the window. "
            "If there is no such substring, return an empty string."
        ),
        "constraints": ["1 <= s.length, t.length <= 10^5", "s and t consist of uppercase and lowercase English letters."],
        "examples": [
            {"input": "s = 'ADOBECODEBANC', t = 'ABC'", "output": "BANC"},
            {"input": "s = 'a', t = 'a'", "output": "a"},
            {"input": "s = 'a', t = 'aa'", "output": ""},
        ],
        "hints": [
            "Sliding window with two counters: what we need vs what we have in the window.",
            "Expand right until all chars in t are covered. Then shrink left to minimize.",
        ],
        "expected_complexity": {"time": "O(|s| + |t|)", "space": "O(|t|)"},
        "starter_code": {
            "python": "import sys\ndef min_window(s, t):\n    # your code here\n    return ''\n\nlines = sys.stdin.read().split('\\n')\nprint(min_window(lines[0], lines[1]))\n",
            "javascript": "const lines = require('fs').readFileSync(0,'utf8').split('\\n');\nfunction minWindow(s, t) {\n    // your code here\n    return '';\n}\nconsole.log(minWindow(lines[0], lines[1]));\n",
        },
        "public_tests": [
            {"input": "ADOBECODEBANC\nABC", "expected": "BANC"},
            {"input": "a\na", "expected": "a"},
        ],
        "hidden_tests": [
            {"input": "a\naa", "expected": ""},
            {"input": "ab\nb", "expected": "b"},
            {"input": "bba\nab", "expected": "ba"},
        ],
    },

    # ════════════════════════════════════════════════════════════════════
    # TWO POINTERS
    # ════════════════════════════════════════════════════════════════════

    "trapping_rain_water": {
        "id": "trapping_rain_water", "lc": "42", "title": "Trapping Rain Water",
        "topic": "two_pointers", "pattern": "two_pointers", "difficulty": "hard",
        "statement": (
            "Given `n` non-negative integers representing an elevation map where the width of each bar is 1, "
            "compute how much water it can trap after raining."
        ),
        "constraints": ["n == height.length", "1 <= n <= 2*10^4", "0 <= height[i] <= 10^5"],
        "examples": [
            {"input": "height = [0,1,0,2,1,0,1,3,2,1,2,1]", "output": "6"},
            {"input": "height = [4,2,0,3,2,5]", "output": "9"},
        ],
        "hints": [
            "For each position, water trapped = min(max_left, max_right) - height[i].",
            "Two-pointer approach: maintain left_max and right_max. Process whichever side has lower max.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": "import sys, json\ndef trap(height):\n    # your code here\n    return 0\n\nheight = json.loads(sys.stdin.read())\nprint(trap(height))\n",
            "javascript": "const height = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction trap(height) {\n    // your code here\n    return 0;\n}\nconsole.log(trap(height));\n",
        },
        "public_tests": [
            {"input": "[0,1,0,2,1,0,1,3,2,1,2,1]", "expected": "6"},
            {"input": "[4,2,0,3,2,5]", "expected": "9"},
        ],
        "hidden_tests": [
            {"input": "[1,0,1]", "expected": "1"},
            {"input": "[3,0,2,0,4]", "expected": "7"},
            {"input": "[1,2,3,4,5]", "expected": "0"},
        ],
    },

    # ════════════════════════════════════════════════════════════════════
    # BINARY SEARCH
    # ════════════════════════════════════════════════════════════════════

    "binary_search_basic": {
        "id": "binary_search_basic", "lc": "704", "title": "Binary Search",
        "topic": "binary_search", "pattern": "binary_search", "difficulty": "easy",
        "statement": (
            "Given a sorted array of integers `nums` in ascending order and a `target`, "
            "return the index of `target`. If not found, return -1."
        ),
        "constraints": ["1 <= nums.length <= 10^4", "All values distinct.", "nums is sorted ascending."],
        "examples": [
            {"input": "nums = [-1,0,3,5,9,12], target = 9", "output": "4"},
            {"input": "nums = [-1,0,3,5,9,12], target = 2", "output": "-1"},
        ],
        "hints": [
            "Maintain left and right pointers. Check the midpoint each iteration.",
            "If mid value < target: search right half (left = mid + 1). Else search left (right = mid - 1).",
        ],
        "expected_complexity": {"time": "O(log n)", "space": "O(1)"},
        "starter_code": {
            "python": "import sys, json\ndef binary_search(nums, target):\n    # your code here\n    return -1\n\ndata = sys.stdin.read().split('\\n')\nnums = json.loads(data[0])\ntarget = int(data[1])\nprint(binary_search(nums, target))\n",
            "javascript": "const data = require('fs').readFileSync(0,'utf8').split('\\n');\nconst nums = JSON.parse(data[0]), target = Number(data[1]);\nfunction binarySearch(nums, target) {\n    // your code here\n    return -1;\n}\nconsole.log(binarySearch(nums, target));\n",
        },
        "public_tests": [
            {"input": "[-1,0,3,5,9,12]\n9", "expected": "4"},
            {"input": "[-1,0,3,5,9,12]\n2", "expected": "-1"},
        ],
        "hidden_tests": [
            {"input": "[5]\n5", "expected": "0"},
            {"input": "[5]\n-5", "expected": "-1"},
            {"input": "[1,3,5,7,9]\n7", "expected": "3"},
        ],
    },

    "search_rotated_array": {
        "id": "search_rotated_array", "lc": "33", "title": "Search in Rotated Sorted Array",
        "topic": "binary_search", "pattern": "binary_search", "difficulty": "medium",
        "statement": (
            "There is an integer array `nums` sorted in ascending order (with distinct values) "
            "that has been possibly rotated. Given `nums` after a possible rotation and an integer `target`, "
            "return the index of `target`, or -1 if it is not in nums. Must be O(log n)."
        ),
        "constraints": ["1 <= nums.length <= 5000", "-10^4 <= nums[i] <= 10^4", "All values distinct."],
        "examples": [
            {"input": "nums = [4,5,6,7,0,1,2], target = 0", "output": "4"},
            {"input": "nums = [4,5,6,7,0,1,2], target = 3", "output": "-1"},
        ],
        "hints": [
            "In binary search, at least one half of the array is always sorted after a rotation.",
            "Check if left half is sorted (nums[left] <= nums[mid]). If target is in that half, search left. Else right.",
        ],
        "expected_complexity": {"time": "O(log n)", "space": "O(1)"},
        "starter_code": {
            "python": "import sys, json\ndef search(nums, target):\n    # your code here\n    return -1\n\ndata = sys.stdin.read().split('\\n')\nnums = json.loads(data[0])\ntarget = int(data[1])\nprint(search(nums, target))\n",
            "javascript": "const data = require('fs').readFileSync(0,'utf8').split('\\n');\nconst nums = JSON.parse(data[0]), target = Number(data[1]);\nfunction search(nums, target) {\n    // your code here\n    return -1;\n}\nconsole.log(search(nums, target));\n",
        },
        "public_tests": [
            {"input": "[4,5,6,7,0,1,2]\n0", "expected": "4"},
            {"input": "[4,5,6,7,0,1,2]\n3", "expected": "-1"},
        ],
        "hidden_tests": [
            {"input": "[1]\n0", "expected": "-1"},
            {"input": "[3,1]\n1", "expected": "1"},
            {"input": "[1,3]\n3", "expected": "1"},
        ],
    },

    # ════════════════════════════════════════════════════════════════════
    # STACK
    # ════════════════════════════════════════════════════════════════════

    "valid_parentheses": {
        "id": "valid_parentheses", "lc": "20", "title": "Valid Parentheses",
        "topic": "stack", "pattern": "stack", "difficulty": "easy",
        "statement": (
            "Given a string `s` containing '(', ')', '{', '}', '[', ']', "
            "determine if the input string is valid. Open brackets must be closed "
            "by the same type of brackets in the correct order."
        ),
        "constraints": ["1 <= s.length <= 10^4", "s consists of parentheses only '()[]{}'."],
        "examples": [
            {"input": "s = '()'", "output": "true"},
            {"input": "s = '()[]{}'", "output": "true"},
            {"input": "s = '(]'", "output": "false"},
        ],
        "hints": [
            "Use a stack. Push open brackets, pop and match on close brackets.",
            "At the end the stack must be empty for the string to be valid.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(n)"},
        "starter_code": {
            "python": "import sys\ndef is_valid(s):\n    # your code here\n    return False\n\ns = sys.stdin.read().rstrip('\\n')\nprint('true' if is_valid(s) else 'false')\n",
            "javascript": "const s = require('fs').readFileSync(0,'utf8').replace(/\\n$/,'');\nfunction isValid(s) {\n    // your code here\n    return false;\n}\nconsole.log(isValid(s) ? 'true' : 'false');\n",
        },
        "public_tests": [
            {"input": "()", "expected": "true"},
            {"input": "()[]{}", "expected": "true"},
            {"input": "(]", "expected": "false"},
        ],
        "hidden_tests": [
            {"input": "([)]", "expected": "false"},
            {"input": "{[]}", "expected": "true"},
            {"input": "]", "expected": "false"},
            {"input": "", "expected": "true"},
        ],
    },

    "daily_temperatures": {
        "id": "daily_temperatures", "lc": "739", "title": "Daily Temperatures",
        "topic": "stack", "pattern": "monotonic_stack", "difficulty": "medium",
        "statement": (
            "Given an array of integers `temperatures` representing the daily temperatures, "
            "return an array `answer` such that `answer[i]` is the number of days you have to "
            "wait after day `i` to get a warmer temperature. If no warmer day exists, answer[i] = 0."
        ),
        "constraints": ["1 <= temperatures.length <= 10^5", "30 <= temperatures[i] <= 100"],
        "examples": [
            {"input": "temperatures = [73,74,75,71,69,72,76,73]", "output": "[1,1,4,2,1,1,0,0]"},
            {"input": "temperatures = [30,40,50,60]", "output": "[1,1,1,0]"},
        ],
        "hints": [
            "Monotonic stack: store indices of temperatures in decreasing order.",
            "When you find a warmer day, pop indices from stack and compute the difference.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(n)"},
        "starter_code": {
            "python": "import sys, json\ndef daily_temperatures(temperatures):\n    # your code here\n    return []\n\ntemperatures = json.loads(sys.stdin.read())\nprint(json.dumps(daily_temperatures(temperatures)))\n",
            "javascript": "const temperatures = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction dailyTemperatures(temperatures) {\n    // your code here\n    return [];\n}\nconsole.log(JSON.stringify(dailyTemperatures(temperatures)));\n",
        },
        "public_tests": [
            {"input": "[73,74,75,71,69,72,76,73]", "expected": "[1,1,4,2,1,1,0,0]"},
            {"input": "[30,40,50,60]", "expected": "[1,1,1,0]"},
        ],
        "hidden_tests": [
            {"input": "[30,60,90]", "expected": "[1,1,0]"},
            {"input": "[89,62,70,58,47,47,46,76,100,70]", "expected": "[8,1,5,4,3,2,1,1,0,0]"},
        ],
    },

    # ════════════════════════════════════════════════════════════════════
    # DYNAMIC PROGRAMMING
    # ════════════════════════════════════════════════════════════════════

    "climbing_stairs": {
        "id": "climbing_stairs", "lc": "70", "title": "Climbing Stairs",
        "topic": "dp_1d", "pattern": "dp_intro", "difficulty": "easy",
        "statement": (
            "You are climbing a staircase with `n` steps. Each time you can climb 1 or 2 steps. "
            "In how many distinct ways can you climb to the top?"
        ),
        "constraints": ["1 <= n <= 45"],
        "examples": [
            {"input": "n = 2", "output": "2", "explanation": "1+1 or 2"},
            {"input": "n = 3", "output": "3", "explanation": "1+1+1, 1+2, 2+1"},
        ],
        "hints": [
            "ways(n) = ways(n-1) + ways(n-2). Recognize this as Fibonacci.",
            "Bottom-up DP: iterate from 1 to n. You only need the previous two values.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": "import sys\ndef climb_stairs(n):\n    # your code here\n    return 0\n\nn = int(sys.stdin.read())\nprint(climb_stairs(n))\n",
            "javascript": "const n = Number(require('fs').readFileSync(0,'utf8').trim());\nfunction climbStairs(n) {\n    // your code here\n    return 0;\n}\nconsole.log(climbStairs(n));\n",
        },
        "public_tests": [
            {"input": "2", "expected": "2"},
            {"input": "3", "expected": "3"},
        ],
        "hidden_tests": [
            {"input": "1", "expected": "1"},
            {"input": "5", "expected": "8"},
            {"input": "10", "expected": "89"},
            {"input": "45", "expected": "1836311903"},
        ],
    },

    "house_robber": {
        "id": "house_robber", "lc": "198", "title": "House Robber",
        "topic": "dp_1d", "pattern": "dp_1d", "difficulty": "medium",
        "statement": (
            "You cannot rob two adjacent houses. "
            "Given an integer array `nums` representing money in each house, return the "
            "maximum amount you can rob without alerting the police."
        ),
        "constraints": ["1 <= nums.length <= 100", "0 <= nums[i] <= 400"],
        "examples": [
            {"input": "nums = [1,2,3,1]", "output": "4"},
            {"input": "nums = [2,7,9,3,1]", "output": "12"},
        ],
        "hints": [
            "At each house: max(rob this house + prev_prev, skip this house = prev).",
            "dp[i] = max(dp[i-1], dp[i-2] + nums[i]). You only need two variables.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": "import sys, json\ndef rob(nums):\n    # your code here\n    return 0\n\nnums = json.loads(sys.stdin.read())\nprint(rob(nums))\n",
            "javascript": "const nums = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction rob(nums) {\n    // your code here\n    return 0;\n}\nconsole.log(rob(nums));\n",
        },
        "public_tests": [
            {"input": "[1,2,3,1]", "expected": "4"},
            {"input": "[2,7,9,3,1]", "expected": "12"},
        ],
        "hidden_tests": [
            {"input": "[0]", "expected": "0"},
            {"input": "[1,2]", "expected": "2"},
            {"input": "[2,1,1,2]", "expected": "4"},
        ],
    },

    "coin_change": {
        "id": "coin_change", "lc": "322", "title": "Coin Change",
        "topic": "dp_1d", "pattern": "dp_1d", "difficulty": "medium",
        "statement": (
            "Given coin denominations `coins` and an integer `amount`, "
            "return the fewest number of coins to make up that amount. Return -1 if impossible."
        ),
        "constraints": ["1 <= coins.length <= 12", "0 <= amount <= 10^4"],
        "examples": [
            {"input": "coins = [1,5,10,25], amount = 41", "output": "4"},
            {"input": "coins = [2], amount = 3", "output": "-1"},
        ],
        "hints": [
            "Classic unbounded knapsack. dp[a] = min coins to make amount a.",
            "Initialize dp[0]=0, dp[1..amount]=infinity. For each amount, try each coin.",
        ],
        "expected_complexity": {"time": "O(amount * coins)", "space": "O(amount)"},
        "starter_code": {
            "python": "import sys, json\ndef coin_change(coins, amount):\n    # your code here\n    return -1\n\ndata = sys.stdin.read().split('\\n')\ncoins = json.loads(data[0])\namount = int(data[1])\nprint(coin_change(coins, amount))\n",
            "javascript": "const data = require('fs').readFileSync(0,'utf8').split('\\n');\nconst coins = JSON.parse(data[0]), amount = Number(data[1]);\nfunction coinChange(coins, amount) {\n    // your code here\n    return -1;\n}\nconsole.log(coinChange(coins, amount));\n",
        },
        "public_tests": [
            {"input": "[1,5,10,25]\n41", "expected": "4"},
            {"input": "[2]\n3", "expected": "-1"},
        ],
        "hidden_tests": [
            {"input": "[1]\n0", "expected": "0"},
            {"input": "[1]\n1", "expected": "1"},
            {"input": "[1,2,5]\n11", "expected": "3"},
        ],
    },

    "longest_increasing_subsequence": {
        "id": "longest_increasing_subsequence", "lc": "300", "title": "Longest Increasing Subsequence",
        "topic": "dp_1d", "pattern": "dp_1d", "difficulty": "medium",
        "statement": (
            "Given an integer array `nums`, return the length of the longest strictly increasing subsequence."
        ),
        "constraints": ["1 <= nums.length <= 2500", "-10^4 <= nums[i] <= 10^4"],
        "examples": [
            {"input": "nums = [10,9,2,5,3,7,101,18]", "output": "4", "explanation": "[2,3,7,101]"},
            {"input": "nums = [0,1,0,3,2,3]", "output": "4"},
        ],
        "hints": [
            "dp[i] = length of LIS ending at index i. For each i, look at all j < i where nums[j] < nums[i].",
            "O(n^2) DP is fine for n=2500. O(n log n) uses patience sorting with binary search.",
        ],
        "expected_complexity": {"time": "O(n^2) or O(n log n)", "space": "O(n)"},
        "starter_code": {
            "python": "import sys, json\ndef length_of_lis(nums):\n    # your code here\n    return 0\n\nnums = json.loads(sys.stdin.read())\nprint(length_of_lis(nums))\n",
            "javascript": "const nums = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction lengthOfLIS(nums) {\n    // your code here\n    return 0;\n}\nconsole.log(lengthOfLIS(nums));\n",
        },
        "public_tests": [
            {"input": "[10,9,2,5,3,7,101,18]", "expected": "4"},
            {"input": "[0,1,0,3,2,3]", "expected": "4"},
        ],
        "hidden_tests": [
            {"input": "[7,7,7,7,7,7,7]", "expected": "1"},
            {"input": "[1,3,6,7,9,4,10,5,6]", "expected": "6"},
        ],
    },

    # ════════════════════════════════════════════════════════════════════
    # GRAPHS
    # ════════════════════════════════════════════════════════════════════

    "number_of_islands": {
        "id": "number_of_islands", "lc": "200", "title": "Number of Islands",
        "topic": "graph_basics", "pattern": "dfs", "difficulty": "medium",
        "statement": (
            "Given a 2D grid of '1's (land) and '0's (water), count the number of islands. "
            "An island is surrounded by water and formed by connecting adjacent lands horizontally or vertically."
        ),
        "constraints": ["1 <= m, n <= 300"],
        "examples": [
            {"input": '[["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]', "output": "1"},
            {"input": '[["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]', "output": "3"},
        ],
        "hints": [
            "DFS or BFS from each unvisited '1'. Mark visited cells as '0' (or use a visited set) to avoid double-counting.",
            "Each time you start a new DFS from an unvisited '1', increment the island count by 1.",
        ],
        "expected_complexity": {"time": "O(m*n)", "space": "O(m*n)"},
        "starter_code": {
            "python": "import sys, json\ndef num_islands(grid):\n    # your code here\n    return 0\n\ngrid = json.loads(sys.stdin.read())\nprint(num_islands(grid))\n",
            "javascript": "const grid = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction numIslands(grid) {\n    // your code here\n    return 0;\n}\nconsole.log(numIslands(grid));\n",
        },
        "public_tests": [
            {"input": '[["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]', "expected": "1"},
            {"input": '[["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]', "expected": "3"},
        ],
        "hidden_tests": [
            {"input": '[["1"]]', "expected": "1"},
            {"input": '[["0"]]', "expected": "0"},
            {"input": '[["1","0","1","1","1"],["1","0","1","0","1"],["1","1","1","0","1"]]', "expected": "1"},
        ],
    },

    "clone_graph": {
        "id": "clone_graph", "lc": "133", "title": "Clone Graph",
        "topic": "graph_basics", "pattern": "bfs", "difficulty": "medium",
        "statement": (
            "Given a node in a connected undirected graph, return a deep copy of the graph. "
            "Each node has a val (int) and a list of neighbors. "
            "Input: adjacency list as JSON array where index i contains neighbors of node i+1. "
            "Output: same adjacency list."
        ),
        "constraints": ["Number of nodes: 0-100", "Node values are unique 1-n"],
        "examples": [
            {"input": "adjList = [[2,4],[1,3],[2,4],[1,3]]", "output": "[[2,4],[1,3],[2,4],[1,3]]"},
            {"input": "adjList = [[]]", "output": "[[]]"},
        ],
        "hints": [
            "BFS or DFS. Use a hash map from original node → cloned node to avoid infinite loops.",
            "When you encounter a neighbor you've already cloned, just add the reference — don't clone again.",
        ],
        "expected_complexity": {"time": "O(V + E)", "space": "O(V)"},
        "starter_code": {
            "python": "import sys, json\nfrom collections import deque\n\ndef clone_graph(adj):\n    # adj is a 0-indexed adjacency list (adj[i] = neighbors of node i+1)\n    # return the same format\n    if not adj:\n        return []\n    # your code here\n    return adj\n\nadj = json.loads(sys.stdin.read())\nprint(json.dumps(clone_graph(adj)))\n",
            "javascript": "const adj = JSON.parse(require('fs').readFileSync(0,'utf8'));\nfunction cloneGraph(adj) {\n    // adj is 0-indexed adjacency list\n    // your code here\n    return adj;\n}\nconsole.log(JSON.stringify(cloneGraph(adj)));\n",
        },
        "public_tests": [
            {"input": "[[2,4],[1,3],[2,4],[1,3]]", "expected": "[[2,4],[1,3],[2,4],[1,3]]"},
            {"input": "[[]]", "expected": "[[]]"},
        ],
        "hidden_tests": [
            {"input": "[]", "expected": "[]"},
            {"input": "[[2],[1]]", "expected": "[[2],[1]]"},
        ],
    },

    # ════════════════════════════════════════════════════════════════════
    # RECURSION
    # ════════════════════════════════════════════════════════════════════

    "power_of_two": {
        "id": "power_of_two", "lc": "231", "title": "Power of Two",
        "topic": "recursion", "pattern": "recursion", "difficulty": "easy",
        "statement": "Given an integer `n`, return `true` if it is a power of two. Otherwise, return `false`.",
        "constraints": ["-2^31 <= n <= 2^31 - 1"],
        "examples": [
            {"input": "n = 1", "output": "true", "explanation": "2^0 = 1"},
            {"input": "n = 16", "output": "true", "explanation": "2^4 = 16"},
            {"input": "n = 3", "output": "false"},
        ],
        "hints": [
            "Recursive approach: isPowerOfTwo(n) = n==1 OR (n%2==0 AND isPowerOfTwo(n//2)).",
            "Bit trick: n > 0 AND (n & (n-1)) == 0.",
        ],
        "expected_complexity": {"time": "O(log n)", "space": "O(log n) recursive / O(1) iterative"},
        "starter_code": {
            "python": "import sys\ndef is_power_of_two(n):\n    # your code here\n    return False\n\nn = int(sys.stdin.read())\nprint('true' if is_power_of_two(n) else 'false')\n",
            "javascript": "const n = Number(require('fs').readFileSync(0,'utf8').trim());\nfunction isPowerOfTwo(n) {\n    // your code here\n    return false;\n}\nconsole.log(isPowerOfTwo(n) ? 'true' : 'false');\n",
        },
        "public_tests": [
            {"input": "1", "expected": "true"},
            {"input": "16", "expected": "true"},
            {"input": "3", "expected": "false"},
        ],
        "hidden_tests": [
            {"input": "0", "expected": "false"},
            {"input": "-16", "expected": "false"},
            {"input": "1073741824", "expected": "true"},
        ],
    },

    "generate_parentheses": {
        "id": "generate_parentheses", "lc": "22", "title": "Generate Parentheses",
        "topic": "recursion", "pattern": "backtracking", "difficulty": "medium",
        "statement": (
            "Given `n` pairs of parentheses, write a function to generate all combinations of well-formed parentheses. "
            "Return the results sorted."
        ),
        "constraints": ["1 <= n <= 8"],
        "examples": [
            {"input": "n = 3", "output": '["((()))","(()())","(())()","()(())","()()()"]'},
            {"input": "n = 1", "output": '["()"]'},
        ],
        "hints": [
            "Backtracking: at each step, add '(' if open count < n, add ')' if close count < open count.",
            "Base case: when the string has length 2*n, it's complete. Add to result.",
        ],
        "expected_complexity": {"time": "O(4^n / sqrt(n))", "space": "O(n)"},
        "starter_code": {
            "python": "import sys, json\ndef generate_parentheses(n):\n    # your code here\n    return []\n\nn = int(sys.stdin.read())\nresult = sorted(generate_parentheses(n))\nprint(json.dumps(result))\n",
            "javascript": "const n = Number(require('fs').readFileSync(0,'utf8').trim());\nfunction generateParenthesis(n) {\n    // your code here\n    return [];\n}\nconsole.log(JSON.stringify(generateParenthesis(n).sort()));\n",
        },
        "public_tests": [
            {"input": "3", "expected": '["((()))","(()())","(())()","()(())","()()()"]'},
            {"input": "1", "expected": '["()"]'},
        ],
        "hidden_tests": [
            {"input": "2", "expected": '["(())","()()"]'},
            {"input": "4", "expected": '["(((())))","((()()))","((())())","((()))()","(()(()))","(()()())","(()())()","(())(())","(())()()","()((()))","()(()())","()(())()","()()(())","()()()()"]'},
        ],
    },

}


# ════════════════════════════════════════════════════════════════════════
# Topic → ordered problem list (easy → hard within each topic)
# ════════════════════════════════════════════════════════════════════════

TOPIC_PROBLEMS: dict[str, list[str]] = {
    "arrays":              ["contains_duplicate", "best_time_stock", "two_sum", "product_except_self", "max_subarray", "max_product_subarray", "find_min_rotated", "three_sum", "container_most_water"],
    "strings":             ["valid_palindrome", "valid_anagram", "group_anagrams"],
    "hashing":             ["contains_duplicate", "two_sum", "valid_anagram", "group_anagrams"],
    "two_pointers":        ["valid_palindrome", "three_sum", "container_most_water", "trapping_rain_water"],
    "sliding_window":      ["best_time_stock", "longest_substring", "min_window_substring"],
    "prefix_sum":          ["product_except_self"],
    "binary_search":       ["binary_search_basic", "find_min_rotated", "search_rotated_array"],
    "stack":               ["valid_parentheses", "daily_temperatures"],
    "monotonic_stack":     ["daily_temperatures"],
    "queue":               ["valid_parentheses", "climbing_stairs"],
    "deque":               ["daily_temperatures", "valid_parentheses"],
    "linked_list":         ["two_sum", "valid_palindrome", "container_most_water"],
    "doubly_linked_list":  ["two_sum", "valid_palindrome"],
    "fast_slow_pointers":  ["valid_palindrome", "two_sum"],
    "recursion":           ["power_of_two", "generate_parentheses"],
    "backtracking":        ["generate_parentheses"],
    "merge_sort":          ["max_subarray", "three_sum"],
    "quick_sort":          ["three_sum", "max_subarray"],
    "binary_tree":         ["climbing_stairs", "house_robber", "power_of_two"],
    "bst":                 ["binary_search_basic", "find_min_rotated", "search_rotated_array"],
    "tree_traversal":      ["climbing_stairs", "power_of_two"],
    "heap":                ["max_subarray", "house_robber", "climbing_stairs"],
    "lowest_common_ancestor": ["climbing_stairs", "house_robber"],
    "bit_manipulation":    ["power_of_two", "contains_duplicate"],
    "intervals":           ["max_subarray", "best_time_stock"],
    "greedy":              ["best_time_stock", "max_subarray"],
    "dp_intro":            ["climbing_stairs"],
    "dp_1d":               ["climbing_stairs", "house_robber", "coin_change", "longest_increasing_subsequence", "max_product_subarray"],
    "dp_2d":               ["coin_change", "longest_increasing_subsequence"],
    "dp_knapsack":         ["coin_change", "house_robber"],
    "dp_lcs":              ["longest_increasing_subsequence", "coin_change"],
    "dp_trees":            ["climbing_stairs", "house_robber"],
    "dp_graphs":           ["number_of_islands", "coin_change"],
    "divide_conquer":      ["max_subarray", "binary_search_basic"],
    "string_matching":     ["valid_anagram", "valid_palindrome"],
    "graph_basics":        ["number_of_islands", "clone_graph"],
    "bfs":                 ["number_of_islands", "clone_graph"],
    "dfs":                 ["number_of_islands"],
    "topological_sort":    ["number_of_islands", "clone_graph"],
    "union_find":          ["number_of_islands", "clone_graph"],
    "shortest_path_dijkstra": ["clone_graph", "number_of_islands"],
    "shortest_path_bellman":  ["clone_graph", "number_of_islands"],
    "minimum_spanning_tree":  ["number_of_islands", "clone_graph"],
    "trie":                ["valid_anagram", "group_anagrams"],
    "segment_tree":        ["max_subarray", "product_except_self"],
    "fenwick_tree":        ["product_except_self", "max_subarray"],
    "sorting":             ["contains_duplicate", "three_sum"],
}

# Difficulty ordering for within-topic progression
_DIFF_ORDER = {"easy": 0, "medium": 1, "hard": 2}


# ════════════════════════════════════════════════════════════════════════
# Public API
# ════════════════════════════════════════════════════════════════════════

def list_problems() -> list[dict]:
    return [
        {k: p[k] for k in ("id", "lc", "title", "topic", "pattern", "difficulty")}
        for p in CODING_PROBLEMS.values()
    ]


def get_problem(problem_id: str) -> dict | None:
    return CODING_PROBLEMS.get(problem_id)


def pick_problem_for_topic(topic: str, mastery: float, solved_ids: list[str]) -> dict | None:
    """Rule-based problem selection — no LLM needed."""
    candidates = TOPIC_PROBLEMS.get(topic, [])

    if mastery < 0.35:
        target_diffs = {"easy"}
    elif mastery < 0.65:
        target_diffs = {"easy", "medium"}
    else:
        target_diffs = {"medium", "hard"}

    unsolved = [pid for pid in candidates if pid not in solved_ids and pid in CODING_PROBLEMS]
    if not unsolved:
        unsolved = [pid for pid in candidates if pid in CODING_PROBLEMS]

    difficulty_matched = [
        pid for pid in unsolved
        if CODING_PROBLEMS[pid]["difficulty"] in target_diffs
    ]

    ranked = sorted(
        difficulty_matched or unsolved,
        key=lambda pid: _DIFF_ORDER.get(CODING_PROBLEMS[pid]["difficulty"], 1)
    )
    return CODING_PROBLEMS[ranked[0]] if ranked else None


def get_next_problem(current_id: str, topic: str, mastery: float, solved_ids: list[str]) -> dict | None:
    """Pick the next problem after completing current_id."""
    candidates = TOPIC_PROBLEMS.get(topic, [])

    if mastery >= 0.75:
        target_diffs = {"medium", "hard"}
    elif mastery >= 0.45:
        target_diffs = {"easy", "medium"}
    else:
        target_diffs = {"easy"}

    unsolved = [
        pid for pid in candidates
        if pid != current_id and pid not in solved_ids and pid in CODING_PROBLEMS
    ]

    if not unsolved:
        # Try harder problems from same topic even if solved
        all_harder = [
            pid for pid in candidates
            if pid != current_id and pid in CODING_PROBLEMS
            and _DIFF_ORDER.get(CODING_PROBLEMS[pid]["difficulty"], 1) >
               _DIFF_ORDER.get(CODING_PROBLEMS.get(current_id, {}).get("difficulty", "easy"), 0)
        ]
        if all_harder:
            unsolved = all_harder

    matched = [
        pid for pid in unsolved
        if CODING_PROBLEMS[pid]["difficulty"] in target_diffs
    ]

    ranked = sorted(
        matched or unsolved,
        key=lambda pid: _DIFF_ORDER.get(CODING_PROBLEMS[pid]["difficulty"], 1)
    )
    return CODING_PROBLEMS[ranked[0]] if ranked else None
