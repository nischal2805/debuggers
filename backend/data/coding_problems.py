"""
Coding sandbox problem catalog — NeetCode 150 / Striver A2Z aligned.

All problems use JSON stdin/stdout so they run on Piston without custom runners.
Two test tiers: public (shown during Run) and hidden (revealed on Submit).
"""

CODING_PROBLEMS: dict[str, dict] = {
    # ── Arrays ──────────────────────────────────────────────────────────────
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
            "Brute force is O(n^2). Can you do better?",
            "A hash map makes lookup O(1). Store value → index.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(n)"},
        "starter_code": {
            "python": (
                "import sys, json\n"
                "def two_sum(nums, target):\n"
                "    # TODO\n"
                "    return []\n\n"
                "data = sys.stdin.read().split('\\n')\n"
                "nums = json.loads(data[0])\ntarget = int(data[1])\n"
                "print(json.dumps(two_sum(nums, target)))\n"
            ),
            "javascript": (
                "const data = require('fs').readFileSync(0,'utf8').split('\\n');\n"
                "const nums = JSON.parse(data[0]), target = Number(data[1]);\n"
                "function twoSum(nums, target) { return []; }\n"
                "console.log(JSON.stringify(twoSum(nums, target)));\n"
            ),
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

    "contains_duplicate": {
        "id": "contains_duplicate", "lc": "217", "title": "Contains Duplicate",
        "topic": "arrays", "pattern": "hashing", "difficulty": "easy",
        "statement": "Given an integer array `nums`, return `true` if any value appears at least twice, and `false` if every element is distinct.",
        "constraints": ["1 <= nums.length <= 10^5", "-10^9 <= nums[i] <= 10^9"],
        "examples": [
            {"input": "nums = [1,2,3,1]", "output": "true"},
            {"input": "nums = [1,2,3,4]", "output": "false"},
        ],
        "hints": ["A set can answer 'have I seen this before?' in O(1)."],
        "expected_complexity": {"time": "O(n)", "space": "O(n)"},
        "starter_code": {
            "python": (
                "import sys, json\n"
                "def contains_duplicate(nums):\n"
                "    return False\n\n"
                "nums = json.loads(sys.stdin.read())\n"
                "print('true' if contains_duplicate(nums) else 'false')\n"
            ),
            "javascript": (
                "const nums = JSON.parse(require('fs').readFileSync(0,'utf8'));\n"
                "function containsDuplicate(nums) { return false; }\n"
                "console.log(containsDuplicate(nums) ? 'true' : 'false');\n"
            ),
        },
        "public_tests": [
            {"input": "[1,2,3,1]", "expected": "true"},
            {"input": "[1,2,3,4]", "expected": "false"},
        ],
        "hidden_tests": [
            {"input": "[1,1,1,3,3,4,3,2,4,2]", "expected": "true"},
            {"input": "[]", "expected": "false"},
            {"input": "[1]", "expected": "false"},
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
            "Track the minimum price seen so far. At each step, compute potential profit.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": (
                "import sys, json\n"
                "def max_profit(prices):\n"
                "    return 0\n\n"
                "prices = json.loads(sys.stdin.read())\n"
                "print(max_profit(prices))\n"
            ),
            "javascript": (
                "const prices = JSON.parse(require('fs').readFileSync(0,'utf8'));\n"
                "function maxProfit(prices) { return 0; }\n"
                "console.log(maxProfit(prices));\n"
            ),
        },
        "public_tests": [
            {"input": "[7,1,5,3,6,4]", "expected": "5"},
            {"input": "[7,6,4,3,1]", "expected": "0"},
        ],
        "hidden_tests": [
            {"input": "[1,2]", "expected": "1"},
            {"input": "[2,4,1]", "expected": "2"},
            {"input": "[3,3,3,3]", "expected": "0"},
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
            "Think prefix products and suffix products.",
            "answer[i] = (product of all to the left) * (product of all to the right)",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1) extra (output array doesn't count)"},
        "starter_code": {
            "python": (
                "import sys, json\n"
                "def product_except_self(nums):\n"
                "    return []\n\n"
                "nums = json.loads(sys.stdin.read())\n"
                "print(json.dumps(product_except_self(nums)))\n"
            ),
            "javascript": (
                "const nums = JSON.parse(require('fs').readFileSync(0,'utf8'));\n"
                "function productExceptSelf(nums) { return []; }\n"
                "console.log(JSON.stringify(productExceptSelf(nums)));\n"
            ),
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
            {"input": "nums = [-2,1,-3,4,-1,2,1,-5,4]", "output": "6", "explanation": "[4,-1,2,1] has the largest sum = 6"},
            {"input": "nums = [1]", "output": "1"},
        ],
        "hints": ["Kadane's: at each index, decide to extend current subarray or start fresh."],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": (
                "import sys, json\n"
                "def max_subarray(nums):\n"
                "    return 0\n\n"
                "nums = json.loads(sys.stdin.read())\n"
                "print(max_subarray(nums))\n"
            ),
            "javascript": (
                "const nums = JSON.parse(require('fs').readFileSync(0,'utf8'));\n"
                "function maxSubArray(nums) { return 0; }\n"
                "console.log(maxSubArray(nums));\n"
            ),
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

    # ── Strings ─────────────────────────────────────────────────────────────
    "valid_palindrome": {
        "id": "valid_palindrome", "lc": "125", "title": "Valid Palindrome",
        "topic": "strings", "pattern": "two_pointers", "difficulty": "easy",
        "statement": "Given a string `s`, return `true` if it is a palindrome considering only alphanumeric characters and ignoring case.",
        "constraints": ["1 <= s.length <= 2*10^5", "s consists only of printable ASCII characters."],
        "examples": [
            {"input": "s = 'A man, a plan, a canal: Panama'", "output": "true"},
            {"input": "s = 'race a car'", "output": "false"},
        ],
        "hints": ["Two pointers from both ends. Skip non-alphanumeric. Compare case-insensitively."],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": (
                "import sys\n"
                "def is_palindrome(s):\n"
                "    return False\n\n"
                "s = sys.stdin.read().rstrip('\\n')\n"
                "print('true' if is_palindrome(s) else 'false')\n"
            ),
            "javascript": (
                "const s = require('fs').readFileSync(0,'utf8').replace(/\\n$/,'');\n"
                "function isPalindrome(s) { return false; }\n"
                "console.log(isPalindrome(s) ? 'true' : 'false');\n"
            ),
        },
        "public_tests": [
            {"input": "A man, a plan, a canal: Panama", "expected": "true"},
            {"input": "race a car", "expected": "false"},
        ],
        "hidden_tests": [
            {"input": " ", "expected": "true"},
            {"input": "0P", "expected": "false"},
            {"input": "Madam", "expected": "true"},
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
        "hints": ["Character frequency counts. Or sort both — but that's O(n log n)."],
        "expected_complexity": {"time": "O(n)", "space": "O(1) (alphabet size is constant)"},
        "starter_code": {
            "python": (
                "import sys\n"
                "def is_anagram(s, t):\n"
                "    return False\n\n"
                "lines = sys.stdin.read().split('\\n')\n"
                "print('true' if is_anagram(lines[0], lines[1]) else 'false')\n"
            ),
            "javascript": (
                "const lines = require('fs').readFileSync(0,'utf8').split('\\n');\n"
                "function isAnagram(s, t) { return false; }\n"
                "console.log(isAnagram(lines[0], lines[1]) ? 'true' : 'false');\n"
            ),
        },
        "public_tests": [
            {"input": "anagram\nnagaram", "expected": "true"},
            {"input": "rat\ncar", "expected": "false"},
        ],
        "hidden_tests": [
            {"input": "a\na", "expected": "true"},
            {"input": "ab\nba", "expected": "true"},
            {"input": "ab\nbc", "expected": "false"},
        ],
    },

    "longest_substring": {
        "id": "longest_substring", "lc": "3", "title": "Longest Substring Without Repeating Characters",
        "topic": "sliding_window", "pattern": "sliding_window", "difficulty": "medium",
        "statement": "Given a string `s`, find the length of the longest substring without repeating characters.",
        "constraints": ["0 <= s.length <= 5*10^4", "s consists of English letters, digits, symbols and spaces."],
        "examples": [
            {"input": "s = 'abcabcbb'", "output": "3", "explanation": "The answer is 'abc', length 3"},
            {"input": "s = 'bbbbb'", "output": "1"},
            {"input": "s = 'pwwkew'", "output": "3"},
        ],
        "hints": [
            "Sliding window: two pointers left and right. Expand right, shrink left when duplicate found.",
            "Use a hash set to track characters in the current window.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(min(m,n)) where m=charset size"},
        "starter_code": {
            "python": (
                "import sys\n"
                "def length_of_longest_substring(s):\n"
                "    return 0\n\n"
                "s = sys.stdin.read().rstrip('\\n')\n"
                "print(length_of_longest_substring(s))\n"
            ),
            "javascript": (
                "const s = require('fs').readFileSync(0,'utf8').replace(/\\n$/,'');\n"
                "function lengthOfLongestSubstring(s) { return 0; }\n"
                "console.log(lengthOfLongestSubstring(s));\n"
            ),
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

    # ── Binary Search ────────────────────────────────────────────────────────
    "binary_search_basic": {
        "id": "binary_search_basic", "lc": "704", "title": "Binary Search",
        "topic": "binary_search", "pattern": "binary_search", "difficulty": "easy",
        "statement": (
            "Given a sorted array of integers `nums` in ascending order and a `target`, "
            "return the index of `target`. If not found, return -1."
        ),
        "constraints": ["1 <= nums.length <= 10^4", "All values in nums are distinct.", "nums is sorted ascending."],
        "examples": [
            {"input": "nums = [-1,0,3,5,9,12], target = 9", "output": "4"},
            {"input": "nums = [-1,0,3,5,9,12], target = 2", "output": "-1"},
        ],
        "hints": [
            "Maintain left and right pointers. Check the midpoint.",
            "If mid < target, search right half. Else search left half.",
        ],
        "expected_complexity": {"time": "O(log n)", "space": "O(1)"},
        "starter_code": {
            "python": (
                "import sys, json\n"
                "def binary_search(nums, target):\n"
                "    return -1\n\n"
                "data = sys.stdin.read().split('\\n')\n"
                "nums = json.loads(data[0])\ntarget = int(data[1])\n"
                "print(binary_search(nums, target))\n"
            ),
            "javascript": (
                "const data = require('fs').readFileSync(0,'utf8').split('\\n');\n"
                "const nums = JSON.parse(data[0]), target = Number(data[1]);\n"
                "function binarySearch(nums, target) { return -1; }\n"
                "console.log(binarySearch(nums, target));\n"
            ),
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

    # ── Stack ────────────────────────────────────────────────────────────────
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
        "hints": ["Use a stack. Push open brackets, pop and match on close brackets."],
        "expected_complexity": {"time": "O(n)", "space": "O(n)"},
        "starter_code": {
            "python": (
                "import sys\n"
                "def is_valid(s):\n"
                "    return False\n\n"
                "s = sys.stdin.read().rstrip('\\n')\n"
                "print('true' if is_valid(s) else 'false')\n"
            ),
            "javascript": (
                "const s = require('fs').readFileSync(0,'utf8').replace(/\\n$/,'');\n"
                "function isValid(s) { return false; }\n"
                "console.log(isValid(s) ? 'true' : 'false');\n"
            ),
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

    # ── Dynamic Programming ──────────────────────────────────────────────────
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
            "Think recursively: ways(n) = ways(n-1) + ways(n-2). Recognize the pattern?",
            "This is Fibonacci. Use DP — store previous two values.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": (
                "import sys\n"
                "def climb_stairs(n):\n"
                "    return 0\n\n"
                "n = int(sys.stdin.read())\n"
                "print(climb_stairs(n))\n"
            ),
            "javascript": (
                "const n = Number(require('fs').readFileSync(0,'utf8').trim());\n"
                "function climbStairs(n) { return 0; }\n"
                "console.log(climbStairs(n));\n"
            ),
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
            "You are a robber planning to rob houses along a street. "
            "Adjacent houses have security — you cannot rob two adjacent houses. "
            "Given an integer array `nums` representing money in each house, return the "
            "maximum amount you can rob tonight without alerting the police."
        ),
        "constraints": ["1 <= nums.length <= 100", "0 <= nums[i] <= 400"],
        "examples": [
            {"input": "nums = [1,2,3,1]", "output": "4", "explanation": "Rob house 1 (1) + house 3 (3) = 4"},
            {"input": "nums = [2,7,9,3,1]", "output": "12"},
        ],
        "hints": [
            "At each house: rob it (prev_prev + current) or skip it (prev).",
            "dp[i] = max(dp[i-1], dp[i-2] + nums[i]). You only need two variables.",
        ],
        "expected_complexity": {"time": "O(n)", "space": "O(1)"},
        "starter_code": {
            "python": (
                "import sys, json\n"
                "def rob(nums):\n"
                "    return 0\n\n"
                "nums = json.loads(sys.stdin.read())\n"
                "print(rob(nums))\n"
            ),
            "javascript": (
                "const nums = JSON.parse(require('fs').readFileSync(0,'utf8'));\n"
                "function rob(nums) { return 0; }\n"
                "console.log(rob(nums));\n"
            ),
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
            "Given an array of coin denominations `coins` and an integer `amount`, "
            "return the fewest number of coins needed to make up that amount. "
            "If the amount cannot be made up, return -1. You may use each coin denomination any number of times."
        ),
        "constraints": ["1 <= coins.length <= 12", "1 <= coins[i] <= 2^31 - 1", "0 <= amount <= 10^4"],
        "examples": [
            {"input": "coins = [1,5,10,25], amount = 41", "output": "4", "explanation": "25+10+5+1"},
            {"input": "coins = [2], amount = 3", "output": "-1"},
            {"input": "coins = [1], amount = 0", "output": "0"},
        ],
        "hints": [
            "Classic unbounded knapsack variant.",
            "dp[a] = minimum coins to make amount a. Initialize dp[0]=0, rest=infinity.",
        ],
        "expected_complexity": {"time": "O(amount * len(coins))", "space": "O(amount)"},
        "starter_code": {
            "python": (
                "import sys, json\n"
                "def coin_change(coins, amount):\n"
                "    return -1\n\n"
                "data = sys.stdin.read().split('\\n')\n"
                "coins = json.loads(data[0])\namount = int(data[1])\n"
                "print(coin_change(coins, amount))\n"
            ),
            "javascript": (
                "const data = require('fs').readFileSync(0,'utf8').split('\\n');\n"
                "const coins = JSON.parse(data[0]), amount = Number(data[1]);\n"
                "function coinChange(coins, amount) { return -1; }\n"
                "console.log(coinChange(coins, amount));\n"
            ),
        },
        "public_tests": [
            {"input": "[1,5,10,25]\n41", "expected": "4"},
            {"input": "[2]\n3", "expected": "-1"},
        ],
        "hidden_tests": [
            {"input": "[1]\n0", "expected": "0"},
            {"input": "[1]\n1", "expected": "1"},
            {"input": "[1,2,5]\n11", "expected": "3"},
            {"input": "[186,419,83,408]\n6249", "expected": "20"},
        ],
    },

    # ── Graphs ───────────────────────────────────────────────────────────────
    "number_of_islands": {
        "id": "number_of_islands", "lc": "200", "title": "Number of Islands",
        "topic": "graph_basics", "pattern": "dfs", "difficulty": "medium",
        "statement": (
            "Given a 2D grid of '1's (land) and '0's (water), count the number of islands. "
            "An island is surrounded by water and formed by connecting adjacent lands horizontally or vertically."
        ),
        "constraints": ["1 <= m, n <= 300"],
        "examples": [
            {"input": 'grid = [["1","1","1","1","0"],["1","1","0","1","0"],["1","1","0","0","0"],["0","0","0","0","0"]]', "output": "1"},
            {"input": 'grid = [["1","1","0","0","0"],["1","1","0","0","0"],["0","0","1","0","0"],["0","0","0","1","1"]]', "output": "3"},
        ],
        "hints": [
            "DFS or BFS from each unvisited '1'. Mark visited cells to avoid counting twice.",
        ],
        "expected_complexity": {"time": "O(m*n)", "space": "O(m*n)"},
        "starter_code": {
            "python": (
                "import sys, json\n"
                "def num_islands(grid):\n"
                "    return 0\n\n"
                "grid = json.loads(sys.stdin.read())\n"
                "print(num_islands(grid))\n"
            ),
            "javascript": (
                "const grid = JSON.parse(require('fs').readFileSync(0,'utf8'));\n"
                "function numIslands(grid) { return 0; }\n"
                "console.log(numIslands(grid));\n"
            ),
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
}


# Piston language identifiers
PISTON_LANGUAGE_VERSIONS: dict[str, dict] = {
    "python":     {"language": "python",     "version": "3.10.0"},
    "javascript": {"language": "javascript", "version": "18.15.0"},
}

# Topic → list of problem IDs ordered by difficulty
TOPIC_PROBLEMS: dict[str, list[str]] = {
    "arrays":         ["contains_duplicate", "best_time_stock", "two_sum", "product_except_self", "max_subarray"],
    "strings":        ["valid_palindrome", "valid_anagram"],
    "hashing":        ["two_sum", "valid_anagram", "contains_duplicate"],
    "sliding_window": ["best_time_stock", "longest_substring"],
    "prefix_sum":     ["product_except_self"],
    "binary_search":  ["binary_search_basic"],
    "stack":          ["valid_parentheses"],
    "dp_intro":       ["climbing_stairs"],
    "dp_1d":          ["climbing_stairs", "house_robber", "coin_change"],
    "graph_basics":   ["number_of_islands"],
    "bfs":            ["number_of_islands"],
    "dfs":            ["number_of_islands"],
    "two_pointers":   ["valid_palindrome"],
}


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
    # Target difficulty based on mastery
    if mastery < 0.35:
        target = "easy"
    elif mastery < 0.65:
        target = {"easy", "medium"}
    else:
        target = {"medium", "hard"}

    unsolved = [pid for pid in candidates if pid not in solved_ids]
    if not unsolved:
        unsolved = candidates  # repeat if exhausted

    # Prefer difficulty-matched
    difficulty_matched = [
        pid for pid in unsolved
        if CODING_PROBLEMS[pid]["difficulty"] in (target if isinstance(target, set) else {target})
    ]
    if difficulty_matched:
        return CODING_PROBLEMS[difficulty_matched[0]]
    # Fallback to any unsolved
    if unsolved:
        return CODING_PROBLEMS[unsolved[0]]
    return None
