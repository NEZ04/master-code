// Starter problems, so a fresh install has something to solve.
export const SEED_PROBLEMS = [
  {
    slug: "sum-of-two",
    title: "Sum of Two Numbers",
    difficulty: "Easy",
    statement:
      "Read two integers a and b on one line and print a + b.\n\nConstraints: -10^18 <= a, b <= 10^18 (watch out for overflow in C++).",
    samples: [
      { input: "1 2\n", output: "3\n" },
      { input: "-5 5\n", output: "0\n" },
    ],
    tests: [
      { input: "1 2\n", output: "3\n" },
      { input: "1000000000 1000000000\n", output: "2000000000\n" },
      { input: "-1000000000000000000 999999999999999999\n", output: "-1\n" },
    ],
  },
  {
    slug: "reverse-words",
    title: "Reverse the Words",
    difficulty: "Easy",
    statement: "Given a line of words separated by single spaces, print the words in reverse order.",
    samples: [{ input: "hello world\n", output: "world hello\n" }],
    tests: [
      { input: "hello world\n", output: "world hello\n" },
      { input: "one\n", output: "one\n" },
      { input: "a b c d e\n", output: "e d c b a\n" },
    ],
  },
  {
    slug: "max-subarray",
    title: "Maximum Subarray Sum",
    difficulty: "Medium",
    statement:
      "The first line has n (1 <= n <= 200000). The second line has n integers (|a_i| <= 10^4).\nPrint the largest sum of a non-empty contiguous subarray.\n\nAn O(n^2) solution will time out on the largest test.",
    samples: [
      { input: "9\n-2 1 -3 4 -1 2 1 -5 4\n", output: "6\n" },
      { input: "3\n-3 -1 -2\n", output: "-1\n" },
    ],
    tests: [
      { input: "9\n-2 1 -3 4 -1 2 1 -5 4\n", output: "6\n" },
      { input: "3\n-3 -1 -2\n", output: "-1\n" },
      { input: "1\n5\n", output: "5\n" },
      {
        input: `200000\n${Array.from({ length: 200000 }, (_, i) => (i % 7 === 0 ? -3 : 2)).join(" ")}\n`,
        output: `${(() => {
          let best = -Infinity, cur = 0;
          for (let i = 0; i < 200000; i++) {
            const v = i % 7 === 0 ? -3 : 2;
            cur = Math.max(v, cur + v);
            best = Math.max(best, cur);
          }
          return best;
        })()}\n`,
      },
    ],
    timeLimitMs: 2000,
  },
  {
    slug: "balanced-brackets",
    title: "Balanced Brackets",
    difficulty: "Medium",
    statement: "Given a string of the characters ()[]{}, print YES if the brackets are balanced and NO otherwise.",
    samples: [
      { input: "([]{})\n", output: "YES\n" },
      { input: "(]\n", output: "NO\n" },
    ],
    tests: [
      { input: "([]{})\n", output: "YES\n" },
      { input: "(]\n", output: "NO\n" },
      { input: "((((\n", output: "NO\n" },
      { input: "{[()()]}\n", output: "YES\n" },
      { input: "))\n", output: "NO\n" },
    ],
  },
];
